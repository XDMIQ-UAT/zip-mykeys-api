# MyKeys Admin Email Authentication - UAT Guide

## Overview
This guide will walk you through User Acceptance Testing (UAT) of the email-based authentication flow for the `mykeys admin` command.

## Prerequisites

### 1. Environment Setup
Ensure you have:
- Node.js 18+ installed
- Access to email account configured in ProtonMail
- Terminal access (PowerShell, Bash, or similar)

### 2. ProtonMail SMTP Configuration
Set the following environment variables:

**PowerShell:**
```powershell
$env:PROTONMAIL_USER = "hello@xdmiq.com"
$env:PROTONMAIL_APP_PASSWORD = "your-app-password-here"
```

**Bash/Linux:**
```bash
export PROTONMAIL_USER="hello@xdmiq.com"
export PROTONMAIL_APP_PASSWORD="your-app-password-here"
```

### 3. Server Running
Ensure the mykeys API server is running:
```powershell
# Start server
npm start

# Or for development:
npm run dev
```

## Pre-UAT Verification

**Run the automated verification script:**
```powershell
.\scripts\verify-email-auth.ps1
```

This will:
- ✓ Check environment setup
- ✓ Verify API server is running
- ✓ Test required endpoints
- ✓ Run Playwright automated tests
- ✓ Provide GO/NO-GO decision

**Expected Output:**
```
╔════════════════════════════════════════╗
║          ✓ GO FOR UAT                 ║
╚════════════════════════════════════════╝
```

## UAT Test Cases

### Test Case 1: Basic Email Authentication Flow

**Objective:** Verify end-to-end email authentication

**Steps:**
1. Clear any existing token:
   ```powershell
   Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue
   ```

2. Run the admin command:
   ```powershell
   node mykeys-cli.js admin --skip-seed
   ```

3. **Expected:** See authentication prompt:
   ```
   ╔════════════════════════════════════════╗
   ║     MyKeys Admin Authentication     ║
   ╚════════════════════════════════════════╝

   No token found. Authenticate via email:

   Enter your email address:
   ```

4. Enter your email address (e.g., `test@xdmiq.com`)

5. **Expected:** Confirmation message:
   ```
   Sending 4-digit verification code to your email...
   ✓ 4-digit code sent to test@xdmiq.com

   Enter 4-digit verification code:
   ```

6. Check your email inbox for the 4-digit code

7. Enter the 4-digit code (e.g., `1234`)

8. **Expected:** Success and admin info display:
   ```
   Verifying code...
   ✓ Authenticated successfully

   ╔════════════════════════════════════════╗
   ║        MyKeys Admin Info           ║
   ╚════════════════════════════════════════╝

   Role: architect
   Context: token-based

   Token Information:
     Client ID: admin-1234567890
     Client Type: admin-cli
     Expires: 11/30/2025 (1 days)

   Permissions:
     ✓ read_secrets
     ✓ write_secrets
     ✓ list_secrets
     ✓ manage_tokens
     ✓ architect_access
     ✓ full_system_access
   ```

**Pass Criteria:**
- ✓ Email prompt appears
- ✓ Email is sent within 30 seconds
- ✓ Code verification succeeds
- ✓ Admin info is displayed
- ✓ No errors or crashes

---

### Test Case 2: Invalid Email Validation

**Objective:** Verify email validation works

**Steps:**
1. Run: `node mykeys-cli.js admin --skip-seed`
2. Enter invalid email: `not-an-email`

**Expected:**
```
Error: Invalid email address format
```

**Pass Criteria:**
- ✓ Invalid email is rejected
- ✓ Clear error message shown

---

### Test Case 3: Invalid Verification Code

**Objective:** Verify code validation works

**Steps:**
1. Run: `node mykeys-cli.js admin --skip-seed`
2. Enter valid email
3. Enter incorrect code: `0000`

**Expected:**
```
Authentication failed: Invalid verification code
```

**Pass Criteria:**
- ✓ Invalid code is rejected
- ✓ Clear error message shown
- ✓ User can retry (run command again)

---

