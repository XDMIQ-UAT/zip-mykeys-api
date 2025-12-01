# Twilio SMS Troubleshooting Guide

**Date:** November 28, 2025  
**Purpose:** Diagnose and fix Twilio SMS issues

---

## Quick Diagnostic

Run the diagnostic tool:

```bash
node test-twilio-sms.js
```

Or with phone number:

```bash
node test-twilio-sms.js --phone +12132484250
```

---

## Common Issues and Solutions

### 1. "Twilio credentials not found"

**Error:**
```
❌ Twilio credentials not found in mykeys.zip
```

**Solution:**
1. Verify credentials are stored in `mykeys.zip`
2. Secret name must be exactly: `twilio-credentials`
3. Check credentials structure:

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your_auth_token_here",
  "phone_number": "+16269959974"
}
```

**Verify:**
```bash
# Check if secret exists
curl -u admin:password https://mykeys.zip/api/secrets/twilio-credentials
```

---

### 2. "Authentication failed" (401 Error)

**Error:**
```
Status: 401
Authentication failed. Check Twilio account_sid and auth_token.
```

**Solution:**
1. Verify `account_sid` is correct (starts with `AC`)
2. Verify `auth_token` is correct (no extra spaces)
3. Check Twilio Console → Account → API Credentials
4. Regenerate auth token if needed

**Check:**
- Twilio Console: https://console.twilio.com/us1/account/keys-credentials/api-keys
- Verify Account SID matches
- Verify Auth Token matches (or regenerate)

---

### 3. "Account not found" (404 Error)

**Error:**
```
Status: 404
Account not found. Check Twilio account_sid.
```

**Solution:**
1. Verify `account_sid` is correct
2. Check account is active (not suspended)
3. Verify you're using the correct account

**Check:**
- Twilio Console: https://console.twilio.com/us1/account/overview
- Verify Account SID matches exactly

---

### 4. "Invalid phone number format" (Error 21211)

**Error:**
```
Code: 21211
Invalid phone number format. Use E.164 format (e.g., +12132484250)
```

**Solution:**
1. Use E.164 format: `+[country code][number]`
2. Examples:
   - ✅ `+12132484250` (US)
   - ✅ `+442071234567` (UK)
   - ❌ `12132484250` (missing +)
   - ❌ `(213) 248-4250` (formatted)

**Fix:**
```javascript
// Normalize phone number
function normalizePhone(phone) {
  // Remove all non-digits except leading +
  let normalized = phone.trim();
  if (!normalized.startsWith('+')) {
    // Add country code if missing
    const digits = normalized.replace(/\D/g, '');
    if (digits.length === 10) {
      normalized = '+1' + digits; // US
    } else {
      normalized = '+' + digits;
    }
  } else {
    normalized = '+' + normalized.substring(1).replace(/\D/g, '');
  }
  return normalized;
}
```

---

### 5. "Permission denied" (Error 21408)

**Error:**
```
Code: 21408
Permission denied. Phone number not verified (trial account restriction).
```

**Solution:**
1. **Trial Account:** Verify phone number in Twilio Console
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
   - Add phone number to verified list
   - Or upgrade to paid account

2. **Paid Account:** Check account restrictions
   - Verify account is not suspended
   - Check account balance
   - Verify SMS capabilities enabled

**Verify Phone Number:**
- Twilio Console: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- Add phone number: Click "Add a new number"

---

### 6. "Unsubscribed recipient" (Error 21608, 21610)

**Error:**
```
Code: 21608 or 21610
Unsubscribed recipient. Phone number has opted out.
```

**Solution:**
1. Remove phone number from unsubscribe list
2. Twilio Console → Messaging → Compliance → Opt-outs
3. Remove phone number from opt-out list

**Fix:**
- Twilio Console: https://console.twilio.com/us1/monitor/compliance/opt-outs
- Find phone number and remove from list

---

### 7. "Invalid mobile number" (Error 21212, 21614)

**Error:**
```
Code: 21212 or 21614
Invalid phone number. Number is not a valid mobile number.
```

**Solution:**
1. Verify phone number is a mobile number (not landline)
2. Use a different phone number
3. Check number format is correct

**Test:**
- Use a known working mobile number
- Verify number format: `+[country code][number]`

---

### 8. "Network error" or Timeout

**Error:**
```
Network error. Check internet connection and Twilio API availability.
```

**Solution:**
1. Check internet connectivity
2. Verify Twilio API is accessible
3. Check firewall/proxy settings
4. Verify DNS resolution

**Test:**
```bash
# Test Twilio API connectivity
curl https://api.twilio.com/2010-04-01/Accounts.json \
  -u ACxxxxx:your-auth-token
