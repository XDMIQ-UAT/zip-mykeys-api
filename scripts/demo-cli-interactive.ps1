# Interactive CLI Demo for mykeys.zip
# Shows off all CLI capabilities

param(
    [switch]$SkipTokenGeneration
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║" -NoNewline -ForegroundColor Cyan
Write-Host "          MyKeys CLI Interactive Demo                        " -NoNewline -ForegroundColor White
Write-Host "║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

$nodeVersion = node --version
Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Check if CLI file exists
$cliPath = Join-Path $PSScriptRoot "..\mykeys-cli.js"
if (-not (Test-Path $cliPath)) {
    Write-Host "❌ CLI file not found: $cliPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ CLI found: $cliPath" -ForegroundColor Green
Write-Host ""

# Demo 1: Show CLI help
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Demo 1: CLI Help" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

node $cliPath

Write-Host ""
Write-Host "Press Enter to continue..." -ForegroundColor Gray
Read-Host | Out-Null

# Demo 2: Check for existing token
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Demo 2: Check for Existing Token" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$tokenFound = $false
$tokenSource = ""

# Check environment variables
if ($env:MCP_TOKEN) {
    Write-Host "✓ Token found in MCP_TOKEN environment variable" -ForegroundColor Green
    $tokenFound = $true
    $tokenSource = "MCP_TOKEN"
} elseif ($env:MYKEYS_TOKEN) {
    Write-Host "✓ Token found in MYKEYS_TOKEN environment variable" -ForegroundColor Green
    $tokenFound = $true
    $tokenSource = "MYKEYS_TOKEN"
}

# Check token file
$tokenFile = Join-Path $env:USERPROFILE ".mykeys\token"
if (-not $tokenFound -and (Test-Path $tokenFile)) {
    $token = Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue
    if ($token) {
        Write-Host "✓ Token found in file: $tokenFile" -ForegroundColor Green
        $tokenFound = $true
        $tokenSource = "file"
    }
}

if (-not $tokenFound) {
    Write-Host "⚠️  No token found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Token can be:" -ForegroundColor Gray
    Write-Host "  - Set as environment variable: `$env:MCP_TOKEN = 'your-token'" -ForegroundColor Gray
    Write-Host "  - Saved to file: $tokenFile" -ForegroundColor Gray
    Write-Host "  - Generated using: node mykeys-cli.js generate-token" -ForegroundColor Gray
} else {
    Write-Host "  Source: $tokenSource" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press Enter to continue..." -ForegroundColor Gray
Read-Host | Out-Null

# Demo 3: Generate Token (if not skipping)
if (-not $SkipTokenGeneration) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Demo 3: Generate Token (MFA Flow)" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This will demonstrate the MFA token generation flow." -ForegroundColor Gray
    Write-Host "You'll need:" -ForegroundColor Gray
    Write-Host "  - Phone number (SMS) or Email address" -ForegroundColor Gray
    Write-Host "  - 4-digit verification code" -ForegroundColor Gray
    Write-Host ""
    
    $generate = Read-Host "Generate a new token? (y/N)"
    if ($generate -eq "y" -or $generate -eq "Y") {
        Write-Host ""
        Write-Host "Running token generation..." -ForegroundColor Yellow
        Write-Host ""
        node $cliPath generate-token
        Write-Host ""
    } else {
        Write-Host "Skipping token generation" -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Demo 3: Generate Token (Skipped)" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Token generation skipped. Use -SkipTokenGeneration to skip." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press Enter to continue..." -ForegroundColor Gray
Read-Host | Out-Null

# Demo 4: Show Admin Info (if token exists)
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Demo 4: Show Admin Info" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check for token again (might have been generated)
$hasToken = $false
if ($env:MCP_TOKEN -or $env:MYKEYS_TOKEN) {
    $hasToken = $true
} elseif (Test-Path $tokenFile) {
    $token = Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue
    if ($token) {
        $hasToken = $true
    }
}

if ($hasToken) {
    Write-Host "Running: node mykeys-cli.js admin" -ForegroundColor Gray
    Write-Host ""
    node $cliPath admin
} else {
    Write-Host "⚠️  No token found. Cannot show admin info." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To generate a token:" -ForegroundColor Gray
    Write-Host "  node mykeys-cli.js generate-token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or set token manually:" -ForegroundColor Gray
    Write-Host "  `$env:MCP_TOKEN = 'your-token'" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Press Enter to continue..." -ForegroundColor Gray
Read-Host | Out-Null

# Demo 5: API Examples
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Demo 5: API Usage Examples" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "With your token, you can use the API:" -ForegroundColor Gray
Write-Host ""

Write-Host "1. Get Admin Info (via API):" -ForegroundColor Cyan
Write-Host '   $token = "your-token"' -ForegroundColor White
Write-Host '   $headers = @{"Authorization" = "Bearer $token"}' -ForegroundColor White
Write-Host '   Invoke-RestMethod -Uri "https://mykeys.zip/api/admin/info" -Headers $headers' -ForegroundColor White
Write-Host ""

Write-Host "2. List Secrets:" -ForegroundColor Cyan
Write-Host '   Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared" -Headers $headers' -ForegroundColor White
Write-Host ""

Write-Host "3. Get a Secret:" -ForegroundColor Cyan
Write-Host '   Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/secret-name" -Headers $headers' -ForegroundColor White
Write-Host ""

Write-Host "4. Store a Secret:" -ForegroundColor Cyan
Write-Host '   $body = @{secret_name = "test"; secret_value = "value"} | ConvertTo-Json' -ForegroundColor White
Write-Host '   Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared" -Method POST -Headers $headers -Body $body' -ForegroundColor White
Write-Host ""

Write-Host "Press Enter to continue..." -ForegroundColor Gray
Read-Host | Out-Null

# Demo 6: Quick Test
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Demo 6: Quick API Test" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$testToken = $null
if ($env:MCP_TOKEN) {
    $testToken = $env:MCP_TOKEN
} elseif ($env:MYKEYS_TOKEN) {
    $testToken = $env:MYKEYS_TOKEN
} elseif (Test-Path $tokenFile) {
    $testToken = (Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue).Trim()
}

if ($testToken) {
    Write-Host "Testing API with token..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        $headers = @{
            "Authorization" = "Bearer $testToken"
            "Content-Type" = "application/json"
        }
        
        $adminInfo = Invoke-RestMethod -Uri "https://mykeys.zip/api/admin/info" -Headers $headers -ErrorAction Stop
        Write-Host "✓ API Test Successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Role: $($adminInfo.role)" -ForegroundColor Cyan
        Write-Host "Client ID: $($adminInfo.tokenInfo.clientId)" -ForegroundColor Cyan
        Write-Host "Secrets: $($adminInfo.stats.secretsCount)" -ForegroundColor Cyan
        Write-Host "Ecosystems: $($adminInfo.stats.ecosystemsCount)" -ForegroundColor Cyan
    } catch {
        Write-Host "✗ API Test Failed: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "This might mean:" -ForegroundColor Yellow
        Write-Host "  - Token is invalid or expired" -ForegroundColor Gray
        Write-Host "  - Network connectivity issue" -ForegroundColor Gray
        Write-Host "  - Server is not accessible" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  No token available for testing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Generate a token first:" -ForegroundColor Gray
    Write-Host "  node mykeys-cli.js generate-token" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Demo Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Use CLI: node mykeys-cli.js admin" -ForegroundColor Gray
Write-Host "  2. Generate token: node mykeys-cli.js generate-token" -ForegroundColor Gray
Write-Host "  3. Use API: https://mykeys.zip/api/admin/info" -ForegroundColor Gray
Write-Host "  4. Read docs: .\CLI_DEMO_GUIDE.md" -ForegroundColor Gray
Write-Host ""






