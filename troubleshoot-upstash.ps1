# Troubleshoot Upstash Integration

Write-Host "`n=== Troubleshooting Upstash Integration ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Check Storage Tab" -ForegroundColor Yellow
Write-Host "  Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/storage" -ForegroundColor Cyan
Write-Host "  Look for 'upstash-kv-purple-umbrella' database" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 2: If database exists but no variables:" -ForegroundColor Yellow
Write-Host "  - Click on the database name" -ForegroundColor Gray
Write-Host "  - Look for 'Connection Details' or 'Environment Variables' section" -ForegroundColor Gray
Write-Host "  - You may need to manually add them" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 3: Get credentials from Upstash Dashboard:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://console.upstash.com" -ForegroundColor Cyan
Write-Host "  2. Find database: upstash-kv-purple-umbrella" -ForegroundColor Gray
Write-Host "  3. Click on it → 'Details' tab" -ForegroundColor Gray
Write-Host "  4. Copy:" -ForegroundColor Gray
Write-Host "     - UPSTASH_REDIS_REST_URL" -ForegroundColor Gray
Write-Host "     - UPSTASH_REDIS_REST_TOKEN" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 4: Add to Vercel manually:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
Write-Host "  2. Click 'Add New'" -ForegroundColor Gray
Write-Host "  3. Add:" -ForegroundColor Gray
Write-Host "     Key: UPSTASH_REDIS_REST_URL" -ForegroundColor White
Write-Host "     Value: <paste from Upstash>" -ForegroundColor White
Write-Host "     Environments: Production, Preview, Development" -ForegroundColor Gray
Write-Host "  4. Repeat for UPSTASH_REDIS_REST_TOKEN" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 5: Or add to .env.local for local testing:" -ForegroundColor Yellow
Write-Host "  Add these lines to .env.local:" -ForegroundColor Gray
Write-Host "    UPSTASH_REDIS_REST_URL=https://..." -ForegroundColor White
Write-Host "    UPSTASH_REDIS_REST_TOKEN=..." -ForegroundColor White
Write-Host ""




