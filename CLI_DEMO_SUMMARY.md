# MyKeys CLI Demo Summary 🎯

## CLI Overview

The MyKeys CLI provides a command-line interface for interacting with mykeys.zip API. It supports token-based authentication and MFA-protected token generation.

---

## Available Commands

### 1. Show Admin Info
```powershell
node mykeys-cli.js admin
```

**What it does:**
- Fetches your admin information from the API
- Shows your role, permissions, capabilities, and statistics
- Requires a valid token (MCP_TOKEN or MYKEYS_TOKEN environment variable, or saved in `~/.mykeys/token`)

**Example Output:**
```
╔════════════════════════════════════════╗
║        MyKeys Admin Info                ║
╚════════════════════════════════════════╝

Role: architect
Context: token-based

Token Information:
  Client ID: cli-dashpc
  Client Type: generic
  Expires: 2/26/2026 (90 days)

Permissions:
  ✓ read_secrets
  ✓ write_secrets
  ✓ list_secrets
  ✓ manage_tokens
  ✓ architect_access
  ✓ full_system_access

Capabilities:
  • API access
  • Secret management
  • Token generation
  • Architect-level operations
  • System administration

Statistics:
  Secrets: 15
  Ecosystems: 3

──────────────────────────────────────────
```

---

### 2. Generate Token (MFA Flow)
```powershell
node mykeys-cli.js generate-token
```

**What it does:**
- Interactive MFA-protected token generation
- Supports SMS or Email verification
- Saves token automatically to `~/.mykeys/token`
- Returns a bearer token for API access

**Flow:**
1. Choose verification method (SMS or Email)
2. Enter phone number or email address
3. Receive 4-digit verification code
4. Enter verification code
5. Optionally customize client ID, type, and expiration
6. Token is generated and saved

**Example Flow:**
```
╔════════════════════════════════════════╗
║     MyKeys Token Generator (MFA)        ║
╚════════════════════════════════════════╝

Choose verification method:
  1. SMS (phone number)
  2. Email (recommended for international users)

Enter choice (1 or 2): 2
Enter email address: user@example.com
Sending 4-digit verification code to email...
✓ 4-digit code sent to user@example.com

Enter 4-digit verification code: 1234
Enter client ID (default: cli-token): my-cli
Enter client type (default: generic): generic
Enter expiration in days (default: 90): 90

Verifying code and generating token...

╔════════════════════════════════════════╗
║      Token Generated Successfully!      ║
╚════════════════════════════════════════╝

Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Expires: 2/26/2026 12:00:00 PM

✓ Token saved to: C:\Users\dash\.mykeys\token

You can now use:
  mykeys admin
```

---

## Token Management

### Setting Token as Environment Variable
```powershell
# Option 1: MCP_TOKEN
$env:MCP_TOKEN = "your-token-here"

# Option 2: MYKEYS_TOKEN
$env:MYKEYS_TOKEN = "your-token-here"
```

### Saving Token to File
```powershell
# Create directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.mykeys"

# Save token
"your-token-here" | Out-File -FilePath "$env:USERPROFILE\.mykeys\token" -Encoding utf8
```

### Token Priority
The CLI checks for tokens in this order:
1. `MCP_TOKEN` environment variable
2. `MYKEYS_TOKEN` environment variable
3. `~/.mykeys/token` file

---

## Demo Scripts

### Quick Demo (Non-Interactive)
```powershell
.\scripts\demo-cli-quick.ps1
```

Shows:
- CLI commands available
- Usage examples
- Token status check
- Quick API test

### Interactive Demo
```powershell
.\scripts\demo-cli-interactive.ps1
```

Full walkthrough:
- CLI help
- Token status
- Token generation (optional)
- Admin info display
- API examples

---

## Common Use Cases

### 1. First-Time Setup
```powershell
# Generate your first token
node mykeys-cli.js generate-token

# Verify it works
node mykeys-cli.js admin
```

### 2. Check Your Access
```powershell
# Quick check of your permissions
node mykeys-cli.js admin
```

### 3. Generate Token for Different Client
```powershell
# Generate token with custom client ID
node mykeys-cli.js generate-token
# When prompted, enter custom client ID
```

### 4. Use Token in Scripts
```powershell
# Set token
$env:MCP_TOKEN = "your-token"

# Use in API calls
$headers = @{"Authorization" = "Bearer $env:MCP_TOKEN"}
Invoke-RestMethod -Uri "https://mykeys.zip/api/admin/info" -Headers $headers
```

---

## Troubleshooting

### "Invalid token" Error
**Causes:**
- Token expired
- Token revoked
- Token format incorrect

**Solutions:**
1. Generate a new token: `node mykeys-cli.js generate-token`
2. Verify token format (should be a JWT)
3. Check token expiration date

### "No token found" Error
**Causes:**
- Token not set in environment
- Token file doesn't exist
- Token file is empty

**Solutions:**
1. Set environment variable: `$env:MCP_TOKEN = "your-token"`
2. Save to file: `"token" | Out-File "$env:USERPROFILE\.mykeys\token"`
3. Generate new token: `node mykeys-cli.js generate-token`

### Network Errors
**Causes:**
- API server unreachable
- Firewall blocking connection
- Incorrect MYKEYS_URL

**Solutions:**
1. Check `MYKEYS_URL` environment variable (default: `https://mykeys.zip`)
2. Verify network connectivity
3. Check firewall settings

---

## API Integration Examples

### Using Token in PowerShell
```powershell
# Set token
$token = "your-token-here"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Get admin info
$adminInfo = Invoke-RestMethod -Uri "https://mykeys.zip/api/admin/info" -Headers $headers

# List secrets
$secrets = Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared" -Headers $headers

# Get a secret
$secret = Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/secret-name" -Headers $headers
```

### Using Token in Node.js
```javascript
const https = require('https');

const token = process.env.MCP_TOKEN;
const options = {
  hostname: 'mykeys.zip',
  path: '/api/admin/info',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(JSON.parse(data));
  });
});
```

---

## Features

✅ **Token-based authentication** - No passwords needed  
✅ **MFA protection** - SMS or Email verification  
✅ **Automatic token saving** - Saves to `~/.mykeys/token`  
✅ **Environment variable support** - Use `MCP_TOKEN` or `MYKEYS_TOKEN`  
✅ **Beautiful output** - Colorized, formatted display  
✅ **Error handling** - Clear error messages and troubleshooting  
✅ **Cross-platform** - Works on Windows, macOS, Linux  

---

## Next Steps

1. **Generate a token:**
   ```powershell
   node mykeys-cli.js generate-token
   ```

2. **View admin info:**
   ```powershell
   node mykeys-cli.js admin
   ```

3. **Use in your scripts:**
   - Set `$env:MCP_TOKEN` or save to `~/.mykeys/token`
   - Use Bearer token authentication in API calls

4. **Read the guide:**
   - See `CLI_DEMO_GUIDE.md` for detailed walkthrough
   - See `README.md` for API documentation

---

**Your token is your golden ticket!** 🎫✨




