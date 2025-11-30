# Quick CLI Demo - Non-Interactive
# Shows CLI capabilities without requiring user input

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║" -NoNewline -ForegroundColor Cyan
Write-Host "              MyKeys CLI Quick Demo                          " -NoNewline -ForegroundColor White
Write-Host "║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    exit 1
}

$cliPath = Join-Path $PSScriptRoot "..\mykeys-cli.js"
if (-not (Test-Path $cliPath)) {
    Write-Host "❌ CLI file not found" -ForegroundColor Red
    exit 1
}

Write-Host "✓ CLI Ready" -ForegroundColor Green
Write-Host ""

# Show CLI Help
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "CLI Commands Available:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

node $cliPath 2>&1 | Out-String

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Usage Examples:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Show Admin Info:" -ForegroundColor Cyan
Write-Host "   node mykeys-cli.js admin" -ForegroundColor White
Write-Host ""

Write-Host "2. Generate Token (MFA):" -ForegroundColor Cyan
Write-Host "   node mykeys-cli.js generate-token" -ForegroundColor White
Write-Host ""

Write-Host "3. Set Token as Environment Variable:" -ForegroundColor Cyan
Write-Host '   $env:MCP_TOKEN = "your-token-here"' -ForegroundColor White
Write-Host ""

Write-Host "4. Save Token to File:" -ForegroundColor Cyan
Write-Host '   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.mykeys"' -ForegroundColor White
Write-Host '   "your-token" | Out-File -FilePath "$env:USERPROFILE\.mykeys\token"' -ForegroundColor White
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Token Status:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$tokenFound = $false

# Check environment variables
if ($env:MCP_TOKEN) {
    Write-Host "✓ Token in MCP_TOKEN environment variable" -ForegroundColor Green
    $tokenFound = $true
} elseif ($env:MYKEYS_TOKEN) {
    Write-Host "✓ Token in MYKEYS_TOKEN environment variable" -ForegroundColor Green
    $tokenFound = $true
}

# Check token file
$tokenFile = Join-Path $env:USERPROFILE ".mykeys\token"
if (Test-Path $tokenFile) {
    $token = Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue
    if ($token) {
        Write-Host "✓ Token found in file: $tokenFile" -ForegroundColor Green
        $tokenFound = $true
    }
}

if (-not $tokenFound) {
    Write-Host "⚠️  No token found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Generate one with:" -ForegroundColor Gray
    Write-Host "   node mykeys-cli.js generate-token" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Testing token..." -ForegroundColor Yellow
    
    $testToken = if ($env:MCP_TOKEN) { $env:MCP_TOKEN } elseif ($env:MYKEYS_TOKEN) { $env:MYKEYS_TOKEN } else { $token.Trim() }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $testToken"
            "Content-Type" = "application/json"
        }
        
        $adminInfo = Invoke-RestMethod -Uri "https://mykeys.zip/api/admin/info" -Headers $headers -ErrorAction Stop -TimeoutSec 5
        Write-Host "✓ Token is valid!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Role: $($adminInfo.role)" -ForegroundColor Cyan
        Write-Host "  Client: $($adminInfo.tokenInfo.clientId)" -ForegroundColor Cyan
        Write-Host "  Secrets: $($adminInfo.stats.secretsCount)" -ForegroundColor Cyan
    } catch {
        Write-Host "✗ Token test failed (may be expired or invalid)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Generate a new token:" -ForegroundColor Yellow
        Write-Host "   node mykeys-cli.js generate-token" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Quick Start:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "To generate a token and see admin info:" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Step 1: Generate token" -ForegroundColor White
Write-Host "  node mykeys-cli.js generate-token" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # Step 2: Show admin info" -ForegroundColor White
Write-Host "  node mykeys-cli.js admin" -ForegroundColor Cyan
Write-Host ""

Write-Host "For more details, see: CLI_DEMO_GUIDE.md" -ForegroundColor Gray
Write-Host ""





