# Credential Management Architecture

## Three-Tier Architecture

### Tier 1: Environment Variables (Bootstrap/Critical Infrastructure)
**Purpose:** Critical infrastructure credentials needed to bootstrap the system
- `MYKEYS_PASS` - Password to access mykeys.zip API
- `MYKEYS_USER` - Username for API access
- `MYKEYS_URL` - API endpoint
- Other critical infrastructure credentials

**Why Environment Variables?**
- Needed before the system can access mykeys.zip API
- Critical bootstrap credentials that unlock the vault
- Minimal set - only what's absolutely necessary

### Tier 2: mykeys.zip API (Application/Service Credentials)
**Purpose:** Application and service credentials managed centrally
- Twilio credentials (SMS)
- SES credentials (Email)
- Third-party API keys
- Service account credentials

**Why mykeys.zip API?**
- Centralized credential management
- Enables tiered, mesh credential management
- Supports distributed fragment storage
- Single source of truth for application credentials
- Easy rotation and audit trail

### Tier 3: Encrypted Content (Data/Content)
**Purpose:** Application data and content stored encrypted
- Session data
- Fragments
- User content
- Application state

**Why Encrypted Content?**
- Production-grade data storage
- Distributed fragment storage architecture
- Encrypted at rest and in transit
- Accessible via mykeys.zip API with proper authentication

## Architecture Flow

```
┌─────────────────────────────────────┐
│  Tier 1: Environment Variables      │
│  (Bootstrap/Critical Infrastructure)│
│  - MYKEYS_PASS                      │
│  - MYKEYS_USER                      │
│  - MYKEYS_URL                       │
└────────────┬─────────────────────────┘
             │
             │ Unlocks access to
             │
┌────────────▼─────────────────────────┐
│  Tier 2: mykeys.zip API              │
│  /api/secrets/:name                  │
│  (Application/Service Credentials)   │
│  - Twilio credentials               │
│  - SES credentials                  │
│  - Third-party API keys             │
└────────────┬─────────────────────────┘
             │
             │ Uses credentials to access
             │
┌────────────▼─────────────────────────┐
│  Tier 3: Encrypted Content          │
│  (Data/Content)                      │
│  - Session data                      │
│  - Fragments                        │
│  - User content                     │
│  - Application state                │
└─────────────────────────────────────┘
```

## Credential Retrieval Pattern

### Primary: mykeys.zip API

```javascript
// Get credentials from mykeys.zip API
const axios = require('axios');
const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
const MYKEYS_PASS = process.env.MYKEYS_PASS;

const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
const response = await axios.get(`${MYKEYS_URL}/api/secrets/twilio-credentials`, {
  headers: { 'Authorization': `Basic ${auth}` },
});

const credentials = JSON.parse(response.data.value);
```

### Fallback: Local GCP Secret Manager

Only for local development when mykeys.zip API is unavailable:

```javascript
const twilioSecret = await getSecretFromGCP('twilio-credentials');
const credentials = JSON.parse(twilioSecret);
```

## Setting Up Credentials

### 1. Store in mykeys.zip API

```bash
# Using curl
curl -u admin:$MYKEYS_PASS \
  -X POST https://mykeys.zip/api/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "twilio-credentials",
    "value": "{\"account_sid\":\"...\",\"auth_token\":\"...\"}"
  }'

# Using PowerShell
$body = @{
  name = "ses-credentials"
  value = '{"smtp_username":"...","smtp_password":"...","region":"us-east-1"}'
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mykeys.zip/api/secrets" `
  -Method POST `
  -Credential $credential `
  -Body $body `
  -ContentType "application/json"
```

### 2. Credentials Format

**Twilio Credentials:**
```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your-auth-token",
  "phone_number": "+1234567890",
  "verify_service_sid": "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**SES Credentials:**
```json
{
  "smtp_username": "AKIAIOSFODNN7EXAMPLE",
  "smtp_password": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "region": "us-east-1",
  "from_email": "noreply@mykeys.zip"
}
```

## Benefits of Centralized Architecture

1. **Single Source of Truth**: All credentials in one place
2. **Easy Rotation**: Rotate credentials once, all services get updated
3. **Audit Trail**: Centralized logging of credential access
4. **Distributed Access**: Services across the mesh can access credentials
5. **Fragment Storage**: Distributed fragments can retrieve credentials as needed
6. **Security**: Credentials never stored in code or environment variables
7. **Scalability**: Add new services without credential management overhead

## Migration from Environment Variables

If you currently have credentials in environment variables:

1. **Extract credentials** from environment variables
2. **Store in mykeys.zip API** using the API endpoints
3. **Remove environment variables** - they're no longer needed
4. **Update services** to fetch from mykeys.zip API

## Environment Variables (Tier 1: Bootstrap)

**Critical infrastructure credentials** needed to bootstrap the system:

```bash
MYKEYS_URL=https://mykeys.zip          # API endpoint
MYKEYS_USER=admin                      # API username
MYKEYS_PASS=your-password              # API password (critical bootstrap credential)
```

**These are the "keys to the vault"** - minimal set needed to access mykeys.zip API.

**Application/service credentials** (Twilio, SES, etc.) come from Tier 2 (mykeys.zip API), **NOT** environment variables.

## Troubleshooting

### "Could not fetch credentials from mykeys.zip API"

1. Check `MYKEYS_URL`, `MYKEYS_USER`, `MYKEYS_PASS` are set correctly
2. Verify credentials exist: `curl -u admin:$MYKEYS_PASS https://mykeys.zip/api/secrets/twilio-credentials`
3. Check network connectivity to mykeys.zip
4. Falls back to local GCP Secret Manager automatically

### "Credentials not found"

1. Ensure credentials are stored in mykeys.zip API
2. Check secret name matches exactly (e.g., `twilio-credentials`, `ses-credentials`)
3. Verify API authentication works

## Architecture Compliance

✅ **DO:**
- **Tier 1:** Use environment variables ONLY for critical bootstrap credentials (MYKEYS_PASS, etc.)
- **Tier 2:** Fetch application credentials from mykeys.zip API
- **Tier 3:** Store data/content as encrypted content (distributed fragment storage)
- Use centralized credential management for application credentials
- Enable distributed fragment storage for data/content

❌ **DON'T:**
- Store application credentials (Twilio, SES) in environment variables
- Hardcode credentials in code
- Scatter credentials across deployments
- Mix tiers (bootstrap credentials vs application credentials vs data)