```

---

### 9. "Account balance insufficient"

**Error:**
```
Account balance insufficient
```

**Solution:**
1. Check Twilio account balance
2. Add funds to account
3. Verify payment method is valid

**Check Balance:**
- Twilio Console: https://console.twilio.com/us1/account/billing/overview
- Add funds if needed

---

### 10. SMS Not Received (No Error)

**Symptoms:**
- API returns success
- No SMS received on phone

**Check:**
1. **Twilio Message Logs:**
   - Go to: https://console.twilio.com/us1/monitor/logs/sms
   - Check message status
   - Look for error messages

2. **Message Status:**
   - `queued` - Message is queued (wait a few seconds)
   - `sent` - Message sent successfully
   - `delivered` - Message delivered to carrier
   - `failed` - Message failed (check error code)
   - `undelivered` - Message not delivered (check reason)

3. **Common Reasons:**
   - Phone number incorrect
   - Phone is off/out of coverage
   - Carrier blocking messages
   - Phone number opted out
   - Invalid mobile number

**Debug:**
```bash
# Check message logs in Twilio Console
# Look for message SID from API response
# Check status and error messages
```

---

## Verification Checklist

### Twilio Account Setup

- [ ] Account is active (not suspended)
- [ ] Account has sufficient balance
- [ ] SMS messaging is enabled
- [ ] Phone number is verified (for trial accounts)
- [ ] No restrictions on sending

### Credentials Configuration

- [ ] `twilio-credentials` secret exists in `mykeys.zip`
- [ ] `account_sid` is correct (starts with `AC`)
- [ ] `auth_token` is correct (no spaces)
- [ ] `phone_number` is set (or defaults to +16269959974)

### Phone Number

- [ ] Phone number is in E.164 format (`+12132484250`)
- [ ] Phone number is a mobile number (not landline)
- [ ] Phone number is verified (for trial accounts)
- [ ] Phone number is not on opt-out list
- [ ] Phone has signal/coverage

### API Configuration

- [ ] API server is running
- [ ] Network connectivity is working
- [ ] Twilio API is accessible
- [ ] No firewall blocking requests

---

## Testing Steps

### Step 1: Verify Credentials

```bash
# Check credentials exist
curl -u admin:password https://mykeys.zip/api/secrets/twilio-credentials
```

### Step 2: Test SMS Sending

```bash
# Use diagnostic tool
node test-twilio-sms.js --phone +12132484250
```

### Step 3: Check Twilio Console

1. Go to: https://console.twilio.com/us1/monitor/logs/sms
2. Look for recent messages
3. Check status and error codes
4. Review error messages

### Step 4: Verify Phone Number

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Add phone number if needed (trial accounts)
3. Verify number is active

---

## Twilio Console Links

- **Account Overview:** https://console.twilio.com/us1/account/overview
- **API Credentials:** https://console.twilio.com/us1/account/keys-credentials/api-keys
- **Message Logs:** https://console.twilio.com/us1/monitor/logs/sms
- **Verified Numbers:** https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- **Opt-outs:** https://console.twilio.com/us1/monitor/compliance/opt-outs
- **Account Balance:** https://console.twilio.com/us1/account/billing/overview

---

## Error Code Reference

| Code | Meaning | Solution |
|------|---------|----------|
| 21211 | Invalid phone number format | Use E.164 format |
| 21212 | Invalid mobile number | Use valid mobile number |
| 21408 | Permission denied (trial) | Verify phone number |
| 21608 | Unsubscribed recipient | Remove from opt-out list |
| 21610 | Unsubscribed recipient | Remove from opt-out list |
| 21614 | Invalid mobile number | Use valid mobile number |
| 401 | Authentication failed | Check credentials |
| 404 | Account not found | Check account_sid |

---

## Still Having Issues?

1. **Check Server Logs:**
   - Look for detailed error messages
   - Check Twilio API responses
   - Review error codes

2. **Test Directly with Twilio API:**
   ```bash
   curl -X POST https://api.twilio.com/2010-04-01/Accounts/ACxxxxx/Messages.json \
     -u ACxxxxx:your-auth-token \
     -d "From=+16269959974" \
     -d "To=+12132484250" \
     -d "Body=Test message"
   ```

3. **Contact Twilio Support:**
   - Twilio Support: https://support.twilio.com/
   - Check message logs for specific error codes
   - Provide message SID for troubleshooting

---

**Last Updated:** November 28, 2025






