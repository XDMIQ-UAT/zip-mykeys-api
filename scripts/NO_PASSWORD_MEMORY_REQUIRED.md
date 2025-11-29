# No Password Memory Required! 🎉

**You don't need to remember passwords anymore!** All passwords are stored in Vercel and can be retrieved automatically.

---

## Quick Start

### Retrieve Password from Vercel

```powershell
# Get password and set as environment variable
.\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview -SetEnvironmentVariable

# Or just display it
.\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview
```

### Run Tests (Auto-Retrieves Password)

```powershell
# Scripts will automatically retrieve from Vercel if not set locally
.\scripts\test-gcp-secret-manager.ps1 -Verbose
.\scripts\verify-deployments.ps1 -Verbose
```

---

## How It Works

### Automatic Password Retrieval

All scripts now automatically try to retrieve passwords from Vercel:

1. **First:** Check `$env:MYKEYS_PASS` (if already set)
2. **Then:** Retrieve from Vercel API (Preview/Development only)
3. **Finally:** Prompt if still not found

### Password Storage

- **Production:** Encrypted (cannot be retrieved - must be saved when set)
- **Preview:** Plain (can be retrieved from Vercel)
- **Development:** Plain (can be retrieved from Vercel)

---

## Usage Examples

### Example 1: Test GCP Secret Manager

```powershell
# No password needed - script retrieves from Vercel automatically
.\scripts\test-gcp-secret-manager.ps1 -Verbose
```

### Example 2: Verify Deployments

```powershell
# Automatically retrieves Preview password from Vercel
.\scripts\verify-deployments.ps1 -Verbose
```

### Example 3: Get Password for Manual Use

```powershell
# Retrieve and set for current session
.\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview -SetEnvironmentVariable

# Now use it
$env:MYKEYS_PASS  # Already set!
```

### Example 4: Get Different Environment

```powershell
# Get Development password
.\scripts\get-mykeys-pass-from-vercel.ps1 -Environment development -SetEnvironmentVariable

# Get Preview password
.\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview -SetEnvironmentVariable
```

---

## Important Notes

### Production Password

⚠️ **Production password is encrypted and cannot be retrieved!**

If you need the Production password:
1. **Save it when you set it** (use `-ShowPasswords` flag)
2. **Or regenerate it:**
   ```powershell
   .\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords
   ```

### Preview/Development Passwords

✅ **Can always be retrieved from Vercel**

These passwords are stored as "plain" type in Vercel, so they can be retrieved anytime via the API.

---

## Scripts That Auto-Retrieve

These scripts automatically retrieve passwords from Vercel:

- ✅ `test-gcp-secret-manager.ps1`
- ✅ `verify-deployments.ps1`
- ✅ `set-and-verify.ps1`

---

## Workflow

### Daily Usage (No Password Memory Needed!)

```powershell
# 1. Run tests (auto-retrieves password)
.\scripts\test-gcp-secret-manager.ps1 -Verbose

# 2. Verify deployments (auto-retrieves password)
.\scripts\verify-deployments.ps1 -Verbose

# That's it! No password needed!
```

### Setting New Passwords

```powershell
# Generate and set new passwords (shows them so you can save Production)
.\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords

# Passwords are automatically saved to Vercel
# Preview/Development can be retrieved later
# Production must be saved when shown (it's encrypted)
```

---

## Troubleshooting

### "Could not retrieve MYKEYS_PASS"

**Solution:**
1. Check VERCEL_KEY is set:
   ```powershell
   $env:VERCEL_KEY = "your-vercel-key"
   ```

2. Verify password exists in Vercel:
   - Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
   - Check `MYKEYS_PASS` exists for the environment

### "Production password is encrypted"

**This is expected!** Production passwords cannot be retrieved. Use Preview/Development for testing, or regenerate Production password.

---

## Summary

✅ **No password memory required**  
✅ **Automatic retrieval from Vercel**  
✅ **Preview/Development always retrievable**  
⚠️ **Production must be saved when set** (it's encrypted)

**Just run your scripts - passwords are handled automatically!** 🎉




