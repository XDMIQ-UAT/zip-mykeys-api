# SES Email Verification Troubleshooting

## Quick Diagnostic

Run the diagnostic script to check your SES configuration:

```bash
node test-ses-config.js [your-email@example.com]
```

This will check:
1. GCP credentials
2. Secret existence in GCP Secret Manager
3. Secret format validation
4. SMTP connection
5. Email sending capability

## Common Issues and Solutions

### 1. "SES credentials not found"

**Problem:** SES credentials are not configured in mykeys.zip API.

**Solution: Store credentials in mykeys.zip API (Centralized Credential Management)**

```bash
# Using curl
curl -u admin:$MYKEYS_PASS \
  -X POST https://mykeys.zip/api/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ses-credentials",
    "value": "{\"smtp_username\":\"...\",\"smtp_password\":\"...\",\"region\":\"us-east-1\",\"from_email\":\"noreply@mykeys.zip\"}"
  }'

# Using PowerShell
$body = @{
  name = "ses-credentials"
  value = '{"smtp_username":"...","smtp_password":"...","region":"us-east-1","from_email":"noreply@mykeys.zip"}'
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mykeys.zip/api/secrets" `
  -Method POST `
  -Credential $credential `
  -Body $body `
  -ContentType "application/json"
```

**Secret Format:**
```json
{
  "smtp_username": "AKIAIOSFODNN7EXAMPLE",
  "smtp_password": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "region": "us-east-1",
  "from_email": "noreply@mykeys.zip"
}
```

**Why mykeys.zip API?**
- Centralized credential management (tiered, mesh architecture)
- Enables distributed fragment storage
- Single source of truth for all credentials
- Easy credential rotation
- Audit trail of credential access

**Fallback:** If mykeys.zip API is unavailable, falls back to local GCP Secret Manager (for local development only).

### 2. "SES authentication failed"

**Problem:** SMTP username or password is incorrect.

**Solution:**
1. Go to AWS SES Console → SMTP Settings
2. Create new SMTP credentials if needed
3. Update the `ses-credentials` secret with correct values:
   ```bash
   # Get current secret
   gcloud secrets versions access latest --secret=ses-credentials > ses-credentials.json
   
   # Edit the file with correct credentials
   # Then update the secret
   gcloud secrets versions add ses-credentials --data-file=ses-credentials.json
   ```

### 3. "Email address not verified in SES"

**Problem:** SES is in sandbox mode and the email address isn't verified.

**Solution:**

**Option A: Verify the email address (for testing)**
1. Go to AWS SES Console → Verified identities
2. Click "Create identity"
3. Select "Email address"
4. Enter the email address
5. Click the verification link in the email

**Option B: Request production access (for production)**
1. Go to AWS SES Console → Account dashboard
2. Click "Request production access"
3. Fill out the form explaining your use case
4. Wait for approval (usually 24-48 hours)

### 4. "SES connection failed"

**Problem:** Network issues or incorrect region.

**Solution:**
1. Verify the region matches your AWS account:
   ```json
   {
     "region": "us-east-1"  // or us-west-2, eu-west-1, etc.
   }
   ```
2. Check network connectivity:
   ```bash
   telnet email-smtp.us-east-1.amazonaws.com 587
   ```
3. Check firewall rules allow outbound SMTP (port 587)

### 5. "Invalid SES credentials format"

**Problem:** The secret JSON is malformed or missing required fields.

**Solution:**
Ensure the secret contains all required fields:
- `smtp_username` (required)
- `smtp_password` (required)
- `region` (optional, defaults to us-east-1)
- `from_email` (optional, defaults to noreply@mykeys.zip)

### 6. GCP Credentials Not Configured

**Problem:** GCP Secret Manager client can't authenticate.

**Solution:**
```bash
# Option 1: Use service account key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Option 2: Use gcloud authentication
gcloud auth application-default login

# Option 3: Set GCP project
export GCP_PROJECT=myl-zip-www
```

## Step-by-Step Setup

### 1. Get SES SMTP Credentials

1. Log in to AWS Console
2. Go to Amazon SES → SMTP Settings
3. Click "Create SMTP credentials"
4. Save the SMTP username and password

### 2. Store Credentials in mykeys.zip API

**This is the correct way** - centralized credential management enables the tiered, mesh architecture:

```bash
# Create credentials JSON
cat > ses-credentials.json <<EOF
{
  "smtp_username": "YOUR_SMTP_USERNAME",
  "smtp_password": "YOUR_SMTP_PASSWORD",
  "region": "us-east-1",
  "from_email": "noreply@mykeys.zip"
}
EOF

# Store in mykeys.zip API
curl -u admin:$MYKEYS_PASS \
  -X POST https://mykeys.zip/api/secrets \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ses-credentials\",
    \"value\": $(cat ses-credentials.json | jq -c .)
  }"

# Clean up
rm ses-credentials.json
```

**Why mykeys.zip API?**
- ✅ Centralized credential management
- ✅ Enables distributed fragment storage
- ✅ Single source of truth
- ✅ Easy credential rotation
- ✅ Audit trail

**NOT Environment Variables** - they break the architecture!

### 3. Verify Email Address (if in sandbox)

1. Go to AWS SES → Verified identities
2. Create identity → Email address
3. Enter your email
4. Click verification link

### 4. Test Configuration

```bash
node test-ses-config.js your-email@example.com
```

## Testing Email Verification

Once configured, test the email verification flow:

```bash
# Using the MFA CLI
node mfa-cli.js

# Or using the generate-token CLI
node mykeys-cli.js generate-token
# Choose option 2 (Email)
# Enter your email address
```

## Monitoring

Check SES sending statistics:
1. Go to AWS SES Console → Sending statistics
2. Monitor:
   - Sends
   - Bounces
   - Complaints
   - Rejects

## Security Best Practices

1. **Rotate SMTP credentials regularly**
2. **Use IAM policies** to restrict SES access
3. **Monitor sending statistics** for anomalies
4. **Use verified domains** instead of individual emails (for production)
5. **Enable SES sending limits** to prevent abuse

## Additional Resources

- [AWS SES SMTP Documentation](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html)
- [GCP Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Nodemailer Documentation](https://nodemailer.com/about/)

