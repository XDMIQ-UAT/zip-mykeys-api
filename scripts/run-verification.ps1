# Run Full Deployment Verification
# Sets up credentials and runs verification script

param(
    [string]$MyKeysPass,
    [switch]$Verbose
)

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Deployment Verification Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Get MYKEYS_PASS
if (-not $MyKeysPass) {
    $MyKeysPass = $env:MYKEYS_PASS
}

if (-not $MyKeysPass) {
    Write-Host "MYKEYS_PASS not found. Please provide it:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Set environment variable" -ForegroundColor Cyan
    Write-Host "  `$env:MYKEYS_PASS = 'your-password'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Pass as parameter" -ForegroundColor Cyan
    Write-Host "  .\scripts\run-verification.ps1 -MyKeysPass 'your-password'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3: Enter now (will be prompted)" -ForegroundColor Cyan
    $securePass = Read-Host "Enter MYKEYS_PASS" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $MyKeysPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    Write-Host ""
}

if (-not $MyKeysPass) {
    Write-Host "❌ MYKEYS_PASS is required" -ForegroundColor Red
    exit 1
}

# Set environment variable for this session
$env:MYKEYS_PASS = $MyKeysPass
Write-Host "✓ MYKEYS_PASS set" -ForegroundColor Green

# Check if VERCEL_TOKEN is in environment
if (-not $env:VERCEL_TOKEN) {
    Write-Host ""
    Write-Host "VERCEL_TOKEN not in environment. Retrieving from mykeys.zip..." -ForegroundColor Yellow
    
    try {
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$MyKeysPass"))
        $headers = @{
            "Authorization" = "Basic $auth"
            "Content-Type" = "application/json"
        }
        
        # Try both possible paths for VERCEL_TOKEN
        $vercelToken = $null
        try {
            $vercelToken = (Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/shared/VERCEL_TOKEN" -Headers $headers -Method Get -ErrorAction Stop).value
        } catch {
            try {
                $vercelToken = (Invoke-RestMethod -Uri "https://mykeys.zip/api/secrets/VERCEL_TOKEN" -Headers $headers -Method Get -ErrorAction Stop).value
            } catch {
                Write-Host "   Tried both API paths, token not found" -ForegroundColor Gray
            }
        }
        
        if ($vercelToken) {
            $env:VERCEL_TOKEN = $vercelToken
            Write-Host "✓ Retrieved VERCEL_TOKEN from mykeys.zip" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not retrieve VERCEL_TOKEN from mykeys.zip: $_" -ForegroundColor Yellow
        Write-Host "   Will test Production only" -ForegroundColor Gray
    }
} else {
    Write-Host "✓ VERCEL_TOKEN found in environment" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Running Verification..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Run verification script
$scriptPath = Join-Path $PSScriptRoot "verify-deployments.ps1"
if ($Verbose) {
    & $scriptPath -Verbose
} else {
    & $scriptPath
}

