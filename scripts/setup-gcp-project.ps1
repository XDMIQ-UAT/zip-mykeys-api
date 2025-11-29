# Setup GCP Project for mykeys.zip
# Creates new project and enables required APIs

$ErrorActionPreference = "Stop"

$ProjectId = "mykeys-zip"
$ProjectName = "MyKeys API"
$BillingAccount = $env:BILLING_ACCOUNT  # Set via environment variable

Write-Host "🚀 Setting up GCP project: $ProjectId" -ForegroundColor Cyan

# Check if gcloud is installed
try {
    $null = gcloud --version 2>&1
} catch {
    Write-Host "❌ Error: gcloud CLI is not installed" -ForegroundColor Red
    Write-Host "Install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Check if project already exists
$projectExists = $false
try {
    gcloud projects describe $ProjectId 2>&1 | Out-Null
    $projectExists = $true
} catch {
    $projectExists = $false
}

if ($projectExists) {
    Write-Host "⚠️  Project $ProjectId already exists" -ForegroundColor Yellow
    $response = Read-Host "Continue with existing project? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
} else {
    # Create new project
    Write-Host "📦 Creating new GCP project: $ProjectId" -ForegroundColor Green
    gcloud projects create $ProjectId --name="$ProjectName"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create project" -ForegroundColor Red
        exit 1
    }
    
    # Link billing account if provided
    if ($BillingAccount) {
        Write-Host "💳 Linking billing account: $BillingAccount" -ForegroundColor Green
        gcloud billing projects link $ProjectId --billing-account=$BillingAccount
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Warning: Failed to link billing account" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Warning: No billing account specified. Set BILLING_ACCOUNT environment variable." -ForegroundColor Yellow
        Write-Host "   You can link it later with:" -ForegroundColor Gray
        Write-Host "   gcloud billing projects link $ProjectId --billing-account=BILLING_ACCOUNT_ID" -ForegroundColor Gray
    }
}

# Set project as active
Write-Host "🔧 Setting active project to $ProjectId" -ForegroundColor Green
gcloud config set project $ProjectId

# Enable required APIs
Write-Host "🔌 Enabling required APIs..." -ForegroundColor Cyan
$apis = @(
    "run.googleapis.com",              # Cloud Run API
    "secretmanager.googleapis.com",     # Secret Manager API
    "compute.googleapis.com",          # Compute Engine API (for load balancer)
    "dns.googleapis.com",              # Cloud DNS API
    "cloudresourcemanager.googleapis.com",  # Cloud Resource Manager API
    "cloudbuild.googleapis.com"       # Cloud Build API (optional, for CI/CD)
)

foreach ($api in $apis) {
    Write-Host "  Enabling $api..." -ForegroundColor Gray
    gcloud services enable $api --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Failed to enable $api (may already be enabled)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ GCP project setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: .\scripts\setup-service-account.ps1" -ForegroundColor White
Write-Host "2. Run: .\scripts\deploy-cloud-run.ps1" -ForegroundColor White
Write-Host ""




