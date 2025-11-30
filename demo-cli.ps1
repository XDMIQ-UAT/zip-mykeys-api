# Quick CLI Demo Script for mykeys.zip
# Usage: .\demo-cli.ps1

Write-Host "=== MyKeys CLI Demo ===" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
$healthCheck = $null
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "Server is running!" -ForegroundColor Green
} catch {
    Write-Host "Server not running. Starting server..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please run in a separate terminal:" -ForegroundColor Cyan
    Write-Host "  cd E:\zip-myl-mykeys-api" -ForegroundColor White
    Write-Host "  npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Testing CLI Endpoints ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Health Check:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/health"
    Write-Host "   Status: $($health.status)" -ForegroundColor Green
    Write-Host "   Service: $($health.service)" -ForegroundColor Gray
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: List Secrets (requires auth)
if ($env:MYKEYS_PASS) {
    Write-Host "2. Testing Authenticated Endpoints:" -ForegroundColor Yellow
    
    $credential = New-Object PSCredential("admin", (ConvertTo-SecureString $env:MYKEYS_PASS -AsPlainText -Force))
    
    # List secrets
    Write-Host "   a) List secrets:" -ForegroundColor Cyan
    try {
        $secrets = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/secrets/shared" -Credential $credential
        if ($secrets -is [Array]) {
            Write-Host "      Found $($secrets.Count) secrets" -ForegroundColor Green
            foreach ($secret in $secrets | Select-Object -First 5) {
                Write-Host "      - $($secret.name)" -ForegroundColor Gray
            }
        } else {
            Write-Host "      Response: $($secrets | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "      Error: $_" -ForegroundColor Red
    }
    
    # Get a specific secret (example)
    Write-Host "   b) Get secret example:" -ForegroundColor Cyan
    Write-Host "      Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/secrets/shared/secret-name' -Credential `$credential" -ForegroundColor Gray
    
    # Store a secret (example)
    Write-Host "   c) Store secret example:" -ForegroundColor Cyan
    Write-Host "      `$body = @{value = 'secret-value'} | ConvertTo-Json" -ForegroundColor Gray
    Write-Host "      Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/secrets/shared/secret-name' -Method POST -Credential `$credential -Body `$body -ContentType 'application/json'" -ForegroundColor Gray
    
} else {
    Write-Host "2. Set MYKEYS_PASS to test authenticated endpoints:" -ForegroundColor Yellow
    Write-Host "   `$env:MYKEYS_PASS = 'your-password'" -ForegroundColor White
}

Write-Host ""

# Test 3: MCP Token Generation
Write-Host "3. MCP Token Generation:" -ForegroundColor Yellow
Write-Host "   Visit: http://localhost:8080/public/generate-token.html" -ForegroundColor Cyan
Write-Host "   Or use API:" -ForegroundColor Gray
Write-Host "   POST http://localhost:8080/api/mcp/token" -ForegroundColor Gray
Write-Host "   Body: {`"clientId`": `"cursor-agent`", `"clientType`": `"cursor`"}" -ForegroundColor Gray

Write-Host ""

# Test 4: API Documentation
Write-Host "4. Available Endpoints:" -ForegroundColor Yellow
Write-Host "   - GET  /api/health" -ForegroundColor Gray
Write-Host "   - GET  /api/v1/secrets/shared/:secretName" -ForegroundColor Gray
Write-Host "   - POST /api/v1/secrets/shared/:secretName" -ForegroundColor Gray
Write-Host "   - GET  /api/v1/secrets/shared" -ForegroundColor Gray
Write-Host "   - POST /api/mcp/token" -ForegroundColor Gray

Write-Host ""
Write-Host "=== Demo Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Server running at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Web UI: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""





