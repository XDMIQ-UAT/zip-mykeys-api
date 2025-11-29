# Setup SES for cosmiciq.org using AWS CLI

Write-Host ""
Write-Host "=== Amazon SES Setup for cosmiciq.org ===" -ForegroundColor Cyan
Write-Host ""

# Verify AWS credentials
Write-Host "Step 1: Verifying AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    if ($identity) {
        Write-Host "AWS credentials configured" -ForegroundColor Green
        Write-Host "  Account: $($identity.Account)" -ForegroundColor Gray
        Write-Host "  User ARN: $($identity.Arn)" -ForegroundColor Gray
    }
} catch {
    Write-Host "AWS credentials not configured" -ForegroundColor Red
    Write-Host "   Run: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Checking domain verification..." -ForegroundColor Yellow
try {
    $domainInfo = aws sesv2 get-email-identity --email-identity cosmiciq.org 2>&1 | ConvertFrom-Json
    if ($domainInfo) {
        Write-Host "Domain cosmiciq.org is verified" -ForegroundColor Green
        Write-Host "  Verification Status: $($domainInfo.VerificationStatus)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Domain cosmiciq.org not verified or does not exist" -ForegroundColor Yellow
    Write-Host "   To verify domain, run:" -ForegroundColor Gray
    Write-Host "   aws sesv2 create-email-identity --email-identity cosmiciq.org" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Step 3: Creating SMTP user..." -ForegroundColor Yellow
try {
    $userExists = aws iam get-user --user-name ses-smtp-user 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SMTP user already exists" -ForegroundColor Green
    }
} catch {
    Write-Host "Creating SMTP user..." -ForegroundColor Cyan
    aws iam create-user --user-name ses-smtp-user | Out-Null
    aws iam attach-user-policy --user-name ses-smtp-user --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess | Out-Null
    Write-Host "SMTP user created" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 4: Creating SMTP access key..." -ForegroundColor Yellow
try {
    $smtpCredentials = aws iam create-access-key --user-name ses-smtp-user 2>&1 | ConvertFrom-Json
    if ($smtpCredentials) {
        $smtpUsername = $smtpCredentials.AccessKey.AccessKeyId
        $smtpPassword = $smtpCredentials.AccessKey.SecretAccessKey
        
        Write-Host "SMTP Credentials created:" -ForegroundColor Green
        Write-Host "  Username: $smtpUsername" -ForegroundColor Gray
        Write-Host "  Password: $smtpPassword" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Step 5: Storing in mykeys.zip API..." -ForegroundColor Yellow
        $cmd = "node store-ses-credentials.js `"$smtpUsername`" `"$smtpPassword`""
        Write-Host "  Run: $cmd" -ForegroundColor Cyan
        Write-Host ""
        
        # Automatically store if MYKEYS_PASS is set
        if ($env:MYKEYS_PASS) {
            Write-Host "MYKEYS_PASS found, storing automatically..." -ForegroundColor Cyan
            node store-ses-credentials.js $smtpUsername $smtpPassword
        } else {
            Write-Host "MYKEYS_PASS not set in environment" -ForegroundColor Yellow
            Write-Host "   Set MYKEYS_PASS in .env.local to auto-store credentials" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Failed to create SMTP credentials: $_" -ForegroundColor Red
    Write-Host "   You may need to delete existing access keys first:" -ForegroundColor Yellow
    Write-Host "   aws iam list-access-keys --user-name ses-smtp-user" -ForegroundColor Cyan
}

Write-Host ""