### Test Case 4: Code Expiration

**Objective:** Verify codes expire after 10 minutes

**Steps:**
1. Request verification code
2. Wait 11 minutes
3. Try to use the code

**Expected:**
```
Authentication failed: Verification code expired
```

**Pass Criteria:**
- ✓ Expired code is rejected
- ✓ User prompted to request new code

---

### Test Case 5: Token Reuse

**Objective:** Verify generated token persists

**Steps:**
1. Complete authentication flow successfully
2. Run `node mykeys-cli.js admin --skip-seed` again (immediately)

**Expected:**
- No email prompt (uses existing token)
- Admin info displayed directly

**Pass Criteria:**
- ✓ Token is saved and reused
- ✓ No re-authentication required

---

### Test Case 6: Email Delivery Time

**Objective:** Verify email arrives promptly

**Steps:**
1. Note current time
2. Request verification code
3. Check email inbox
4. Note time of email arrival

**Expected:**
- Email arrives within 30 seconds

**Pass Criteria:**
- ✓ Email delivery < 30 seconds
- ✓ Email contains 4-digit code
- ✓ Email is well-formatted

---

### Test Case 7: Multiple Requests

**Objective:** Verify rate limiting and multiple requests

**Steps:**
1. Request code for email A
2. Immediately request code for email A again
3. Check behavior

**Expected:**
- Second request either:
  - Generates new code (replaces old)
  - OR shows rate limit message

**Pass Criteria:**
- ✓ System handles multiple requests gracefully
- ✓ No crashes or errors

---

## UAT Checklist

Use this checklist during testing:

```
Pre-UAT:
[ ] Automated verification passed
[ ] ProtonMail SMTP configured
[ ] API server running
[ ] Test email inbox accessible

Test Execution:
[ ] TC1: Basic flow successful
[ ] TC2: Invalid email rejected
[ ] TC3: Invalid code rejected
[ ] TC4: Expired code handled
[ ] TC5: Token reuse works
[ ] TC6: Email delivery < 30s
[ ] TC7: Multiple requests handled

Post-UAT:
[ ] No crashes occurred
[ ] Error messages clear
[ ] Performance acceptable
[ ] Security concerns noted (if any)
```

## Troubleshooting

### Email Not Received

**Check:**
1. ProtonMail credentials correct
2. Spam/junk folder
3. Email service logs:
   ```powershell
   # Check server logs for SMTP errors
   ```

**Solution:**
- Verify `PROTONMAIL_APP_PASSWORD` is set correctly
- Check ProtonMail account is active
- Try different email address

### "Cannot reach API server"

**Check:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/health"
```

**Solution:**
- Ensure server is running: `npm start`
- Check port 8080 is available
- Verify firewall settings

### "Invalid verification code" (but code is correct)

**Check:**
- Code not expired (< 10 minutes)
- No typos in code entry
- Code matches the one in email

**Solution:**
- Request new code
- Copy-paste code from email

### Token Not Persisting

**Check:**
```powershell
Test-Path "$env:USERPROFILE\.mykeys\token"
```

**Solution:**
- Verify write permissions to home directory
- Check disk space available

## Success Criteria

UAT is successful if:
- ✅ All 7 test cases pass
- ✅ No critical errors occur
- ✅ Email delivery reliable (< 30s)
- ✅ User experience is smooth
- ✅ Security validation working

## Known Limitations

1. **Email Delivery:** Depends on ProtonMail SMTP availability
2. **Code Format:** Fixed to 4 digits (not configurable)
3. **Token Expiry:** 1 day for admin sessions
4. **Rate Limiting:** Applied to prevent abuse

## Next Steps After UAT

1. **Document Issues:** Report any bugs or UX issues
2. **Performance Notes:** Note any slow operations
3. **Security Review:** Flag any security concerns
4. **Production Readiness:** Confirm GO/NO-GO for production

## Contact

For questions or issues during UAT:
- Check logs: `npm run logs` (if available)
- Review API health: `http://localhost:8080/health`
- Consult: `CLI_MFA_GUIDE.md` for reference
