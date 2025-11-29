# Update MYKEYS_PASS in Vercel - Quick Guide

This guide shows how to update the `MYKEYS_PASS` environment variable in Vercel for all three environments (Production, Preview, Development).

## Prerequisites

1. **Vercel Authentication Token:**
   ```powershell
   # Set VERCEL_KEY (preferred) or VERCEL_TOKEN
   $env:VERCEL_KEY = "your-vercel-key"
   # OR
   $env:VERCEL_TOKEN = "your-vercel-token"
   ```

2. **Script Location:**
   ```powershell
   cd E:\zip-myl-mykeys-api
   ```

## Usage Options

### Option 1: Interactive Mode (Recommended)

Prompts you to enter passwords securely:

```powershell
.\scripts\update-mykeys-password.ps1 -Interactive
```

You'll be asked:
- Use same password for all environments? (Y/n)
- Enter password(s) securely (input is hidden)

### Option 2: Same Password for All Environments

Set the same password for Production, Preview, and Development:

```powershell
.\scripts\update-mykeys-password.ps1 -AllEnvironmentsPassword "your-new-password"
```

### Option 3: Different Passwords Per Environment

Set different passwords for each environment:

```powershell
.\scripts\update-mykeys-password.ps1 `
    -ProductionPassword "prod-password" `
    -PreviewPassword "preview-password" `
    -DevelopmentPassword "dev-password"
```

### Option 4: Partial Passwords (Interactive for Missing)

Provide some passwords, prompt for the rest:

```powershell
# Only set Production, will prompt for Preview and Development
.\scripts\update-mykeys-password.ps1 -ProductionPassword "prod-password"
```

## Dry Run Mode

Test what would be updated without making changes:

```powershell
.\scripts\update-mykeys-password.ps1 -Interactive -DryRun
```

## Examples

### Example 1: Quick Update (Same Password)

```powershell
# Set Vercel key
$env:VERCEL_KEY = "Bv7Q3R3cI3gINFDxvl4iglFJ"

# Update all environments with same password
.\scripts\update-mykeys-password.ps1 -AllEnvironmentsPassword "MyNewSecurePassword123!"
```

### Example 2: Different Passwords

```powershell
.\scripts\update-mykeys-password.ps1 `
    -ProductionPassword "ProdPass123!" `
    -PreviewPassword "PreviewPass456!" `
    -DevelopmentPassword "DevPass789!"
```

### Example 3: Interactive with Dry Run

```powershell
# Test first
.\scripts\update-mykeys-password.ps1 -Interactive -DryRun

# If looks good, apply for real
.\scripts\update-mykeys-password.ps1 -Interactive
```

## After Updating

1. **Test the new password locally:**
   ```powershell
   $env:MYKEYS_PASS = "your-new-password"
   .\scripts\test-gcp-secret-manager.ps1 -Verbose
   ```

2. **Verify deployments:**
   ```powershell
   .\scripts\verify-deployments.ps1 -Verbose
   ```

3. **Check Vercel dashboard:**
   - Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
   - Verify `MYKEYS_PASS` is updated for each environment

## Troubleshooting

### Error: VERCEL_KEY or VERCEL_TOKEN not found

**Solution:**
```powershell
# Set the token
$env:VERCEL_KEY = "your-vercel-key"

# Or set it permanently (User level)
[System.Environment]::SetEnvironmentVariable("VERCEL_KEY", "your-vercel-key", "User")
```

### Error: Authentication failed

**Solution:**
- Verify your VERCEL_KEY/VERCEL_TOKEN is correct
- Check that you have access to the Vercel project
- Try getting a new token from: https://vercel.com/account/tokens

### Error: Project not found

**Solution:**
- Verify the project ID in the script matches your Vercel project
- Check team ID is correct (`xdmiq`)

## Security Notes

- ✅ **Standardized on `MYKEYS_PASS`** for all environments
- ✅ **Production:** Encrypted (sensitive, cannot be read back)
- ✅ **Preview/Development:** Plain (readable, can be retrieved)
- ✅ Script uses secure password input (hidden)
- ✅ Never commit passwords to git
- ✅ Use strong, unique passwords for each environment
- ✅ Rotate passwords regularly
- ⚠️ **Save Production password securely** - it cannot be retrieved after setting!

## Related Scripts

- `test-gcp-secret-manager.ps1` - Test GCP Secret Manager access
- `verify-deployments.ps1` - Verify all deployments work correctly
- `rotate-vercel-gcp-credentials.ps1` - Rotate GCP service account credentials

