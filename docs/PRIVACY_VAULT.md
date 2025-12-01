# Privacy Vault System

## Overview

Each key in MyKeys.zip can have its own **privacy vault** for storing personal/sacred secrets that should **not** be shared with other ring members, even though the key itself belongs to the ring.

## Two-Tier Content Model

### 1. Ring-Shared Content (Default)
- **Belongs to the ring**: All members can access
- **Automatically shared**: No explicit sharing needed
- **Use case**: Team secrets, shared credentials, collaborative keys

### 2. Privacy Vault (Per-Key, Per-User)
- **Belongs to individual user**: Only the owner can access
- **Encrypted separately**: Uses user-specific encryption
- **Use case**: Personal notes, sacred secrets, private annotations

## Architecture

### Vault Storage

Each user has their own encrypted vault per key:

```
vault:ring:{ringId}:key:{keyName}:user:{userId}:secret:{vaultSecretName}
vault:ring:{ringId}:key:{keyName}:user:{userId}:secrets:list
```

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with user/key-specific salt
- **Master Key**: Optional user-provided master key for additional security
- **Isolation**: Each user's vault is encrypted separately

## Use Cases

### Personal Sacred Secrets
Store personal notes, sacred information, or private annotations that should never be shared:

```javascript
// Store a personal note about a shared API key
await storeVaultSecret(
  'ring-123',
  'api-key-production',
  'user@example.com',
  'personal-notes',
  'This key was rotated on 2025-01-15. Contact John if issues arise.'
);
```

### Private Annotations
Add private context to shared keys without exposing it to the team:

```javascript
// Add private reminder
await storeVaultSecret(
  'ring-123',
  'database-password',
  'user@example.com',
  'reminder',
  'Remember to rotate this quarterly'
);
```

### Personal Credentials
Store personal credentials related to a shared key:

```javascript
// Store personal 2FA backup codes
await storeVaultSecret(
  'ring-123',
  'aws-access-key',
  'user@example.com',
  'backup-codes',
  'code1, code2, code3'
);
```

## API Endpoints

### Store Vault Secret

```http
POST /api/rings/:ringId/keys/:keyName/vault
Authorization: Bearer <token>
Content-Type: application/json

{
  "vault_secret_name": "personal-notes",
  "vault_secret_value": "Private note about this key",
  "master_key": "optional-master-key"  // Optional, for additional encryption
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "ringId": "ring-123",
    "keyName": "api-key",
    "userId": "user@example.com",
    "vaultSecretName": "personal-notes",
    "stored": true
  },
  "message": "Vault secret stored successfully. This secret is private to you and not shared with ring members."
}
```

### Get Vault Secret

```http
GET /api/rings/:ringId/keys/:keyName/vault/:vaultSecretName?master_key=optional
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ringId": "ring-123",
    "keyName": "api-key",
    "vaultSecretName": "personal-notes",
    "vaultSecretValue": "Private note about this key",
    "private": true,
    "message": "This is your personal vault secret, not shared with ring members"
  }
}
```

### List Vault Secrets

```http
GET /api/rings/:ringId/keys/:keyName/vault
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ringId": "ring-123",
    "keyName": "api-key",
    "userId": "user@example.com",
    "vaultSecrets": ["personal-notes", "reminder", "backup-codes"],
    "metadata": {
      "ringId": "ring-123",
      "keyName": "api-key",
      "userId": "user@example.com",
      "secretCount": 3,
      "secrets": [...],
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    },
    "message": "These are your personal vault secrets, not shared with ring members"
  }
}
```

### Delete Vault Secret

```http
DELETE /api/rings/:ringId/keys/:keyName/vault/:vaultSecretName
Authorization: Bearer <token>
```

### Check Vault Existence

```http
GET /api/rings/:ringId/keys/:keyName/vault/exists
Authorization: Bearer <token>
```

## Security Model

### Encryption

