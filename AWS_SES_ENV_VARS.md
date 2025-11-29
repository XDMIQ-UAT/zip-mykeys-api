# AWS SES Environment Variables for Vercel

The email service now uses the AWS SES SDK and reads credentials from Vercel environment variables.

## Required Environment Variables

Set these in your Vercel project settings:

### 1. AWS_ACCESS_KEY_ID
- **Description**: AWS Access Key ID for SES
- **How to get**: 
  - Go to AWS IAM Console
  - Create a new IAM user or use an existing one
  - Attach the `AmazonSESFullAccess` policy (or a custom policy with SES permissions)
  - Create Access Key and copy the Access Key ID
- **Example**: `AKIAIOSFODNN7EXAMPLE`

### 2. AWS_SECRET_ACCESS_KEY
- **Description**: AWS Secret Access Key for SES
- **How to get**: 
  - Same as above - when creating the Access Key, copy the Secret Access Key
  - **Important**: This is only shown once - save it securely!
- **Example**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

### 3. AWS_REGION (Optional)
- **Description**: AWS region for SES (defaults to `us-east-1`)
- **Example**: `us-east-1`, `us-west-2`, `eu-west-1`
- **Default**: `us-east-1`

### 4. SES_SENDER_EMAIL (Optional)
- **Description**: Email address to send from (defaults to `hello@cosmiciq.org`)
- **Important**: This email must be verified in AWS SES
- **Note**: Already configured in Vercel as `SES_SENDER_EMAIL`
- **Alternative**: Can also use `SES_FROM_EMAIL` if preferred
- **Example**: `hello@cosmiciq.org`
- **Default**: `hello@cosmiciq.org`

## Setting Up in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable for the appropriate environments (Production, Preview, Development)
4. Mark `AWS_SECRET_ACCESS_KEY` as **Sensitive** (encrypted)
5. Optionally mark `AWS_ACCESS_KEY_ID` as **Sensitive** as well

## Verifying Email Address in AWS SES

Before sending emails, you must verify the sender email address:

1. Go to AWS SES Console: https://console.aws.amazon.com/ses/
2. Navigate to **Verified identities** → **Create identity**
3. Select **Email address**
4. Enter your email (e.g., `hello@cosmiciq.org`)
5. Click **Create identity**
6. Check your email and click the verification link

## Testing

After setting the environment variables, test the email service:

```bash
# Test locally (requires .env.local with the variables)
node -e "const { testConnection } = require('./email-service'); testConnection().then(console.log);"
```

Or test via the API endpoint:
```bash
curl -X POST https://your-api.vercel.app/api/auth/request-mfa-code \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

## Migration from KV Storage

Previously, SES credentials were stored in Vercel KV (Redis). Now they're read directly from environment variables, which is:
- ✅ More secure (encrypted by Vercel)
- ✅ Easier to manage (no need to store/retrieve from KV)
- ✅ Standard practice for cloud deployments

If you had SES credentials stored in KV, you can remove them:
```bash
# Optional: Clean up old KV storage
# The email service no longer reads from KV
```

## Troubleshooting

### Error: "AWS credentials not found in environment variables"
- **Solution**: Make sure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in Vercel
- Check that you've deployed after setting the variables (or trigger a new deployment)

### Error: "Email address is not verified"
- **Solution**: Verify the sender email address in AWS SES Console
- Make sure `SES_FROM_EMAIL` matches the verified email

### Error: "Access Denied" or "Invalid credentials"
- **Solution**: 
  - Verify the IAM user has `AmazonSESFullAccess` policy
  - Check that the Access Key ID and Secret Access Key are correct
  - Ensure the credentials haven't been rotated/deleted

### Error: "Region not supported"
- **Solution**: Make sure `AWS_REGION` is set to a region where SES is available
- Common regions: `us-east-1`, `us-west-2`, `eu-west-1`

