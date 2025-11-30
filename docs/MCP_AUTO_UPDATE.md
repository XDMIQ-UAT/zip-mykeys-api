# MCP Server Auto-Update Guide

## Overview

MCP server updates **do NOT happen automatically** - users need to manually update their `mcp-server.js` file. However, we've added tools to make this process easier.

## Current Setup

Users have MCP configured in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mykeys-zip": {
      "command": "node",
      "args": ["c:\\users\\dash\\.mykeys\\mcp-server.js"],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MCP_TOKEN": "...",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

The `mcp-server.js` file is stored locally and needs to be updated when new features are added.

## Update Methods

### Method 1: CLI Command (Easiest)

```bash
# Check for updates
mykeys mcp check

# Update to latest version
mykeys mcp update

# Force update (even if versions match)
mykeys mcp update --force
```

### Method 2: Manual Download

1. Visit `https://mykeys.zip/mcp-server.js`
2. Download the file
3. Replace `~/.mykeys/mcp-server.js` with the downloaded file
4. Restart Cursor/Warp

### Method 3: Automatic Check (On Server Start)

The MCP server automatically checks for updates when it starts:

```
⚠️  MCP Server update available: 2.0.0
   Current version: 1.0.0
   Download: https://mykeys.zip/mcp-server.js
   Or run: mykeys mcp update
```

## Why Not Automatic?

MCP servers run as **local processes** (not remote URLs), so:

1. **Security**: Users control what code runs locally
2. **Stability**: Prevents unexpected changes breaking workflows
3. **Transparency**: Users know when updates happen
4. **Rollback**: Users can keep backups and rollback if needed

## Version Checking

### Server-Side

The server exposes version information:

```http
GET /api/mcp/version
```

**Response:**
```json
{
  "version": "2.0.0",
  "downloadUrl": "https://mykeys.zip/mcp-server.js",
  "updateAvailable": false
}
```

### Client-Side

The MCP server checks for updates on startup:

```typescript
// In mcp-server.ts
const MCP_SERVER_VERSION = '2.0.0';
const AUTO_UPDATE_ENABLED = process.env.MCP_AUTO_UPDATE !== 'false';

// Checks version on startup
const updateCheck = await checkForUpdates();
if (updateCheck.updateAvailable) {
  console.error(`⚠️  Update available: ${updateCheck.latestVersion}`);
}
```

## Update Process

### Step 1: Check Current Version

```bash
mykeys mcp check
```

### Step 2: Update

```bash
mykeys mcp update
```

This will:
1. Check for latest version
2. Download `mcp-server.js` to temp file
3. Backup existing file (`.backup`)
4. Replace with new file
5. Make executable

### Step 3: Restart MCP Client

Restart Cursor/Warp to load the updated server.

## Environment Variables

Control update behavior:

```bash
# Disable auto-update checks
export MCP_AUTO_UPDATE=false

# Custom MCP server path
export MCP_SERVER_PATH=~/custom/path/mcp-server.js

# Custom MyKeys URL
export MYKEYS_URL=https://mykeys.zip
```

## MCP Tools for Updates

The MCP server includes tools for checking updates:

### Check Updates Tool

```javascript
// Available via MCP
{
  "name": "check_updates",
  "description": "Check if MCP server update is available"
}
```

### Get Server Info Tool

```javascript
{
  "name": "get_server_info",
  "description": "Get MCP server version, capabilities, and available tools"
}
```

## Best Practices

### For Users

1. **Regular Updates**: Run `mykeys mcp update` periodically
2. **Check on Startup**: MCP server warns about updates
3. **Backup Before Update**: Script automatically creates backups
4. **Test After Update**: Verify tools work after updating

### For Developers

1. **Increment Version**: Update `MCP_SERVER_VERSION` when adding features
2. **Update Tools**: Register new tools in `initializeMCPServer()`
3. **Test Updates**: Verify update script works
4. **Document Changes**: Update changelog with new features

## Troubleshooting

### Update Fails

```bash
# Check if file exists
ls ~/.mykeys/mcp-server.js

# Check permissions
chmod +x ~/.mykeys/mcp-server.js

# Manual download
curl -o ~/.mykeys/mcp-server.js https://mykeys.zip/mcp-server.js
```

### Version Mismatch

```bash
# Check current version
grep MCP_SERVER_VERSION ~/.mykeys/mcp-server.js

# Check server version
curl https://mykeys.zip/api/mcp/version
```

### Backup and Rollback

```bash
# Backup exists automatically
ls ~/.mykeys/mcp-server.js.backup

# Rollback
cp ~/.mykeys/mcp-server.js.backup ~/.mykeys/mcp-server.js
```

## Future Enhancements

Potential improvements:

1. **Auto-Update Toggle**: UI toggle to enable/disable auto-updates
2. **Scheduled Checks**: Periodic background checks for updates
3. **Update Notifications**: Desktop notifications when updates available
4. **Version Pinning**: Allow users to pin to specific versions
5. **Changelog**: Show what's new in each version

## Summary

- ❌ **Fully Automatic**: Not possible (security/stability reasons)
- ✅ **Easy Updates**: `mykeys mcp update` command
- ✅ **Version Checking**: Automatic checks on startup
- ✅ **Backup Safety**: Automatic backups before updates
- ✅ **Transparency**: Users control when updates happen

The update process is designed to be **easy but not automatic**, giving users control while making updates simple.


