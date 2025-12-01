# 🎯 MyKeys CLI Demo - Quick Start

## What You Just Got

You generated a **golden ticket** (MCP token) that gives you architect-level access to mykeys.zip. Now you can use the CLI to see your admin info!

## Quick Demo

### 1. Set Your Token

**Option A: Environment Variable (Recommended)**
```powershell
$env:MCP_TOKEN = "your-token-here"
```

**Option B: Save to File**
```powershell
# Create .mykeys directory in your home folder
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.mykeys"

# Save your token
"your-token-here" | Out-File -FilePath "$env:USERPROFILE\.mykeys\token" -Encoding utf8
```

### 2. Run the CLI

```powershell
# Using npm script
npm run cli admin

# Or directly
node mykeys-cli.js admin
```

### 3. See Your Admin Info! 🎉

The CLI will show:
- ✅ Your **role** (architect)
- ✅ Your **context** (token-based)
- ✅ **Token information** (client ID, type, expiration)
- ✅ **Permissions** (what you can do)
- ✅ **Capabilities** (features available)
- ✅ **Statistics** (secrets count, ecosystems)

## Example Output

```
╔════════════════════════════════════════╗
║        MyKeys Admin Info                ║
╚════════════════════════════════════════╝

Role: architect
Context: token-based

Token Information:
  Client ID: dashpc
  Client Type: generic
  Expires: 2/26/2026 (90 days)

Permissions:
  ✓ read_secrets
  ✓ write_secrets
  ✓ list_secrets
  ✓ manage_tokens
  ✓ architect_access
  ✓ full_system_access

Capabilities:
  • API access
  • Secret management
  • Token generation
  • Architect-level operations
  • System administration

Statistics:
  Secrets: 15
  Ecosystems: 3

──────────────────────────────────────────
```

## Making It a Global Command

To use `mykeys` from anywhere:

### Windows (PowerShell)

```powershell
# Add to your PowerShell profile
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force
}

# Add alias
Add-Content -Path $profilePath -Value "Set-Alias -Name mykeys -Value 'node E:\zip-myl-mykeys-api\mykeys-cli.js'"
```

Then reload:
```powershell
. $PROFILE
```

Now you can use:
```powershell
mykeys admin
```

### Alternative: Create a Batch File

Create `mykeys.bat` in a folder in your PATH:

```batch
@echo off
node E:\zip-myl-mykeys-api\mykeys-cli.js %*
```

## What This Demo Shows

This POC demonstrates:
1. ✅ **Token-based authentication** - No passwords needed
2. ✅ **Context-aware responses** - Info based on your role
3. ✅ **Architect privileges** - Full system access
4. ✅ **CLI-first design** - Built for developers

## Next Steps

- Use the token in MCP clients (Cursor, Warp)
- Access secrets via API with your token
- Generate more tokens for different clients
- Explore the full API at https://mykeys.zip/docs

---

**Your token is your golden ticket!** 🎫✨






