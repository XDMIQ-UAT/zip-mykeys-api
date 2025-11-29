# Get Upstash credentials from Vercel Storage

Write-Host "`n=== Getting Upstash Credentials from Vercel ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Method 1: Vercel Storage Tab" -ForegroundColor Yellow
Write-Host "  1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/storage" -ForegroundColor Cyan
Write-Host "  2. Find 'upstash-kv-purple-umbrella' in the list" -ForegroundColor Gray
Write-Host "  3. Click on it" -ForegroundColor Gray
Write-Host "  4. Look for:" -ForegroundColor Gray
Write-Host "     - 'Connection Details'" -ForegroundColor White
Write-Host "     - 'REST URL' or 'Endpoint'" -ForegroundColor White
Write-Host "     - 'REST Token' or 'Token'" -ForegroundColor White
Write-Host ""

Write-Host "Method 2: Check Email" -ForegroundColor Yellow
Write-Host "  Vercel may have sent you an email about Upstash account creation" -ForegroundColor Gray
Write-Host "  Check your email for:" -ForegroundColor Gray
Write-Host "    - Subject: 'Welcome to Upstash' or similar" -ForegroundColor White
Write-Host "    - From: Upstash or Vercel" -ForegroundColor White
Write-Host ""

Write-Host "Method 3: Vercel Integration Settings" -ForegroundColor Yellow
Write-Host "  1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/integrations" -ForegroundColor Cyan
Write-Host "  2. Find 'Upstash' integration" -ForegroundColor Gray
Write-Host "  3. Click on it to see connection details" -ForegroundColor Gray
Write-Host ""

Write-Host "Method 4: Use Vercel CLI" -ForegroundColor Yellow
Write-Host "  Try: vercel env ls" -ForegroundColor Cyan
Write-Host "  This might show all environment variables including Upstash ones" -ForegroundColor Gray
Write-Host ""

Write-Host "If none of these work, we can:" -ForegroundColor Yellow
Write-Host "  - Continue using GCP Secret Manager (current fallback)" -ForegroundColor Gray
Write-Host "  - Or manually create Upstash account at https://upstash.com" -ForegroundColor Gray
Write-Host ""




