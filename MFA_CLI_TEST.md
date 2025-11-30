# MFA CLI Testing Guide

**Date:** November 28, 2025  
**Purpose:** Test MFA CLI with Twilio SMS and Amazon SES Email

---

## Quick Test

### Test SMS (Twilio)

```bash
# Interactive mode
node mfa-cli.js

# Or with arguments
node mfa-cli.js --method sms --phone +12132484250
```

**Expected Flow:**
1. Choose method: `1` (SMS)
2. Enter phone: `+12132484250` (or your test number)
3. Receive SMS with 4-digit code
4. Enter code when prompted
5. Token generated and saved

**Check:**
- ✅ SMS received on phone
- ✅ Code is 4 digits
- ✅ Token generated successfully
- ✅ Token saved to `~/.mykeys/token`

---

### Test Email (Amazon SES)

```bash
# Interactive mode
node mfa-cli.js

# Or with arguments
node mfa-cli.js --method email --email your-email@example.com
```

**Expected Flow:**
1. Choose method: `2` (Email)
2. Enter email: `your-email@example.com`
3. Receive email with 4-digit code
4. Enter code when prompted
5. Token generated and saved

**Check:**
- ✅ Email received in inbox
- ✅ Code is 4 digits
- ✅ Token generated successfully
- ✅ Token saved to `~/.mykeys/token`

---

## Prerequisites Check

### 1. Verify Twilio Credentials

```bash
# Check if credentials exist in mykeys.zip
# Should have secret named: twilio-credentials
# With structure:
{
  "account_sid": "ACxxxxx",
  "auth_token": "your-token",
  "phone_number": "+16269959974"
}
```

### 2. Verify SES Credentials

```bash
# Check if credentials exist in mykeys.zip
# Should have secret named: ses-credentials
# With structure:
{
  "smtp_username": "your-smtp-user",
  "smtp_password": "your-smtp-password",
  "region": "us-east-1",
  "from_email": "noreply@mykeys.zip"
}
```

### 3. Verify API Server

```bash
# Check if API is running
curl https://mykeys.zip/api/health

# Or check locally if running locally
curl http://localhost:3000/api/health
```

---

## Troubleshooting

### SMS Not Received

**Check:**
1. Twilio credentials configured correctly
2. Phone number in E.164 format (`+12132484250`)
3. Twilio account has SMS enabled
4. Phone number verified (for trial accounts)
5. Check Twilio console for message logs

**Test Twilio Directly:**
```bash
# Use Twilio API directly to test
curl -X POST https://api.twilio.com/2010-04-01/Accounts/ACxxxxx/Messages.json \
  -u ACxxxxx:your-auth-token \
  -d "From=+16269959974" \
  -d "To=+12132484250" \
  -d "Body=Test message"
```

### Email Not Received

**Check:**
1. SES credentials configured correctly
2. Email address format is valid
3. SES domain/email verified
4. SES out of sandbox mode (for production)
5. Check spam/junk folder
6. Check SES sending statistics in AWS console

**Test SES Directly:**
```bash
# Use nodemailer to test SES
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-smtp-username',
    pass: 'your-smtp-password'
  }
});
transporter.sendMail({
  from: 'noreply@mykeys.zip',
  to: 'your-email@example.com',
  subject: 'Test',
  text: 'Test message'
}).then(console.log).catch(console.error);
"
```

### Code Expired

**Solution:**
- Codes expire after 10 minutes
- Request a new code by running `mfa-cli.js` again
- Enter the new code when prompted

### Invalid Code

**Check:**
- Code is exactly 4 digits
- Using the most recent code
- Not mixing codes from different requests
- Request a new code if unsure

---

## Expected Server Logs

When MFA code is requested, you should see in server logs:

```
📤 Requesting verification code...
POST /api/auth/request-mfa-code
Sending SMS to +12132484250...
✓ SMS sent successfully
```

Or for email:

```
📤 Requesting verification code...
POST /api/auth/request-mfa-code
Sending email to user@example.com...
✓ Email sent successfully
```

---

## Verification Steps

### Step 1: Test SMS Flow

```bash
# 1. Run CLI
node mfa-cli.js

# 2. Choose SMS (1)
# 3. Enter phone number
# 4. Check phone for SMS
# 5. Enter code
# 6. Verify token generated
```

### Step 2: Test Email Flow

```bash
# 1. Run CLI
node mfa-cli.js

# 2. Choose Email (2)
# 3. Enter email address
# 4. Check email inbox
# 5. Enter code
# 6. Verify token generated
```

### Step 3: Verify Token Works

```bash
# Use generated token
export MCP_TOKEN=$(cat ~/.mykeys/token)

# Test token
node mykeys-cli.js admin

# Should show admin information
```

---

## Success Criteria

✅ **SMS Test:**
- SMS received within 10 seconds
- Code is 4 digits
- Token generated successfully
- Token saved to file

✅ **Email Test:**
- Email received within 30 seconds
- Code is 4 digits
- Token generated successfully
- Token saved to file

✅ **Token Usage:**
- Token can be used with `mykeys-cli.js admin`
- Token expires at correct time
- Token has correct client ID and type

---

## Next Steps

After successful testing:

1. ✅ Document any issues found
2. ✅ Update credentials if needed
3. ✅ Add to CI/CD if applicable
4. ✅ Share with team for testing

---

**Last Updated:** November 28, 2025





