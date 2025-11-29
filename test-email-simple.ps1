# Simple Email Test
# Tests sending email to bcherrman@gmail.com from hello@cosmiciq.org

$mykeysUrl = "https://mykeys.zip"
$testEmail = "bcherrman@gmail.com"

Write-Host "`n=== Testing Email Send ===" -ForegroundColor Cyan
Write-Host "To: $testEmail" -ForegroundColor Yellow
Write-Host "From: hello@cosmiciq.org" -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{ email = $testEmail } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$mykeysUrl/api/auth/request-mfa-code" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "✓ Email sent successfully!" -ForegroundColor Green
        Write-Host "  Method: $($response.method)" -ForegroundColor Gray
        Write-Host "  Target: $($response.target)" -ForegroundColor Gray
        Write-Host "`nCheck your inbox at $testEmail" -ForegroundColor Bright
        Write-Host "Look for email from hello@cosmiciq.org" -ForegroundColor Gray
    } else {
        Write-Host "✗ Failed to send email" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  Status: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""
