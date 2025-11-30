# MYKEYS_PASS Standardization

**Date:** November 29, 2025  
**Status:** ✅ **STANDARDIZED**

---

## Standardization Summary

✅ **Standardized on `MYKEYS_PASS`** for all environments  
✅ **Production:** Sensitive (encrypted, cannot be read back)  
✅ **Preview/Development:** Plain (readable, can be retrieved from Vercel)  
❌ **Removed:** `MYKEYS_PASS_DEV` (no longer used)

---

## Environment Variable Configuration

### Production
- **Variable Name:** `MYKEYS_PASS`
- **Type:** `encrypted` (sensitive)
- **Readable:** ❌ No (encrypted in Vercel, cannot be retrieved)
- **Purpose:** Production authentication password

### Preview
- **Variable Name:** `MYKEYS_PASS`
- **Type:** `plain` (non-sensitive)
- **Readable:** ✅ Yes (can be retrieved from Vercel dashboard/API)
- **Purpose:** Preview environment authentication password

### Development
- **Variable Name:** `MYKEYS_PASS`
- **Type:** `plain` (non-sensitive)
- **Readable:** ✅ Yes (can be retrieved from Vercel dashboard/API)
- **Purpose:** Development environment authentication password

---

## Why This Standardization?

1. **Consistency:** Single variable name (`MYKEYS_PASS`) across all environments
2. **Security:** Production password is encrypted and cannot be read back
3. **Convenience:** Preview/Development passwords are readable for testing/debugging
4. **Simplicity:** No need to remember different variable names per environment

---

## Usage

### In Code (Node.js/JavaScript)
```javascript
// Standardized - only MYKEYS_PASS
const MYKEYS_PASS = process.env.MYKEYS_PASS || 'fallback-password';
```

### In PowerShell Scripts
```powershell
# Standardized - only MYKEYS_PASS
$mykeysPass = $env:MYKEYS_PASS
```

### Setting Locally
```powershell
# Set for current session
$env:MYKEYS_PASS = "your-password"

# Set permanently (User level)
[System.Environment]::SetEnvironmentVariable("MYKEYS_PASS", "your-password", "User")
```

---

## Updating Passwords

Use the standardized script:

```powershell
# Generate and update all environments
.\scripts\generate-and-rotate-mykeys-passwords.ps1 -PasswordLength 128 -ShowPasswords

# Or update manually
.\scripts\update-mykeys-password.ps1 -Interactive
```

**Note:** Production password will be encrypted (cannot be read back), while Preview/Development will be plain (readable).

---

## Retrieving Passwords from Vercel

### Production
❌ **Cannot be retrieved** - Password is encrypted and sensitive

### Preview/Development
✅ **Can be retrieved** via:
- Vercel Dashboard: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
- Vercel API: `GET /v10/projects/{projectId}/env` (for plain type variables)

---

## Migration from MYKEYS_PASS_DEV

If you have scripts using `MYKEYS_PASS_DEV`, update them:

**Before:**
```powershell
$mykeysPass = $env:MYKEYS_PASS_DEV
if (-not $mykeysPass) {
    $mykeysPass = $env:MYKEYS_PASS
}
```

**After:**
```powershell
# Standardized - only MYKEYS_PASS
$mykeysPass = $env:MYKEYS_PASS
```

---

## Files Updated

- ✅ `server.js` - Removed MYKEYS_PASS_DEV fallback
- ✅ `generate-token-cli.js` - Removed MYKEYS_PASS_DEV fallback
- ✅ `scripts/update-mykeys-password.ps1` - Production sensitive, others plain
- ✅ `scripts/test-gcp-secret-manager.ps1` - Standardized on MYKEYS_PASS
- ✅ `scripts/verify-deployments.ps1` - Standardized on MYKEYS_PASS
- ✅ `scripts/rotate-vercel-gcp-credentials.ps1` - Standardized on MYKEYS_PASS
- ✅ `scripts/update-vercel-env-vars.ps1` - Standardized on MYKEYS_PASS

---

## Security Notes

- ✅ Production password is **encrypted** in Vercel (cannot be read back)
- ✅ Preview/Development passwords are **plain** (readable for convenience)
- ✅ All passwords are stored securely in Vercel environment variables
- ✅ Use strong, unique passwords for each environment
- ⚠️ **Save Production password securely** - it cannot be retrieved after setting!

---

**Status:** ✅ Standardization Complete  
**Last Updated:** November 29, 2025





