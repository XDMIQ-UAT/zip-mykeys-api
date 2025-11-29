# Check Vercel Environment Variables for Upstash
Write-Host "`n=== Checking Vercel Environment Variables ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "To check if Upstash variables are set in Vercel:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
Write-Host "  2. Look for:" -ForegroundColor Yellow
Write-Host "     - UPSTASH_REDIS_REST_URL" -ForegroundColor Gray
Write-Host "     - UPSTASH_REDIS_REST_TOKEN" -ForegroundColor Gray
Write-Host ""

Write-Host "If they're not there yet:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/storage" -ForegroundColor Cyan
Write-Host "  2. Check if 'upstash-kv-purple-umbrella' database is listed" -ForegroundColor Gray
Write-Host "  3. Click on it to see connection details" -ForegroundColor Gray
Write-Host ""

Write-Host "Once variables are set, pull them:" -ForegroundColor Yellow
Write-Host "  vercel env pull .env.local --environment=production" -ForegroundColor Cyan
Write-Host ""

Write-Host "Then test connection:" -ForegroundColor Yellow
Write-Host "  node test-upstash-connection.js" -ForegroundColor Cyan
Write-Host ""




