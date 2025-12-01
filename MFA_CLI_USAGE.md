# MFA CLI Usage Guide

**Date:** November 28, 2025  
**Status:** ✅ **READY TO USE**

---

## Overview

The MFA CLI tool (`mfa-cli.js`) provides a simple command-line interface for generating MyKeys tokens using Multi-Factor Authentication via:

- **SMS** (Twilio) - Phone number verification
- **Email** (Amazon SES) - Email address verification

---

## Quick Start

### Interactive Mode (Recommended)

```bash
node mfa-cli.js
```

This will guide you through:
1. Choosing SMS or Email
2. Entering phone number or email
3. Receiving verification code
4. Entering verification code
5. Generating and saving token

### Command Line Arguments

```bash
# SMS Mode
node mfa-cli.js --method sms --phone +12132484250

# Email Mode
node mfa-cli.js --method email --email user@example.com
```

---

## Examples

### Example 1: SMS Verification

```bash
$ node mfa-cli.js

╔════════════════════════════════════════╗
║     MyKeys MFA Token Generator         ║
╚════════════════════════════════════════╝

API URL: https://mykeys.zip

Choose verification method:
  1. SMS (Twilio) - Phone number
  2. Email (Amazon SES) - Email address

Enter choice (1 or 2): 1

Phone Number Formats:
  • +12132484250 (E.164 with country code)
  • 12132484250 (11 digits with US country code)
  • 213-248-4250 (10 digits, US number)

Enter phone number: +12132484250
✓ Normalized: +12132484250

📤 Requesting verification code...
✓ Verification code sent to +12132484250
  Method: SMS
  Expires in: 600 seconds

Enter verification code: 1234

Enter client ID (default: cli-hostname): cursor-mcp
Enter client type (default: generic): generic
Enter expiration in days (default: 90): 90

🔐 Verifying code and generating token...

╔════════════════════════════════════════╗
║      Token Generated Successfully!     ║
╚════════════════════════════════════════╝

Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Expires: 2/28/2026, 10:30:00 AM
Client ID: cursor-mcp
Client Type: generic

✓ Token saved to: C:\Users\username\.mykeys\token

You can now use:
  • Set environment variable: export MCP_TOKEN="..."
  • Use in scripts: node mykeys-cli.js admin
```

### Example 2: Email Verification

```bash
$ node mfa-cli.js --method email --email user@example.com

╔════════════════════════════════════════╗
║     MyKeys MFA Token Generator         ║
╚════════════════════════════════════════╝

API URL: https://mykeys.zip

✓ Email: user@example.com

📤 Requesting verification code...
✓ Verification code sent to user@example.com
  Method: EMAIL
  Expires in: 600 seconds

Enter verification code: 5678
...
```

---

## Phone Number Formats

The CLI accepts multiple phone number formats and automatically normalizes them to E.164:

- `+12132484250` - E.164 format (recommended)
- `12132484250` - 11 digits with US country code
- `213-248-4250` - 10 digits, US number (auto-adds +1)
- `(213) 248-4250` - Formatted US number

**International Numbers:**
- Must include country code
- Use E.164 format: `+[country code][number]`
- Example: `+442071234567` (UK), `+33123456789` (France)

---

## Prerequisites

### Backend Configuration

The MFA CLI requires the following to be configured in `mykeys.zip`:

#### For SMS (Twilio):
```json
{
  "account_sid": "ACxxxxx",
  "auth_token": "your-token",
  "phone_number": "+16269959974"
}
```

**Secret Name:** `twilio-credentials`

#### For Email (Amazon SES):
```json
{
  "smtp_username": "your-smtp-user",
  "smtp_password": "your-smtp-password",
  "region": "us-east-1",
  "from_email": "noreply@mykeys.zip"
}
```

**Secret Name:** `ses-credentials`

---

## API Endpoints Used

The CLI uses the following endpoints:

