# Google OAuth Setup for MyKeys.zip

This guide explains how to set up Google OAuth for UI security in MyKeys.zip.

## Overview

Google OAuth adds an extra layer of security to admin pages by:
1. Requiring users to sign in with Google
2. Verifying that the Google-authenticated email matches the MCP token's email
3. Ensuring only users with owner/architect roles can access admin endpoints

## Setup Steps

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Configure the OAuth consent screen if prompted:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in app name: "MyKeys.zip"
   - Add your email as a test user
   - Add scopes: `email`, `profile`
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: "MyKeys.zip Web Client"
   - Authorized redirect URIs:
     - `https://mykeys.zip/oauth2callback` (Production)
     - `http://localhost:5173/oauth2callback` (Local development)
     - `https://zip-myl-mykeys-api-*.vercel.app/oauth2callback` (Preview deployments - optional)

### 2. Set Environment Variables

Add these environment variables to Vercel:

**Production:**
- `GOOGLE_OAUTH_CLIENT_ID` - Your OAuth Client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` - Your OAuth Client Secret
- `GOOGLE_OAUTH_REDIRECT_URI` - `https://mykeys.zip/oauth2callback` (optional, auto-detected)

**Preview/Development:**
- `GOOGLE_OAUTH_CLIENT_ID` - Same Client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` - Same Client Secret
- `GOOGLE_OAUTH_REDIRECT_URI` - `http://localhost:5173/oauth2callback` (for local dev)

### 3. Verify Setup

1. Visit `https://mykeys.zip/role-management.html`
2. Click "Sign in with Google"
3. Complete Google authentication
4. Enter your MCP token
5. System verifies:
   - Google email matches token email
   - User has owner/architect role
   - Access granted if both checks pass

## Security Flow

```
User → Google Sign-In → Verify Email → Enter MCP Token → Verify Token Email Matches Google Email → Check Role → Grant Access
```

## Fallback Behavior

If Google OAuth is not configured:
- System falls back to direct token entry
- Users can still authenticate with just their MCP token
- Admin role checks still apply

## Admin Access

Only users with `owner` or `architect` roles can access admin pages:
- `bcherrman@gmail.com` is automatically set as owner, architect, and member
- Other users must be granted owner/architect roles via the role management interface

## Troubleshooting

### "Google OAuth not configured"
- Check that `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are set in Vercel
- Verify environment variables are set for the correct environment (Production/Preview/Development)

### "Email mismatch"
- Ensure the Google account email matches the email used to generate the MCP token
- Generate a new token with the correct email if needed

### "Insufficient permissions"
- User must have `owner` or `architect` role
- Contact an admin to grant the appropriate role

### Redirect URI mismatch
- Ensure the redirect URI in Google Cloud Console matches exactly:
  - Production: `https://mykeys.zip/oauth2callback`
  - Local: `http://localhost:5173/oauth2callback`
- Check for trailing slashes or protocol mismatches

## API Endpoints

- `GET /api/auth/google/url` - Get OAuth authorization URL
- `POST /api/auth/google/verify` - Verify OAuth code or ID token
- `POST /api/auth/google/verify-token-match` - Verify Google email matches MCP token email

## Notes

- Google OAuth adds security but is optional
- System gracefully falls back to token-only authentication if OAuth is not configured
- All admin endpoints still require owner/architect roles regardless of authentication method

