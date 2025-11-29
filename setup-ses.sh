#!/bin/bash
# Setup SES for cosmiciq.org using AWS CLI

echo ""
echo "=== Amazon SES Setup for cosmiciq.org ==="
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "✗ AWS CLI not found. Install from: https://aws.amazon.com/cli/"
    exit 1
fi

echo "✓ AWS CLI found: $(aws --version)"
echo ""

# Verify AWS credentials
echo "Step 1: Verifying AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    echo "✓ AWS credentials configured"
    aws sts get-caller-identity
else
    echo "⚠️  AWS credentials not configured"
    echo "   Run: aws configure"
    exit 1
fi

echo ""
echo "Step 2: Checking domain verification..."
if aws sesv2 get-email-identity --email-identity cosmiciq.org &> /dev/null; then
    echo "✓ Domain cosmiciq.org is verified"
    aws sesv2 get-email-identity --email-identity cosmiciq.org
else
    echo "⚠️  Domain cosmiciq.org not verified"
    echo "   Verifying domain..."
    aws sesv2 create-email-identity --email-identity cosmiciq.org
fi

echo ""
echo "Step 3: Creating SMTP user..."
if aws iam get-user --user-name ses-smtp-user &> /dev/null; then
    echo "✓ SMTP user already exists"
else
    echo "Creating SMTP user..."
    aws iam create-user --user-name ses-smtp-user
    aws iam attach-user-policy --user-name ses-smtp-user --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess
fi

echo ""
echo "Step 4: Creating SMTP access key..."
SMTP_CREDENTIALS=$(aws iam create-access-key --user-name ses-smtp-user)
echo "$SMTP_CREDENTIALS" | jq '.'

SMTP_USERNAME=$(echo "$SMTP_CREDENTIALS" | jq -r '.AccessKey.AccessKeyId')
SMTP_PASSWORD=$(echo "$SMTP_CREDENTIALS" | jq -r '.AccessKey.SecretAccessKey')

echo ""
echo "✓ SMTP Credentials created:"
echo "  Username: $SMTP_USERNAME"
echo "  Password: $SMTP_PASSWORD"
echo ""
echo "Step 5: Store in mykeys.zip API..."
echo "  Run: node store-ses-credentials.js $SMTP_USERNAME $SMTP_PASSWORD"




