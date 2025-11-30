# Ring Isolation & Mesh Connections

## Overview

MyKeys.zip implements **ring isolation** for secrets/keys while enabling **mesh connections** between rings for discovery and collaboration. Keys on separate rings are completely isolated and can never be shared, but rings can discover each other through minimal metadata.

## Key Principles

### 1. Complete Isolation
- **Secrets are ring-scoped**: Each secret is stored with a ring identifier
- **No cross-ring access**: Secrets from one ring cannot be accessed by another ring
- **Isolated storage**: Ring A's secrets are stored separately from Ring B's secrets

### 2. Minimal Metadata Discovery
- **Bare minimum data**: Only public metadata is shared (no secrets, no user emails)
- **Anonymous support**: Supports anonymous usage patterns
- **Mesh connections**: Rings can discover each other for collaboration

### 3. Layman-Friendly
- **Simple for non-technical users**: Automatic ring assignment
- **Anonymous rings**: Temporary rings for anonymous usage
- **Automatic registration**: Rings are automatically registered when used

## Architecture

### Secret Storage

Secrets are stored with ring-scoped keys:

**Redis/KV Storage:**
```
ring:{ringId}:secret:{secretName}
ring:{ringId}:secret:{secretName}:meta
```

**GCP Secret Manager:**
```
ring-{ringId}-{secretName}
```

### Ring Registry

The ring registry stores minimal metadata for discovery:

```json
{
  "ring-1234567890-abc123": {
    "ringId": "ring-1234567890-abc123",
    "publicName": "Company A",
    "capabilities": ["key-management", "token-management", "password-rotation"],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "lastSeen": "2025-01-15T12:00:00.000Z"
  }
}
```

**What's NOT stored:**
- ❌ User emails
- ❌ Secrets or keys
- ❌ Sensitive data
- ❌ Ring members

**What IS stored:**
- ✅ Ring ID
- ✅ Optional public name
- ✅ Capabilities (what the ring can do)
- ✅ Timestamps (created, last seen)

## Ring Detection

### Automatic Ring Assignment

When a user authenticates:

1. **MCP Token**: Ring determined from token's email
2. **Device Token**: Ring determined from device username
3. **Anonymous**: Creates temporary anonymous ring

### Anonymous Rings

Anonymous rings are created for:
- Users without accounts
- Temporary sessions
- One-time usage

Format: `anon-{timestamp}-{random}`

Example: `anon-1705320000000-abc123`

## API Endpoints

### Secret Management (Ring-Scoped)

#### Get Secret
```http
GET /api/v1/secrets/:ecosystem/:secretName
Authorization: Bearer <token>
```

**Behavior:**
- Automatically uses ring from authentication
- Only returns secrets from user's ring
- Returns 404 if secret not in user's ring

#### Store Secret
```http
POST /api/v1/secrets/:ecosystem
Authorization: Bearer <token>
Content-Type: application/json

{
  "secret_name": "api-key",
  "secret_value": "secret-value",
  "description": "API key for service"
}
```

**Behavior:**
- Automatically stores in user's ring
- Updates ring's lastSeen timestamp
- Cannot access other rings' secrets

### Ring Discovery

#### Discover All Rings
```http
GET /api/rings/discover?includeAnonymous=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ring-123": {
      "ringId": "ring-123",
      "publicName": "Company A",
      "capabilities": ["key-management"],
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastSeen": "2025-01-15T12:00:00.000Z"
    },
    "ring-456": {
      "ringId": "ring-456",
      "publicName": null,
      "capabilities": ["token-management"],
      "createdAt": "2025-01-15T11:00:00.000Z",
      "lastSeen": "2025-01-15T13:00:00.000Z"
    }
  }
}
```

#### Get Ring Metadata
```http
GET /api/rings/:ringId/metadata
Authorization: Bearer <token>
```

#### Search Rings by Capability
```http
GET /api/rings/search?capability=key-management
Authorization: Bearer <token>
```