1. **`POST /api/auth/request-mfa-code`**
   - Requests verification code via SMS or Email
   - Body: `{ phoneNumber?: string, email?: string }`
   - Response: `{ success: true, method: 'sms'|'email', target: string, expiresIn: number }`

2. **`POST /api/auth/verify-mfa-code`**
   - Verifies code and generates token
   - Body: `{ phoneNumber?: string, email?: string, code: string, clientId: string, clientType: string, expiresInDays: number }`
   - Response: `{ success: true, token: string, expiresAt: string, clientId: string, clientType: string }`

---

## Token Storage

Generated tokens are automatically saved to:

- **Windows:** `%USERPROFILE%\.mykeys\token`
- **Linux/Mac:** `~/.mykeys/token`

The token file can be used by other MyKeys CLI tools.

---

## Environment Variables

- `MYKEYS_URL` - API URL (default: `https://mykeys.zip`)
- `MCP_TOKEN` - Token can be set manually (if not using saved file)

---

## Troubleshooting

### "Failed to send verification code"

**SMS Issues:**
- Check Twilio credentials are stored in `mykeys.zip` as `twilio-credentials`
- Verify phone number is in E.164 format
- Check Twilio account has SMS enabled
- Verify phone number is verified in Twilio (for trial accounts)

**Email Issues:**
- Check SES credentials are stored in `mykeys.zip` as `ses-credentials`
- Verify email address format
- Check SES domain/email is verified
- Check SES is out of sandbox mode (for production)

### "Verification code expired"

- Codes expire after 10 minutes
- Request a new code: run `mfa-cli.js` again
- Enter the new code when prompted

### "Invalid verification code"

- Double-check the code you entered
- Codes are 4 digits
- Make sure you're using the most recent code
- Request a new code if unsure

### "Request timeout"

- Check network connectivity
- Verify `MYKEYS_URL` is correct
- Ensure API server is running
- Check firewall/proxy settings

---

## Security Notes

- ✅ Verification codes expire after 10 minutes
- ✅ Codes are 4 digits (numeric only)
- ✅ Tokens are stored locally in plain text (protect your `.mykeys` directory)
- ✅ SMS uses Twilio Messages API
- ✅ Email uses Amazon SES SMTP
- ✅ No passwords required for MFA flow

---

## Comparison: MFA CLI vs Legacy CLI

| Feature | MFA CLI (`mfa-cli.js`) | Legacy CLI (`generate-token-cli.js`) |
|---------|------------------------|-------------------------------------|
| **Authentication** | MFA (SMS/Email) | Basic Auth (password) |
| **Security** | ✅ Higher (2FA) | ⚠️ Lower (password only) |
| **User Experience** | ✅ Interactive | ⚠️ Requires password |
| **Phone Support** | ✅ Yes (Twilio) | ❌ No |
| **Email Support** | ✅ Yes (SES) | ❌ No |
| **Token Storage** | ✅ Auto-save | ⚠️ Manual |

---

## Integration Examples

### PowerShell Script

```powershell
# Generate token via MFA
node mfa-cli.js --method email --email admin@example.com

# Use token
$token = Get-Content "$env:USERPROFILE\.mykeys\token"
$env:MCP_TOKEN = $token

# Verify token works
node mykeys-cli.js admin
```

### Bash Script

```bash
#!/bin/bash
# Generate token via MFA
node mfa-cli.js --method sms --phone +12132484250

# Use token
export MCP_TOKEN=$(cat ~/.mykeys/token)

# Verify token works
node mykeys-cli.js admin
```

---

## Related Documentation

- **CLI MFA Guide:** `CLI_MFA_GUIDE.md`
- **Device Registration:** `docs/DEVICE_REGISTRATION_IMPLEMENTATION.md`
- **Twilio Setup:** See Twilio documentation
- **SES Setup:** See Amazon SES documentation

---

**Last Updated:** November 28, 2025  
**Status:** ✅ Production Ready






