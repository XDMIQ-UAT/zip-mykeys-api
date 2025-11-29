# Quick Check: SES Credentials Setup
# Verifies Tier 1 bootstrap credentials and Tier 2 SES credentials

Write-Host "`n=== Quick SES Credentials Check ===`n" -ForegroundColor Cyan

# Check Tier 1: Bootstrap credentials
Write-Host "Tier 1: Bootstrap Credentials" -ForegroundColor Yellow
if ($env:MYKEYS_PASS) {
    Write-Host "  ✓ MYKEYS_PASS is set" -ForegroundColor Green
} else {
    Write-Host "  ✗ MYKEYS_PASS not set" -ForegroundColor Red
    Write-Host "    Set it: `$env:MYKEYS_PASS = 'your-password'" -ForegroundColor Gray
    Write-Host "    Or get from Vercel: .\scripts\get-mykeys-pass-from-vercel.ps1" -ForegroundColor Gray
}

$mykeysUrl = if ($env:MYKEYS_URL) { $env:MYKEYS_URL } else { "https://mykeys.zip" }
$mykeysUser = if ($env:MYKEYS_USER) { $env:MYKEYS_USER } else { "admin" }
Write-Host "  MYKEYS_URL: $mykeysUrl" -ForegroundColor Gray
Write-Host "  MYKEYS_USER: $mykeysUser" -ForegroundColor Gray

# Check Tier 2: SES credentials in mykeys.zip API
Write-Host "`nTier 2: SES Credentials in mykeys.zip API" -ForegroundColor Yellow

if (-not $env:MYKEYS_PASS) {
    Write-Host "  ⚠️  Cannot check - MYKEYS_PASS not set" -ForegroundColor Yellow
    exit 1
}

try {
    $credential = New-Object System.Management.Automation.PSCredential($mykeysUser, (ConvertTo-SecureString $env:MYKEYS_PASS -AsPlainText -Force))
    
    $response = Invoke-RestMethod -Uri "$mykeysUrl/api/secrets/ses-credentials" -Credential $credential -ErrorAction Stop
    
    if ($response.value) {
        Write-Host "  ✓ SES credentials found in mykeys.zip API" -ForegroundColor Green
        
        # Try to parse as JSON
        try {
            $sesCreds = $response.value | ConvertFrom-Json
            Write-Host "  ✓ Credentials format is valid JSON" -ForegroundColor Green
            $usernamePreview = if ($sesCreds.smtp_username.Length -gt 8) { $sesCreds.smtp_username.Substring(0, 8) + "..." } else { $sesCreds.smtp_username }
            $region = if ($sesCreds.region) { $sesCreds.region } else { 'us-east-1' }
            $fromEmail = if ($sesCreds.from_email) { $sesCreds.from_email } else { 'noreply@mykeys.zip' }
            Write-Host "    smtp_username: $usernamePreview" -ForegroundColor Gray
            Write-Host "    region: $region" -ForegroundColor Gray
            Write-Host "    from_email: $fromEmail" -ForegroundColor Gray
        } catch {
            Write-Host "  ⚠️  Credentials found but not JSON format" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✗ SES credentials not found" -ForegroundColor Red
        Write-Host "    Store them using the API" -ForegroundColor Gray
    }
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "  ✗ SES credentials not found in mykeys.zip API" -ForegroundColor Red
        Write-Host "`n  To store SES credentials:" -ForegroundColor Yellow
        Write-Host "    1. Get SES SMTP credentials from AWS Console" -ForegroundColor Gray
        Write-Host "    2. Store in mykeys.zip API using curl or PowerShell" -ForegroundColor Gray
    } elseif ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "  ✗ Authentication failed" -ForegroundColor Red
        Write-Host "    Check MYKEYS_PASS is correct" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($env:MYKEYS_PASS) {
    Write-Host "  Tier 1: Bootstrap credentials ✓" -ForegroundColor Green
} else {
    Write-Host "  Tier 1: Bootstrap credentials ✗" -ForegroundColor Red
}
