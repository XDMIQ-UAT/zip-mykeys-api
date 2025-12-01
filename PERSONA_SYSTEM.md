# Progressive Persona System: Anonymous → Logged → Named → Profiled

## Overview

**Service tiers based on engagement level** - Progressive disclosure that works for both AI agents and humans.

## The Four Personas

### 1. Anonymous
**Level**: Basic access, no identity required
- **Access**: Public endpoints, read-only
- **Limitations**: Rate-limited, no persistence
- **Use case**: Exploration, discovery
- **For AI agents**: Can discover infrastructure, read public data
- **For humans**: Can browse, see what's available

### 2. Logged
**Level**: Has token/account, tracked usage
- **Access**: Authenticated endpoints, basic operations
- **Limitations**: Limited storage, basic features
- **Use case**: Active usage, basic credential management
- **For AI agents**: Token-based access, can create/read keys
- **For humans**: Account created, can manage basic credentials

### 3. Named
**Level**: Has identity (email/name), personalized
- **Access**: Full features, personalized experience
- **Limitations**: Standard limits, full feature set
- **Use case**: Regular usage, team collaboration
- **For AI agents**: Agent identity established, can join rings
- **For humans**: Profile complete, can create/join teams

### 4. Profiled
**Level**: Complete profile, premium service
- **Access**: Premium features, priority support
- **Limitations**: Higher limits, advanced features
- **Use case**: Enterprise, advanced needs
- **For AI agents**: Full capabilities, automated infrastructure access
- **For humans**: Complete onboarding, business features

## Persona Progression

### For AI Agents

```
Anonymous
  ↓ (Get token)
Logged (agent-token-123)
  ↓ (Register identity)
Named (agent: "deployment-bot", capabilities: [...])
  ↓ (Complete profile)
Profiled (full capabilities, automated infrastructure access)
```

### For Humans

```
Anonymous
  ↓ (Sign up)
Logged (email: user@example.com)
  ↓ (Complete profile)
Named (name: "John Doe", company: "Acme Inc")
  ↓ (Upgrade/complete onboarding)
Profiled (business entity, domain, full features)
```

## Technical Implementation

### Persona Detection

```javascript
function getPersona(identifier, ringId = null) {
  // Check if identifier exists
  if (!identifier) {
    return 'anonymous';
  }
  
  // Check if logged (has token/account)
  const hasAccount = await hasAccount(identifier);
  if (!hasAccount) {
    return 'anonymous';
  }
  
  // Check if named (has identity)
  const identity = await getIdentity(identifier);
  if (!identity || !identity.name) {
    return 'logged';
  }
  
  // Check if profiled (complete profile)
  const profile = await getProfile(identifier);
  if (!profile || !profile.complete) {
    return 'named';
  }
  
  return 'profiled';
}
```

### Persona-Based Access Control

```javascript
function canAccess(persona, feature) {
  const personaFeatures = {
    anonymous: ['discover', 'read-public'],
    logged: ['discover', 'read-public', 'create-key', 'read-key'],
    named: ['discover', 'read-public', 'create-key', 'read-key', 'join-ring', 'create-ring'],
    profiled: ['discover', 'read-public', 'create-key', 'read-key', 'join-ring', 'create-ring', 'automated-infrastructure', 'business-features']
  };
  
  return personaFeatures[persona]?.includes(feature) || false;
}
```

## API Design

### 1. Get Current Persona

```javascript
GET /api/persona/me
Authorization: Bearer <token>

Response:
{
  "persona": "named",
  "identifier": "user@example.com",
  "nextLevel": "profiled",
  "upgradePath": {
    "steps": [
      "Complete business profile",
      "Link domain",
      "Enable automated infrastructure"
    ]
  }
}
```

### 2. Upgrade Persona

```javascript
POST /api/persona/upgrade
Authorization: Bearer <token>
{
  "targetPersona": "named",
  "data": {
    "name": "John Doe",
    "company": "Acme Inc"
  }
}

Response:
{
  "success": true,
  "previousPersona": "logged",
  "currentPersona": "named",
  "unlockedFeatures": ["join-ring", "create-ring"]
}
```

### 3. Persona-Based Feature Access

```javascript
GET /api/features
Authorization: Bearer <token>

Response:
{
  "persona": "named",
  "availableFeatures": [
    "discover",
    "read-public",
    "create-key",
    "read-key",
    "join-ring",
    "create-ring"
  ],
  "unavailableFeatures": [
    "automated-infrastructure",
    "business-features"
  ],
  "upgradeToUnlock": "profiled"
}
```

