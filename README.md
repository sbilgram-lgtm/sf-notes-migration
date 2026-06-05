# SF Notes & Attachments — Phase 1 Inventory & Assessment
*By Steven Bilgram*

A web app that connects to any Salesforce org and produces a full inventory of legacy Notes and Attachments — counts, sizes, flags, and breakdown by object type. All checks are **read-only**. Nothing is written to or deleted from your org.

---

## Data & Privacy

All metadata is **ephemeral** — nothing is written to a database or stored server-side beyond your active session:

| Data | Where it lives | Lifetime |
|---|---|---|
| OAuth tokens | Server memory (express-session) | 1 hour |
| Assessment results | Browser tab (React state) | Until page refresh |
| Credentials (if remembered) | Browser localStorage | Until you clear it |
| Exported files (PDF / Excel) | Your local Downloads folder | Permanent |

Nothing is written back to Salesforce. No external database is used.

---

## Using the hosted app

> **https://sf-notes-migration.onrender.com**

> Note: The app is hosted on Render's free tier and may take ~30 seconds to load after a period of inactivity.

---

## Setup: Registering the app in Salesforce (per org)

Do this once per Salesforce org you want to assess. Takes about 5 minutes.

### How to tell which setup your org uses

- **External Client App** — newer orgs (Spring '25+). Go to Setup and search **"External Client Apps"**. If it appears in the menu, use Option A.
- **Connected App** — older orgs. Go to Setup → **App Manager**. If you see a **"New Connected App"** button, use Option B.

---

### Option A — External Client App (newer orgs, Spring '25+)

1. Log in as an Administrator → **Setup → External Client Apps → New**
2. Fill in:
   - **Label:** SF Notes Migration Assessment
   - **API Name:** SF_Notes_Migration_Assessment
   - **Contact Email:** your email
3. Under **OAuth Settings**, check **Enable OAuth**
4. Set **Callback URL** to:
   ```
   https://sf-notes-migration.onrender.com/auth/callback
   ```
5. Under **OAuth Scopes**, add:
   - Manage user data via APIs (api)
   - Perform requests at any time (refresh_token, offline_access)
6. **Uncheck "Require Proof Key for Code Exchange (PKCE)"** if it appears — leave it disabled
7. Click **Save** — wait ~10 minutes for Salesforce to activate it
8. Go back to the External Client App → **View Consumer Details** to retrieve:
   - **Consumer Key** → this is your Client ID
   - **Consumer Secret** → this is your Client Secret

---

### Option B — Connected App (older orgs)

1. Log in as an Administrator → **Setup → App Manager → New Connected App**
2. Fill in:
   - **Connected App Name:** SF Notes Migration Assessment
   - **API Name:** SF_Notes_Migration_Assessment
   - **Contact Email:** your email
3. Check **Enable OAuth Settings**
4. Set **Callback URL** to:
   ```
   https://sf-notes-migration.onrender.com/auth/callback
   ```
5. Under **Selected OAuth Scopes**, add:
   - Manage user data via APIs (api)
   - Perform requests at any time (refresh_token, offline_access)
6. **Uncheck "Require Proof Key for Code Exchange (PKCE)"** — this must be disabled
7. Click **Save** — wait ~10 minutes for Salesforce to activate the Connected App
8. Go back to the Connected App and click **Manage Consumer Details** to retrieve:
   - **Consumer Key** → this is your Client ID
   - **Consumer Secret** → this is your Client Secret

### Set Permitted Users

1. In App Manager, find your app → dropdown arrow → **Manage**
2. Click **Edit Policies**
3. Set **Permitted Users** to `All users may self-authorize`
4. Click **Save**

> **Important:** If you see a `redirect_uri_mismatch` error, the Callback URL doesn't match. Update it to exactly `https://sf-notes-migration.onrender.com/auth/callback`, save, and wait ~10 minutes.
>
> **Important:** If you see a `missing required code challenge` error, PKCE is still enabled. Go back into Setup and uncheck "Require Proof Key for Code Exchange (PKCE)", then save and retry.

### Permissions required

The user who authenticates must have:
- **API Enabled** on their profile
- **View Setup and Configuration**
- System Administrator profile gives all of the above

### Org URL format

| Org Type | Example URL |
|---|---|
| Production | `https://yourorg.my.salesforce.com` |
| Sandbox | `https://yourorg--sandboxname.sandbox.my.salesforce.com` |
| Trailhead Playground | `https://yourorg-dev-ed.trailblaze.my.salesforce.com` |

> Do **not** use `.lightning.force.com` URLs — use the My Domain URL format above.

---

## Running an assessment

1. Open **https://sf-notes-migration.onrender.com**
2. Enter your org credentials:
   - **Org URL** — your org's My Domain URL
   - **Client ID** — Consumer Key from setup above
   - **Client Secret** — Consumer Secret from setup above
3. Click **Connect to Salesforce**, log in, and click **Allow**
4. Click **Run Assessment** — all five sections run in parallel
5. Once complete, click **Preview & Export** to view the full report and export:
   - **Save / Print PDF** — opens browser print dialog, choose "Save as PDF"
   - **Export Excel** — downloads a `.xlsx` workbook with one tab per section

---

## What the app checks

All checks are read-only. No changes are made to your org.

### Legacy Notes
- Total count of legacy Notes
- Count of Private Notes (require special handling before any future migration)
- Count of Notes with body exceeding 32KB (ContentNote size limit)
- Breakdown by parent object type (Account, Contact, Case, Opportunity, etc.)

### Legacy Attachments
- Total count of legacy Attachments
- Total combined size of all Attachments
- Count of Attachments exceeding 25MB (cannot be migrated via standard Salesforce REST API)
- Breakdown by parent object type

### Modern Salesforce Files (Baseline)
- Total count of existing ContentDocuments (modern Files already in the org)
- Total storage consumed by modern Files

### Org Limits
- File Storage — used vs. total available (visual bar, flagged at 65% and 85%)
- Data Storage — used vs. total available
- API Requests remaining for the day vs. daily limit

### Creation Controls
- Whether the org-level setting still allows new legacy Notes to be created
- Whether the org-level setting still allows new legacy Attachments to be created
- Every Profile that still grants Create permission on Notes or Attachments
- Every Permission Set that still grants Create permission on Notes or Attachments

---

## Running locally (development)

### Prerequisites
- Node.js 18+
- A Salesforce Connected App or External Client App with callback URL `http://localhost:3000/auth/callback`

### Steps

```bash
git clone https://github.com/sbilgram-lgtm/sf-notes-migration
cd sf-notes-migration
npm install
npm run dev
```

Open http://localhost:3000

Create a `.env` file in the project root:

```
SESSION_SECRET=any-random-string
# SF_CALLBACK_URL=http://localhost:3000/auth/callback
```

---

## Deploying your own instance to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo — Render will detect `render.yaml` automatically
4. Add environment variables:
   - `SESSION_SECRET` = any long random string (or let Render auto-generate it)
   - `NODE_ENV` = `production`
   - `NPM_CONFIG_PRODUCTION` = `false`
5. Click **Deploy**
6. Once live, update your Connected App's callback URL to `https://your-render-url.onrender.com/auth/callback`

---

## Roadmap

- **Phase 2 — Migration:** Batch migration of Notes → ContentNote and Attachments → ContentVersion with resume capability (SQLite), Private Notes handling, and Chatter flood suppression
- **Phase 3 — Cleanup:** Optional deletion of originals post-verification with full audit log export