**Use Cases:**
- Find rings that support key rotation
- Discover rings with specific capabilities
- Enable mesh connections between compatible rings

#### Get Current User's Ring
```http
GET /api/rings/my-ring
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ringId": "ring-123",
    "ring": {
      "id": "ring-123",
      "firstEmail": "user@example.com",
      "members": { ... }
    },
    "metadata": {
      "ringId": "ring-123",
      "publicName": "Company A",
      "capabilities": ["key-management"]
    }
  }
}
```

### Ring Registration (Admin)

#### Register Ring
```http
POST /api/admin/rings/:ringId/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "publicName": "Company A",
  "capabilities": ["key-management", "token-management"]
}
```

#### Update Ring Metadata
```http
PUT /api/admin/rings/:ringId/metadata
Authorization: Bearer <token>
Content-Type: application/json

{
  "publicName": "Updated Name",
  "capabilities": ["key-management", "password-rotation"]
}
```

## Usage Examples

### Storing a Secret (Automatic Ring Assignment)

```javascript
// User authenticates with MCP token
// Ring is automatically determined from token's email

const response = await fetch('/api/v1/secrets/my-ecosystem', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <mcp-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    secret_name: 'api-key',
    secret_value: 'secret-123',
    description: 'API key'
  })
});

// Secret is automatically stored in user's ring
// Other rings cannot access this secret
```

### Discovering Rings

```javascript
// Discover all rings in ecosystem
const response = await fetch('/api/rings/discover', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

const rings = await response.json();

// Find rings with key rotation capability
const keyRotationRings = Object.values(rings.data)
  .filter(ring => ring.capabilities.includes('key-rotation'));
```

### Anonymous Usage

```javascript
// Anonymous user authenticates
// System automatically creates anonymous ring

const response = await fetch('/api/v1/secrets/my-ecosystem', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <anonymous-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    secret_name: 'temp-key',
    secret_value: 'value'
  })
});

// Secret stored in anonymous ring
// Ring is discoverable but shows as "Anonymous"
```

## Security Considerations

### Isolation Guarantees

1. **Storage Isolation**: Secrets are stored with ring-scoped keys
2. **Access Control**: Authentication middleware enforces ring boundaries
3. **No Cross-Ring Access**: API endpoints only return secrets from user's ring

### Privacy

1. **Minimal Metadata**: Registry only stores public information
2. **No User Data**: User emails are never exposed in registry
3. **Anonymous Support**: Supports anonymous usage without exposing identity

### Mesh Connections

1. **Discovery Only**: Registry enables discovery, not direct access
2. **Capability-Based**: Rings can find each other by capabilities
3. **No Secret Sharing**: Discovery does not enable secret sharing

## Migration Notes

### Existing Secrets

Existing secrets (without ring ID) are treated as:
- Legacy secrets (backward compatible)
- Accessible to all authenticated users
- Should be migrated to ring-scoped storage

### Ring Assignment

When migrating:
1. Determine ring for each user
2. Migrate secrets to ring-scoped storage
3. Register rings in registry
4. Update capabilities

## Best Practices

### For Ring Owners

1. **Register Your Ring**: Make your ring discoverable
2. **Set Capabilities**: Describe what your ring can do
3. **Update Metadata**: Keep capabilities current

### For Developers

1. **Use Ring Context**: Always use ring-scoped storage
2. **Respect Isolation**: Never attempt cross-ring access
3. **Leverage Discovery**: Use registry for mesh connections

### For Layman Users

1. **Automatic**: System handles ring assignment automatically
2. **Simple**: Just authenticate and use secrets
3. **Anonymous**: Can use anonymously if needed

## Related Files

- `ring-registry.js` - Ring discovery and registry functions
- `ring-management.js` - Ring management functions
- `server.js` - API endpoints with ring-scoped storage
- `docs/MULTI_ACCOUNT_RINGS.md` - Multi-account ring system documentation

