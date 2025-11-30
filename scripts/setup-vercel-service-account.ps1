# Setup Service Account for Vercel Deployment
# Creates a dedicated service account for mykeys.zip Vercel deployment
# This is separate from your personal credentials

$ErrorActionPreference = "Stop"

$ProjectId = "myl-zip-www"  # GCP Project ID
$ServiceAccountName = "mykeys-vercel-sa"  # Service account name
$ServiceAccountEmail = "${ServiceAccountName}@${ProjectId}.iam.gserviceaccount.com"
$KeyFileName = "vercel-service-account-key.json"

Write-Host "=== Setup Service Account for Vercel ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectId" -ForegroundColor Gray
Write-Host "Service Account: $ServiceAccountEmail" -ForegroundColor Gray
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
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project. Make sure you have access to $ProjectId" -ForegroundColor Red
    exit 1
}

# Check if service account already exists
Write-Host "Checking if service account exists..." -ForegroundColor Yellow
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
    $response = Read-Host "Use existing service account? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Cancelled." -ForegroundColor Gray
        exit 0
    }
} else {
    # Create service account
    Write-Host "📦 Creating service account..." -ForegroundColor Green
    gcloud iam service-accounts create $ServiceAccountName `
        --display-name="MyKeys Vercel Service Account" `
        --description="Service account for mykeys.zip Vercel deployment - separate from personal credentials" `
        --project=$ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create service account" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Service account created" -ForegroundColor Green
}

# Grant required roles
Write-Host ""
Write-Host "🔑 Granting IAM roles..." -ForegroundColor Cyan

# Secret Manager Secret Accessor (read secrets)
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

# Secret Manager Admin (for creating/updating secrets like MCP tokens)
Write-Host "  • Granting Secret Manager Admin (for token management)..." -ForegroundColor Gray
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:${ServiceAccountEmail}" `
    --role="roles/secretmanager.admin" `
    --condition=None 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ Secret Manager Admin granted" -ForegroundColor Green
} else {
    Write-Host "    ⚠️  Failed to grant Secret Manager Admin" -ForegroundColor Yellow
}

# Create and download key
Write-Host ""
Write-Host "🔐 Creating service account key..." -ForegroundColor Cyan

# Delete old key if exists
if (Test-Path $KeyFileName) {
    Write-Host "  ⚠️  Old key file found: $KeyFileName" -ForegroundColor Yellow
    $response = Read-Host "Delete and create new key? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Remove-Item $KeyFileName -Force
    } else {
        Write-Host "  Using existing key file" -ForegroundColor Gray
        $skipKeyCreation = $true
    }
}

if (-not $skipKeyCreation) {
    Write-Host "  Creating new key..." -ForegroundColor Gray
    gcloud iam service-accounts keys create $KeyFileName `
        --iam-account=$ServiceAccountEmail `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Key created: $KeyFileName" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed to create key" -ForegroundColor Red
        exit 1
    }
}

# Display key content for Vercel
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Service Account Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Account Email: $ServiceAccountEmail" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps for Vercel:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Copy the JSON key content:" -ForegroundColor White
Write-Host "   Get-Content $KeyFileName | Set-Clipboard" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Go to Vercel Environment Variables:" -ForegroundColor White
Write-Host "   https://vercel.com/ici1/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Add these variables:" -ForegroundColor White
Write-Host ""
Write-Host "   Key: GCP_PROJECT" -ForegroundColor Gray
Write-Host "   Value: myl-zip-www" -ForegroundColor Gray
Write-Host "   Environment: Production, Preview" -ForegroundColor Gray
Write-Host ""
Write-Host "   Key: GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
Write-Host "   Value: [Paste the entire JSON key content]" -ForegroundColor Gray
Write-Host "   Environment: Production, Preview" -ForegroundColor Gray
Write-Host "   ⚠️  Mark as 'Sensitive'" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. After adding, redeploy:" -ForegroundColor White
Write-Host "   npm run deploy:vercel:prod" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔒 Security Notes:" -ForegroundColor Yellow
Write-Host "   • This service account is separate from your personal credentials" -ForegroundColor Gray
Write-Host "   • It only has access to Secret Manager (no other GCP resources)" -ForegroundColor Gray
Write-Host "   • You can revoke this key anytime without affecting your personal account" -ForegroundColor Gray
Write-Host "   • Keep the key file secure and don't commit it to git" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Quick Copy Command:" -ForegroundColor Yellow
Write-Host "   Get-Content $KeyFileName | Set-Clipboard" -ForegroundColor Cyan
Write-Host ""





