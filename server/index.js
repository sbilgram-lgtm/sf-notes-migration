const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const jsforce = require('jsforce');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
}
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: isProduction,
    maxAge: 3600000,
    sameSite: 'lax'
  },
  proxy: isProduction
}));

if (isProduction) {
  app.set('trust proxy', 1);
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (isProduction) return `${req.protocol}://${req.get('host')}`;
  return 'http://localhost:3000';
}

function getCallbackUrl(req) {
  if (process.env.SF_CALLBACK_URL) return process.env.SF_CALLBACK_URL;
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/auth/callback`;
}

function getConnection(req) {
  return new jsforce.Connection({
    accessToken: req.session.accessToken,
    instanceUrl: req.session.instanceUrl
  });
}

function safeQuery(conn, soql) {
  return new Promise((resolve, reject) => {
    conn.query(soql, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

app.get('/auth/login', (req, res) => {
  const loginUrl = (req.query.loginUrl || 'https://login.salesforce.com').replace(/\/$/, '');
  const clientId = req.query.clientId;
  const clientSecret = req.query.clientSecret;

  if (!clientId || !clientSecret) {
    return res.redirect(`${getBaseUrl(req)}/login?error=missing_credentials`);
  }

  req.session.loginUrl = loginUrl;
  req.session.clientId = clientId;
  req.session.clientSecret = clientSecret;

  const oauth = new jsforce.OAuth2({ loginUrl, clientId, clientSecret, redirectUri: getCallbackUrl(req) });
  const authUrl = oauth.getAuthorizationUrl({ scope: 'api refresh_token' });

  req.session.save(err => {
    if (err) return res.redirect(`${getBaseUrl(req)}/login?error=session_error`);
    res.redirect(authUrl);
  });
});

app.get('/auth/callback', async (req, res) => {
  const loginUrl = req.session.loginUrl || 'https://login.salesforce.com';
  const clientId = req.session.clientId;
  const clientSecret = req.session.clientSecret;

  const oauth = new jsforce.OAuth2({ loginUrl, clientId, clientSecret, redirectUri: getCallbackUrl(req) });
  const conn = new jsforce.Connection({ oauth2: oauth });

  try {
    await conn.authorize(req.query.code);
    req.session.accessToken = conn.accessToken;
    req.session.instanceUrl = conn.instanceUrl;
    req.session.refreshToken = conn.refreshToken;

    try {
      await new Promise((resolve) => {
        conn.query(
          "SELECT Id, Name, OrganizationType, IsSandbox, InstanceName FROM Organization LIMIT 1",
          (err, result) => {
            if (!err && result.records && result.records.length > 0) {
              const org = result.records[0];
              req.session.orgId = org.Id;
              req.session.orgName = org.Name;
              req.session.orgType = org.OrganizationType;
              req.session.isSandbox = org.IsSandbox;
              req.session.instanceName = org.InstanceName;
            }
            resolve(null);
          }
        );
      });
    } catch (e) { /* non-fatal */ }

    req.session.save(err => {
      if (err) return res.redirect(`${getBaseUrl(req)}/login?error=auth_failed`);
      res.redirect(`${getBaseUrl(req)}/dashboard`);
    });
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect(`${getBaseUrl(req)}/login?error=auth_failed`);
  }
});

app.get('/auth/status', (req, res) => {
  res.json({
    authenticated: !!(req.session.accessToken && req.session.instanceUrl),
    instanceUrl: req.session.instanceUrl || null,
    orgId: req.session.orgId || null,
    orgName: req.session.orgName || null,
    orgType: req.session.orgType || null,
    isSandbox: req.session.isSandbox || false,
    instanceName: req.session.instanceName || null
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── Assessment endpoints ──────────────────────────────────────────────────────

app.get('/api/assess/notes', async (req, res) => {
  if (!req.session.accessToken) return res.status(401).json({ error: 'Not authenticated' });
  const conn = getConnection(req);
  try {
    const countResult = await safeQuery(conn, 'SELECT COUNT() FROM Note');
    const total = countResult.totalSize;

    // Sample ParentIds to build object type breakdown
    const byParent = await safeQuery(conn, 'SELECT ParentId FROM Note LIMIT 2000');

    // Private notes count
    const privateResult = await safeQuery(conn, 'SELECT COUNT() FROM Note WHERE IsPrivate = true');
    const privateCount = privateResult.totalSize;

    // Large notes — SOQL cannot filter by body length, so fetch a sample and count in JS
    // Body field is not reliably queryable by size in SOQL; we flag this as "unknown" unless
    // the org is small enough to sample
    let largeCount = 0;
    if (total <= 5000) {
      const bodyResult = await safeQuery(conn, 'SELECT Body FROM Note WHERE Body != null LIMIT 5000');
      largeCount = (bodyResult.records || []).filter(r => r.Body && r.Body.length > 32000).length;
    }

    // Aggregate by object prefix for parent type breakdown
    const parentBreakdown = {};
    (byParent.records || []).forEach(r => {
      const prefix = (r.ParentId || '').substring(0, 3);
      parentBreakdown[prefix] = (parentBreakdown[prefix] || 0) + (r.cnt || 1);
    });

    res.json({ total, privateCount, largeCount, parentBreakdown });
  } catch (err) {
    console.error('Notes assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assess/attachments', async (req, res) => {
  if (!req.session.accessToken) return res.status(401).json({ error: 'Not authenticated' });
  const conn = getConnection(req);
  try {
    const countResult = await safeQuery(conn, 'SELECT COUNT() FROM Attachment');
    const total = countResult.totalSize;

    // Total size in bytes
    const sizeResult = await safeQuery(conn, 'SELECT SUM(BodyLength) totalBytes FROM Attachment');
    const totalBytes = sizeResult.records[0] ? (sizeResult.records[0].totalBytes || 0) : 0;

    // Large attachments > 25MB (REST API limit)
    const largeResult = await safeQuery(conn, 'SELECT COUNT() FROM Attachment WHERE BodyLength > 26214400');
    const largeCount = largeResult.totalSize;

    // Breakdown by parent object prefix
    const byParent = await safeQuery(conn,
      'SELECT ParentId FROM Attachment LIMIT 2000'
    );
    const parentBreakdown = {};
    (byParent.records || []).forEach(r => {
      const prefix = (r.ParentId || '').substring(0, 3);
      parentBreakdown[prefix] = (parentBreakdown[prefix] || 0) + 1;
    });

    res.json({ total, totalBytes, largeCount, parentBreakdown });
  } catch (err) {
    console.error('Attachments assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assess/files', async (req, res) => {
  if (!req.session.accessToken) return res.status(401).json({ error: 'Not authenticated' });
  const conn = getConnection(req);
  try {
    const countResult = await safeQuery(conn, 'SELECT COUNT() FROM ContentDocument');
    const total = countResult.totalSize;

    const sizeResult = await safeQuery(conn, 'SELECT SUM(ContentSize) totalBytes FROM ContentVersion WHERE IsLatest = true');
    const totalBytes = sizeResult.records[0] ? (sizeResult.records[0].totalBytes || 0) : 0;

    res.json({ total, totalBytes });
  } catch (err) {
    console.error('Files assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assess/limits', async (req, res) => {
  if (!req.session.accessToken) return res.status(401).json({ error: 'Not authenticated' });
  const conn = getConnection(req);
  try {
    const limitsUrl = `${req.session.instanceUrl}/services/data/v59.0/limits`;
    const response = await fetch(limitsUrl, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    const limits = await response.json();

    const storage = limits.DataStorageMB || {};
    const fileStorage = limits.FileStorageMB || {};
    const apiRequests = limits.DailyApiRequests || {};

    res.json({
      dataStorageUsedMB: storage.Max - storage.Remaining,
      dataStorageMaxMB: storage.Max,
      fileStorageUsedMB: fileStorage.Max - fileStorage.Remaining,
      fileStorageMaxMB: fileStorage.Max,
      apiRequestsUsed: apiRequests.Max - apiRequests.Remaining,
      apiRequestsMax: apiRequests.Max,
      apiRequestsRemaining: apiRequests.Remaining
    });
  } catch (err) {
    console.error('Limits error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Serve React in production ─────────────────────────────────────────────────

if (isProduction) {
  app.use(express.static(path.join(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
