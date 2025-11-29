# MyKeys Admin Email Authentication - Complete UAT Procedure

## Executive Summary

This document provides the complete step-by-step procedure for User Acceptance Testing (UAT) of the email-based authentication mechanism for `mykeys admin` CLI command.

**Testing Duration:** ~45 minutes  
**Prerequisites:** Server access, email access, terminal access  
**Risk Level:** Low (isolated testing environment)

---

## Phase 1: Pre-UAT Setup (10 minutes)

### Step 1.1: Configure ProtonMail SMTP

**Action:** Set environment variables for email delivery

```powershell
# PowerShell
$env:PROTONMAIL_USER = "hello@xdmiq.com"
$env:PROTONMAIL_APP_PASSWORD = "your-app-password-here"
$env:MYKEYS_URL = "http://localhost:8080"
```

**Verification:**
```powershell
echo $env:PROTONMAIL_USER
echo $env:PROTONMAIL_APP_PASSWORD
```

### Step 1.2: Start the API Server

**Action:** Launch the mykeys API server

```powershell
# Navigate to project directory
cd E:\zip-myl-mykeys-api

# Install dependencies (if needed)
npm install

# Start server
npm start
```

**Expected Output:**
```
🚀 MyKeys API Service running on port 8080
📦 Project: myl-zip-www
🔐 Authentication: Basic Auth + Bearer Token
```

**Verification:**
```powershell
# In another terminal, test health endpoint
Invoke-RestMethod -Uri "http://localhost:8080/health"
```

**Expected Response:**
```json
{
  "success": true,
  "service": "mykeys-api",
  "status": "healthy",
  "timestamp": "2025-11-29T...",
  "version": "2.0.0"
}
```

### Step 1.3: Run Automated Pre-Checks

**Action:** Execute verification script

```powershell
.\scripts\verify-email-auth.ps1
```

**Expected Outcome:** GO FOR UAT

**If NO-GO:**
- Review failures in output
- Fix issues (usually server not running)
- Re-run verification script

---

## Phase 2: UAT Test Execution (25 minutes)

### Test 1: Happy Path - Email Authentication (5 min)

**Objective:** Verify complete email auth flow works end-to-end

**Setup:**
```powershell
# Clear any existing token
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue

# Verify token is gone
Test-Path "$env:USERPROFILE\.mykeys\token"  # Should return False
```

**Execute:**
```powershell
node mykeys-cli.js admin --skip-seed
```

**Step-by-Step Expected Interaction:**

1. **Prompt appears:**
   ```
   ╔════════════════════════════════════════╗
   ║     MyKeys Admin Authentication     ║
   ╚════════════════════════════════════════╝

   No token found. Authenticate via email:

   Enter your email address:
   ```

2. **You enter:** `your-email@domain.com` (use test email with access)

3. **System responds:**
   ```
   Sending 4-digit verification code to your email...
   ✓ 4-digit code sent to your-email@domain.com

   Enter 4-digit verification code:
   ```

4. **You check email** (should arrive within 30 seconds)
   - Subject: "MyKeys.zip Authentication Code: XXXX"
   - Body contains 4-digit code
   - Note the code

5. **You enter:** The 4-digit code from email

