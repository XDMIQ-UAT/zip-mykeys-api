# Setup script for MyKeys CLI token
# Usage: .\setup-cli-token.ps1 [your-token-here]

param(
    [Parameter(Mandatory=$false)]
    [string]$Token = ""
)

Write-Host "=== MyKeys CLI Token Setup ===" -ForegroundColor Cyan
Write-Host ""

if (-not $Token) {
    Write-Host "Please provide your token:" -ForegroundColor Yellow
    Write-Host "  .\setup-cli-token.ps1 -Token 'your-token-here'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or enter it interactively:" -ForegroundColor Yellow
    $Token = Read-Host "Enter your MCP token"
}

if (-not $Token -or $Token.Trim() -eq "") {
    Write-Host "Error: Token is required" -ForegroundColor Red
    exit 1
}

# Create .mykeys directory
$tokenDir = Join-Path $env:USERPROFILE ".mykeys"
if (-not (Test-Path $tokenDir)) {
    New-Item -ItemType Directory -Path $tokenDir -Force | Out-Null
    Write-Host "Created directory: $tokenDir" -ForegroundColor Green
}

# Save token to file
$tokenFile = Join-Path $tokenDir "token"
$Token.Trim() | Out-File -FilePath $tokenFile -Encoding utf8 -NoNewline
Write-Host "Token saved to: $tokenFile" -ForegroundColor Green

# Also set as environment variable for current session
$env:MCP_TOKEN = $Token.Trim()
Write-Host "Token set in current session (MCP_TOKEN)" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Test it now:" -ForegroundColor Yellow
Write-Host "  npm run cli admin" -ForegroundColor Cyan
Write-Host "  or" -ForegroundColor Gray
Write-Host "  node mykeys-cli.js admin" -ForegroundColor Cyan
Write-Host ""





