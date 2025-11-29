#!/usr/bin/env pwsh
# Workspace Recovery Script - Auto-downloaded from mykeys.zip/rebuild
# This script restores your workspace after Windows reinstall

param(
    [string]$MyKeysUser = "admin",
    [string]$MyKeysPass = "",
    [switch]$SkipTools,
    [switch]$AutoApprove
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Workspace Recovery - mykeys.zip" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  This script requires Administrator privileges" -ForegroundColor Yellow
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    $proceed = Read-Host "Continue anyway? (y/n)"
    if ($proceed -ne "y") {
        exit 1
    }
}

# Step 1: Install winget if needed
if (-not $SkipTools) {
    Write-Host "Step 1: Installing Required Tools" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Host "Installing App Installer (includes winget)..." -ForegroundColor Gray
        $appInstallerUrl = "https://aka.ms/getwinget"
        $appInstallerPath = "$env:TEMP\Microsoft.DesktopAppInstaller.msixbundle"
        
        try {
            Invoke-WebRequest -Uri $appInstallerUrl -OutFile $appInstallerPath
            Add-AppxPackage -Path $appInstallerPath -ErrorAction Stop
            Write-Host "✅ App Installer installed" -ForegroundColor Green
            Write-Host "   Please restart PowerShell and run this script again" -ForegroundColor Yellow
            exit 0
        } catch {
            Write-Host "⚠️  Failed to install App Installer: $_" -ForegroundColor Yellow
            Write-Host "   Continuing with manual setup..." -ForegroundColor Gray
        }
    } else {
        Write-Host "✅ winget is available" -ForegroundColor Green
    }
    
    # Install Python
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Host "Installing Python..." -ForegroundColor Gray
        try {
            winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
            Write-Host "✅ Python installed" -ForegroundColor Green
            Write-Host "   Refreshing PATH..." -ForegroundColor Gray
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        } catch {
            Write-Host "⚠️  Failed to install Python: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ Python is installed" -ForegroundColor Green
    }
    
    # Install keyring
    Write-Host "Installing keyring library..." -ForegroundColor Gray
    try {
        pip install keyring --quiet
        Write-Host "✅ keyring installed" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Failed to install keyring: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Step 2: Device Registration with 2FA
Write-Host "Step 2: Device Registration (2FA Required)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

Write-Host "⚠️  SECURITY: New device registration requires 2FA approval" -ForegroundColor Yellow
Write-Host ""

if ([string]::IsNullOrWhiteSpace($MyKeysPass)) {
    Write-Host "Enter your mykeys.zip credentials:" -ForegroundColor White
    $securePass = Read-Host "Password" -AsSecureString
    $MyKeysPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    )
}

# Device fingerprinting
Write-Host "Generating device fingerprint..." -ForegroundColor Gray
$deviceFingerprint = @{
    hostname = $env:COMPUTERNAME
    username = $env:USERNAME
    os_version = (Get-CimInstance Win32_OperatingSystem).Version
    machine_guid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name MachineGuid).MachineGuid
    mac_address = (Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1).MacAddress
}

Write-Host "✅ Device fingerprint generated" -ForegroundColor Green

# Request 2FA code
Write-Host ""
Write-Host "Choose 2FA delivery method:" -ForegroundColor Cyan
$phoneNumber = Read-Host "Phone number (e.g., +12132484250) [optional]"
$email = Read-Host "Email address [optional]"

if ([string]::IsNullOrWhiteSpace($phoneNumber) -and [string]::IsNullOrWhiteSpace($email)) {
    Write-Host "⚠️  No phone or email provided" -ForegroundColor Yellow
    Write-Host "   You can manually retrieve the code from the API response" -ForegroundColor Gray
}

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${MyKeysUser}:${MyKeysPass}"))

try {
    $registerBody = @{
        device_fingerprint = $deviceFingerprint
        phone_number = $phoneNumber
        email = $email
    } | ConvertTo-Json
    
    Write-Host ""
    Write-Host "Requesting 2FA code..." -ForegroundColor Gray
    $registerResponse = Invoke-RestMethod -Uri "https://mykeys.zip/api/devices/register" `
        -Method Post `
        -Headers @{
            Authorization = "Basic $auth"
            ContentType = "application/json"
        } `
        -Body $registerBody
    
    $challengeId = $registerResponse.challenge_id
    Write-Host "✅ 2FA code sent" -ForegroundColor Green
    Write-Host "   Challenge ID: $challengeId" -ForegroundColor Gray
    
    $twoFactorCode = Read-Host "Enter 2FA code received via SMS/Email"
    
    # Verify 2FA
    $verifyBody = @{
        challenge_id = $challengeId
        code = $twoFactorCode
    } | ConvertTo-Json
    
    Write-Host "Verifying 2FA code..." -ForegroundColor Gray
    $verifyResponse = Invoke-RestMethod -Uri "https://mykeys.zip/api/devices/verify-2fa" `
        -Method Post `
        -Headers @{
            Authorization = "Basic $auth"
            ContentType = "application/json"
        } `
        -Body $verifyBody
    
    if ($verifyResponse.success) {
        $deviceToken = $verifyResponse.device_token
        Write-Host "✅ Device registered successfully" -ForegroundColor Green
        Write-Host "   Device Token saved" -ForegroundColor Gray
        
        # Store device token
        $pythonScript = @"
import keyring
try:
    keyring.set_password("mykeys.zip", "device_token", "$deviceToken")
    keyring.set_password("mykeys.zip", "username", "$MyKeysUser")
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
"@
        $result = $pythonScript | python
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Device token stored securely" -ForegroundColor Green
        }
        
        # Store in environment variables
        [System.Environment]::SetEnvironmentVariable("MYKEYS_URL", "https://mykeys.zip", "Machine")
        [System.Environment]::SetEnvironmentVariable("MYKEYS_USER", $MyKeysUser, "Machine")
        [System.Environment]::SetEnvironmentVariable("MYKEYS_PASS", $MyKeysPass, "Machine")
        Write-Host "✅ Environment variables set" -ForegroundColor Green
        
    } else {
        Write-Host "❌ 2FA verification failed: $($verifyResponse.reason)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "⚠️  Device registration failed: $_" -ForegroundColor Yellow
    Write-Host "   Error details: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Falling back to basic auth storage..." -ForegroundColor Yellow
    
    # Fallback: Store basic auth
    $pythonScript = @"
import keyring
try:
    keyring.set_password("mykeys.zip", "username", "$MyKeysUser")
    keyring.set_password("mykeys.zip", "password", "$MyKeysPass")
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
"@
    $pythonScript | python
    
    [System.Environment]::SetEnvironmentVariable("MYKEYS_URL", "https://mykeys.zip", "Machine")
    [System.Environment]::SetEnvironmentVariable("MYKEYS_USER", $MyKeysUser, "Machine")
    [System.Environment]::SetEnvironmentVariable("MYKEYS_PASS", $MyKeysPass, "Machine")
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Recovery Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Restart PowerShell to load new environment variables" -ForegroundColor White
Write-Host "  2. Your workspace credentials are now configured" -ForegroundColor White
Write-Host "  3. Agents can now retrieve secrets automatically" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: https://mykeys.zip/rebuild" -ForegroundColor Cyan
Write-Host ""




