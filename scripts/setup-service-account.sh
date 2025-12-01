#!/bin/bash
# Setup Service Account for mykeys.zip Cloud Run
# Creates service account with required permissions

set -e

PROJECT_ID="mykeys-zip"
SERVICE_ACCOUNT_NAME="mykeys-api-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🔐 Setting up service account: $SERVICE_ACCOUNT_EMAIL"

# Set project
gcloud config set project "$PROJECT_ID"

# Check if service account already exists
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
    echo "⚠️  Service account $SERVICE_ACCOUNT_EMAIL already exists"
    read -p "Continue with existing service account? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    # Create service account
    echo "📦 Creating service account: $SERVICE_ACCOUNT_NAME"
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="MyKeys API Service Account" \
        --description="Service account for mykeys.zip Cloud Run service" \
        --project="$PROJECT_ID"
fi

# Grant required roles
echo "🔑 Granting IAM roles..."

# Secret Manager access
echo "  Granting Secret Manager access..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None

# Cloud Run invoker (for load balancer)
echo "  Granting Cloud Run invoker role..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/run.invoker" \
    --condition=None

# Optional: Secret Manager Admin (if you need to create/delete secrets)
read -p "Grant Secret Manager Admin role (for creating/deleting secrets)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  Granting Secret Manager Admin role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/secretmanager.admin" \
        --condition=None
fi

echo ""
echo "✅ Service account setup complete!"
echo ""
echo "Service Account Email: $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "Next step: Run ./scripts/deploy-cloud-run.sh"
echo ""






