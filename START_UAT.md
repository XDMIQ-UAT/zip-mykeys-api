# Start UAT - Email Authentication Testing

## 🎯 For UAT Testers (Zero Setup Required)

Everything is pre-configured. Just follow these steps.

---

## Step 1: Start the Server (2 minutes)

Open PowerShell and run:

```powershell
cd E:\zip-myl-mykeys-api
npm start
```

**Expected:** Server starts on port 8080

**If you see errors:** The server is already running (that's fine, continue)

---

## Step 2: Open Another Terminal

Keep the server running and open a **new** PowerShell terminal.

---

## Step 3: Test the Authentication (5 minutes)

### Your First Test

```powershell
# Clear any existing token
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue

# Run the admin command
node mykeys-cli.js admin --skip-seed
```

### What You'll See

```
╔════════════════════════════════════════╗
║     MyKeys Admin Authentication     ║
╚════════════════════════════════════════╝

No token found. Authenticate via email:

Enter your email address:
```

### What to Do

1. **Enter your email address** (use an email you can check)
   - Example: `your-email@gmail.com`

2. **Check your email** (arrives within 30 seconds)
   - Subject: "MyKeys.zip Authentication Code: XXXX"
   - Look for the 4-digit code

3. **Enter the 4-digit code** when prompted

4. **See admin info displayed**

---

## Expected Result

If everything works, you'll see:

```
✓ 4-digit code sent to your-email@domain.com

Enter 4-digit verification code: ____

Verifying code...
✓ Authenticated successfully

╔════════════════════════════════════════╗
║        MyKeys Admin Info           ║
╚════════════════════════════════════════╝

Role: architect
Context: token-based
...
```

---

## Test Checklist (Check Each)

Run through these scenarios:

### ✅ Test 1: Happy Path
- [ ] Email prompt appears
- [ ] Enter valid email
- [ ] Email arrives within 30 seconds
- [ ] Enter correct 4-digit code
- [ ] Admin info displays
- [ ] No errors

### ✅ Test 2: Invalid Email
- [ ] Run: `node mykeys-cli.js admin --skip-seed`
- [ ] Enter: `not-an-email`
- [ ] See error: "Invalid email address format"

### ✅ Test 3: Wrong Code
- [ ] Get verification code email
- [ ] Enter wrong code: `0000`
- [ ] See error: "Invalid verification code"

### ✅ Test 4: Token Reuse
- [ ] Run admin command again immediately
- [ ] NO email prompt (uses saved token)
- [ ] Admin info displays instantly

---

## Problems?

### Email Not Received?
1. Check spam/junk folder
2. Wait up to 60 seconds
3. Try again with different email

### Server Won't Start?
```powershell
# Check if it's already running
Invoke-RestMethod -Uri "http://localhost:8080/health"
```

If it returns JSON, server is running (continue to Step 3)

### "Cannot reach API server"?
Server needs to be running in another terminal.

---

## Report Results

After testing, note:

**What Worked:**
- ___________________________________________

**What Didn't Work:**
- ___________________________________________

**Email Delivery Time:**
- ___________________________________________

**Overall Experience (1-5):** _____ / 5

---

## That's It!

You're done. Report your findings:
- ✅ All tests passed → Ready for production
- ⚠️ Some issues → Document what failed
- ❌ Major problems → System not ready

**Time Required:** 10-15 minutes total
