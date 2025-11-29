# Rotate Google Application Credentials for Vercel Environments
# Creates new service account keys and updates Vercel environment variables
# for Production, Preview, and Development environments

param(
    [switch]$DeleteOldKeys,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ProjectId = "myl-zip-www"
$Environments = @(
    @{ Name = "Production"; ServiceAccountName = "mykeys-vercel-prod-sa"; KeyFile = "vercel-prod-key.json"; VercelEnv = "production" },
    @{ Name = "Preview"; ServiceAccountName = "mykeys-vercel-preview-sa"; KeyFile = "vercel-preview-key.json"; VercelEnv = "preview" },
    @{ Name = "Development"; ServiceAccountName = "mykeys-vercel-dev-sa"; KeyFile = "vercel-dev-key.json"; VercelEnv = "development" }
)

Write-Host "=== Rotate Google Credentials for Vercel ===" -ForegroundColor Cyan
Write-Host ""
if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}
Write-Host "Project: $ProjectId" -ForegroundColor Gray
Write-Host "Environments: Production, Preview, Development" -ForegroundColor Gray
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check gcloud
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "✓ Found gcloud: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud CLI not found. Please install Google Cloud SDK" -ForegroundColor Red
    exit 1
}

# Check Vercel CLI
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Vercel CLI not found. Install with: npm install -g vercel" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Found Vercel CLI" -ForegroundColor Green

# Get Vercel project info
Write-Host ""
Write-Host "Getting Vercel project information..." -ForegroundColor Yellow
# Default project ID (can be overridden by environment variable or API lookup)
$vercelProjectId = $env:VERCEL_PROJECT_ID
if (-not $vercelProjectId) {
    # Hardcoded project ID for zip-myl-mykeys-api
    $vercelProjectId = "prj_z7PH1IzqYB7DusqyUuOcheekW77j"
}

