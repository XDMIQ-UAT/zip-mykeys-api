# Local Development Setup

## Local Dev Revolution

**`.env.local` contains your partial password** - a partial of the admin password for mykeys.zip seed token generator!

### Architecture

```
.env.local (MYKEYS_PASS = partial password)
    ↓
Verify partial password → Get architect code
    ↓
Use architect code → Generate token
    ↓
Use token → Fetch credentials (SES, Twilio, etc.)
    ↓
Use in application
```

### 1. Create `.env.local` file

```bash
# .env.local
# Partial password for mykeys.zip seed token generator
# This is a partial (4+ characters) of the admin password for mykeys.zip
MYKEYS_PASS=your-partial-password

# Optional: Override API endpoint
MYKEYS_URL=https://mykeys.zip
MYKEYS_USER=admin
```

### 2. Get your partial password

The `MYKEYS_PASS` in `.env.local` should be a **partial password** - any 4+ character substring of the admin password for mykeys.zip.

For example, if the admin password is `riddle-squiggle@#$34alkdjf`, your partial could be:
- `riddle`
- `squiggle`
- `@#$34`
- Any 4+ character substring

### 3. Run the server

```bash
npm start
# or
node server.js
```

The server will:
1. ✅ Load `.env.local` (your MYKEYS_PASS partial password)
2. ✅ Verify partial password → Get architect code
3. ✅ Generate token using architect code
4. ✅ Fetch all credentials (SES, Twilio) from mykeys.zip API using token
5. ✅ Use credentials in the application

## How It Works

### Local Dev Flow

1. **`.env.local`** contains `MYKEYS_PASS` (your local dev password/seed)
2. **Server authenticates** to mykeys.zip API using MYKEYS_PASS
3. **mykeys.zip API** provides credentials (SES, Twilio, etc.)
4. **Server uses** credentials from mykeys.zip API

### Authorization via yourl.cloud

The MYKEYS_PASS in `.env.local` is used for authorization via yourl.cloud simple code flow. This enables:
- ✅ Local dev revolution - all credentials from mykeys.zip API
- ✅ Centralized credential management
- ✅ Simple authorization flow
- ✅ No need to manage individual service credentials locally

## Getting Your Local Dev Password/Seed

### Option 1: Use yourl.cloud Token Generator

1. Go to yourl.cloud token generator
2. Generate/get your local dev password/seed
3. Add to `.env.local` as `MYKEYS_PASS`

### Option 2: Use Existing mykeys.zip Password

If you already have a mykeys.zip password, use that as `MYKEYS_PASS` in `.env.local`.

## Example `.env.local`

```bash
# Your local dev password/seed for mykeys.zip API authorization
MYKEYS_PASS=your-local-dev-password-seed-from-yourl-cloud

# Optional: Override defaults
MYKEYS_URL=https://mykeys.zip
MYKEYS_USER=admin
```

## Storing Credentials in mykeys.zip API

Once you have MYKEYS_PASS set up, store your service credentials in mykeys.zip API:

### Store SES Credentials

```bash
curl -u admin:$MYKEYS_PASS -X POST https://mykeys.zip/api/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ses-credentials",
    "value": "{\"smtp_username\":\"...\",\"smtp_password\":\"...\",\"region\":\"us-east-1\"}"
  }'
```

### Store Twilio Credentials

```bash
curl -u admin:$MYKEYS_PASS -X POST https://mykeys.zip/api/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "twilio-credentials",
    "value": "{\"account_sid\":\"...\",\"auth_token\":\"...\",\"phone_number\":\"...\"}"
  }'
```

## Testing

Once `.env.local` is set up, test email verification:

```bash
node mfa-cli.js
# Choose option 2 (Email)
# Enter your email address
```

The server will use your `.env.local` credentials automatically!

## Notes

- `.env.local` is gitignored (never commit it!)
- Use `.env.local.example` as a template (if it exists)
- No MYKEYS_PASS needed for local dev
- Credentials are loaded automatically via dotenv

