# Test GCP Secret Manager Access After Credential Rotation
# This script tests that the new GCP credentials are working correctly

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  GCP Secret Manager Access Test" -ForegroundColor Cyan
Write-Host "  After Credential Rotation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "https://mykeys.zip"

# Get MYKEYS_PASS - try environment variable first, then Vercel
$mykeysPass = $env:MYKEYS_PASS

if (-not $mykeysPass) {
    Write-Host "⚠️  MYKEYS_PASS not found in environment" -ForegroundColor Yellow
    Write-Host "   Attempting to retrieve from Vercel..." -ForegroundColor Gray
    Write-Host ""
    
    # Try to get from Vercel (for Preview/Development - Production is encrypted)
    $getPasswordScript = Join-Path $PSScriptRoot "get-mykeys-pass-from-vercel.ps1"
    if (Test-Path $getPasswordScript) {
        try {
            # Try Preview first (most likely to be readable)
            $mykeysPass = & $getPasswordScript -Environment "preview" -ErrorAction SilentlyContinue
            if ($mykeysPass) {
                Write-Host "✓ Retrieved MYKEYS_PASS from Vercel (Preview)" -ForegroundColor Green
                $env:MYKEYS_PASS = $mykeysPass
            } else {
                # Try Development
                $mykeysPass = & $getPasswordScript -Environment "development" -ErrorAction SilentlyContinue
                if ($mykeysPass) {
                    Write-Host "✓ Retrieved MYKEYS_PASS from Vercel (Development)" -ForegroundColor Green
                    $env:MYKEYS_PASS = $mykeysPass
                }
            }
        } catch {
            # Script will handle its own errors
        }
    }
    
    if (-not $mykeysPass) {
        Write-Host "❌ Could not retrieve MYKEYS_PASS" -ForegroundColor Red
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  1. Retrieve from Vercel (Preview/Dev only):" -ForegroundColor Gray
        Write-Host "     .\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview -SetEnvironmentVariable" -ForegroundColor Cyan
        Write-Host "  2. Set manually:" -ForegroundColor Gray
        Write-Host "     `$env:MYKEYS_PASS = 'your-password'" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Note: Production password is encrypted and cannot be retrieved." -ForegroundColor Yellow
        Write-Host "      Use Preview/Development password for testing, or regenerate Production." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✓ MYKEYS_PASS found" -ForegroundColor Green
Write-Host ""

# Create Basic Auth header
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$mykeysPass"))
$headers = @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
}

# Test 1: List all secrets
Write-Host "Test 1: Listing all secrets..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/secrets" -Headers $headers -Method Get -ErrorAction Stop
    Write-Host "   ✓ Success! Found $($response.secrets.Count) secrets" -ForegroundColor Green
    if ($Verbose -and $response.secrets) {
        Write-Host "   Sample secrets:" -ForegroundColor Gray
        $response.secrets | Select-Object -First 5 | ForEach-Object {
            Write-Host "     - $($_.name)" -ForegroundColor Gray
        }
    }
    $listSuccess = $true
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        if ($statusCode -eq 401) {
            Write-Host "   ⚠️  Authentication failed - check MYKEYS_PASS" -ForegroundColor Yellow
        } elseif ($statusCode -eq 500) {
            Write-Host "   ⚠️  Server error - may indicate GCP credential issues" -ForegroundColor Yellow
        }
    }
    $listSuccess = $false
}

Write-Host ""

# Test 2: Get a specific secret (try to read an existing one)
Write-Host "Test 2: Reading a specific secret..." -ForegroundColor Yellow
if ($listSuccess -and $response.secrets -and $response.secrets.Count -gt 0) {
    $testSecretName = $response.secrets[0].name
    Write-Host "   Testing with secret: $testSecretName" -ForegroundColor Gray
    try {
        $secretResponse = Invoke-RestMethod -Uri "$baseUrl/api/secrets/$testSecretName" -Headers $headers -Method Get -ErrorAction Stop
        Write-Host "   ✓ Successfully read secret value" -ForegroundColor Green
        if ($Verbose) {
            $valuePreview = if ($secretResponse.value.Length -gt 50) {
                $secretResponse.value.Substring(0, 50) + "..."
            } else {
                $secretResponse.value
            }
            Write-Host "   Value preview: $valuePreview" -ForegroundColor Gray
        }
        $readSuccess = $true
    } catch {
        Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode.value__
            Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        }
        $readSuccess = $false
    }
} else {
    Write-Host "   ⚠️  Skipping - no secrets found to test" -ForegroundColor Yellow
    $readSuccess = $null
}

