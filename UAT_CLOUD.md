# Cloud UAT - Ready to Test!

## ✅ Your UAT Environment is Live!

**Preview URL:** https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app

---

## 🚀 Start Testing (2 Steps)

### Step 1: Set the Cloud URL

```powershell
$env:MYKEYS_URL = "https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app"
```

### Step 2: Test Email Authentication

```powershell
node mykeys-cli.js admin --skip-seed
```

Then:
1. **Enter your email address** (use one you can access)
2. **Check your email** for 4-digit code (arrives in ~30 seconds)
3. **Enter the 4-digit code**
4. **✅ See admin info!**

---

## 📋 What to Test

### Test 1: Happy Path ⭐
- [ ] Email prompt appears
- [ ] Email arrives within 30 seconds
- [ ] Code verification works
- [ ] Admin info displays

### Test 2: Invalid Email
```powershell
node mykeys-cli.js admin --skip-seed
# Enter: not-an-email
# Expected: "Invalid email address format"
```

### Test 3: Wrong Code
```powershell
node mykeys-cli.js admin --skip-seed
# Enter valid email
# Enter wrong code: 0000
# Expected: "Invalid verification code"
```

### Test 4: Token Persistence
```powershell
node mykeys-cli.js admin --skip-seed
# (Run immediately after successful auth)
# Expected: No email prompt, uses saved token
```

---

## 🔧 If Deployment Protection is Enabled

The URL may require authentication. To fix:

### Option 1: Disable Protection (Easiest)
1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/deployment-protection
2. Set "Protection Bypass for Automation" to **Disabled** for Preview
3. Re-test

### Option 2: Use Bypass Token
```powershell
# Get bypass token from Vercel dashboard
# Then use it in URLs:
$env:MYKEYS_URL = "https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=YOUR_TOKEN"
```

---

## 📊 Monitor Deployment

### View Logs
```powershell
vercel logs https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app --follow
```

### Open Dashboard
https://vercel.com/xdmiq/zip-myl-mykeys-api

### Check Deployment
https://vercel.com/xdmiq/zip-myl-mykeys-api/3EgxVhgJSvzoFTsTUmJ6R4xcwQSn

---

## ✅ Environment Setup Summary

**What's Configured:**
- ✅ ProtonMail SMTP (hello@xdmiq.com)
- ✅ Email authentication enabled
- ✅ 4-digit code generation
- ✅ Deployed to Vercel Preview
- ✅ Zero local setup required

**Your URLs:**
- **Preview:** https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app
- **Dashboard:** https://vercel.com/xdmiq/zip-myl-mykeys-api
- **Production:** https://mykeys.zip (deploy after UAT passes)

---

## 🎬 Expected Flow

```
$ $env:MYKEYS_URL = "https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app"
$ node mykeys-cli.js admin --skip-seed

╔════════════════════════════════════════╗
║     MyKeys Admin Authentication     ║
╚════════════════════════════════════════╝

No token found. Authenticate via email:

Enter your email address: your@email.com

Sending 4-digit verification code to your email...
✓ 4-digit code sent to your@email.com

Enter 4-digit verification code: 2132

Verifying code...
✓ Authenticated successfully

╔════════════════════════════════════════╗
║        MyKeys Admin Info           ║
╚════════════════════════════════════════╝

Role: architect
...
```

---

## 🔄 Redeploy if Needed

Made changes? Redeploy:
```powershell
vercel
```

Deploy to production after UAT passes:
```powershell
vercel --prod
```

---

## ✅ Ready for UAT!

**No local server needed**  
**No email setup needed**  
**Just test the CLI!**

```powershell
$env:MYKEYS_URL = "https://zip-myl-mykeys-e1g8cjbvg-xdmiq.vercel.app"
node mykeys-cli.js admin --skip-seed
```

**Time to Test:** ~10 minutes
