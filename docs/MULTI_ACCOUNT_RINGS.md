# Multi-Account Ring System for MyKeys.zip

## Overview

MyKeys.zip now supports multiple accounts through a **ring** (branch) system. Each ring is an isolated account space with its own users and roles. This enables multi-tenant functionality where different organizations or users can have their own isolated mykeys branch.

## Key Concepts

### Rings
- **Ring**: An isolated account space containing users and their roles
- **Ring ID**: Unique identifier for a ring (e.g., `default`, `ring-1234567890-abc123`)
- **First Email**: The first email address associated with a ring (always known, but may not always have all roles)

### Roles
- **owner**: Full administrative access
- **architect**: Can manage users and roles
- **member**: Basic access

### Role Requirements

Each ring **must** meet one of these configurations:

1. **One person with all 3 roles**: Single user has owner + architect + member
2. **Two people with 2 roles each + one person with 1 role**: 
   - Two users each have 2 roles (covering all 3 roles between them)
   - One user has 1 role
3. **Three people, each with one role**: 
   - One user has owner
   - One user has architect  
   - One user has member

## Architecture

### Storage Structure

Rings are stored in KV storage under the `rings` key:

```json
{
  "ring-1234567890-abc123": {
    "id": "ring-1234567890-abc123",
    "firstEmail": "bcherrman@gmail.com",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "members": {
      "bcherrman@gmail.com": {
        "roles": ["owner", "architect", "member"],
        "addedAt": "2025-01-15T10:00:00.000Z"
      },
      "user2@example.com": {
        "roles": ["member"],
        "addedAt": "2025-01-15T11:00:00.000Z"
      }
    }
  }
}
```

### Backward Compatibility

The system maintains backward compatibility with legacy global roles:
- If a user is not in any ring, the system falls back to legacy global roles
- Legacy roles are stored under the `user-roles` key in KV storage
- Role management functions automatically detect and use ring-scoped roles when available

## API Endpoints

### Ring Management

#### Create Ring
```http
POST /api/admin/rings
Authorization: Bearer <token>
Content-Type: application/json

{
  "ringId": "optional-ring-id",
  "firstEmail": "user@example.com",
  "initialRoles": {
    "user@example.com": ["owner", "architect", "member"],
    "user2@example.com": ["member"]
  }
}
```

#### Get All Rings
```http
GET /api/admin/rings
Authorization: Bearer <token>
```

#### Get Specific Ring
```http
GET /api/admin/rings/:ringId
Authorization: Bearer <token>
```

#### Get Ring by Email
```http
GET /api/admin/rings/by-email/:email
Authorization: Bearer <token>
```

#### Update Ring Roles
```http
PUT /api/admin/rings/:ringId/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "roles": {
    "user@example.com": ["owner", "architect", "member"],
    "user2@example.com": ["member"]
  }
}
```

#### Add Member to Ring
```http
POST /api/admin/rings/:ringId/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "roles": ["member"]
}
```

#### Remove Member from Ring
```http
DELETE /api/admin/rings/:ringId/members/:email
Authorization: Bearer <token>
```

#### Initialize Default Ring
```http
POST /api/admin/rings/initialize-default
Authorization: Bearer <token>
```

#### Validate Ring Roles
```http
POST /api/admin/rings/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "roles": {
    "user@example.com": ["owner", "architect", "member"]
  }
}
```

## Migration

### Migrating from Legacy Roles

To migrate existing global roles to ring-based structure:

```bash
node scripts/migrate-to-rings.js [ringId]
```

If `ringId` is not provided, defaults to `default`.

This script:
1. Reads legacy role data from KV storage
2. Creates a new ring with the first email
3. Migrates all users and their roles to the ring
4. Preserves legacy data for safety

### Example Migration

```bash
# Migrate to default ring
node scripts/migrate-to-rings.js

# Migrate to custom ring
node scripts/migrate-to-rings.js my-company-ring
```

## Usage Examples

### Creating a New Ring

```javascript
const { createRing } = require('./ring-management');

// Create ring with first email having all roles
const ring = await createRing('company-ring', 'admin@company.com', {
  'admin@company.com': ['owner', 'architect', 'member'],
  'user1@company.com': ['member'],
  'user2@company.com': ['member']
});
```

### Adding Members to a Ring

```javascript
const { addRingMember } = require('./ring-management');

// Add member with default member role
await addRingMember('company-ring', 'newuser@company.com');

// Add member with specific roles
await addRingMember('company-ring', 'architect@company.com', ['architect', 'member']);
```

### Getting User Roles (Ring-Aware)

```javascript
const { getUserRoles } = require('./role-management');

// Automatically detects ring for email
const roles = await getUserRoles('user@company.com');

// Or specify ring explicitly
const roles = await getUserRoles('user@company.com', 'company-ring');
```

## Validation

The system automatically validates ring configurations when:
- Creating a new ring
- Updating ring roles
- Adding members to a ring
- Removing members from a ring

Validation ensures:
- At least one owner exists
- At least one architect exists
- At least one member exists
- The ring meets one of the three valid configurations

## Security Considerations

1. **Ring Isolation**: Users can only access rings they belong to (unless they have admin roles)
2. **First Email Protection**: The first email cannot be removed from a ring
3. **Role Validation**: All role changes are validated to ensure ring remains valid
4. **Backward Compatibility**: Legacy roles continue to work for users not in rings

## First Email Behavior

- The first email (`bcherrman@gmail.com` by default) is always known
- The first email may not always have all roles
- The first email cannot be removed from a ring
- When creating a ring, the first email must be included

## Error Handling

Common errors and solutions:

### "Ring must have at least one owner, one architect, and one member"
- **Solution**: Ensure your ring configuration includes all three roles across members

### "Cannot remove the first email from a ring"
- **Solution**: The first email must remain in the ring. Remove other members instead.

### "Removing this member would make ring invalid"
- **Solution**: Ensure at least one other member has the roles being removed

## Future Enhancements

Potential future improvements:
- Ring-level secret isolation
- Ring-level API rate limiting
- Ring-level billing and quotas
- Cross-ring collaboration features
- Ring templates and cloning

## Related Files

- `ring-management.js` - Core ring management functions
- `role-management.js` - Role management (now ring-aware)
- `server.js` - API endpoints for ring management
- `scripts/migrate-to-rings.js` - Migration script