1. **User-Specific Keys**: Each user's vault uses a unique encryption key
2. **Key Derivation**: Derived from user ID + key name + optional master key
3. **No Cross-User Access**: Even ring admins cannot decrypt other users' vaults
4. **Optional Master Key**: Additional layer of encryption for extra security

### Access Control

1. **Ring Membership Required**: User must be a member of the ring
2. **User-Only Access**: Only the vault owner can access their vault
3. **No Sharing**: Vault secrets cannot be shared, even within the ring
4. **Audit Trail**: All vault operations are logged

### Isolation

- ✅ **Ring Isolation**: Vaults are ring-scoped (can't access vaults from other rings)
- ✅ **User Isolation**: Each user's vault is encrypted separately
- ✅ **Key Isolation**: Each key has its own vault namespace

## Comparison: Ring Content vs Privacy Vault

| Feature | Ring Content | Privacy Vault |
|---------|-------------|---------------|
| **Ownership** | Ring (all members) | Individual user |
| **Access** | All ring members | Only vault owner |
| **Sharing** | Automatic within ring | Never shared |
| **Encryption** | Ring-scoped | User-specific |
| **Use Case** | Team secrets | Personal/sacred secrets |
| **Visibility** | Visible to all members | Private to owner |

## Usage Examples

### Storing Personal Notes

```javascript
// User stores personal notes about a shared API key
const response = await fetch('/api/rings/ring-123/keys/api-key/vault', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    vault_secret_name: 'personal-notes',
    vault_secret_value: 'This key expires on 2025-12-31. Contact vendor for renewal.'
  })
});
```

### Retrieving Personal Secrets

```javascript
// User retrieves their personal vault secret
const response = await fetch('/api/rings/ring-123/keys/api-key/vault/personal-notes', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

const data = await response.json();
console.log(data.data.vaultSecretValue); // Private note
```

### Using Master Key for Extra Security

```javascript
// Store with master key for additional encryption
const response = await fetch('/api/rings/ring-123/keys/api-key/vault', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    vault_secret_name: 'sacred-secret',
    vault_secret_value: 'Highly sensitive information',
    master_key: 'user-provided-master-key'
  })
});

// Retrieve with master key
const getResponse = await fetch('/api/rings/ring-123/keys/api-key/vault/sacred-secret?master_key=user-provided-master-key', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});
```

## Best Practices

### When to Use Privacy Vault

✅ **Use Privacy Vault for:**
- Personal notes about shared keys
- Private annotations or reminders
- Personal credentials (backup codes, etc.)
- Sacred or highly sensitive personal information
- Information that should never be shared

❌ **Don't Use Privacy Vault for:**
- Information that should be shared with the team
- Team credentials or shared secrets
- Information that needs collaboration

### Security Recommendations

1. **Use Master Keys**: For highly sensitive vault secrets, use a master key
2. **Regular Rotation**: Consider rotating master keys periodically
3. **Separate Vaults**: Use different vault secret names for different purposes
4. **Backup**: Ensure you have a way to recover vault secrets if needed

### Organization

1. **Naming Convention**: Use clear names for vault secrets (e.g., `personal-notes`, `backup-codes`)
2. **Documentation**: Document what each vault secret contains (in your own notes)
3. **Cleanup**: Regularly review and delete unused vault secrets

## Integration with Ring Model

The privacy vault system integrates seamlessly with the ring-based content model:

1. **Ring Membership Required**: You must be a ring member to create a vault
2. **Key Must Exist**: The key must exist in the ring before creating a vault
3. **Separate Storage**: Vaults are stored separately from ring content
4. **Independent Access**: Vault access is independent of ring content access

## Related Files

- `privacy-vault.js` - Privacy vault implementation
- `key-management.js` - Key management functions
- `ring-management.js` - Ring management functions
- `docs/KEY_MANAGEMENT_MODEL.md` - Key management model documentation



