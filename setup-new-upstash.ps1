# Setup New Upstash Database: upstash-kv-indigo-island

Write-Host "`n=== Setting Up New Upstash Database ===" -ForegroundColor Cyan
Write-Host "Database: upstash-kv-indigo-island" -ForegroundColor Yellow
Write-Host "REST URL: https://diverse-guinea-10527.upstash.io" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 1: Get REST Token from Upstash Console" -ForegroundColor Yellow
Write-Host "  1. In the Upstash console, find the 'REST' tab" -ForegroundColor Gray
Write-Host "  2. Look for 'UPSTASH_REDIS_REST_TOKEN' or 'Token'" -ForegroundColor Gray
Write-Host "  3. Click the eye icon to reveal it" -ForegroundColor Gray
Write-Host "  4. Copy the token" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 2: Add to Vercel Environment Variables" -ForegroundColor Yellow
Write-Host "  Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables" -ForegroundColor Cyan
Write-Host "  Add:" -ForegroundColor Gray
Write-Host "    Key: KV_REST_API_URL" -ForegroundColor White
Write-Host "    Value: https://diverse-guinea-10527.upstash.io" -ForegroundColor White
Write-Host "    Environments: Production, Preview, Development" -ForegroundColor Gray
Write-Host ""
Write-Host "    Key: KV_REST_API_TOKEN" -ForegroundColor White
Write-Host "    Value: <paste token from Upstash>" -ForegroundColor White
Write-Host "    Environments: Production, Preview, Development" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 3: Or add to .env.local for local testing" -ForegroundColor Yellow
Write-Host "  Add these lines to .env.local:" -ForegroundColor Gray
Write-Host "    KV_REST_API_URL=https://diverse-guinea-10527.upstash.io" -ForegroundColor White
Write-Host "    KV_REST_API_TOKEN=<your-token>" -ForegroundColor White
Write-Host ""

Write-Host "Step 4: After setting variables, re-store SES credentials:" -ForegroundColor Yellow
Write-Host "  node test-store-ses-local.js AKIAVGDN36DN35Q62F4F BMNmhuQjmqWO8ko8ABdk3rNuwNgsXDmBFG05hTYeBoXw" -ForegroundColor Cyan
Write-Host ""




