# How to Get Vercel API Token

## Step-by-Step Instructions

### Step 1: Go to Vercel Account Settings
1. Open your browser
2. Go to: **https://vercel.com/account/tokens**
3. You may need to log in if you're not already

### Step 2: Create a New Token
1. Click the **"Create Token"** button (usually at the top right)
2. Give it a descriptive name, e.g.,:
   - `mykeys-api-rotation` or
   - `credential-management` or
   - `gcp-credentials-rotation`
3. Set expiration (optional):
   - **No expiration** (recommended for automation)
   - Or set a specific expiration date
4. Click **"Create"**

### Step 3: Copy the Token
1. **IMPORTANT:** Copy the token immediately - it will only be shown once!
2. The token will look something like: `vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. Save it securely (you'll need it for the script)

### Step 4: Use the Token

**Option A: Set as environment variable (temporary)**
```powershell
$env:VERCEL_TOKEN = 'vercel_your-token-here'
.\scripts\update-vercel-env-vars.ps1
```

**Option B: Store in mykeys.zip (permanent)**
```powershell
# Store it securely in mykeys.zip for future use
# (You can use the mykeys CLI or API to store it)
```

**Option C: Add to PowerShell profile (persistent)**
```powershell
# Add to your PowerShell profile
notepad $PROFILE
# Add: $env:VERCEL_TOKEN = 'vercel_your-token-here'
```

## Security Notes

- ⚠️ **Never commit tokens to git**
- ⚠️ **Don't share tokens publicly**
- ✅ **Store in mykeys.zip for secure access**
- ✅ **Use environment variables for temporary access**
- ✅ **Rotate tokens periodically**

## Alternative: Check if Token Already Exists

If you've used Vercel CLI before, you might already have a token:

```powershell
# Check Vercel CLI config
vercel whoami
# If logged in, you might be able to use existing auth
```

## Quick Link

**Direct link to create token:** https://vercel.com/account/tokens






