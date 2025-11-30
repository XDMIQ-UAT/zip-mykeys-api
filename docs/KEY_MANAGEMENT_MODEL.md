# Key Management Model

## Overview

MyKeys.zip uses a **ring-based content model** where:
- **Content belongs to the ring**, not individual keys
- **Content can be shared within the same ring** (all members have access)
- **Content cannot be shared between different rings** (complete isolation)
- **Keys can be moved or copied between rings**

## Core Principles

### 1. Content Belongs to the Ring

All secrets/keys stored in a ring are **owned by the ring**, not by individual users or keys. This means:

- ✅ All members of a ring can access all content in that ring
- ✅ Content is automatically shared within the ring
- ✅ No need for explicit sharing between ring members
- ✅ Content persists even if individual members leave

### 2. Intra-Ring Sharing

**Within the same ring:**
- All members can read all keys
- All members can write new keys
- All members can update existing keys
- Content is automatically accessible to all members

**Example:**
```
Ring A has members: [user1@example.com, user2@example.com, user3@example.com]
Ring A has keys: [api-key-1, api-key-2, database-password]

All three users can access all three keys.
```

### 3. Inter-Ring Isolation

**Between different rings:**
- ❌ Keys from Ring A cannot be accessed by Ring B
- ❌ Complete isolation between rings
- ❌ No cross-ring secret sharing
- ✅ Keys can be moved or copied between rings (by admins)

**Example:**
```
Ring A: [user1@example.com] → Keys: [api-key-1]
Ring B: [user2@example.com] → Keys: [api-key-2]

user1@example.com CANNOT access api-key-2
user2@example.com CANNOT access api-key-1
```

### 4. Key Movement and Copying

Keys can be **moved** or **copied** between rings:

- **Copy**: Creates a duplicate in target ring, original remains in source ring
- **Move**: Transfers key from source ring to target ring, removes from source
- Requires admin privileges (owner or architect role)
- Content is transferred, not shared

## Storage Model

### Ring-Scoped Storage

Keys are stored with ring-scoped identifiers:

**Redis/KV:**
```
ring:{ringId}:secret:{keyName}
ring:{ringId}:secret:{keyName}:meta
ring:{ringId}:keys:list
```

**GCP Secret Manager:**
```
ring-{ringId}-{keyName}
```

### Key Registry

Each ring maintains a list of its keys:

```json
{
  "ring-123": ["api-key-1", "api-key-2", "database-password"]
}
```

## API Endpoints

### List Keys in Ring

```http
GET /api/rings/:ringId/keys
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ringId": "ring-123",
    "keys": ["api-key-1", "api-key-2"],
    "count": 2,
    "message": "All keys are accessible to all ring members"
  }
}
```

### Copy Key Between Rings

```http
POST /api/rings/:sourceRingId/keys/:keyName/copy
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetRingId": "ring-456",
  "newKeyName": "api-key-1-copy"  // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "sourceRingId": "ring-123",
    "targetRingId": "ring-456",
    "sourceKeyName": "api-key-1",
    "targetKeyName": "api-key-1-copy",
    "copied": true
  }
}
```

### Move Key Between Rings

```http
POST /api/rings/:sourceRingId/keys/:keyName/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetRingId": "ring-456",
  "newKeyName": "api-key-1"  // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "sourceRingId": "ring-123",
    "targetRingId": "ring-456",
    "sourceKeyName": "api-key-1",
    "targetKeyName": "api-key-1",
    "moved": true
  }
}
```

### Share Key Within Ring (Tracking)

```http
POST /api/rings/:ringId/keys/:keyName/share
Authorization: Bearer <token>
```

**Note:** All members already have access. This endpoint is for tracking/audit purposes.

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "ringId": "ring-123",
    "keyName": "api-key-1",
    "sharedBy": "user@example.com",
    "accessibleTo": ["user1@example.com", "user2@example.com", "user3@example.com"],
    "message": "Key is accessible to all ring members"
  }
}
```

### Get Key Sharing Information

```http
GET /api/rings/:ringId/keys/:keyName/share
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ringId": "ring-123",
    "keyName": "api-key-1",
    "accessibleTo": ["user1@example.com", "user2@example.com", "user3@example.com"],
    "shared": true,
    "message": "Key is accessible to all ring members"
  }
}
```

## Usage Examples

### Storing a Key (Automatically Accessible to Ring)

```javascript
// User stores a key in their ring
const response = await fetch('/api/v1/secrets/my-ecosystem', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    secret_name: 'api-key',
    secret_value: 'secret-123'
  })
});

// Key is automatically accessible to all members of the user's ring
// No explicit sharing needed
```

### Accessing Ring Content

```javascript
// Any member of the ring can access the key
const response = await fetch('/api/v1/secrets/my-ecosystem/api-key', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

// Returns the key value
// Access is automatically granted if user is a ring member
```

### Copying a Key to Another Ring

```javascript
// Admin copies a key from Ring A to Ring B
const response = await fetch('/api/rings/ring-123/keys/api-key/copy', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <admin-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    targetRingId: 'ring-456',
    newKeyName: 'api-key-copy'  // Optional
  })
});

// Key is now available in both rings
// Original remains in ring-123
// Copy is in ring-456
```

### Moving a Key Between Rings

```javascript
// Admin moves a key from Ring A to Ring B
const response = await fetch('/api/rings/ring-123/keys/api-key/move', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <admin-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    targetRingId: 'ring-456'
  })
});

// Key is now only in ring-456
// Removed from ring-123
```

## Access Control

### Within Ring

- ✅ **All members** can read all keys
- ✅ **All members** can write new keys
- ✅ **All members** can update existing keys
- ✅ **Owners/Architects** can delete keys
- ✅ **Owners/Architects** can move/copy keys

### Between Rings

- ❌ **No access** to other rings' keys
- ❌ **No sharing** between rings
- ✅ **Admins** can copy/move keys (requires owner/architect role)

## Security Considerations

### Isolation Guarantees

1. **Storage Isolation**: Keys stored with ring-scoped identifiers
2. **Access Control**: Authentication middleware enforces ring boundaries
3. **No Cross-Ring Access**: API endpoints only return keys from user's ring

### Content Ownership

1. **Ring Ownership**: Content belongs to ring, not individual users
2. **Member Access**: All members have equal access to ring content
3. **Persistence**: Content persists even if members leave

### Key Movement

1. **Admin Only**: Only owners/architects can move/copy keys
2. **Audit Trail**: Movement operations are logged
3. **Validation**: Source and target rings must exist

## Best Practices

### For Ring Members

1. **Understand Ring Access**: All members can see all keys
2. **Use Appropriate Rings**: Store keys in the right ring
3. **Respect Privacy**: Don't store sensitive personal data in shared rings

### For Ring Admins

1. **Organize Keys**: Use rings to organize keys logically
2. **Move, Don't Copy**: Use move when transferring ownership
3. **Audit Regularly**: Review key access and sharing

### For Developers

1. **Ring Context**: Always use ring-scoped storage
2. **Access Control**: Verify ring membership before access
3. **Key Registry**: Maintain key lists for each ring

## Related Files

- `key-management.js` - Key management functions
- `ring-management.js` - Ring management functions
- `server.js` - API endpoints with ring-scoped access control
- `docs/RING_ISOLATION_MESH.md` - Ring isolation documentation
- `docs/MULTI_ACCOUNT_RINGS.md` - Multi-account ring system

