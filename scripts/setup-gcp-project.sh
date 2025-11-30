#!/bin/bash
# Setup GCP Project for mykeys.zip
# Creates new project and enables required APIs

set -e

PROJECT_ID="mykeys-zip"
PROJECT_NAME="MyKeys API"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"  # Set via environment variable

echo "🚀 Setting up GCP project: $PROJECT_ID"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if project already exists
if gcloud projects describe "$PROJECT_ID" &> /dev/null; then
    echo "⚠️  Project $PROJECT_ID already exists"
    read -p "Continue with existing project? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    # Create new project
    echo "📦 Creating new GCP project: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"
    
    # Link billing account if provided
    if [ -n "$BILLING_ACCOUNT" ]; then
        echo "💳 Linking billing account: $BILLING_ACCOUNT"
        gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
    else
        echo "⚠️  Warning: No billing account specified. Set BILLING_ACCOUNT environment variable."
        echo "   You can link it later with:"
        echo "   gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID"
    fi
fi

# Set project as active
echo "🔧 Setting active project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "🔌 Enabling required APIs..."
APIS=(
    "run.googleapis.com"              # Cloud Run API
    "secretmanager.googleapis.com"     # Secret Manager API
    "compute.googleapis.com"          # Compute Engine API (for load balancer)
    "dns.googleapis.com"              # Cloud DNS API
    "cloudresourcemanager.googleapis.com"  # Cloud Resource Manager API
    "cloudbuild.googleapis.com"       # Cloud Build API (optional, for CI/CD)
)

for api in "${APIS[@]}"; do
    echo "  Enabling $api..."
    gcloud services enable "$api" --project="$PROJECT_ID" || echo "  ⚠️  Failed to enable $api (may already be enabled)"
done

echo ""
echo "✅ GCP project setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/setup-service-account.sh"
echo "2. Run: ./scripts/deploy-cloud-run.sh"
echo ""





