# Store SES Credentials for cosmiciq.org
# Stores credentials in mykeys.zip API or GCP Secret Manager

param(
    [string]$SmtpUsername,
    [string]$SmtpPassword,
    [string]$Region = "us-east-1",
    [string]$FromEmail = "hello@cosmiciq.org"
)

$mykeysUrl = if ($env:MYKEYS_URL) { $env:MYKEYS_URL } else { "https://mykeys.zip" }
$mykeysUser = if ($env:MYKEYS_USER) { $env:MYKEYS_USER } else { "admin" }
$mykeysPass = $env:MYKEYS_PASS

Write-Host "`n=== Store SES Credentials for cosmiciq.org ===" -ForegroundColor Cyan
Write-Host ""

# Get credentials if not provided
if (-not $SmtpUsername) {
    $SmtpUsername = Read-Host "Enter SES SMTP Username"
}

if (-not $SmtpPassword) {
    $securePassword = Read-Host "Enter SES SMTP Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $SmtpPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Create credentials JSON
$sesCredentials = @{
    smtp_username = $SmtpUsername
    smtp_password = $SmtpPassword
    region = $Region
    from_email = $FromEmail
} | ConvertTo-Json -Compress

Write-Host "Storing SES credentials..." -ForegroundColor Yellow
Write-Host "  SMTP Username: $($SmtpUsername.Substring(0, [Math]::Min(8, $SmtpUsername.Length)))..." -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host "  From Email: $FromEmail" -ForegroundColor Gray
Write-Host ""

if ($mykeysPass) {
    # Store via mykeys.zip API
    Write-Host "Storing via mykeys.zip API..." -ForegroundColor Cyan
    
    # Create Basic Auth header
    $authString = "$mykeysUser" + ":" + "$mykeysPass"
    $authBytes = [System.Text.Encoding]::ASCII.GetBytes($authString)
    $authToken = [System.Convert]::ToBase64String($authBytes)
    $headers = @{
        "Authorization" = "Basic $authToken"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        name = "ses-credentials"
        value = $sesCredentials
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$mykeysUrl/api/secrets" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ErrorAction Stop
        
        Write-Host "✓ SES credentials stored successfully in mykeys.zip API!" -ForegroundColor Green
        Write-Host "  Secret name: ses-credentials" -ForegroundColor Gray
        Write-Host "  From email: $FromEmail" -ForegroundColor Gray
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
        
        if ($statusCode -eq 409) {
            # Secret exists, try update
            Write-Host "Secret exists, updating..." -ForegroundColor Yellow
            $updateBody = @{ value = $sesCredentials } | ConvertTo-Json
            try {
                $response = Invoke-RestMethod -Uri "$mykeysUrl/api/secrets/ses-credentials" `
                    -Method PUT `
                    -Headers $headers `
                    -Body $updateBody `
                    -ErrorAction Stop
                
                Write-Host "✓ SES credentials updated successfully!" -ForegroundColor Green
            } catch {
                Write-Host "✗ Failed to update: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "✗ Failed to store: $($_.Exception.Message)" -ForegroundColor Red
            if ($statusCode) {
                Write-Host "  Status: $statusCode" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "⚠️  MYKEYS_PASS not set" -ForegroundColor Yellow
    Write-Host "   Set MYKEYS_PASS in .env.local or environment" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternative: Store directly in GCP Secret Manager:" -ForegroundColor Yellow
    Write-Host "  gcloud secrets create ses-credentials \" -ForegroundColor Cyan
    Write-Host "    --data-file=- \" -ForegroundColor Cyan
    Write-Host "    --project=myl-zip-www" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Then paste this JSON:" -ForegroundColor Gray
    Write-Host $sesCredentials -ForegroundColor White
}

Write-Host ""

