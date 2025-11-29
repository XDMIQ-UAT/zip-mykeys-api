# MyKeys CLI Session Management Guide

## Overview

The MyKeys CLI now includes seed-based session management, allowing you to:
- **Resume** previous sessions with their context and memory
- **Delete** sessions when done
- **Hold** sessions temporarily (like temp authorization tokens for context switching)

## How It Works

### Seed-Based Sessions

A **seed** is an identifier you provide to name your session. Think of it as a context identifier:
- Use the same seed to resume a previous session
- Use a new seed to start fresh
- Seeds are stored as filenames (sanitized for safety)

### Session Storage

Sessions are stored in:
- **Active Sessions:** `~/.mykeys/sessions/`
- **Held Sessions:** `~/.mykeys/sessions/held/`

Each session is stored as a JSON file: `{seed}.json`

## Usage

### Starting a Session

When you run any CLI command, you'll be prompted for a seed:

```bash
node mykeys-cli.js admin
```

**Output:**
```
╔════════════════════════════════════════╗
║     MyKeys Session Manager          ║
╚════════════════════════════════════════╝

Enter a session seed (identifier for this context/memory session):
  • Use the same seed to resume a previous session
  • Use a new seed to start a fresh session

Session seed: my-project
```

### Resuming an Existing Session

If you enter a seed that already exists, you'll see:

```
✓ Found existing session!

╔════════════════════════════════════════╗
║        Session Information           ║
╚════════════════════════════════════════╝

Seed: my-project
Created: 1/28/2025, 2:30:00 PM
Last Accessed: 1/28/2025, 3:45:00 PM (75 minutes ago)

Context:
  lastCommand: admin
  lastCommandTime: 2025-01-28T15:45:00.000Z

Memory Entries: 5
  • admin_info: {...}
  • token_generated: {...}
  • ... and 2 more

What would you like to do?
  1. Rejoin this session (continue with existing context)
  2. Delete this session (start fresh)
  3. Hold this session temporarily (save for later, expires in 60 min)
  4. Cancel
```

### Options

**1. Rejoin Session**
- Continues with existing context and memory
- Updates `lastAccessed` timestamp
- All previous memory entries are available

**2. Delete Session**
- Permanently removes the session
- Starts fresh with the same seed
- Useful when you want to reset context

**3. Hold Session**
- Moves session to `held/` directory
- Sets expiration time (default: 60 minutes)
- Can be restored later using the same seed
- Useful for temporary context switching

**4. Cancel**
- Exits without making changes

### Held Sessions

Held sessions are temporary authorization tokens for context switching:

**When you hold a session:**
```
Hold duration in minutes (default: 60): 120
✓ Session held for 120 minutes
You can restore it later using the same seed.
```

**When you try to use a held seed:**
- If still valid: Shows held status and expiration time
- If expired: Prompts to restore or delete

**Restoring a held session:**
- Automatically moves it back to active sessions
- Removes expiration time
- Updates `restoredAt` timestamp

### Skipping Seed Prompt

To skip the seed prompt (for automation):

```bash
node mykeys-cli.js admin --no-seed
# or
node mykeys-cli.js admin --skip-seed
```

## Session Data Structure

Each session file contains:

```json
{
  "seed": "my-project",
  "createdAt": "2025-01-28T14:30:00.000Z",
  "lastAccessed": "2025-01-28T15:45:00.000Z",
  "context": {
    "lastCommand": "admin",
    "lastCommandTime": "2025-01-28T15:45:00.000Z"
  },
  "memory": [
    {
      "timestamp": "2025-01-28T14:35:00.000Z",
      "entry": {
        "type": "admin_info",
        "data": {...}
      }
    },
    {
      "timestamp": "2025-01-28T15:00:00.000Z",
      "entry": {
        "type": "token_generated",
        "expiresAt": "...",
        "clientId": "cli-token"
      }
    }
  ]
}
```

**Held sessions also include:**
```json
{
  "heldAt": "2025-01-28T16:00:00.000Z",
  "heldUntil": "2025-01-28T18:00:00.000Z"
}
```

## Memory Management

The CLI automatically stores memory entries for:
- Admin info queries
- Token generations
- Other CLI operations

Memory is limited to the last **100 entries** per session to prevent file bloat.

## Use Cases

### Context Switching

**Scenario:** Working on multiple projects, need to switch contexts

```bash
# Project A
node mykeys-cli.js admin
# Seed: project-a
# ... do work ...
# Hold session when switching

# Project B
node mykeys-cli.js admin
# Seed: project-b
# ... do work ...

# Back to Project A
node mykeys-cli.js admin
# Seed: project-a
# Choose: Rejoin session
# All previous context restored!
```

### Temporary Authorization

**Scenario:** Need temporary access token that expires

```bash
node mykeys-cli.js generate-token
# Seed: temp-access-2025-01-28
# ... generate token ...
# Hold session for 2 hours
# Session expires automatically
```

### Session Cleanup

**Scenario:** Done with a project, clean up

```bash
node mykeys-cli.js admin
# Seed: old-project
# Choose: Delete session
# Session permanently removed
```

## Best Practices

1. **Use descriptive seeds:** `project-name`, `feature-branch`, `date-based`
2. **Hold sessions for context switching:** Don't delete if you might return
3. **Delete when done:** Clean up completed projects
4. **Set appropriate hold durations:** Match your workflow needs
5. **Use consistent naming:** Makes it easier to find sessions

## Troubleshooting

### Session Not Found
- Check spelling of seed
- Check `~/.mykeys/sessions/` directory
- Held sessions are in `~/.mykeys/sessions/held/`

### Expired Held Session
- Choose "Restore" to reactivate
- Or "Delete" to remove permanently

### Too Many Sessions
- Manually delete old session files
- Sessions older than 30 days can be cleaned up

## Technical Details

- **Session files:** JSON format, UTF-8 encoded
- **Seed sanitization:** Special characters replaced with `_`
- **File naming:** `{sanitized-seed}.json`
- **Memory limit:** 100 entries per session
- **Default hold duration:** 60 minutes

---

**Last Updated:** 2025-01-28  
**Version:** 1.0.0




