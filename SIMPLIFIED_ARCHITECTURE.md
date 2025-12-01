# Simplified Architecture for Projects/Teams/Families

## Overview

The system has been simplified to support:
- **Projects/Teams/Families**: Flexible groups of any size
- **People/Agents/Bots**: Different entity types for HIPAA compliance
- **HIPAA Compliance**: Clear separation of concerns with audit trails

## Key Simplifications

### 1. Roles: Admin/Member (was Owner/Architect/Member)

**Before:**
- Complex role validation requiring owner + architect + member
- Multiple role combinations required

**Now:**
- **Admin**: Full access (create/read/update/delete keys, manage members)
- **Member**: Read/write access to shared keys
- Simple validation: Must have at least one admin

### 2. Entity Types: Person/Agent/Bot

For HIPAA compliance and separation of concerns:

- **Person**: Human user (email-based)
- **Agent**: AI agent/bot (token-based)
- **Bot**: Automated system (token-based)

Each member can be tagged with entity type for audit and compliance.

### 3. Key Visibility: Shared/Private (was complex visibility lists)

**Before:**
- Complex visibility tracking with `visibleTo` arrays
- Ring owners couldn't see member keys by default
- Request/grant workflows for individual access

**Now:**
- **Shared**: Visible to all ring members (default for HIPAA compliance)
- **Private**: Visible only to creator
- Admins can request access to private keys
- Creator can grant access (makes key shared)

### 4. Ring Structure

```javascript
{
  id: "ring-1234567890-abc123",  // Token-based identifier
  firstMember: "user@example.com",
  domain: "gmail.com",            // Metadata only (most common domain)
  createdBy: "creator@xdmiq.com", // Ownership tracking
  type: "project",                // project/team/family
  label: "Home Automation",       // Optional human-readable label
  description: "VPN keys for home",
  tags: ["vpn", "home"],
  members: {
    "user@gmail.com": {
      role: "admin",
      entityType: "person",
      addedAt: "2024-01-01T00:00:00Z"
    },
    "agent-token-123": {
      role: "member",
      entityType: "agent",
      addedAt: "2024-01-02T00:00:00Z"
    }
  }
}
```

### 5. HIPAA Compliance Features

- **Audit Trails**: All key access, member changes, and role updates logged
- **Separation of Concerns**: Entity types distinguish people from agents/bots
- **Access Controls**: Clear admin/member roles with visibility controls
- **Data Isolation**: Rings provide logical separation of data

## API Changes

### Ring Creation
```javascript
POST /api/admin/rings
{
  "firstIdentifier": "user@example.com",
  "initialMembers": {
    "user@example.com": { "role": "admin", "entityType": "person" },
    "agent-token-123": { "role": "member", "entityType": "agent" }
  },
  "type": "project",  // project/team/family
  "label": "Home Automation",
  "description": "VPN keys",
  "tags": ["vpn", "home"]
}
```

### Key Storage
```javascript
POST /api/v1/secrets/:ecosystem
{
  "secret_name": "vpn-key",
  "secret_value": "secret-value",
  "isShared": true  // true = shared with all members, false = private
}
```

### Key Access Request
```javascript
POST /api/rings/:ringId/keys/:keyName/request
{
  "reason": "VPN setup for home automation"
}
```

### Grant Key Access
```javascript
POST /api/rings/:ringId/keys/:keyName/grant
// Makes private key shared with all members
```

## Migration Notes

- Old rings with owner/architect/member roles will be migrated
- Legacy role checks fall back to admin for owner/architect
- Key visibility defaults to shared for backward compatibility
- Audit logs track all changes for compliance

## Benefits

1. **Simpler**: Admin/member instead of complex role combinations
2. **Flexible**: Supports projects/teams/families of any size
3. **HIPAA Compliant**: Entity types, audit trails, separation of concerns
4. **Clear**: Shared/private keys instead of complex visibility rules
5. **Scalable**: Token-based identification, flexible mesh networks


