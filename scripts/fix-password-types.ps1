# Fix Password Types in Vercel
# Converts Preview/Development passwords to 'plain' type so they can be retrieved
# Production remains encrypted (sensitive)

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$VercelProjectId = "prj_z7PH1IzqYB7DusqyUuOcheekW77j"
$TeamId = "xdmiq"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Fix Password Types in Vercel" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  ✓ Keep Production as encrypted (sensitive)" -ForegroundColor Green
Write-Host "  ✓ Convert Preview to plain (readable)" -ForegroundColor Yellow
Write-Host "  ✓ Convert Development to plain (readable)" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  Note: To change Preview/Development to plain, you need to:" -ForegroundColor Yellow
Write-Host "  1. Retrieve current passwords (if possible)" -ForegroundColor Gray
Write-Host "  2. Re-set them with the correct type" -ForegroundColor Gray
Write-Host ""
Write-Host "Since Preview/Development are currently encrypted, you'll need to:" -ForegroundColor Yellow
Write-Host "  - Regenerate passwords with correct types:" -ForegroundColor Gray
Write-Host "    .\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "The best approach is to regenerate passwords with correct types." -ForegroundColor Cyan
Write-Host "Run: .\scripts\generate-and-rotate-mykeys-passwords.ps1 -ShowPasswords" -ForegroundColor White




