# Vercel Environment Variables Summary

## Current Environment Variables

### ✅ Redis/KV Storage (Connected)
- `mykeys_KV_REST_API_URL` - Production, Preview, Development
- `mykeys_KV_REST_API_TOKEN` - Production, Preview, Development
- `mykeys_KV_REST_API_READ_ONLY_TOKEN` - Production, Preview, Development
- `mykeys_KV_URL` - Production, Preview, Development
- `mykeys_REDIS_URL` - Production, Preview, Development
- `UPSTASH_REDIS_REST_URL` - Production
- `UPSTASH_REDIS_REST_TOKEN` - Production

### ✅ AWS/SES Email
- `AWS_ACCESS_KEY_ID` - Production
- `AWS_SECRET_ACCESS_KEY` - Production
- `AWS_REGION` - Production
- `SES_SENDER_EMAIL` - Production

### ✅ Authentication
- `MYKEYS_PASS` - Production, Preview, Development

### ✅ GCP (Optional/Development)
- `GCP_PROJECT` - Production, Preview, Development
- `GOOGLE_APPLICATION_CREDENTIALS` - Production, Preview, Development

### ⚠️ ProtonMail (Preview only)
- `PROTONMAIL_USER` - Preview
- `PROTONMAIL_APP_PASSWORD` - Preview

## Credentials Storage Strategy

### Stored in KV (Redis) - Not Environment Variables
These credentials are stored in the KV database and accessed via the API:

- ✅ **SES Credentials** (`ses-credentials`)
  - Stored via: `node store-ses-credentials.js`
  - Contains: `smtp_username`, `smtp_password`, `region`, `from_email`

- ⏳ **Twilio Credentials** (`twilio-credentials`)
  - Store via: `node store-twilio-credentials.js`
  - Contains: `account_sid`, `auth_token`, `phone_number`, `verify_service_sid`

## Commands

### View All Environment Variables
```bash
vercel env ls
```

### Add Environment Variable
```bash
vercel env add VARIABLE_NAME production
# Then paste the value when prompted
```

### Remove Environment Variable
```bash
vercel env rm VARIABLE_NAME production
```

### Pull Environment Variables Locally
```bash
vercel env pull .env.local --environment=production
```

### View in Dashboard
https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables

## What's Missing?

### Twilio Credentials
Twilio credentials should be stored in KV, not as environment variables. Run:
```bash
node store-twilio-credentials.js
```

This will:
1. Authenticate using `MYKEYS_PASS`
2. Store credentials in KV at `secret:twilio-credentials`
3. Make them accessible to the SMS service

## Environment Variable Usage

### Production
- Uses `mykeys_KV_*` variables for Redis connection
- Uses AWS env vars for SES (though SES creds are also in KV)
- Uses `MYKEYS_PASS` for partial password authentication

### Development/Preview
- Same as production, but may have different KV database
- GCP variables available for local development

## Notes

1. **KV Storage**: Most secrets are stored in KV (Redis), not as environment variables
2. **AWS SES**: Credentials are in both env vars AND KV (KV takes precedence)
3. **Twilio**: Should only be in KV, not env vars
4. **MYKEYS_PASS**: Used for local dev authentication to the API



