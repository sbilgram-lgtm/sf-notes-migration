import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'sf_notes_migration_creds';

export const LoginPage: React.FC = () => {
  const [loginUrl, setLoginUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errParam = params.get('error');
    if (errParam === 'auth_failed') setError('Authentication failed. Check your Client ID, Client Secret, and Callback URL.');
    if (errParam === 'missing_credentials') setError('Client ID and Client Secret are required.');
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { loginUrl: u, clientId: id, clientSecret: s } = JSON.parse(saved);
        if (u) setLoginUrl(u);
        if (id) setClientId(id);
        if (s) setClientSecret(s);
      }
    } catch {}
  }, []);

  const handleLogin = () => {
    if (!loginUrl.trim() || !clientId.trim() || !clientSecret.trim()) {
      setError('All three fields are required.');
      return;
    }
    let url = loginUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    url = url.replace(/\/$/, '');

    if (remember) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ loginUrl: url, clientId: clientId.trim(), clientSecret: clientSecret.trim() })); } catch {}
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    const params = new URLSearchParams({ loginUrl: url, clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    window.location.href = `/auth/login?${params.toString()}`;
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #dde1e7', fontSize: '0.9rem',
    boxSizing: 'border-box', marginTop: '6px', outline: 'none'
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', textAlign: 'left'
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', backgroundColor: '#f0f4f8' }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', padding: '48px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center',
        maxWidth: '460px', width: '100%'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📎</div>
        <h2 style={{ color: '#1a2f4e', marginBottom: '4px', fontSize: '1.3rem' }}>
          SF Notes &amp; Attachments
        </h2>
        <p style={{ color: '#7f8c8d', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
          Phase 1 — Inventory &amp; Assessment
        </p>
        <p style={{ color: '#95a5a6', marginBottom: '32px', fontSize: '0.8rem' }}>
          Connect to your Salesforce org to run a full legacy Notes &amp; Attachments inventory.
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fdf0ed', border: '1px solid #e74c3c', borderRadius: '6px',
            padding: '10px 14px', marginBottom: '20px', fontSize: '0.85rem',
            color: '#c0392b', textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '18px' }}>
          <label style={label}>
            Org URL
            <input
              type="text"
              placeholder="https://yourorg.sandbox.my.salesforce.com"
              value={loginUrl}
              onChange={e => { setLoginUrl(e.target.value); setError(''); }}
              style={field}
            />
          </label>
          <p style={{ fontSize: '0.72rem', color: '#aaa', textAlign: 'left', margin: '4px 0 0' }}>
            Use My Domain URL — e.g. https://company--uat.sandbox.my.salesforce.com
          </p>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={label}>
            Client ID (Consumer Key)
            <input
              type="text"
              placeholder="3MVG9..."
              value={clientId}
              onChange={e => { setClientId(e.target.value); setError(''); }}
              style={field}
            />
          </label>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={label}>
            Client Secret (Consumer Secret)
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={clientSecret}
              onChange={e => { setClientSecret(e.target.value); setError(''); }}
              style={field}
            />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
          <label htmlFor="remember" style={{ fontSize: '0.8rem', color: '#555', cursor: 'pointer' }}>
            Remember credentials on this device
          </label>
        </div>

        <button
          onClick={handleLogin}
          style={{
            backgroundColor: '#1a2f4e', color: 'white', border: 'none',
            padding: '14px 32px', borderRadius: '8px', fontSize: '1rem',
            fontWeight: 600, cursor: 'pointer', width: '100%'
          }}
          onMouseOver={e => (e.currentTarget.style.backgroundColor = '#243d63')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = '#1a2f4e')}
        >
          Connect to Salesforce
        </button>
      </div>
    </div>
  );
};
