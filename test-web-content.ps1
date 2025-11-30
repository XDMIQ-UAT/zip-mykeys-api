# Test All Web Content with curl
# Tests all routes and endpoints before UAT handoff

$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"
$testResults = @()

Write-Host "=== Testing All Web Content ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host ""

function Test-Route {
    param(
        [string]$Path,
        [string]$Method = "GET",
        [string]$Description,
        [int]$ExpectedStatus = 200,
        [string]$ExpectedContent = ""
    )
    
    $url = "$baseUrl$Path"
    $result = @{
        Path = $Path
        Method = $Method
        Description = $Description
        Status = "PENDING"
        StatusCode = 0
        Error = ""
    }
    
    try {
        Write-Host "Testing: $Path" -ForegroundColor Yellow -NoNewline
        Write-Host " ($Description)" -ForegroundColor Gray
        
        $response = Invoke-WebRequest -Uri $url -Method $Method -UseBasicParsing -ErrorAction Stop
        
        $result.StatusCode = $response.StatusCode
        $result.ContentLength = $response.Content.Length
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            $result.Status = "PASS"
            Write-Host "  ✓ PASS - Status: $($response.StatusCode), Size: $($response.Content.Length) bytes" -ForegroundColor Green
            
            # Check for expected content if specified
            if ($ExpectedContent -and $response.Content -notmatch $ExpectedContent) {
                $result.Status = "WARN"
                $result.Error = "Expected content not found: $ExpectedContent"
                Write-Host "  ⚠ WARN - Expected content not found" -ForegroundColor Yellow
            }
        } else {
            $result.Status = "FAIL"
            $result.Error = "Expected status $ExpectedStatus, got $($response.StatusCode)"
            Write-Host "  ✗ FAIL - Expected status $ExpectedStatus, got $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        $result.Status = "FAIL"
        $result.Error = $_.Exception.Message
        if ($_.Exception.Response) {
            $result.StatusCode = $_.Exception.Response.StatusCode.value__
        }
        Write-Host "  ✗ FAIL - $($_.Exception.Message)" -ForegroundColor Red
    }
    
    $script:testResults += $result
    Write-Host ""
}

# Test React Router Routes
Write-Host "=== React Router Routes ===" -ForegroundColor Cyan
Write-Host ""

Test-Route -Path "/" -Description "Home page" -ExpectedContent "MyKeys.zip"
Test-Route -Path "/about" -Description "About page" -ExpectedContent "About MyKeys"
Test-Route -Path "/docs" -Description "Documentation page" -ExpectedContent "Documentation"
Test-Route -Path "/tools" -Description "Tools page" -ExpectedContent "Developer Tools"

# Test API Endpoints
Write-Host "=== API Endpoints ===" -ForegroundColor Cyan
Write-Host ""

Test-Route -Path "/health" -Description "Health check"
Test-Route -Path "/api/health" -Description "API health check"
Test-Route -Path "/api/v1/health" -Description "API v1 health check"

# Test Static HTML Tools (should still work)
Write-Host "=== Static HTML Tools ===" -ForegroundColor Cyan
Write-Host ""

Test-Route -Path "/generate-token.html" -Description "Token generator"
Test-Route -Path "/mcp-config-generator.html" -Description "MCP config generator"

# Test Static Assets (React build)
Write-Host "=== Static Assets ===" -ForegroundColor Cyan
Write-Host ""

# Check if React app was built
$indexPath = Join-Path $PSScriptRoot "public\index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    if ($indexContent -match "root") {
        Write-Host "✓ React app index.html found" -ForegroundColor Green
        
        # Test for common React build assets
        Test-Route -Path "/assets/index.js" -Description "React JS bundle" -ExpectedStatus 200
        Test-Route -Path "/assets/index.css" -Description "React CSS bundle" -ExpectedStatus 200
    } else {
        Write-Host "⚠ React app may not be built correctly" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ React app index.html not found - run 'npm run build' in marketing-site" -ForegroundColor Red
}

# Test 404 handling (should serve React app for client-side routing)
Write-Host "=== 404 Handling ===" -ForegroundColor Cyan
Write-Host ""

Test-Route -Path "/nonexistent-page" -Description "Non-existent route (should serve React app)" -ExpectedStatus 200

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$warned = ($testResults | Where-Object { $_.Status -eq "WARN" }).Count
$total = $testResults.Count

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $warned" -ForegroundColor $(if ($warned -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($failed -gt 0) {
    Write-Host "Failed Tests:" -ForegroundColor Red
    $testResults | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "  ✗ $($_.Path) - $($_.Error)" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}

if ($warned -gt 0) {
    Write-Host "Warnings:" -ForegroundColor Yellow
    $testResults | Where-Object { $_.Status -eq "WARN" } | ForEach-Object {
        Write-Host "  ⚠ $($_.Path) - $($_.Error)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "✅ All critical tests passed!" -ForegroundColor Green
Write-Host ""
Write-Host "Ready for UAT handoff!" -ForegroundColor Cyan





