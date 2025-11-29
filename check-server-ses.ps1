# Check if deployed server can access SES credentials
# Tests the actual deployed server at mykeys.zip

$mykeysUrl = "https://mykeys.zip"
$testEmail = "bcherrman@gmail.com"

Write-Host "`n=== Checking Server SES Configuration ===" -ForegroundColor Cyan
Write-Host "Server: $mykeysUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Check if endpoint is accessible
Write-Host "Test 1: Checking endpoint accessibility..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$mykeysUrl/api/auth/request-mfa-code" `
        -Method POST `
        -Body (@{ email = $testEmail } | ConvertTo-Json) `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "  ✓ Email sent successfully!" -ForegroundColor Green
        Write-Host "    Check inbox at $testEmail" -ForegroundColor Gray
        Write-Host "    From: hello@cosmiciq.org" -ForegroundColor Gray
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorDetails = $_.Exception.Message
    
    Write-Host "  ✗ Request failed (Status: $statusCode)" -ForegroundColor Red
    
    if ($statusCode -eq 500) {
        Write-Host "`n  Server Error - Likely causes:" -ForegroundColor Yellow
        Write-Host "    1. SES credentials not found in mykeys.zip API" -ForegroundColor Gray
        Write-Host "    2. MYKEYS_PASS not set in Vercel (server can't fetch credentials)" -ForegroundColor Gray
        Write-Host "    3. SES credentials incomplete or invalid" -ForegroundColor Gray
        Write-Host "    4. SES connection/auth failure" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  To fix:" -ForegroundColor Yellow
        Write-Host "    1. Store SES credentials in mykeys.zip API:" -ForegroundColor Cyan
        Write-Host "       curl -u admin:\`$MYKEYS_PASS -X POST https://mykeys.zip/api/secrets \" -ForegroundColor White
        Write-Host "         -H 'Content-Type: application/json' \" -ForegroundColor White
        Write-Host "         -d '{\"name\":\"ses-credentials\",\"value\":\"{\\\"smtp_username\\\":\\\"...\\\",\\\"smtp_password\\\":\\\"...\\\",\\\"region\\\":\\\"us-east-1\\\",\\\"from_email\\\":\\\"hello@cosmiciq.org\\\"}\"}'" -ForegroundColor White
        Write-Host ""
        Write-Host "    2. OR set MYKEYS_PASS in Vercel env vars (if server fetches from API)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "    3. OR store SES credentials directly in GCP Secret Manager" -ForegroundColor Cyan
    }
    
    Write-Host "`n  Error: $errorDetails" -ForegroundColor Red
}

Write-Host ""




