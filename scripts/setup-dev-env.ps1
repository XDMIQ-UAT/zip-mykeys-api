# Setup Development Environment for mykeys.zip
# Usage: .\scripts\setup-dev-env.ps1

Write-Host "=== Setup MyKeys Development Environment ===" -ForegroundColor Cyan
Write-Host ""

# Check if MYKEYS_PASS_DEV is set
if ($env:MYKEYS_PASS_DEV) {
    Write-Host "MYKEYS_PASS_DEV is set" -ForegroundColor Green
    Write-Host "  Length: $($env:MYKEYS_PASS_DEV.Length) characters" -ForegroundColor Gray
} else {
    Write-Host "MYKEYS_PASS_DEV not set" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To set it:" -ForegroundColor Cyan
    Write-Host "  `$env:MYKEYS_PASS_DEV = 'your-dev-password'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or get it from Vercel:" -ForegroundColor Cyan
    Write-Host "  https://vercel.com/ici1/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor White
    Write-Host "  Look for MYKEYS_PASS_DEV (non-sensitive, visible)" -ForegroundColor Gray
}

Write-Host ""

# Check MYKEYS_PASS (production)
if ($env:MYKEYS_PASS) {
    Write-Host "MYKEYS_PASS is set (for production)" -ForegroundColor Green
} else {
    Write-Host "MYKEYS_PASS not set locally (will use from Vercel in production)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Environment Summary:" -ForegroundColor Cyan
Write-Host "  Production: Uses MYKEYS_PASS from Vercel (sensitive)" -ForegroundColor White
Write-Host "  Development: Uses MYKEYS_PASS_DEV (non-sensitive, visible)" -ForegroundColor White
Write-Host ""
Write-Host "To start development server:" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor White
Write-Host "  (Will use MYKEYS_PASS_DEV if set, or prompt for password)" -ForegroundColor Gray
Write-Host ""






