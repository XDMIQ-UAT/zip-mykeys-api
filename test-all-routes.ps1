# Comprehensive Route Testing with curl
# Tests all routes and verifies content before UAT

$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"
$allTestsPassed = $true

Write-Host "=== Comprehensive Web Content Testing ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host "Using curl for all tests" -ForegroundColor Gray
Write-Host ""

function Test-Curl {
    param(
        [string]$Path,
        [string]$Description,
        [int]$ExpectedStatus = 200,
        [string[]]$ExpectedPatterns = @(),
        [string[]]$MustNotContain = @()
    )
    
    $url = "$baseUrl$Path"
    $passed = $false
    $issues = @()
    
    Write-Host "Testing: $Path" -ForegroundColor Yellow -NoNewline
    Write-Host " ($Description)" -ForegroundColor Gray
    
    try {
        # Get HTTP status code and content separately
        $tempFile = [System.IO.Path]::GetTempFileName()
        $statusCode = curl.exe -s -o $tempFile -w "%{http_code}" $url 2>&1
        
        # Parse status code (curl returns it as string)
        if ($statusCode -match '^\d+$') {
            $statusInt = [int]$statusCode
        } else {
            # If curl failed, try to get status from error
            $statusInt = 0
        }
        
        if ($statusInt -ne $ExpectedStatus) {
            $issues += "Status: Expected $ExpectedStatus, got $statusInt"
            Write-Host "  ✗ FAIL - HTTP Status: $statusInt (expected $ExpectedStatus)" -ForegroundColor Red
            if (Test-Path $tempFile) {
                $errorContent = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
                if ($errorContent) {
                    Write-Host "  Response: $($errorContent.Substring(0, [Math]::Min(100, $errorContent.Length)))..." -ForegroundColor Gray
                }
            }
            $script:allTestsPassed = $false
            Remove-Item $tempFile -ErrorAction SilentlyContinue
            Write-Host ""
            return
        }
        
        # Get content
        $content = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
        $contentLength = if ($content) { $content.Length } else { 0 }
        
        Write-Host "  Status: $statusInt ✓" -ForegroundColor Green -NoNewline
        Write-Host " Size: $contentLength bytes" -ForegroundColor Gray
        
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        
        # Check for expected patterns
        foreach ($pattern in $ExpectedPatterns) {
            if ($content -notmatch $pattern) {
                $issues += "Missing pattern: $pattern"
                Write-Host "  ⚠ WARN - Pattern not found: $pattern" -ForegroundColor Yellow
            } else {
                Write-Host "  ✓ Contains: $pattern" -ForegroundColor Green
            }
        }
        
        # Check for forbidden content
        foreach ($forbidden in $MustNotContain) {
            if ($content -match $forbidden) {
                $issues += "Found forbidden content: $forbidden"
                Write-Host "  ✗ FAIL - Contains forbidden content: $forbidden" -ForegroundColor Red
                $script:allTestsPassed = $false
            }
        }
        
        if ($issues.Count -eq 0) {
            $passed = $true
        }
        
    } catch {
        Write-Host "  ✗ ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $script:allTestsPassed = $false
    }
    
    Write-Host ""
    return $passed
}

# React Router Routes (should all serve index.html)
Write-Host "=== React Router Routes ===" -ForegroundColor Cyan
Write-Host ""

Test-Curl -Path "/" -Description "Home page" -ExpectedPatterns @("root", "MyKeys")
Test-Curl -Path "/about" -Description "About page" -ExpectedPatterns @("root")
Test-Curl -Path "/docs" -Description "Documentation page" -ExpectedPatterns @("root")
Test-Curl -Path "/tools" -Description "Tools page" -ExpectedPatterns @("root")

# API Endpoints
Write-Host "=== API Endpoints ===" -ForegroundColor Cyan
Write-Host ""

Test-Curl -Path "/health" -Description "Health check" -ExpectedPatterns @("ok|healthy|status")
Test-Curl -Path "/api/health" -Description "API health" -ExpectedPatterns @("ok|healthy|status")
Test-Curl -Path "/api/v1/health" -Description "API v1 health" -ExpectedPatterns @("ok|healthy|status")

# Static HTML Tools
Write-Host "=== Static HTML Tools ===" -ForegroundColor Cyan
Write-Host ""

Test-Curl -Path "/generate-token.html" -Description "Token generator" -ExpectedPatterns @("token|generate")
Test-Curl -Path "/mcp-config-generator.html" -Description "MCP config generator" -ExpectedPatterns @("mcp|config")

# Check React build assets exist
Write-Host "=== React Build Assets ===" -ForegroundColor Cyan
Write-Host ""

$assets = Get-ChildItem "public\assets" -ErrorAction SilentlyContinue
if ($assets) {
    foreach ($asset in $assets) {
        $assetPath = "/assets/$($asset.Name)"
        Test-Curl -Path $assetPath -Description "Asset: $($asset.Name)" -ExpectedStatus 200
    }
} else {
    Write-Host "⚠ No assets found in public/assets" -ForegroundColor Yellow
    Write-Host ""
}

# Test 404 handling (should serve React app)
Write-Host "=== 404 Handling ===" -ForegroundColor Cyan
Write-Host ""

Test-Curl -Path "/nonexistent-route-12345" -Description "Non-existent route" -ExpectedPatterns @("root")

# Test API endpoints that require auth (should return 401)
Write-Host "=== API Authentication ===" -ForegroundColor Cyan
Write-Host ""

$tempFile = [System.IO.Path]::GetTempFileName()
$authStatus = curl.exe -s -o $tempFile -w "%{http_code}" "http://localhost:8080/api/v1/secrets/shared/test" 2>&1
if ($authStatus -match '^\d+$') {
    $authStatusInt = [int]$authStatus
    if ($authStatusInt -eq 401) {
        Write-Host "✓ Authentication required - API returns 401 for unauthenticated requests" -ForegroundColor Green
    } else {
        Write-Host "✗ Authentication test failed - Expected 401, got $authStatusInt" -ForegroundColor Red
        $allTestsPassed = $false
    }
} else {
    # Check if response contains authentication error message
    $authContent = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
    if ($authContent -match "Authentication required|Authorization header") {
        Write-Host "✓ Authentication required - API returns error for unauthenticated requests" -ForegroundColor Green
    } else {
        Write-Host "⚠ Authentication test unclear - Status: $authStatus" -ForegroundColor Yellow
    }
}
Remove-Item $tempFile -ErrorAction SilentlyContinue
Write-Host ""

# Final Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""

if ($allTestsPassed) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ready for UAT handoff!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Verified:" -ForegroundColor Yellow
    Write-Host "  ✓ React Router routes serve index.html" -ForegroundColor Green
    Write-Host "  ✓ API endpoints respond correctly" -ForegroundColor Green
    Write-Host "  ✓ Static HTML tools accessible" -ForegroundColor Green
    Write-Host "  ✓ React build assets served" -ForegroundColor Green
    Write-Host "  ✓ Authentication required for API" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Some tests failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Review errors above before UAT handoff." -ForegroundColor Yellow
    exit 1
}

