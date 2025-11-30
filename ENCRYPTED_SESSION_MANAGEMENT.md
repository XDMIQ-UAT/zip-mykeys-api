# Encrypted Session Management

**Date:** 2025-01-28  
**Status:** ✅ Complete

## Overview

Sessions are now **encrypted** both locally and on the server. All diffs needed to recover sessions are committed encrypted, and you can replay history to remind of the session and its value, then compare to the current state.

## Features

### 🔐 Encryption

- **Local Encryption:** All sessions encrypted using AES-256-CBC
- **Server Encryption:** Sessions synced to server remain encrypted (server never sees plaintext)
- **Key Derivation:** Encryption key derived from your MCP token
- **Automatic:** Encryption happens transparently - no user action required

### 📝 Diff Tracking

- **Automatic Diffs:** Every session change creates an encrypted diff
- **Committed Diffs:** Diffs stored in `~/.mykeys/sessions/diffs/` (encrypted)
- **Recovery:** Diffs can be replayed to reconstruct session state
- **History:** Full change history maintained

### 🕐 History Snapshots

- **Periodic Snapshots:** Snapshots created every 10 changes or every hour
- **Encrypted Storage:** Snapshots stored in `~/.mykeys/sessions/history/` (encrypted)
- **Replay:** Replay history to see session evolution
- **Comparison:** Compare current state vs historical snapshots

### 🔄 Server Sync

- **Automatic Sync:** Sessions automatically synced to server
- **Encrypted Transport:** Only encrypted data sent to server
- **GCP Secret Manager:** Optional persistence in GCP Secret Manager
- **Recovery:** Sessions can be recovered from server if local files lost

## Architecture

### Encryption Flow

```
Session Data → Encrypt (AES-256-CBC) → Store Locally
                              ↓
                         Sync to Server (encrypted)
                              ↓
                    GCP Secret Manager (optional)
```

### Key Derivation

```javascript
encryptionKey = SHA256(token + 'session-encryption-key')
```

The encryption key is derived from your MCP token, ensuring:
- Only you can decrypt your sessions
- No plaintext keys stored
- Token rotation invalidates old sessions (by design)

### Storage Structure

```
~/.mykeys/sessions/
├── {seed}.json              # Active sessions (encrypted)
├── held/
│   └── {seed}.json          # Held sessions (encrypted)
├── history/
│   └── {seed}-{timestamp}.json  # History snapshots (encrypted)
└── diffs/
    └── {seed}-{timestamp}.json   # Encrypted diffs
```

## Usage

### Basic Usage

Sessions are automatically encrypted when you use the CLI:

```bash
node mykeys-cli.js admin
# Enter seed: my-project
# Session automatically encrypted and synced
```

### Replay History

View session history to remind yourself of the session and its value:

```bash
node mykeys-cli.js session-history my-project
```

**Output:**
```
╔════════════════════════════════════════╗
║      Session History Replay          ║
╚════════════════════════════════════════╝

Seed: my-project
Snapshots: 5
Diffs: 23

History Snapshots:
  1. 1/28/2025, 2:30:00 PM
     Context: {"lastCommand":"admin"}
     Memory entries: 3
  2. 1/28/2025, 3:30:00 PM
     Context: {"lastCommand":"generate-token"}
     Memory entries: 8
  ...

Change History:
  1. 1/28/2025, 2:35:00 PM
     ~ context
     + memory
  2. 1/28/2025, 2:40:00 PM
     ~ lastAccessed
  ...
```

### Compare States

Compare current session state with historical snapshot:

```bash
node mykeys-cli.js session-compare my-project [snapshot-index]
```

**Output:**
```
╔════════════════════════════════════════╗
║     Session Comparison              ║
╚════════════════════════════════════════╝

Seed: my-project
Snapshot: 1/28/2025, 2:30:00 PM
Current: 1/28/2025, 4:00:00 PM

Found 3 differences:
  ~ context
    Historical: {"lastCommand":"admin"}
    Current:    {"lastCommand":"generate-token"}
  + memory
  ~ lastAccessed
```

### Automatic Diff Creation

Every time a session is saved, a diff is automatically created:

```javascript
// Old session state
{
  context: { lastCommand: 'admin' },
  memory: [entry1, entry2]
}

// New session state  
{
  context: { lastCommand: 'admin' },
  memory: [entry1, entry2, entry3]  // Added entry3
}

// Automatic diff created:
{
  timestamp: "2025-01-28T16:00:00.000Z",
  changes: [
    {
      field: "memory",
      old: [entry1, entry2],
      new: [entry1, entry2, entry3],
      type: "modified"
    }
  ]
}
```

