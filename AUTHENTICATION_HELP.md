# Authentication Help - Token Generation

## Common Authentication Errors

### "Authentication failed" Error

This error occurs when the username or password is incorrect.

**Solution:**

1. **Check your credentials:**
   - Username should be: `admin` (default)
   - Password should match your `MYKEYS_PASS` or `MYKEYS_PASS_DEV` environment variable

2. **For Production (Vercel):**
   - Password is stored in Vercel environment variable `MYKEYS_PASS` (sensitive)
   - Check: https://vercel.com/ici1/zip-myl-mykeys-api/settings/environment-variables

3. **For Development:**
   - Password is stored in `MYKEYS_PASS_DEV` environment variable (non-sensitive)
   - Or use the fallback password from `server.js`

4. **Reset Password:**
   - Use the password reset script: `scripts/reset-mykeys-password.ps1`
   - Or update Vercel environment variables directly

## Progressive Form Flow

The updated form now follows a progressive disclosure pattern:

1. **Step 1: Required Fields**
   - Admin Username
   - Admin Password  
   - Client ID (unique identifier)

2. **Step 2: Advanced Options** (collapsed by default)
   - Client Type (optional, defaults to "generic")
   - Expiration (optional, defaults to 90 days)

3. **Step 3: Terms & Generate**
   - Acknowledge ecosystem terms
   - Generate token

## Testing Authentication

```bash
# Test with curl
curl -u admin:YOUR_PASSWORD \
  -X POST https://mykeys.zip/api/mcp/token/generate \
  -H "Content-Type: application/json" \
  -d '{"clientId":"test","clientType":"generic","expiresInDays":90}'
```

## Next Steps

After fixing authentication:
1. Form will generate token successfully
2. Copy the token immediately (it won't be shown again)
3. Use token in your MCP configuration

---

**Need Help?** Check Vercel environment variables or contact support.






