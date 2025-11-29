# Standardized Error Response Format

All API responses now follow a standardized format with three possible states: **success**, **failure**, or **hung**.

## Response Structure

### Success Response

```json
{
  "status": "success",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "mykeys-api",
  "data": {
    "token": "abc123...",
    "tokenId": "token-id-123",
    "expiresAt": "2025-04-15T10:30:00.000Z"
  },
  "message": "Token generated successfully. Save this token - it will not be shown again!"
}
```

### Failure Response

```json
{
  "status": "failure",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "mykeys-api",
  "error": "Invalid verification code",
  "message": "The code you entered is incorrect.",
  "details": "Code mismatch"
}
```

### Hung Response (Timeout/In Progress)

```json
{
  "status": "hung",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "mykeys-api",
  "error": "Operation timed out",
  "message": "The request is taking longer than expected. Please try again.",
  "details": "Request exceeded 30 second timeout"
}
```

## Status Codes

- **success**: Operation completed successfully (HTTP 200)
- **failure**: Operation failed due to an error (HTTP 400, 401, 403, 404, 500, etc.)
- **hung**: Operation timed out or is still in progress (HTTP 408, 504)

## Implementation

The standardized response format is implemented using helper functions:

```javascript
// Create a response object
function createResponse(status, data, error, message, details)

// Send a standardized response
function sendResponse(res, statusCode, status, data, error, message, details)
```

### Usage Examples

```javascript
// Success response
return sendResponse(res, 200, 'success', {
  token: tokenResult.token,
  tokenId: tokenResult.tokenId
}, null, 'Token generated successfully');

// Failure response
return sendResponse(res, 401, 'failure', null, 'Invalid verification code', 'The code you entered is incorrect.');

// Hung response (for timeouts)
return sendResponse(res, 408, 'hung', null, 'Operation timed out', 'The request is taking longer than expected.', 'Request exceeded 30 second timeout');
```

## Updated Endpoints

The following endpoints have been updated to use the standardized format:

- ✅ `/api/auth/request-mfa-code` - Request MFA code
- ✅ `/api/auth/verify-mfa-code` - Verify MFA code and generate token
- ✅ `/api/mcp/token/generate` - Generate token with architect code
- ✅ `/api/mcp/token/validate` - Validate token
- ✅ Authentication middleware - All authentication errors

## Migration Notes

- Old format responses are being gradually migrated
- New endpoints should use `sendResponse()` helper
- Existing endpoints will be updated incrementally
- Clients should check `status` field instead of HTTP status code alone

## Benefits

1. **Consistency**: All responses follow the same structure
2. **Clarity**: Clear distinction between success, failure, and hung states
3. **Debugging**: Timestamp and service information included
4. **Client-friendly**: Easy to parse and handle in client applications

