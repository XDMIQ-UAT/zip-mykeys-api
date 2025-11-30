# Setup Service Account for mykeys.zip Cloud Run
# Creates service account with required permissions

$ErrorActionPreference = "Stop"

$ProjectId = "mykeys-zip"
$ServiceAccountName = "mykeys-api-sa"
$ServiceAccountEmail = "${ServiceAccountName}@${ProjectId}.iam.gserviceaccount.com"

Write-Host "🔐 Setting up service account: $ServiceAccountEmail" -ForegroundColor Cyan

# Set project
gcloud config set project $ProjectId

# Check if service account already exists
$saExists = $false
try {
    gcloud iam service-accounts describe $ServiceAccountEmail 2>&1 | Out-Null
    $saExists = $true
} catch {
    $saExists = $false
}

if ($saExists) {
    Write-Host "⚠️  Service account $ServiceAccountEmail already exists" -ForegroundColor Yellow
    $response = Read-Host "Continue with existing service account? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
} else {
    # Create service account
    Write-Host "📦 Creating service account: $ServiceAccountName" -ForegroundColor Green
    gcloud iam service-accounts create $ServiceAccountName `
        --display-name="MyKeys API Service Account" `
        --description="Service account for mykeys.zip Cloud Run service" `
        --project=$ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create service account" -ForegroundColor Red
        exit 1
    }
}

# Grant required roles
Write-Host "🔑 Granting IAM roles..." -ForegroundColor Cyan

# Secret Manager access
Write-Host "  Granting Secret Manager access..." -ForegroundColor Gray
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:${ServiceAccountEmail}" `
    --role="roles/secretmanager.secretAccessor" `
    --condition=None

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  Failed to grant Secret Manager access" -ForegroundColor Yellow
}

# Cloud Run invoker (for load balancer)
Write-Host "  Granting Cloud Run invoker role..." -ForegroundColor Gray
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:${ServiceAccountEmail}" `
    --role="roles/run.invoker" `
    --condition=None

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  Failed to grant Cloud Run invoker role" -ForegroundColor Yellow
}

# Optional: Secret Manager Admin (if you need to create/delete secrets)
$response = Read-Host "Grant Secret Manager Admin role (for creating/deleting secrets)? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "  Granting Secret Manager Admin role..." -ForegroundColor Gray
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:${ServiceAccountEmail}" `
        --role="roles/secretmanager.admin" `
        --condition=None
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Failed to grant Secret Manager Admin role" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Service account setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Service Account Email: $ServiceAccountEmail" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step: Run .\scripts\deploy-cloud-run.ps1" -ForegroundColor White
Write-Host ""