6. **System responds:**
   ```
   Verifying code...
   ✓ Authenticated successfully

   Fetching admin information...

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

**PASS Criteria:**
- [ ] Email prompt displayed correctly
- [ ] Email received within 30 seconds
- [ ] Code verification successful
- [ ] Admin info displayed
- [ ] No errors or exceptions

**Result:** PASS / FAIL / BLOCKED

**Notes:** _____________________________

---

### Test 2: Token Persistence (2 min)

**Objective:** Verify token is saved and reused

**Execute:**
```powershell
# Run admin command again immediately
node mykeys-cli.js admin --skip-seed
```

**Expected Behavior:**
- NO email prompt
- Admin info displayed directly using saved token
- Response time < 5 seconds

**PASS Criteria:**
- [ ] No re-authentication required
- [ ] Token loaded from file
- [ ] Admin info displayed correctly

**Result:** PASS / FAIL / BLOCKED

**Notes:** _____________________________

---

### Test 3: Invalid Email Rejection (3 min)

**Objective:** Verify email validation works

**Setup:**
```powershell
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue
```

**Execute:**
```powershell
node mykeys-cli.js admin --skip-seed
```

**Test Cases:**

| Input | Expected Result | Pass/Fail |
|-------|----------------|-----------|
| `not-an-email` | "Invalid email address format" | [ ] |
| `test@` | "Invalid email address format" | [ ] |
| `@domain.com` | "Invalid email address format" | [ ] |
| ` ` (empty) | "Email is required" | [ ] |

**PASS Criteria:**
- [ ] All invalid emails rejected
- [ ] Clear error messages
- [ ] No crashes

**Result:** PASS / FAIL / BLOCKED

**Notes:** _____________________________

---

### Test 4: Invalid Code Rejection (3 min)

**Objective:** Verify code validation works

**Setup:**
```powershell
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue
```

**Execute:**
```powershell
node mykeys-cli.js admin --skip-seed
# Enter valid email
# Receive code, but don't use it yet
```

**Test Cases:**

| Code Input | Expected Result | Pass/Fail |
|------------|----------------|-----------|
| `0000` | "Invalid verification code" | [ ] |
| `abcd` | "Please enter a 4-digit verification code" | [ ] |
| `123` | "Please enter a 4-digit verification code" | [ ] |
| ` ` (empty) | "Please enter a 4-digit verification code" | [ ] |

**PASS Criteria:**
- [ ] Invalid codes rejected
- [ ] Clear error messages
- [ ] User can retry (run command again)

**Result:** PASS / FAIL / BLOCKED

**Notes:** _____________________________

---

### Test 5: Email Delivery Performance (5 min)

**Objective:** Measure email delivery time

**Setup:**
```powershell
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue
```

**Execute:** Run 3 iterations

```powershell
# Iteration 1
$start = Get-Date
node mykeys-cli.js admin --skip-seed
# Enter email, note time email arrives
$end = Get-Date
$duration1 = ($end - $start).TotalSeconds
Write-Host "Iteration 1: $duration1 seconds"
```

**Measurements:**

| Iteration | Email Arrival Time | Pass (<30s) |
|-----------|-------------------|-------------|
| 1 | _____ seconds | [ ] |
| 2 | _____ seconds | [ ] |
| 3 | _____ seconds | [ ] |

**Average:** _____ seconds

**PASS Criteria:**
- [ ] Average < 30 seconds
- [ ] All emails arrived
- [ ] Codes were valid

**Result:** PASS / FAIL / BLOCKED

**Notes:** _____________________________

---

### Test 6: Code Expiration (12 min - can run concurrent)

**Objective:** Verify codes expire after 10 minutes

**Setup:**
```powershell
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue
```

**Execute:**
```powershell
# Request code
node mykeys-cli.js admin --skip-seed
# Enter email, note the code
# Wait 11 minutes (or adjust server expiry for testing)
# Try to use the code
```

**Expected Result:** "Verification code expired" or "Invalid verification code"

**PASS Criteria:**
- [ ] Expired code rejected
- [ ] Clear error message

**Result:** PASS / FAIL / BLOCKED (can mark as SKIPPED if time-constrained)

**Notes:** _____________________________

---

### Test 7: Security - Multiple Requests (3 min)

**Objective:** Test rate limiting and security

**Execute:**
```powershell
# Send multiple requests rapidly
for ($i=1; $i -le 5; $i++) {
    Write-Host "Request $i"
    # Start CLI, enter email, then cancel (Ctrl+C)
    # Repeat quickly
}
```

**Observations:**
- Rate limiting applied? _____ (Yes/No)
- System stable? _____ (Yes/No)
- Error handling graceful? _____ (Yes/No)

**PASS Criteria:**
- [ ] System handles multiple requests
- [ ] No crashes or hangs
- [ ] Rate limiting active (optional)

**Result:** PASS / FAIL / BLOCKED

**Notes:** _____________________________

---

## Phase 3: Post-UAT Validation (5 minutes)

### Verify Token File

```powershell
$tokenPath = "$env:USERPROFILE\.mykeys\token"
Test-Path $tokenPath
Get-Content $tokenPath
```

**Expected:**
- File exists
- Contains token string (64+ characters)

### Verify Server Logs

Review server output for:
- [ ] No error messages
- [ ] Successful authentication logs
- [ ] Email delivery confirmations

### Check Email Quality

Review received emails for:
- [ ] Professional formatting
- [ ] Clear 4-digit code display
- [ ] Correct sender (hello@xdmiq.com)
- [ ] No typos or errors

---

## Phase 4: UAT Sign-Off (5 minutes)

### Overall Results

| Test Case | Result | Notes |
|-----------|--------|-------|
| TC1: Happy Path | _____ | _____ |
| TC2: Token Persistence | _____ | _____ |
| TC3: Invalid Email | _____ | _____ |
| TC4: Invalid Code | _____ | _____ |
| TC5: Performance | _____ | _____ |
| TC6: Expiration | _____ | _____ |
| TC7: Security | _____ | _____ |

**Total Pass:** _____ / 7  
**Total Fail:** _____ / 7  
**Total Blocked:** _____ / 7

### GO / NO-GO Decision

**UAT Result:** [ ] GO FOR PRODUCTION  /  [ ] NO-GO - FIXES REQUIRED

**Decision Criteria:**
- Minimum 6/7 tests must PASS
- TC1 (Happy Path) must PASS
- TC2 (Token Persistence) must PASS
- No critical security issues

### Issues Found

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | _____ | _____ | _____ |
| 2 | _____ | _____ | _____ |
| 3 | _____ | _____ | _____ |

**Severity Levels:** Critical / High / Medium / Low

### Tester Sign-Off

**Tester Name:** _____________________________  
**Date:** _____________________________  
**Signature:** _____________________________

**Recommendation:** _____________________________

---

## Appendix A: Quick Reference Commands

```powershell
# Start server
npm start

# Check health
Invoke-RestMethod -Uri "http://localhost:8080/health"

# Clear token
Remove-Item "$env:USERPROFILE\.mykeys\token" -ErrorAction SilentlyContinue

# Run admin command
node mykeys-cli.js admin --skip-seed

# Run verification
.\scripts\verify-email-auth.ps1

# View token
Get-Content "$env:USERPROFILE\.mykeys\token"
```

## Appendix B: Troubleshooting

### Server won't start
```powershell
# Check if port 8080 is in use
netstat -ano | findstr :8080

# Kill process if needed
Stop-Process -Id <PID> -Force
```

### Email not received
1. Check spam folder
2. Verify ProtonMail credentials
3. Check server logs for SMTP errors
4. Try different email address

### Token not saving
1. Check permissions: `icacls "$env:USERPROFILE\.mykeys"`
2. Check disk space: `Get-PSDrive C`
3. Try manual create: `New-Item -Path "$env:USERPROFILE\.mykeys" -ItemType Directory -Force`

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-29  
**Next Review:** After UAT completion
