# Setup Separate Service Accounts for Each Vercel Environment
# Creates dedicated service accounts for Production, Preview, and Development
# This ensures proper isolation between environments

$ErrorActionPreference = "Stop"

$ProjectId = "myl-zip-www"  # GCP Project ID
$Environments = @(
    @{ Name = "Production"; ServiceAccountName = "mykeys-vercel-prod-sa"; KeyFile = "vercel-prod-key.json" },
    @{ Name = "Preview"; ServiceAccountName = "mykeys-vercel-preview-sa"; KeyFile = "vercel-preview-key.json" },
    @{ Name = "Development"; ServiceAccountName = "mykeys-vercel-dev-sa"; KeyFile = "vercel-dev-key.json" }
)

Write-Host "=== Setup Service Accounts for All Vercel Environments ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectId" -ForegroundColor Gray
Write-Host "This will create separate service accounts for:" -ForegroundColor Gray
Write-Host "  • Production (mykeys-vercel-prod-sa)" -ForegroundColor Green
Write-Host "  • Preview (mykeys-vercel-preview-sa)" -ForegroundColor Yellow
Write-Host "  • Development (mykeys-vercel-dev-sa)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Each environment will have its own credentials for better security isolation." -ForegroundColor Gray
Write-Host ""

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "✅ Found gcloud: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud CLI not found. Please install Google Cloud SDK:" -ForegroundColor Red
    Write-Host "   https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Set project
Write-Host "Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project. Make sure you have access to $ProjectId" -ForegroundColor Red
    exit 1
}

$results = @()

foreach ($env in $Environments) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Setting up: $($env.Name)" -ForegroundColor $(if ($env.Name -eq "Production") { "Green" } elseif ($env.Name -eq "Preview") { "Yellow" } else { "Cyan" })
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    $ServiceAccountEmail = "${env.ServiceAccountName}@${ProjectId}.iam.gserviceaccount.com"
    
    # Check if service account exists
    $saExists = $false
    try {
        gcloud iam service-accounts describe $ServiceAccountEmail 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $saExists = $true
        }
    } catch {
        $saExists = $false
    }
    
    if ($saExists) {
        Write-Host "⚠️  Service account already exists: $ServiceAccountEmail" -ForegroundColor Yellow
        $response = Read-Host "Use existing? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Skipping $($env.Name)..." -ForegroundColor Gray
            continue
        }
    } else {
        # Create service account
        Write-Host "📦 Creating service account..." -ForegroundColor Green
        gcloud iam service-accounts create $env.ServiceAccountName `
            --display-name="MyKeys Vercel $($env.Name) Service Account" `
            --description="Service account for mykeys.zip Vercel $($env.Name) deployment" `
            --project=$ProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Service account created" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to create service account" -ForegroundColor Red
            continue
        }
    }
    
    # Grant required roles
    Write-Host "🔑 Granting IAM roles..." -ForegroundColor Cyan
    
    # Secret Manager Secret Accessor
    Write-Host "  • Granting Secret Manager access..." -ForegroundColor Gray
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:${ServiceAccountEmail}" `
        --role="roles/secretmanager.secretAccessor" `
        --condition=None 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Secret Manager access granted" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Failed to grant Secret Manager access" -ForegroundColor Yellow
    }
    
    # Secret Manager Admin (for creating/updating secrets)
    Write-Host "  • Granting Secret Manager Admin..." -ForegroundColor Gray
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:${ServiceAccountEmail}" `
        --role="roles/secretmanager.admin" `
        --condition=None 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Secret Manager Admin granted" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Failed to grant Secret Manager Admin" -ForegroundColor Yellow
    }
    
    # Create key
    Write-Host "🔐 Creating service account key..." -ForegroundColor Cyan
    
    if (Test-Path $env.KeyFile) {
        Write-Host "  ⚠️  Key file exists: $($env.KeyFile)" -ForegroundColor Yellow
        $response = Read-Host "Overwrite? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "  Using existing key file" -ForegroundColor Gray
            $skipKeyCreation = $true
        } else {
            Remove-Item $env.KeyFile -Force
            $skipKeyCreation = $false
        }
    } else {
        $skipKeyCreation = $false
    }
    
    if (-not $skipKeyCreation) {
        Write-Host "  Creating new key..." -ForegroundColor Gray
        gcloud iam service-accounts keys create $env.KeyFile `
            --iam-account=$ServiceAccountEmail `
            --project=$ProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Key created: $($env.KeyFile)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Failed to create key" -ForegroundColor Red
            continue
        }
    }
    
    # Clean and prepare JSON for clipboard
    $json = Get-Content $env.KeyFile -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
    $json = $json.Trim()
    
    $results += @{
        Environment = $env.Name
        ServiceAccountEmail = $ServiceAccountEmail
        KeyFile = $env.KeyFile
        JsonKey = $json
    }
    
    Write-Host "✅ $($env.Name) setup complete!" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ All Service Accounts Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps for Vercel:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Go to: https://vercel.com/ici1/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
Write-Host ""

foreach ($result in $results) {
    $envColor = if ($result.Environment -eq "Production") { "Green" } elseif ($result.Environment -eq "Preview") { "Yellow" } else { "Cyan" }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $envColor
    Write-Host "$($result.Environment) Environment:" -ForegroundColor $envColor
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $envColor
    Write-Host ""
    Write-Host "Service Account: $($result.ServiceAccountEmail)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "1. Copy key to clipboard:" -ForegroundColor White
    Write-Host "   `$json = Get-Content $($result.KeyFile) -Raw | ConvertFrom-Json | ConvertTo-Json -Compress; `$json.Trim() | Set-Clipboard" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Add to Vercel:" -ForegroundColor White
    Write-Host "   Key: GCP_PROJECT" -ForegroundColor Gray
    Write-Host "   Value: myl-zip-www" -ForegroundColor Gray
    Write-Host "   Environment: $($result.Environment) only" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Key: GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
    Write-Host "   Value: [Paste JSON from clipboard]" -ForegroundColor Gray
    Write-Host "   Environment: $($result.Environment) only" -ForegroundColor Gray
    Write-Host "   ⚠️  Mark as 'Sensitive'" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🔒 Security Benefits:" -ForegroundColor Yellow
Write-Host "   • Each environment has separate credentials" -ForegroundColor Gray
Write-Host "   • Can revoke dev/preview keys without affecting production" -ForegroundColor Gray
Write-Host "   • Better audit trail (know which env accessed what)" -ForegroundColor Gray
Write-Host "   • Can use different GCP projects per environment if needed" -ForegroundColor Gray
Write-Host ""




