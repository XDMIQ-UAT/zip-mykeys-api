# SMS Verification Improvements for jobmatch.zip

## Current Implementation

The SMS verification uses Twilio Messages API to send 4-digit codes.

### Current Flow:
1. User requests code via `/api/auth/request-mfa-code` with `phoneNumber`
2. Server generates 4-digit code and stores it in memory
3. Server sends SMS via Twilio Messages API
4. User enters code via `/api/auth/verify-mfa-code`
5. Server verifies code and generates token

## Issues to Address

### 1. Code Formatting
- Current: Plain text message
- Improvement: Better formatted SMS with branding

### 2. Error Handling
- Current: Basic error messages
- Improvement: More user-friendly error messages

### 3. Rate Limiting
- Current: Basic rate limiting
- Improvement: Per-phone-number rate limiting

### 4. Code Expiration
- Current: 10 minutes
- Improvement: Configurable expiration

### 5. Retry Logic
- Current: No retry mechanism
- Improvement: Allow resending code with cooldown

## Proposed Improvements

### 1. Better SMS Message Format

```javascript
// Current
Body: `Your mykeys.zip verification code is: ${code}. Valid for 10 minutes.`

// Improved
Body: `Your jobmatch.zip verification code is: ${code}\n\nValid for 10 minutes.\n\nIf you didn't request this code, please ignore this message.`
```

### 2. SMS Service Module

Create `sms-service.js` similar to `email-service.js`:

```javascript
const { sendVerificationCode } = require('./sms-service');

async function send2FACodeViaSMS(phoneNumber, code) {
  return await sendVerificationCode(phoneNumber, code, 'jobmatch');
}
```

### 3. Enhanced Error Messages

```javascript
// Map Twilio error codes to user-friendly messages
const errorMessages = {
  21211: 'Invalid phone number. Please check the number and try again.',
  21408: 'This phone number is not verified. Please verify it in your account.',
  21608: 'This phone number has opted out. Please contact support.',
  // ... more mappings
};
```

### 4. Rate Limiting Per Phone Number

```javascript
// Track requests per phone number
const phoneRateLimits = new Map();

function checkRateLimit(phoneNumber) {
  const key = `sms:${phoneNumber}`;
  const lastRequest = phoneRateLimits.get(key);
  const now = Date.now();
  
  if (lastRequest && (now - lastRequest) < 60000) {
    throw new Error('Please wait 60 seconds before requesting another code');
  }
  
  phoneRateLimits.set(key, now);
}
```

## Testing with jobmatch.zip

### Test Script
Use `test-sms-jobmatch.js` to test the full flow:

```bash
node test-sms-jobmatch.js +12132484250
```

### Integration Points
1. jobmatch.zip calls `/api/auth/request-mfa-code` with phone number
2. Receives success response
3. User enters code in jobmatch.zip UI
4. jobmatch.zip calls `/api/auth/verify-mfa-code` with code
5. Receives token
6. Uses token for authenticated API calls

## Next Steps

1. ✅ Create test script for jobmatch.zip
2. ⏳ Improve SMS message formatting
3. ⏳ Create sms-service.js module
4. ⏳ Add per-phone rate limiting
5. ⏳ Enhance error messages
6. ⏳ Add retry/resend functionality



