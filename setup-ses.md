# Amazon SES Setup for MyKeys.zip Email Authentication

## Overview
The email verification system has been updated to use **Amazon SES** instead of ProtonMail SMTP.

## Requirements

### 1. Verify Email Addresses in AWS SES
Before sending emails, you need to verify the sender email address(es) in AWS SES:

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Select your region (us-east-1 recommended)
3. Navigate to **Verified Identities** → **Create identity**
4. Choose **Email address**
5. Enter: `hello@xdmiq.com` or `hello@cosmiciq.com`
6. Click **Create identity**
7. Check the email inbox and click the verification link

**Important**: In SES Sandbox mode, you must also verify the recipient email (`bcherrman@gmail.com`) before testing.

### 2. Move Out of SES Sandbox (Production)
To send to any email address without verification:

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Click **Get Set Up** or navigate to **Account Dashboard**
3. Request production access
4. Fill out the request form explaining your use case:
   - **Use case**: Transactional authentication emails
   - **Description**: "Send 4-digit verification codes for multi-factor authentication"
   - **Opt-out process**: "Authentication emails only, no marketing"

Approval typically takes 24 hours.

### 3. Create IAM User with SES Permissions

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new IAM user: `mykeys-ses-sender`
3. Attach policy: `AmazonSESFullAccess` (or create a custom policy with only `ses:SendEmail`)
4. Create **Access Keys** for the user
5. Save the credentials securely

**Minimal IAM Policy** (recommended for security):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

## Configuration

### Update `.env.local` with AWS Credentials

```bash
# Amazon SES for email authentication
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
SES_SENDER_EMAIL=hello@xdmiq.com
```

**Alternatively**, if using `hello@cosmiciq.com`:
```bash
SES_SENDER_EMAIL=hello@cosmiciq.com
```

## Testing

### Test SES Connection
```bash
node test-email.js
```

### Test Email Verification Flow
```bash
node test-email-verification.js
```

### Test Token Generation with Email Verification
```bash
node mykeys-cli.js generate-token
```

## Troubleshooting

### Error: "Email address is not verified"
- **Cause**: Sender email not verified in SES
- **Solution**: Verify `hello@xdmiq.com` in AWS SES Console

### Error: "MessageRejected: Email address is not verified"
- **Cause**: In SES Sandbox, recipient email must also be verified
- **Solution**: 
  1. Verify `bcherrman@gmail.com` in AWS SES Console, OR
  2. Request production access to remove sandbox restrictions

### Error: "The security token included in the request is invalid"
- **Cause**: Invalid AWS credentials
- **Solution**: Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env.local`

### Error: "Missing credentials in config"
- **Cause**: Environment variables not loaded
- **Solution**: Ensure `.env.local` exists and credentials are set correctly

## Files Modified

1. `email-service.js` - Updated to use Amazon SES SDK
2. `mykeys-cli.js` - Added dotenv configuration
3. `.env.local` - Added AWS SES credentials
4. `package.json` - Added `@aws-sdk/client-ses` dependency

## Next Steps

1. **Verify sender email** in AWS SES Console
2. **Add AWS credentials** to `.env.local`
3. **Test connection**: `node test-email.js`
4. **Test verification flow**: `node test-email-verification.js`
5. **Request production access** to send to any email (optional, for production)

## Benefits of Amazon SES

- ✅ Highly reliable email delivery
- ✅ No rate limits (after leaving sandbox)
- ✅ Better deliverability than SMTP
- ✅ Detailed bounce/complaint tracking
- ✅ Cost-effective ($0.10 per 1000 emails)
- ✅ Native AWS SDK integration
