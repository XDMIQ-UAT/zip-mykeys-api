# Test Vercel Environment Variables
# Usage: .\test-env-vars.ps1

Write-Host "=== Testing Environment Variables ===" -ForegroundColor Cyan
Write-Host ""

# Test local server
$baseUrl = "http://localhost:8080"
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "Testing local server: $baseUrl" -ForegroundColor Green
} catch {
    Write-Host "Local server not running" -ForegroundColor Yellow
    Write-Host "Start with: cd E:\zip-myl-mykeys-api && npm start" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Checking environment variables..." -ForegroundColor Yellow

# Check if variables are set
$vars = @("REGISTRAR_URL", "REGISTRAR_API_KEY", "REGISTRAR_SECRET_KEY")

foreach ($var in $vars) {
    $value = [System.Environment]::GetEnvironmentVariable($var, "Process")
    if ($value) {
        Write-Host "  $var : Set (length: $($value.Length))" -ForegroundColor Green
    } else {
        Write-Host "  $var : Not set in local environment" -ForegroundColor Yellow
        Write-Host "    (Will use Vercel environment variables when deployed)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Note: In Vercel, these variables are loaded automatically" -ForegroundColor Cyan
Write-Host "They are available as process.env.REGISTRAR_URL, etc." -ForegroundColor Gray
Write-Host ""