## API Endpoints

### Store Session (Encrypted)

```http
PUT /api/sessions/:seed
Authorization: Bearer {token}
Content-Type: application/json

{
  "encrypted": "hex-encrypted-data",
  "iv": "hex-initialization-vector",
  "algorithm": "aes-256-cbc"
}
```

### Retrieve Session (Encrypted)

```http
GET /api/sessions/:seed
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "encrypted": "hex-encrypted-data",
  "iv": "hex-initialization-vector",
  "algorithm": "aes-256-cbc",
  "updatedAt": "2025-01-28T16:00:00.000Z"
}
```

### List Sessions

```http
GET /api/sessions
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "seed": "my-project",
      "updatedAt": "2025-01-28T16:00:00.000Z",
      "clientId": "cli-token"
    }
  ],
  "count": 1
}
```

### Delete Session

```http
DELETE /api/sessions/:seed
Authorization: Bearer {token}
```

## Security Considerations

### Encryption

- **Algorithm:** AES-256-CBC
- **Key Derivation:** SHA-256 hash of token + salt
- **IV:** Random 16 bytes per encryption
- **No Plaintext:** Server never sees unencrypted session data

### Key Management

- **Token-Based:** Encryption key derived from MCP token
- **No Storage:** Encryption key never stored
- **Rotation:** Token rotation invalidates old sessions (by design)

### Recovery

- **Encrypted Diffs:** All diffs encrypted before storage
- **Server Backup:** Sessions synced to server (encrypted)
- **GCP Backup:** Optional GCP Secret Manager storage
- **History:** Full encrypted history maintained

## Implementation Details

### Encryption Functions

```javascript
// Encrypt session data
function encryptSessionData(data, token) {
  const key = deriveEncryptionKey(token);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    algorithm: 'aes-256-cbc'
  };
}

// Decrypt session data
function decryptSessionData(encryptedData, token) {
  const key = deriveEncryptionKey(token);
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}
```

### Diff Calculation

```javascript
function calculateDiff(oldState, newState) {
  const diff = {
    timestamp: new Date().toISOString(),
    changes: [],
  };
  
  const allKeys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);
  
  for (const key of allKeys) {
    const oldValue = oldState?.[key];
    const newValue = newState?.[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diff.changes.push({
        field: key,
        old: oldValue,
        new: newValue,
        type: oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'modified'
      });
    }
  }
  
  return diff;
}
```

## Use Cases

### 1. Context Recovery

**Scenario:** Need to remember what you were working on

```bash
# Replay history to see what happened
node mykeys-cli.js session-history my-project

# Compare with current state
node mykeys-cli.js session-compare my-project
```

### 2. Session Value Assessment

**Scenario:** Determine if session is still valuable

```bash
# Replay history to see session evolution
node mykeys-cli.js session-history my-project

# Compare current vs historical to see changes
node mykeys-cli.js session-compare my-project 0
```

### 3. Recovery from Server

**Scenario:** Local files lost, recover from server

```bash
# Session automatically loads from server if local missing
node mykeys-cli.js admin
# Enter seed: my-project
# Session recovered from server automatically
```

### 4. Encrypted Diff Commits

**Scenario:** Need to commit session diffs for recovery

```bash
# Diffs automatically created and encrypted
# Located in: ~/.mykeys/sessions/diffs/
# Can be committed to version control (encrypted)
git add ~/.mykeys/sessions/diffs/
git commit -m "Encrypted session diffs"
```

## Troubleshooting

### Cannot Decrypt Session

**Error:** "Failed to decrypt session data"

**Solution:**
- Ensure you're using the same token that encrypted the session
- Token rotation invalidates old sessions (by design)
- Check that session file is not corrupted

### Server Sync Failed

**Error:** Silent failure (optional feature)

**Solution:**
- Server sync is optional - sessions work locally
- Check network connectivity
- Verify token is valid
- Check server logs

### History Not Found

**Error:** "No history found for this session"

**Solution:**
- History only created after multiple changes
- Snapshots created every 10 changes or every hour
- Ensure session has been used multiple times

## Best Practices

1. **Regular Snapshots:** History snapshots created automatically
2. **Encrypted Storage:** All data encrypted before storage
3. **Server Backup:** Enable server sync for recovery
4. **Diff Commits:** Commit encrypted diffs to version control
5. **Token Security:** Protect your MCP token (it's the encryption key)

---

**Last Updated:** 2025-01-28  
**Version:** 1.0.0





