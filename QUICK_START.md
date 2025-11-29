# MyKeys CLI Quick Start

## Installation

The CLI is a Node.js script. You can use it in several ways:

### Option 1: Direct Node.js (Recommended)

```powershell
node mykeys-cli.js admin
node mykeys-cli.js generate-token
node mykeys-cli.js session-history <seed>
node mykeys-cli.js session-compare <seed> [index]
```

### Option 2: PowerShell Function (Current Session)

Add this to your current PowerShell session:

```powershell
function mykeys { node E:\zip-myl-mykeys-api\mykeys-cli.js $args }
```

Then use:
```powershell
mykeys admin
mykeys generate-token
```

### Option 3: PowerShell Function (Permanent)

Add to your PowerShell profile:

```powershell
# Edit profile
notepad $PROFILE

# Add this function:
function mykeys {
    param(
        [Parameter(Position=0)]
        [string]$Command,
        
        [Parameter(ValueFromRemainingArguments=$true)]
        [string[]]$Args
    )
    
    $scriptPath = "E:\zip-myl-mykeys-api"
    $cliPath = Join-Path $scriptPath "mykeys-cli.js"
    
    if (-not (Test-Path $cliPath)) {
        Write-Host "Error: mykeys-cli.js not found at $cliPath" -ForegroundColor Red
        return
    }
    
    $nodeArgs = @($cliPath)
    if ($Command) {
        $nodeArgs += $Command
    }
    if ($Args) {
        $nodeArgs += $Args
    }
    
    & node $nodeArgs
}
```

### Option 4: Create Alias

```powershell
Set-Alias -Name mykeys -Value "node E:\zip-myl-mykeys-api\mykeys-cli.js"
```

## Usage

### Basic Commands

```powershell
# Show admin info
node mykeys-cli.js admin

# Generate new token
node mykeys-cli.js generate-token

# View session history
node mykeys-cli.js session-history my-project

# Compare session states
node mykeys-cli.js session-compare my-project 0
```

### Session Management

When you run any command, you'll be prompted for a session seed:

```
Session seed: my-project
```

Options:
- **New seed**: Start fresh session
- **Existing seed**: Resume/Delete/Hold session
- **Replay history**: See session evolution
- **Compare states**: Compare current vs historical

## Troubleshooting

### "mykeys: The term 'mykeys' is not recognized"

**Solution:** Use `node mykeys-cli.js` instead, or add the PowerShell function above.

### "No token found"

**Solution:** Generate a token first:
```powershell
node mykeys-cli.js generate-token
```

### "Failed to decrypt session"

**Solution:** Ensure you're using the same token that encrypted the session.

---

**Quick Reference:**
- CLI File: `mykeys-cli.js`
- Location: `E:\zip-myl-mykeys-api\`
- Usage: `node mykeys-cli.js <command>`
