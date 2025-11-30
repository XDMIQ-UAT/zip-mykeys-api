# Generate New MyKeys Token
# This script helps generate a new token using the partial password flow

param(
    [Parameter(Mandatory=$true)]
    [string]$PartialPassword,
    
    [Parameter(Mandatory=$false)]
    [string]$ClientId = "cli-$env:COMPUTERNAME",
    
    [Parameter(Mandatory=$false)]
    [string]$ClientType = "generic",
    
    [Parameter(Mandatory=$false)]
    [int]$ExpiresInDays = 90
)

$MYKEYS_URL = $env:MYKEYS_URL
if (-not $MYKEYS_URL) {
    $MYKEYS_URL = "https://mykeys.zip"
}

Write-Host "=== MyKeys Token Generator ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify partial password and get architect code
Write-Host "Step 1: Verifying partial password..." -ForegroundColor Yellow
$verifyBody = @{
    partialPassword = $PartialPassword
} | ConvertTo-Json

try {
    $verifyResponse = Invoke-RestMethod -Uri "$MYKEYS_URL/api/auth/verify-partial" `
        -Method POST `
        -ContentType "application/json" `
        -Body $verifyBody `
        -ErrorAction Stop
    
    if ($verifyResponse.success -and $verifyResponse.code) {
        $architectCode = $verifyResponse.code
        Write-Host "✅ Partial password verified!" -ForegroundColor Green
        Write-Host "  Architect code obtained (valid for $($verifyResponse.expiresIn) seconds)" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "❌ Failed to verify partial password" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error verifying partial password: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  $($errorDetails.message)" -ForegroundColor Yellow
    }
    exit 1
}

# Step 2: Generate token using architect code
Write-Host "Step 2: Generating token..." -ForegroundColor Yellow
Write-Host "  Client ID: $ClientId" -ForegroundColor Gray
Write-Host "  Client Type: $ClientType" -ForegroundColor Gray
Write-Host "  Expires In: $ExpiresInDays days" -ForegroundColor Gray
Write-Host ""

$generateBody = @{
    clientId = $ClientId
    clientType = $ClientType
    expiresInDays = $ExpiresInDays
    architectCode = $architectCode
} | ConvertTo-Json

try {
    $generateResponse = Invoke-RestMethod -Uri "$MYKEYS_URL/api/mcp/token/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $generateBody `
        -ErrorAction Stop
    
    if ($generateResponse.success -and $generateResponse.token) {
        Write-Host "✅ Token generated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Token: $($generateResponse.token)" -ForegroundColor Cyan
        Write-Host "Expires: $($generateResponse.expiresAt)" -ForegroundColor Gray
        Write-Host ""
        
        # Ask if user wants to save it
        $save = Read-Host "Save this token? (Y/n)"
        if ($save -ne 'n' -and $save -ne 'N') {
            Write-Host ""
            Write-Host "Saving token..." -ForegroundColor Yellow
            & ".\setup-cli-token.ps1" -Token $generateResponse.token
            Write-Host ""
            Write-Host "✅ Token saved! You can now use: npm run cli admin" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "To save this token later, run:" -ForegroundColor Yellow
            Write-Host "  .\setup-cli-token.ps1 -Token `"$($generateResponse.token)`"" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Failed to generate token" -ForegroundColor Red
        Write-Host "Response: $($generateResponse | ConvertTo-Json)" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Error generating token: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  $($errorDetails.message)" -ForegroundColor Yellow
    }
    exit 1
}





