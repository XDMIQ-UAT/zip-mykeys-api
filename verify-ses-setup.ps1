# Verify SES Setup for hello@cosmiciq.org
# Checks if SES credentials are configured with correct from_email

Write-Host "`n=== Verifying SES Setup ===`n" -ForegroundColor Cyan

$mykeysUrl = if ($env:MYKEYS_URL) { $env:MYKEYS_URL } else { "https://mykeys.zip" }
$mykeysUser = if ($env:MYKEYS_USER) { $env:MYKEYS_USER } else { "admin" }
$mykeysPass = $env:MYKEYS_PASS

if (-not $mykeysPass) {
    Write-Host "⚠️  MYKEYS_PASS not set" -ForegroundColor Yellow
    Write-Host "   Set it: `$env:MYKEYS_PASS = 'your-partial-password'" -ForegroundColor Gray
    Write-Host "   Or create .env.local with MYKEYS_PASS=your-partial-password" -ForegroundColor Gray
    exit 1
}

Write-Host "Checking SES credentials in mykeys.zip API..." -ForegroundColor Yellow

try {
    # Step 1: Get architect code using partial password
    Write-Host "`nStep 1: Verifying partial password..." -ForegroundColor Cyan
    $partialResponse = Invoke-RestMethod -Uri "$mykeysUrl/api/auth/verify-partial" `
        -Method POST `
        -Body (@{ partialPassword = $mykeysPass } | ConvertTo-Json) `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    if ($partialResponse.code) {
        Write-Host "  ✓ Partial password verified" -ForegroundColor Green
        $architectCode = $partialResponse.code
        Write-Host "  Architect code: $($architectCode.Substring(0, 8))..." -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Failed to get architect code" -ForegroundColor Red
        exit 1
    }
    
    # Step 2: Get SES credentials
    Write-Host "`nStep 2: Fetching SES credentials..." -ForegroundColor Cyan
    $credential = New-Object System.Management.Automation.PSCredential($mykeysUser, (ConvertTo-SecureString $mykeysPass -AsPlainText -Force))
    
    $sesResponse = Invoke-RestMethod -Uri "$mykeysUrl/api/secrets/ses-credentials" `
        -Credential $credential `
        -ErrorAction Stop
    
    if ($sesResponse.value) {
        Write-Host "  ✓ SES credentials found" -ForegroundColor Green
        $sesCreds = $sesResponse.value | ConvertFrom-Json
        
        $fromEmail = if ($sesCreds.from_email) { $sesCreds.from_email } else { 'hello@cosmiciq.org' }
        $region = if ($sesCreds.region) { $sesCreds.region } else { 'us-east-1' }
        
        Write-Host "`nSES Configuration:" -ForegroundColor Yellow
        Write-Host "  smtp_username: $($sesCreds.smtp_username.Substring(0, [Math]::Min(8, $sesCreds.smtp_username.Length)))..." -ForegroundColor Gray
        Write-Host "  region: $region" -ForegroundColor Gray
        Write-Host "  from_email: $fromEmail" -ForegroundColor $(if ($fromEmail -eq 'hello@cosmiciq.org') { 'Green' } else { 'Yellow' })
        
        if ($fromEmail -ne 'hello@cosmiciq.org') {
            Write-Host "`n⚠️  from_email is not hello@cosmiciq.org" -ForegroundColor Yellow
            Write-Host "   Update it in mykeys.zip API:" -ForegroundColor Gray
            Write-Host "   curl -u admin:`$env:MYKEYS_PASS -X PUT $mykeysUrl/api/secrets/ses-credentials \" -ForegroundColor Cyan
            Write-Host "     -H 'Content-Type: application/json' \" -ForegroundColor Cyan
            Write-Host "     -d '{\"value\":\"{\\\"smtp_username\\\":\\\"$($sesCreds.smtp_username)\\\",\\\"smtp_password\\\":\\\"$($sesCreds.smtp_password)\\\",\\\"region\\\":\\\"$region\\\",\\\"from_email\\\":\\\"hello@cosmiciq.org\\\"}\"}'" -ForegroundColor Cyan
        } else {
            Write-Host "`n✓ from_email is correctly set to hello@cosmiciq.org" -ForegroundColor Green
        }
        
        # Step 3: Test email send
        Write-Host "`nStep 3: Testing email send..." -ForegroundColor Cyan
        $testEmail = "bcherrman@gmail.com"
        
        try {
            $emailResponse = Invoke-RestMethod -Uri "$mykeysUrl/api/auth/request-mfa-code" `
                -Method POST `
                -Body (@{ email = $testEmail } | ConvertTo-Json) `
                -ContentType "application/json" `
                -ErrorAction Stop
            
            if ($emailResponse.success) {
                Write-Host "  ✓ Email sent successfully!" -ForegroundColor Green
                Write-Host "    To: $testEmail" -ForegroundColor Gray
                Write-Host "    From: hello@cosmiciq.org" -ForegroundColor Gray
                Write-Host "    Method: $($emailResponse.method)" -ForegroundColor Gray
                Write-Host "`n  Check your inbox at $testEmail" -ForegroundColor Bright
            } else {
                Write-Host "  ✗ Email send failed" -ForegroundColor Red
            }
        } catch ($emailError) {
            Write-Host "  ✗ Email send error: $($emailError.Exception.Message)" -ForegroundColor Red
            if ($emailError.Exception.Response.StatusCode.value__ -eq 500) {
                Write-Host "    Check server logs for details" -ForegroundColor Gray
            }
        }
        
    } else {
        Write-Host "  ✗ SES credentials not found" -ForegroundColor Red
        Write-Host "`n  Store SES credentials in mykeys.zip API:" -ForegroundColor Yellow
        Write-Host "    curl -u admin:`$env:MYKEYS_PASS -X POST $mykeysUrl/api/secrets \" -ForegroundColor Cyan
        Write-Host "      -H 'Content-Type: application/json' \" -ForegroundColor Cyan
        Write-Host "      -d '{\"name\":\"ses-credentials\",\"value\":\"{\\\"smtp_username\\\":\\\"...\\\",\\\"smtp_password\\\":\\\"...\\\",\\\"region\\\":\\\"us-east-1\\\",\\\"from_email\\\":\\\"hello@cosmiciq.org\\\"}\"}'" -ForegroundColor Cyan
    }
} catch ($error) {
    if ($error.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "  ✗ Authentication failed" -ForegroundColor Red
        Write-Host "    Check MYKEYS_PASS (partial password) is correct" -ForegroundColor Gray
    } elseif ($error.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "  ✗ SES credentials not found" -ForegroundColor Red
    } else {
        Write-Host "  ✗ Error: $($error.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""