Write-Host ""

# Test 3: V1 API - List secrets for ecosystem
Write-Host "Test 3: Testing V1 API - List secrets for 'shared' ecosystem..." -ForegroundColor Yellow
try {
    $v1Response = Invoke-RestMethod -Uri "$baseUrl/api/v1/secrets/shared" -Headers $headers -Method Get -ErrorAction Stop
    Write-Host "   ✓ Success! Found $($v1Response.secrets.Count) secrets in 'shared' ecosystem" -ForegroundColor Green
    if ($Verbose -and $v1Response.secrets) {
        Write-Host "   Sample secrets:" -ForegroundColor Gray
        $v1Response.secrets | Select-Object -First 5 | ForEach-Object {
            Write-Host "     - $($_.secret_name)" -ForegroundColor Gray
        }
    }
    $v1ListSuccess = $true
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    }
    $v1ListSuccess = $false
}

Write-Host ""

# Test 4: Create/Update a test secret (write access)
Write-Host "Test 4: Testing write access - Creating test secret..." -ForegroundColor Yellow
$testSecretName = "verification-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
$testSecretValue = "Test value created at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
try {
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/secrets" `
        -Headers $headers `
        -Method Post `
        -Body (@{
            name = $testSecretName
            value = $testSecretValue
            labels = @{
                test = "true"
                created_by = "verification-script"
            }
        } | ConvertTo-Json) `
        -ErrorAction Stop
    
    Write-Host "   ✓ Successfully created test secret: $testSecretName" -ForegroundColor Green
    
    # Clean up - delete the test secret
    Write-Host "   Cleaning up test secret..." -ForegroundColor Gray
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/secrets/$testSecretName" `
            -Headers $headers `
            -Method Delete `
            -ErrorAction Stop | Out-Null
        Write-Host "   ✓ Test secret deleted" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Could not delete test secret (non-critical)" -ForegroundColor Yellow
    }
    
    $writeSuccess = $true
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        if ($statusCode -eq 500 -and $_.Exception.Message -match "permission|credentials|GCP") {
            Write-Host "   ⚠️  This indicates GCP credential/permission issues!" -ForegroundColor Yellow
        }
    }
    $writeSuccess = $false
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{ Name = "List Secrets"; Success = $listSuccess },
    @{ Name = "Read Secret"; Success = $readSuccess },
    @{ Name = "V1 List Secrets"; Success = $v1ListSuccess },
    @{ Name = "Write Secret"; Success = $writeSuccess }
)

$allPassed = $true
foreach ($test in $tests) {
    $status = if ($test.Success -eq $null) { "SKIP" } elseif ($test.Success) { "PASS" } else { "FAIL" }
    $color = if ($test.Success -eq $null) { "Yellow" } elseif ($test.Success) { "Green" } else { "Red" }
    
    if ($test.Success -eq $false) {
        $allPassed = $false
    }
    
    Write-Host "  $status" -NoNewline -ForegroundColor $color
    Write-Host " - $($test.Name)"
}

Write-Host ""

if ($allPassed) {
    Write-Host "✅ All tests passed! GCP Secret Manager access is working correctly." -ForegroundColor Green
    Write-Host ""
    Write-Host "The credential rotation was successful!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. This may indicate:" -ForegroundColor Yellow
    Write-Host "   1. GCP credential issues (check service account permissions)" -ForegroundColor Yellow
    Write-Host "   2. Authentication issues (check MYKEYS_PASS)" -ForegroundColor Yellow
    Write-Host "   3. Network/connectivity issues" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
}

Write-Host ""

