# MyKeys CLI MFA Guide

## Overview

The MyKeys CLI now supports Multi-Factor Authentication (MFA) via SMS or Email, eliminating the need for web pages. You can generate tokens entirely from the command line.

## Commands

### `mykeys admin`
Shows admin information. If no token is found, prompts for email authentication.

**Usage:**
```bash
mykeys admin
```

**Flow (when no token exists):**
1. Enter your email address
2. Receive 4-digit verification code via email
3. Enter the 4-digit code
4. View admin information

**Requirements:**
- ProtonMail SMTP configured for email delivery
- Internet connection for API access

### `mykeys generate-token`
Generates a new MCP token using MFA (SMS or Email).

**Usage:**
```bash
mykeys generate-token
```

**Flow:**
1. Enter partial password (architect password)
2. Choose verification method (SMS or Email)
3. Enter phone number or email address
4. Receive verification code
5. Enter verification code
6. Provide client details (ID, type, expiration)
7. Token is generated and saved automatically

## Setup

### Prerequisites
- Node.js 18+ installed
- Twilio credentials configured in `mykeys.zip` (for SMS)
- Amazon SES credentials configured in `mykeys.zip` (for Email)

### Installation
The CLI is already available via npm scripts:
```bash
npm run cli generate-token
```

Or directly:
```bash
node mykeys-cli.js generate-token
```

## Token Storage

Generated tokens are automatically saved to:
- **Windows:** `%USERPROFILE%\.mykeys\token`
- **Linux/Mac:** `~/.mykeys/token`

The token is also available via environment variables:
- `MCP_TOKEN`
- `MYKEYS_TOKEN`

## Example Flows

### Admin Authentication via Email

```bash
$ mykeys admin

╔════════════════════════════════════════╗
║     MyKeys Admin Authentication     ║
╚════════════════════════════════════════╝

No token found. Authenticate via email:

Enter your email address: [email protected]

Sending 4-digit verification code to your email...
✓ 4-digit code sent to [email protected]

Enter 4-digit verification code: 1234

Verifying code...
✓ Authenticated successfully

╔════════════════════════════════════════╗
║        MyKeys Admin Info           ║
╚════════════════════════════════════════╝

Role: architect
Context: token-based

Token Information:
  Client ID: admin-1234567890
  Client Type: admin-cli
  Expires: 11/30/2025 (1 days)

Permissions:
  ✓ read_secrets
  ✓ write_secrets
  ✓ list_secrets
  ✓ manage_tokens
  ✓ architect_access
  ✓ full_system_access
```

### Token Generation Flow

```bash
$ mykeys generate-token

╔════════════════════════════════════════╗
║     MyKeys Token Generator (MFA)      ║
╚════════════════════════════════════════╝

Enter partial password: ********
✓ Partial password verified

Choose verification method:
  1. SMS (phone number)
  2. Email
Enter choice (1 or 2): 1
Enter phone number (E.164 format, e.g., +1234567890): +16269959974

Sending verification code to SMS...
✓ Verification code sent to +16269959974

Enter verification code: 123456
Enter client ID (e.g., cursor-mcp): cursor-mcp
Enter client type (default: generic): generic
Enter expiration in days (default: 90): 90

Verifying code and generating token...

╔════════════════════════════════════════╗
║      Token Generated Successfully!     ║
╚════════════════════════════════════════╝

Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Expires: 2/28/2026, 10:30:00 AM

✓ Token saved to: C:\Users\username\.mykeys\token

You can now use:
  mykeys admin
```

## API Endpoints

The CLI uses the following API endpoints:

1. **`POST /api/auth/verify-partial`**
   - Verifies partial password
   - Returns architect code

2. **`POST /api/auth/request-mfa-code`**
   - Requests MFA code via SMS or Email
   - Requires architect code

3. **`POST /api/auth/verify-mfa-code`**
   - Verifies MFA code
   - Generates and returns token

## Troubleshooting

### "No token found"
Generate a token first:
```bash
mykeys generate-token
```

### "Partial password does not match"
Ensure you're entering the correct partial password (minimum 4 characters).

### "Failed to send verification code"
- Check Twilio credentials are configured in `mykeys.zip`
- Verify phone number is in E.164 format (+1234567890)
- Check Amazon SES credentials for email delivery

### "Verification code expired"
Request a new code and try again (codes expire after 10 minutes).

### "Request timeout"
- Check network connectivity
- Verify `MYKEYS_URL` environment variable is correct
- Ensure the API server is running

## Security Notes

- Partial passwords are case-insensitive
- Verification codes expire after 10 minutes
- Architect codes are single-use
- Tokens are stored locally in plain text (protect your `.mykeys` directory)
- SMS codes use Twilio Verify API for enhanced security
- Email codes use Amazon SES for reliable delivery

## Environment Variables

- `MYKEYS_URL` - API URL (default: `https://mykeys.zip`)
- `MCP_TOKEN` - Authentication token
- `MYKEYS_TOKEN` - Alternative token environment variable






