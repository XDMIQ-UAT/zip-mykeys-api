# Token Diagnostic and Generation Script
# This script helps diagnose token issues and generate new tokens

param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "diagnose"
)

$MYKEYS_URL = $env:MYKEYS_URL
if (-not $MYKEYS_URL) {
    $MYKEYS_URL = "https://mykeys.zip"
}

Write-Host "=== MyKeys Token Diagnostic Tool ===" -ForegroundColor Cyan
Write-Host ""

# Check current token
$tokenFile = Join-Path $env:USERPROFILE ".mykeys\token"
if (Test-Path $tokenFile) {
    $currentToken = Get-Content $tokenFile -Raw | ForEach-Object { $_.Trim() }
    Write-Host "Current token found: $($currentToken.Substring(0, [Math]::Min(20, $currentToken.Length)))..." -ForegroundColor Yellow
    Write-Host ""
    
    # Validate token
    Write-Host "Validating token..." -ForegroundColor Cyan
    $body = @{ token = $currentToken } | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri "$MYKEYS_URL/api/mcp/token/validate" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        if ($response.valid) {
            Write-Host "✅ Token is VALID" -ForegroundColor Green
            Write-Host "  Client ID: $($response.clientId)" -ForegroundColor Gray
            Write-Host "  Client Type: $($response.clientType)" -ForegroundColor Gray
            Write-Host "  Expires: $($response.expiresAt)" -ForegroundColor Gray
        } else {
            Write-Host "❌ Token is INVALID" -ForegroundColor Red
            Write-Host "  Reason: $($response.reason)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "The token needs to be generated through the API." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "To generate a new token:" -ForegroundColor Cyan
            Write-Host "  1. Visit: https://mykeys.zip/generate-token.html" -ForegroundColor White
            Write-Host "  2. Enter a partial password (any 4+ character substring of the architect password)" -ForegroundColor White
            Write-Host "  3. Click 'Verify Partial Password'" -ForegroundColor White
            Write-Host "  4. Fill in Client ID (e.g., 'cli-$env:COMPUTERNAME')" -ForegroundColor White
            Write-Host "  5. Click 'Generate Token'" -ForegroundColor White
            Write-Host "  6. Copy the token and run:" -ForegroundColor White
            Write-Host "     .\setup-cli-token.ps1 -Token 'YOUR_NEW_TOKEN'" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "❌ Error validating token: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ No token file found at: $tokenFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "To generate a new token:" -ForegroundColor Cyan
    Write-Host "  1. Visit: https://mykeys.zip/generate-token.html" -ForegroundColor White
    Write-Host "  2. Follow the token generation flow" -ForegroundColor White
    Write-Host "  3. Run: .\setup-cli-token.ps1 -Token 'YOUR_TOKEN'" -ForegroundColor Cyan
}

Write-Host ""





