# Update Vercel Environment Variables with New GCP Credentials
# This script updates Vercel environment variables with the newly rotated credentials

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ProjectId = "myl-zip-www"
$VercelProjectId = "prj_z7PH1IzqYB7DusqyUuOcheekW77j"
$Environments = @(
    @{ Name = "Production"; KeyFile = "vercel-prod-key.json"; VercelEnv = "production" },
    @{ Name = "Preview"; KeyFile = "vercel-preview-key.json"; VercelEnv = "preview" },
    @{ Name = "Development"; KeyFile = "vercel-dev-key.json"; VercelEnv = "development" }
)

Write-Host "=== Update Vercel Environment Variables ===" -ForegroundColor Cyan
Write-Host ""
if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Get Vercel token
$vercelToken = $env:VERCEL_TOKEN
if (-not $vercelToken) {
    # Try to get from mykeys.zip
    Write-Host "Getting VERCEL_TOKEN from mykeys.zip..." -ForegroundColor Yellow
    # Standardized on MYKEYS_PASS (no MYKEYS_PASS_DEV)
    $mykeysPass = $env:MYKEYS_PASS
    
    if ($mykeysPass) {
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$mykeysPass"))
        $headers = @{
            "Authorization" = "Basic $auth"
            "Content-Type" = "application/json"
        }
        
        try {
            $vercelToken = (Invoke-RestMethod -Uri "https://mykeys.zip/api/v1/secrets/VERCEL_TOKEN" -Headers $headers -Method Get).value
            Write-Host "✓ Retrieved VERCEL_TOKEN from mykeys.zip" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not retrieve VERCEL_TOKEN from mykeys.zip: $_" -ForegroundColor Yellow
        }
    }
}

if (-not $vercelToken) {
    Write-Host "❌ VERCEL_TOKEN not found. Please set it:" -ForegroundColor Red
    Write-Host "   `$env:VERCEL_TOKEN = 'your-token'" -ForegroundColor Cyan
    Write-Host "   Or store it in mykeys.zip as VERCEL_TOKEN" -ForegroundColor Gray
    exit 1
}

$vercelHeaders = @{
    "Authorization" = "Bearer $vercelToken"
    "Content-Type" = "application/json"
}

# Function to update/create environment variable
function Update-VercelEnvVar {
    param(
        [string]$Key,
        [string]$Value,
        [string]$Environment,
        [bool]$IsDryRun
    )
    
    try {
        # Get existing env vars
        $envVars = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env" `
            -Headers $vercelHeaders `
            -Method Get
        
        $existingVar = $envVars.envs | Where-Object { 
            $_.key -eq $Key -and 
            $_.target -contains $Environment 
        } | Select-Object -First 1
        
        if ($existingVar) {
            # Update existing
            if (-not $IsDryRun) {
                $updateBody = @{
                    value = $Value
                    type = "encrypted"
                    target = @($Environment)
                } | ConvertTo-Json
                
                Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env/$($existingVar.id)" `
                    -Headers $vercelHeaders `
                    -Method Patch `
                    -Body $updateBody | Out-Null
                
                return "Updated"
            } else {
                return "Would update"
            }
        } else {
            # Create new
            if (-not $IsDryRun) {
                $createBody = @{
                    key = $Key
                    value = $Value
                    type = "encrypted"
                    target = @($Environment)
                } | ConvertTo-Json
                
                Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env" `
                    -Headers $vercelHeaders `
                    -Method Post `
                    -Body $createBody | Out-Null
                
                return "Created"
            } else {
                return "Would create"
            }
        }
    } catch {
        Write-Host "  ✗ Error: $_" -ForegroundColor Red
        return "Failed"
    }
}

$successCount = 0
$failCount = 0

foreach ($env in $Environments) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Updating: $($env.Name)" -ForegroundColor $(if ($env.Name -eq "Production") { "Green" } elseif ($env.Name -eq "Preview") { "Yellow" } else { "Cyan" })
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-Path $env.KeyFile)) {
        Write-Host "⚠️  Key file not found: $($env.KeyFile)" -ForegroundColor Yellow
        Write-Host "   Run the rotation script first: .\scripts\rotate-vercel-gcp-credentials.ps1" -ForegroundColor Gray
        $failCount++
        continue
    }
    
    # Read key JSON
    Write-Host "Reading key file..." -ForegroundColor Yellow
    $keyJson = Get-Content $env.KeyFile -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10
    $keyJson = $keyJson.Trim()
    
    # Update GOOGLE_APPLICATION_CREDENTIALS
    Write-Host "Updating GOOGLE_APPLICATION_CREDENTIALS..." -ForegroundColor Yellow
    $result = Update-VercelEnvVar -Key "GOOGLE_APPLICATION_CREDENTIALS" -Value $keyJson -Environment $env.VercelEnv -IsDryRun $DryRun
    if ($result -match "Updated|Created|Would") {
        Write-Host "  ✓ $result GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ✗ Failed to update GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Red
        $failCount++
    }
    
    # Ensure GCP_PROJECT is set
    Write-Host "Ensuring GCP_PROJECT is set..." -ForegroundColor Yellow
    $result = Update-VercelEnvVar -Key "GCP_PROJECT" -Value $ProjectId -Environment $env.VercelEnv -IsDryRun $DryRun
    if ($result -match "Updated|Created|Would") {
        Write-Host "  ✓ $result GCP_PROJECT=$ProjectId" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  GCP_PROJECT update: $result" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "✅ $($env.Name) update complete!" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "✅ Dry Run Complete!" -ForegroundColor Green
    Write-Host "Run without -DryRun to apply changes" -ForegroundColor Yellow
} else {
    Write-Host "✅ Environment Variables Updated!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Summary:" -ForegroundColor Yellow
    Write-Host "  ✓ Successfully updated: $successCount" -ForegroundColor Green
    if ($failCount -gt 0) {
        Write-Host "  ✗ Failed: $failCount" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Verify deployments work with new credentials" -ForegroundColor Gray
    Write-Host "  2. After verification, delete old keys:" -ForegroundColor Gray
    Write-Host "     .\scripts\rotate-vercel-gcp-credentials.ps1 -DeleteOldKeys" -ForegroundColor Cyan
}
Write-Host ""

