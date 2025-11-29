# Set MYKEYS_PASS and run verification
# This script will prompt for the password and then run full verification

param(
    [switch]$Verbose
)

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Set MYKEYS_PASS and Run Verification" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if already set
if ($env:MYKEYS_PASS) {
    Write-Host "MYKEYS_PASS is already set in environment" -ForegroundColor Green
    $useExisting = Read-Host "Use existing value? (Y/n)"
    if ($useExisting -eq 'n' -or $useExisting -eq 'N') {
        $env:MYKEYS_PASS = $null
    }
}

# Get password if not set - try Vercel first
if (-not $env:MYKEYS_PASS) {
    Write-Host ""
    Write-Host "MYKEYS_PASS not found. Attempting to retrieve from Vercel..." -ForegroundColor Yellow
    
    # Try to get from Vercel (Preview/Development can be retrieved)
    $getPasswordScript = Join-Path $PSScriptRoot "get-mykeys-pass-from-vercel.ps1"
    if (Test-Path $getPasswordScript) {
        try {
            # Try Preview first (most likely to be readable)
            $retrievedPass = & $getPasswordScript -Environment "preview" -ErrorAction SilentlyContinue
            if ($retrievedPass) {
                $env:MYKEYS_PASS = $retrievedPass
                Write-Host "✓ Retrieved MYKEYS_PASS from Vercel (Preview)" -ForegroundColor Green
            } else {
                # Try Development
                $retrievedPass = & $getPasswordScript -Environment "development" -ErrorAction SilentlyContinue
                if ($retrievedPass) {
                    $env:MYKEYS_PASS = $retrievedPass
                    Write-Host "✓ Retrieved MYKEYS_PASS from Vercel (Development)" -ForegroundColor Green
                }
            }
        } catch {
            Write-Host "⚠️  Could not retrieve from Vercel: $_" -ForegroundColor Yellow
        }
    }
    
    # If still not set, prompt
    if (-not $env:MYKEYS_PASS) {
        Write-Host ""
        Write-Host "Could not retrieve from Vercel. Options:" -ForegroundColor Yellow
        Write-Host "  1. Retrieve manually:" -ForegroundColor Gray
        Write-Host "     .\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview -SetEnvironmentVariable" -ForegroundColor Cyan
        Write-Host "  2. Enter manually (input will be hidden):" -ForegroundColor Gray
        $securePass = Read-Host "Password"
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
        $env:MYKEYS_PASS = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        Write-Host "✓ MYKEYS_PASS set" -ForegroundColor Green
    }
}

# Check if VERCEL_TOKEN or VERCEL_KEY is set
if (-not $env:VERCEL_TOKEN -and -not $env:VERCEL_KEY) {
    Write-Host ""
    Write-Host "VERCEL_TOKEN not in environment. Retrieving from mykeys.zip..." -ForegroundColor Yellow
    
    try {
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$($env:MYKEYS_PASS)"))
        $headers = @{
            "Authorization" = "Basic $auth"
            "Content-Type" = "application/json"
        }
        
        # Try multiple API paths
        $paths = @(
            "https://mykeys.zip/api/v1/secrets/shared/VERCEL_TOKEN",
            "https://mykeys.zip/api/secrets/VERCEL_TOKEN",
            "https://mykeys.zip/api/v1/secrets/VERCEL_TOKEN"
        )
        
        $vercelToken = $null
        foreach ($path in $paths) {
            try {
                $vercelToken = (Invoke-RestMethod -Uri $path -Headers $headers -Method Get -ErrorAction Stop).value
                if ($vercelToken) {
                    $env:VERCEL_TOKEN = $vercelToken
                    Write-Host "✓ Retrieved VERCEL_TOKEN from mykeys.zip" -ForegroundColor Green
                    break
                }
            } catch {
                # Try next path
            }
        }
        
        if (-not $vercelToken) {
            Write-Host "⚠️  Could not retrieve VERCEL_TOKEN from mykeys.zip" -ForegroundColor Yellow
            Write-Host "   Will test Production only" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️  Error retrieving VERCEL_TOKEN: $_" -ForegroundColor Yellow
    }
} else {
    $tokenName = if ($env:VERCEL_TOKEN) { "VERCEL_TOKEN" } else { "VERCEL_KEY" }
    Write-Host "✓ $tokenName found in environment" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Running Full Verification..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Run verification script
$scriptPath = Join-Path $PSScriptRoot "verify-deployments.ps1"
if ($Verbose) {
    & $scriptPath -Verbose
} else {
    & $scriptPath
}