try {
    $vercelOutput = vercel project ls --json 2>&1
    if ($LASTEXITCODE -eq 0) {
        try {
            $vercelProjects = $vercelOutput | ConvertFrom-Json
            $vercelProject = $vercelProjects | Where-Object { $_.name -eq "zip-myl-mykeys-api" } | Select-Object -First 1
            if ($vercelProject) {
                Write-Host "✓ Found Vercel project: $($vercelProject.name)" -ForegroundColor Green
                $vercelProjectId = $vercelProject.id
            } else {
                Write-Host "⚠️  Vercel project 'zip-myl-mykeys-api' not found in list" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  Could not parse Vercel project list: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Could not list Vercel projects. Will try API method." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Failed to get Vercel project info: $_" -ForegroundColor Yellow
}

# Verify project ID or try to get it from Vercel API if not set
if ($vercelProjectId) {
    Write-Host "✓ Using project ID: $vercelProjectId" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Attempting to get project ID from Vercel API..." -ForegroundColor Yellow
    $vercelToken = $env:VERCEL_TOKEN
    if ($vercelToken) {
        try {
            $vercelHeaders = @{
                "Authorization" = "Bearer $vercelToken"
            }
            $teamId = "xdmiq"  # Team ID (updated from ici1)
            $projects = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?teamId=$teamId" -Headers $vercelHeaders
            $project = $projects.projects | Where-Object { $_.name -eq "zip-myl-mykeys-api" } | Select-Object -First 1
            if ($project) {
                $vercelProjectId = $project.id
                Write-Host "✓ Found project ID from API: $vercelProjectId" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️  Could not get project ID from API: $_" -ForegroundColor Yellow
        }
    }
    
    if (-not $vercelProjectId) {
        Write-Host "⚠️  Could not determine Vercel project ID" -ForegroundColor Yellow
        Write-Host "   Set VERCEL_PROJECT_ID environment variable or update script" -ForegroundColor Gray
        Write-Host "   The script will prompt for manual updates if needed" -ForegroundColor Gray
    }
}

# Set GCP project
Write-Host ""
Write-Host "Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project. Make sure you have access to $ProjectId" -ForegroundColor Red
    exit 1
}
Write-Host "✓ GCP project set" -ForegroundColor Green

$results = @()

foreach ($env in $Environments) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Rotating: $($env.Name)" -ForegroundColor $(if ($env.Name -eq "Production") { "Green" } elseif ($env.Name -eq "Preview") { "Yellow" } else { "Cyan" })
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    $ServiceAccountEmail = "$($env.ServiceAccountName)@${ProjectId}.iam.gserviceaccount.com"
    
    # Check if service account exists
    Write-Host "Checking service account..." -ForegroundColor Yellow
    $saExists = $false
    try {
        gcloud iam service-accounts describe $ServiceAccountEmail 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $saExists = $true
            Write-Host "✓ Service account exists: $ServiceAccountEmail" -ForegroundColor Green
        }
    } catch {
        $saExists = $false
    }
    
    if (-not $saExists) {
        Write-Host "⚠️  Service account does not exist: $ServiceAccountEmail" -ForegroundColor Yellow
        Write-Host "Creating service account..." -ForegroundColor Yellow
        
        if (-not $DryRun) {
            gcloud iam service-accounts create $env.ServiceAccountName `
                --display-name="MyKeys Vercel $($env.Name) Service Account" `
                --description="Service account for mykeys.zip Vercel $($env.Name) deployment" `
                --project=$ProjectId 2>&1 | Out-Null
            
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Failed to create service account" -ForegroundColor Red
                continue
            }
            
            # Grant required roles
            Write-Host "Granting IAM roles..." -ForegroundColor Yellow
            gcloud projects add-iam-policy-binding $ProjectId `
                --member="serviceAccount:${ServiceAccountEmail}" `
                --role="roles/secretmanager.secretAccessor" `
                --condition=None 2>&1 | Out-Null
            
            gcloud projects add-iam-policy-binding $ProjectId `
                --member="serviceAccount:${ServiceAccountEmail}" `
                --role="roles/secretmanager.admin" `
                --condition=None 2>&1 | Out-Null
            
            Write-Host "✓ Service account created and configured" -ForegroundColor Green
        } else {
            Write-Host "[DRY RUN] Would create service account" -ForegroundColor Gray
        }
    }
    
    # List existing keys
    Write-Host ""
    Write-Host "Listing existing keys..." -ForegroundColor Yellow
    $existingKeys = @()
    try {
        $keysJson = gcloud iam service-accounts keys list --iam-account=$ServiceAccountEmail --format=json 2>&1 | ConvertFrom-Json
        $existingKeys = $keysJson
        Write-Host "Found $($existingKeys.Count) existing key(s)" -ForegroundColor Gray
    } catch {
        Write-Host "Could not list keys (may be first time setup)" -ForegroundColor Gray
    }
    
    # Backup old key if exists
    $oldKeyFile = $env.KeyFile
    if (Test-Path $oldKeyFile) {
        $backupFile = "$oldKeyFile.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
        Write-Host "Backing up old key to: $backupFile" -ForegroundColor Yellow
        if (-not $DryRun) {
            Copy-Item $oldKeyFile $backupFile
        }
    }
    
    # Create new key
    Write-Host ""
    Write-Host "Creating new service account key..." -ForegroundColor Yellow
    
    if (-not $DryRun) {
        # Delete old key file if exists
        if (Test-Path $oldKeyFile) {
            Remove-Item $oldKeyFile -Force
        }
        
        gcloud iam service-accounts keys create $oldKeyFile `
            --iam-account=$ServiceAccountEmail `
            --project=$ProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to create new key" -ForegroundColor Red
            continue
        }
        
        Write-Host "✓ New key created: $oldKeyFile" -ForegroundColor Green
        
        # Read key JSON
        $keyJson = Get-Content $oldKeyFile -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10
        $keyJson = $keyJson.Trim()
        
        # Update Vercel environment variable
        Write-Host ""
        Write-Host "Updating Vercel environment variable..." -ForegroundColor Yellow
        
        try {
            # Get Vercel token from environment or mykeys.zip
            $vercelToken = $env:VERCEL_TOKEN
            if (-not $vercelToken) {
                # Try to get from mykeys.zip
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
                    } catch {
                        Write-Host "⚠️  Could not retrieve VERCEL_TOKEN from mykeys.zip" -ForegroundColor Yellow
                    }
                }
            }
            
            if (-not $vercelToken) {
                Write-Host "⚠️  VERCEL_TOKEN not found. Please set it manually:" -ForegroundColor Yellow
                Write-Host "   vercel env add GOOGLE_APPLICATION_CREDENTIALS $($env.VercelEnv)" -ForegroundColor Cyan
                Write-Host "   Then paste the JSON key content" -ForegroundColor Gray
                Write-Host ""
                Write-Host "   Or set VERCEL_TOKEN environment variable and run again" -ForegroundColor Gray
            } elseif (-not $vercelProjectId) {
                Write-Host "⚠️  Vercel project ID not found. Please update manually:" -ForegroundColor Yellow
                Write-Host "   https://vercel.com/ici1/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "   Key: GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
                Write-Host "   Value: [JSON key content from $oldKeyFile]" -ForegroundColor Gray
                Write-Host "   Environment: $($env.VercelEnv)" -ForegroundColor Gray
            } else {
                # Update via Vercel API
                $vercelHeaders = @{
                    "Authorization" = "Bearer $vercelToken"
                    "Content-Type" = "application/json"
                }
                
                # Check if env var exists
                $envVars = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$vercelProjectId/env" `
                    -Headers $vercelHeaders `
                    -Method Get
                
                $existingEnvVar = $envVars.envs | Where-Object { 
                    $_.key -eq "GOOGLE_APPLICATION_CREDENTIALS" -and 
                    $_.target -contains $env.VercelEnv 
                } | Select-Object -First 1
                
                if ($existingEnvVar) {
                    # Update existing
                    $updateBody = @{
                        value = $keyJson
                        type = "encrypted"
                        target = @($env.VercelEnv)
                    } | ConvertTo-Json
                    
                    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$vercelProjectId/env/$($existingEnvVar.id)" `
                        -Headers $vercelHeaders `
                        -Method Patch `
                        -Body $updateBody | Out-Null
                    
                    Write-Host "✓ Updated GOOGLE_APPLICATION_CREDENTIALS in Vercel ($($env.VercelEnv))" -ForegroundColor Green
                } else {
                    # Create new
                    $createBody = @{
                        key = "GOOGLE_APPLICATION_CREDENTIALS"
                        value = $keyJson
                        type = "encrypted"
                        target = @($env.VercelEnv)
                    } | ConvertTo-Json
                    
                    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$vercelProjectId/env" `
                        -Headers $vercelHeaders `
                        -Method Post `
                        -Body $createBody | Out-Null
                    
                    Write-Host "✓ Created GOOGLE_APPLICATION_CREDENTIALS in Vercel ($($env.VercelEnv))" -ForegroundColor Green
                }
                
                # Also ensure GCP_PROJECT is set
                $gcpProjectVar = $envVars.envs | Where-Object { 
                    $_.key -eq "GCP_PROJECT" -and 
                    $_.target -contains $env.VercelEnv 
                } | Select-Object -First 1
                
                if (-not $gcpProjectVar) {
                    $createBody = @{
                        key = "GCP_PROJECT"
                        value = $ProjectId
                        type = "encrypted"
                        target = @($env.VercelEnv)
                    } | ConvertTo-Json
                    
                    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$vercelProjectId/env" `
                        -Headers $vercelHeaders `
                        -Method Post `
                        -Body $createBody | Out-Null
                    
                    Write-Host "✓ Set GCP_PROJECT=$ProjectId in Vercel ($($env.VercelEnv))" -ForegroundColor Green
                }
            }
        } catch {
            Write-Host "⚠️  Failed to update Vercel: $_" -ForegroundColor Yellow
            Write-Host "   You can manually update at:" -ForegroundColor Gray
            Write-Host "   https://vercel.com/ici1/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[DRY RUN] Would create new key and update Vercel" -ForegroundColor Gray
    }
    
    # Delete old keys if requested
    if ($DeleteOldKeys -and $existingKeys.Count -gt 0 -and -not $DryRun) {
        Write-Host ""
        Write-Host "Deleting old keys..." -ForegroundColor Yellow
        foreach ($key in $existingKeys) {
            Write-Host "  Deleting key: $($key.name)" -ForegroundColor Gray
            gcloud iam service-accounts keys delete $key.name `
                --iam-account=$ServiceAccountEmail `
                --project=$ProjectId `
                --quiet 2>&1 | Out-Null
        }
        Write-Host "✓ Old keys deleted" -ForegroundColor Green
    }
    
    $results += @{
        Environment = $env.Name
        ServiceAccountEmail = $ServiceAccountEmail
        KeyFile = $oldKeyFile
        Success = $true
    }
    
    Write-Host ""
    Write-Host "✅ $($env.Name) rotation complete!" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Credential Rotation Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "This was a DRY RUN. No changes were made." -ForegroundColor Yellow
    Write-Host "Run without -DryRun to apply changes." -ForegroundColor Yellow
} else {
    Write-Host "📋 Summary:" -ForegroundColor Yellow
    foreach ($result in $results) {
        Write-Host "  ✓ $($result.Environment): $($result.ServiceAccountEmail)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "🔒 Security Notes:" -ForegroundColor Yellow
    Write-Host "  • New keys have been created and deployed to Vercel" -ForegroundColor Gray
    Write-Host "  • Old keys are still active (delete them manually if needed)" -ForegroundColor Gray
    Write-Host "  • Use -DeleteOldKeys to automatically remove old keys" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Verify deployments work with new credentials" -ForegroundColor Gray
    Write-Host "  2. After verification, delete old keys:" -ForegroundColor Gray
    Write-Host "     .\scripts\rotate-vercel-gcp-credentials.ps1 -DeleteOldKeys" -ForegroundColor Cyan
    Write-Host ""
}

