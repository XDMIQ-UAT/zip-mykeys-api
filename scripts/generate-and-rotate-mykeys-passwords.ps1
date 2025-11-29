# Generate Random Max-Complexity Passwords and Update Vercel
# Creates strong, unique passwords for Production, Preview, and Development

param(
    [int]$PasswordLength = 128,
    [switch]$DryRun,
    [switch]$ShowPasswords
)

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Generate & Rotate MYKEYS_PASS" -ForegroundColor Cyan
Write-Host "  Max-Length, Max-Complexity Passwords" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Password Length: $PasswordLength characters" -ForegroundColor Gray
Write-Host "Complexity: Maximum (uppercase, lowercase, numbers, special chars)" -ForegroundColor Gray
Write-Host ""

# Function to generate secure random password
function New-SecureRandomPassword {
    param(
        [int]$Length = 128
    )
    
    # Character sets for maximum complexity
    $lowercase = "abcdefghijklmnopqrstuvwxyz"
    $uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    $numbers = "0123456789"
    $special = '!@#$%^&*()_+-=[]{}|;:,.<>?/~' + [char]96
    
    # Combine all character sets
    $allChars = $lowercase + $uppercase + $numbers + $special
    
    # Ensure at least one character from each set
    $password = ""
    $password += $lowercase[(Get-Random -Maximum $lowercase.Length)]
    $password += $uppercase[(Get-Random -Maximum $uppercase.Length)]
    $password += $numbers[(Get-Random -Maximum $numbers.Length)]
    $password += $special[(Get-Random -Maximum $special.Length)]
    
    # Fill the rest randomly
    for ($i = $password.Length; $i -lt $Length; $i++) {
        $password += $allChars[(Get-Random -Maximum $allChars.Length)]
    }
    
    # Shuffle the password to randomize position of required characters
    $passwordArray = $password.ToCharArray()
    $shuffled = $passwordArray | Sort-Object { Get-Random }
    $password = -join $shuffled
    
    return $password
}

Write-Host "Generating secure random passwords..." -ForegroundColor Yellow
Write-Host ""

# Generate passwords for each environment
$passwords = @{
    Production = New-SecureRandomPassword -Length $PasswordLength
    Preview = New-SecureRandomPassword -Length $PasswordLength
    Development = New-SecureRandomPassword -Length $PasswordLength
}

Write-Host "✓ Generated passwords for all environments" -ForegroundColor Green
Write-Host ""

# Display passwords if requested
if ($ShowPasswords) {
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Generated Passwords" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Production:" -ForegroundColor Green
    Write-Host "  $($passwords.Production)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Preview:" -ForegroundColor Yellow
    Write-Host "  $($passwords.Preview)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Development:" -ForegroundColor Cyan
    Write-Host "  $($passwords.Development)" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "Passwords generated (hidden for security)" -ForegroundColor Gray
    Write-Host "  Production:   $($passwords.Production.Length) characters" -ForegroundColor Green
    Write-Host "  Preview:      $($passwords.Preview.Length) characters" -ForegroundColor Yellow
    Write-Host "  Development: $($passwords.Development.Length) characters" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Use -ShowPasswords to display the generated passwords" -ForegroundColor Gray
    Write-Host ""
}

# Save passwords to a secure temporary file (will be deleted after use)
$tempFile = [System.IO.Path]::GetTempFileName()
$passwords | ConvertTo-Json | Out-File -FilePath $tempFile -Encoding UTF8

try {
    # Call the update script with the generated passwords
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Updating Vercel Environment Variables" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    $updateScript = Join-Path $PSScriptRoot "update-mykeys-password.ps1"
    
    if (-not (Test-Path $updateScript)) {
        Write-Host "❌ Update script not found: $updateScript" -ForegroundColor Red
        exit 1
    }
    
    # Build parameters for update script
    $updateParams = @{
        ProductionPassword = $passwords.Production
        PreviewPassword = $passwords.Preview
        DevelopmentPassword = $passwords.Development
    }
    
    if ($DryRun) {
        $updateParams.DryRun = $true
    }
    
    # Call the update script
    & $updateScript @updateParams
    
    if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) {
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "  Password Rotation Complete!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host ""
        
        if (-not $ShowPasswords) {
            Write-Host "⚠️  IMPORTANT: Save these passwords securely!" -ForegroundColor Yellow
            Write-Host "   They will not be shown again unless you use -ShowPasswords" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "To view passwords, run:" -ForegroundColor Gray
            Write-Host "   .\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords" -ForegroundColor Cyan
            Write-Host ""
        }
        
        Write-Host "Next Steps:" -ForegroundColor Yellow
        Write-Host "  1. Test authentication with new passwords:" -ForegroundColor Gray
        Write-Host '     $env:MYKEYS_PASS = "production-password"' -ForegroundColor Cyan
        Write-Host "     .\scripts\test-gcp-secret-manager.ps1 -Verbose" -ForegroundColor Cyan
        Write-Host "  2. Verify deployments are working:" -ForegroundColor Gray
        Write-Host "     .\scripts\verify-deployments.ps1 -Verbose" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Password update failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "   Passwords were generated but not updated in Vercel" -ForegroundColor Yellow
        Write-Host ""
        if (-not $ShowPasswords) {
            Write-Host "   Run with -ShowPasswords to see generated passwords:" -ForegroundColor Yellow
            Write-Host "   .\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords" -ForegroundColor Cyan
        }
    }
} finally {
    # Clean up temp file
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

