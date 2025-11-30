# Get MYKEYS_PASS from Vercel Environment Variables
# Retrieves passwords from Vercel API - no need to remember them!

param(
    [string]$Environment = "production",  # production, preview, or development
    [switch]$SetEnvironmentVariable
)

$ErrorActionPreference = "Stop"

$VercelProjectId = "prj_z7PH1IzqYB7DusqyUuOcheekW77j"
$TeamId = "xdmiq"

# Get Vercel token
$vercelToken = $env:VERCEL_KEY
if (-not $vercelToken) {
    $vercelToken = $env:VERCEL_TOKEN
}
if (-not $vercelToken) {
    try {
        $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_KEY", "User")
    } catch {}
    if (-not $vercelToken) {
        try {
            $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN", "User")
        } catch {}
    }
    if (-not $vercelToken) {
        try {
            $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_KEY", "Machine")
        } catch {}
    }
    if (-not $vercelToken) {
        try {
            $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN", "Machine")
        } catch {}
    }
}

if (-not $vercelToken) {
    Write-Host "❌ VERCEL_KEY or VERCEL_TOKEN not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set VERCEL_KEY:" -ForegroundColor Yellow
    Write-Host "   `$env:VERCEL_KEY = 'your-vercel-key'" -ForegroundColor Cyan
    exit 1
}

$vercelHeaders = @{
    "Authorization" = "Bearer $vercelToken"
    "Content-Type" = "application/json"
}

# Map environment names
$envMap = @{
    "production" = "production"
    "prod" = "production"
    "preview" = "preview"
    "dev" = "development"
    "development" = "development"
}

$targetEnv = if ($envMap.ContainsKey($Environment.ToLower())) {
    $envMap[$Environment.ToLower()]
} else {
    $Environment.ToLower()
}

if ($targetEnv -notin @("production", "preview", "development")) {
    Write-Host "❌ Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "   Valid values: production, preview, development" -ForegroundColor Yellow
    exit 1
}

Write-Host "Retrieving MYKEYS_PASS from Vercel ($targetEnv)..." -ForegroundColor Yellow

try {
    # Get environment variables from Vercel
    $envVars = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env?teamId=$TeamId" `
        -Headers $vercelHeaders `
        -Method Get
    
    # Find MYKEYS_PASS for the target environment
    $mykeysPassVar = $envVars.envs | Where-Object { 
        $_.key -eq "MYKEYS_PASS" -and 
        $_.target -contains $targetEnv 
    } | Select-Object -First 1
    
    if (-not $mykeysPassVar) {
        Write-Host "❌ MYKEYS_PASS not found for $targetEnv environment" -ForegroundColor Red
        Write-Host ""
        Write-Host "Set it using:" -ForegroundColor Yellow
        Write-Host "   .\scripts\update-mykeys-password.ps1 -Interactive" -ForegroundColor Cyan
        exit 1
    }
    
    # Check if it's encrypted (Production)
    if ($mykeysPassVar.type -eq "encrypted") {
        Write-Host "⚠️  MYKEYS_PASS for $targetEnv is encrypted (sensitive)" -ForegroundColor Yellow
        Write-Host "   Cannot retrieve encrypted passwords from Vercel API" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "For Production, you must:" -ForegroundColor Yellow
        Write-Host "   1. Have saved the password when it was set" -ForegroundColor Gray
        Write-Host "   2. Or regenerate it:" -ForegroundColor Gray
        Write-Host "      .\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords" -ForegroundColor Cyan
        exit 1
    }
    
    # Get the value (only works for plain type)
    if ($mykeysPassVar.value) {
        $password = $mykeysPassVar.value
        
        Write-Host "✓ Retrieved MYKEYS_PASS for $targetEnv" -ForegroundColor Green
        Write-Host "  Length: $($password.Length) characters" -ForegroundColor Gray
        
        if ($SetEnvironmentVariable) {
            $env:MYKEYS_PASS = $password
            Write-Host ""
            Write-Host "✓ Set `$env:MYKEYS_PASS for current session" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "Password:" -ForegroundColor Cyan
            Write-Host $password -ForegroundColor White
            Write-Host ""
            Write-Host "To set as environment variable:" -ForegroundColor Gray
            Write-Host "   .\scripts\get-mykeys-pass-from-vercel.ps1 -Environment $targetEnv -SetEnvironmentVariable" -ForegroundColor Cyan
        }
        
        return $password
    } else {
        Write-Host "❌ Password value not available" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error retrieving password: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Red
        } catch {}
    }
    exit 1
}





