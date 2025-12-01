# Quick test script for MyKeys CLI demo
# Usage: .\test-cli-demo.ps1 [your-token]

param(
    [Parameter(Mandatory=$false)]
    [string]$Token = ""
)

Write-Host "=== MyKeys CLI Demo Test ===" -ForegroundColor Cyan
Write-Host ""

# Check if token is provided
if (-not $Token) {
    # Try to get from environment
    $Token = $env:MCP_TOKEN
    
    if (-not $Token) {
        # Try to read from file
        $tokenFile = Join-Path $env:USERPROFILE ".mykeys\token"
        if (Test-Path $tokenFile) {
            $Token = Get-Content $tokenFile -Raw
            Write-Host "Found token in: $tokenFile" -ForegroundColor Green
        } else {
            Write-Host "No token found. Please provide one:" -ForegroundColor Yellow
            Write-Host "  .\test-cli-demo.ps1 -Token 'your-token-here'" -ForegroundColor Gray
            Write-Host "  or set: `$env:MCP_TOKEN = 'your-token-here'" -ForegroundColor Gray
            exit 1
        }
    }
}

# Set token for this session
$env:MCP_TOKEN = $Token.Trim()

Write-Host "Testing CLI with token..." -ForegroundColor Yellow
Write-Host ""

# Run the CLI
node mykeys-cli.js admin

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Green






