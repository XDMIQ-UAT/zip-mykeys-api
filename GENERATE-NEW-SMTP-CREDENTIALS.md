# Generate New AWS SES SMTP Credentials

The SMTP credentials from your screenshot are not working (535 Authentication Error).
You need to generate **NEW** SMTP credentials.

## Steps:

### 1. Go to AWS SES Console
Open: https://console.aws.amazon.com/ses/home?region=us-east-1#/account

### 2. Navigate to SMTP Settings
- In the left sidebar, click **"SMTP settings"**
- You'll see the SMTP endpoint: `email-smtp.us-east-1.amazonaws.com`

### 3. Create SMTP Credentials
- Click the button **"Create SMTP credentials"**
- AWS will create a new IAM user with SMTP access
- Give it a name like: `mykeys-ses-smtp-2025`

### 4. Download Credentials
- **IMPORTANT**: AWS shows the credentials ONLY ONCE
- You'll see:
  - SMTP Username (starts with `AKIA...`)
  - SMTP Password (long string with special characters)
- **COPY BOTH** immediately!

### 5. Update .env.local
Replace the existing credentials in `.env.local`:

```bash
AWS_SES_SMTP_USERNAME=AKIA... (your new username)
AWS_SES_SMTP_PASSWORD="..." (your new password in quotes)
```

### 6. Test
Run: `node test-send-email.js`

---

## Why the old credentials don't work:

1. **They might be for a different AWS account**
2. **The IAM user might have been deleted**
3. **They might be expired or revoked**
4. **They might be for a different region**

**Solution**: Generate new credentials following steps above.