## Persona-Specific Features

### Anonymous
- ✅ Discover automated infrastructure
- ✅ Read public ring metadata
- ✅ View public documentation
- ❌ Create keys
- ❌ Join rings
- ❌ Access credentials

### Logged
- ✅ All Anonymous features
- ✅ Create keys (limited)
- ✅ Read own keys
- ✅ Basic credential management
- ❌ Join rings
- ❌ Create rings
- ❌ Automated infrastructure

### Named
- ✅ All Logged features
- ✅ Join rings
- ✅ Create rings
- ✅ Team collaboration
- ✅ Profile management
- ❌ Automated infrastructure
- ❌ Business features

### Profiled
- ✅ All Named features
- ✅ Automated infrastructure
- ✅ Business entity creation
- ✅ Domain registration
- ✅ Advanced features
- ✅ Priority support
- ✅ Higher limits

## Persona Progression Triggers

### Anonymous → Logged
- **Trigger**: Get token / Create account
- **Action**: Issue token, create basic account
- **Unlocks**: Basic credential management

### Logged → Named
- **Trigger**: Complete identity (name, email verification)
- **Action**: Create profile, verify identity
- **Unlocks**: Ring features, team collaboration

### Named → Profiled
- **Trigger**: Complete business profile (entity, domain, etc.)
- **Action**: Link business entity, domain, enable features
- **Unlocks**: Automated infrastructure, business features

## Marketing Messaging

### Anonymous
**"Explore automated credential management"**
- No signup required
- See what's possible
- Discover infrastructure

### Logged
**"Start managing credentials"**
- Get started quickly
- Basic features unlocked
- Build your credential library

### Named
**"Join teams and collaborate"**
- Create and join rings
- Team credential management
- Professional features

### Profiled
**"Complete business infrastructure"**
- Automated business setup
- Domain registration
- Enterprise features

## Data Model

### Persona Tracking

```javascript
{
  "identifier": "user@example.com",
  "persona": "named",
  "personaHistory": [
    {
      "persona": "anonymous",
      "attainedAt": "2024-01-01T00:00:00Z"
    },
    {
      "persona": "logged",
      "attainedAt": "2024-01-01T01:00:00Z"
    },
    {
      "persona": "named",
      "attainedAt": "2024-01-01T02:00:00Z"
    }
  ],
  "profile": {
    "name": "John Doe",
    "company": "Acme Inc",
    "complete": false  // Not yet profiled
  }
}
```

### Persona Metadata

```javascript
{
  "persona": "named",
  "features": ["discover", "read-public", "create-key", "read-key", "join-ring", "create-ring"],
  "limits": {
    "keys": 100,
    "rings": 10,
    "members": 50
  },
  "upgradePath": {
    "nextPersona": "profiled",
    "requirements": [
      "Complete business profile",
      "Link domain",
      "Enable automated infrastructure"
    ]
  }
}
```

## Benefits

### For Users (AI Agents & Humans)
- ✅ **Low friction**: Start anonymous, no commitment
- ✅ **Progressive disclosure**: Unlock features as you need them
- ✅ **Clear value**: See what you get at each level
- ✅ **Natural progression**: Move up as you engage

### For Platform
- ✅ **User acquisition**: Anonymous lowers barrier to entry
- ✅ **Engagement**: Progressive unlocks keep users engaged
- ✅ **Upselling**: Natural upgrade path
- ✅ **Retention**: Users invested in progression

## Implementation Strategy

### Phase 1: Persona Detection
- [ ] Add persona field to user/agent records
- [ ] Implement persona detection logic
- [ ] Add persona tracking

### Phase 2: Access Control
- [ ] Implement persona-based feature access
- [ ] Add persona checks to API endpoints
- [ ] Create feature matrix

### Phase 3: Progression System
- [ ] Build upgrade endpoints
- [ ] Create progression triggers
- [ ] Add upgrade notifications

### Phase 4: Marketing Integration
- [ ] Persona-specific messaging
- [ ] Upgrade prompts
- [ ] Feature unlock notifications

## Conclusion

**Progressive Personas**: Anonymous → Logged → Named → Profiled

**Benefits**:
- Low friction entry (anonymous)
- Natural progression (logged → named → profiled)
- Clear value at each level
- Works for both AI agents and humans

**Result**: Users know what level of service they need/want/deserve, and the platform delivers it progressively! 🚀


