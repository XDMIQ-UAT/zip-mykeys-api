# Verify Vercel Deployments After Credential Rotation
# Tests all 3 environments (Production, Preview, Development) to ensure credentials work

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

$Environments = @(
    @{ Name = "Production"; BaseUrl = "https://mykeys.zip" },
    @{ Name = "Preview"; BaseUrl = $null },  # Will be fetched from Vercel
    @{ Name = "Development"; BaseUrl = $null }  # Will be fetched from Vercel
)

$VercelProjectId = "prj_z7PH1IzqYB7DusqyUuOcheekW77j"
$TeamId = "xdmiq"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Vercel Deployment Verification" -ForegroundColor Cyan
Write-Host "  After GCP Credential Rotation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Get Vercel token (check both VERCEL_TOKEN and VERCEL_KEY)
$vercelToken = $env:VERCEL_TOKEN
if (-not $vercelToken) {
    $vercelToken = $env:VERCEL_KEY
}

# Also check system/user environment variables
if (-not $vercelToken) {
    try {
        $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_KEY", "User")
    } catch {}
}
if (-not $vercelToken) {
    try {
        $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_KEY", "Machine")
    } catch {}
}
if (-not $vercelToken) {
    try {
        $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN", "User")
    } catch {}
}
if (-not $vercelToken) {
    try {
        $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN", "Machine")
    } catch {}
}

if (-not $vercelToken) {
    Write-Host "Getting VERCEL_TOKEN from mykeys.zip..." -ForegroundColor Yellow
    # Get MYKEYS_PASS - try environment variable first, then Vercel
    $mykeysPass = $env:MYKEYS_PASS
    
    if (-not $mykeysPass) {
        # Try to get from Vercel (for Preview/Development - Production is encrypted)
        $getPasswordScript = Join-Path $PSScriptRoot "get-mykeys-pass-from-vercel.ps1"
        if (Test-Path $getPasswordScript) {
            try {
                # Try Preview first (most likely to be readable)
                $mykeysPass = & $getPasswordScript -Environment "preview" -ErrorAction SilentlyContinue
                if (-not $mykeysPass) {
                    # Try Development
                    $mykeysPass = & $getPasswordScript -Environment "development" -ErrorAction SilentlyContinue
                }
                if ($mykeysPass) {
                    $env:MYKEYS_PASS = $mykeysPass
                }
            } catch {
                # Script will handle its own errors
            }
        }
    }
    
    if ($mykeysPass) {
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$mykeysPass"))
        $headers = @{
            "Authorization" = "Basic $auth"
            "Content-Type" = "application/json"
        }
        
        try {
            # Try multiple API paths for VERCEL_TOKEN
            $vercelToken = $null
            $paths = @(
                "https://mykeys.zip/api/v1/secrets/shared/VERCEL_TOKEN",
                "https://mykeys.zip/api/secrets/VERCEL_TOKEN",
                "https://mykeys.zip/api/v1/secrets/VERCEL_TOKEN"
            )
            
            foreach ($path in $paths) {
                try {
                    $vercelToken = (Invoke-RestMethod -Uri $path -Headers $headers -Method Get -ErrorAction Stop).value
                    if ($vercelToken) {
                        Write-Host "✓ Retrieved VERCEL_TOKEN from mykeys.zip" -ForegroundColor Green
                        break
                    }
                } catch {
                    # Try next path
                }
            }
            
            if (-not $vercelToken) {
                Write-Host "⚠️  Could not retrieve VERCEL_TOKEN from mykeys.zip (tried multiple paths)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  Could not retrieve VERCEL_TOKEN from mykeys.zip: $_" -ForegroundColor Yellow
        }
    }
}

if (-not $vercelToken) {
    Write-Host "⚠️  VERCEL_TOKEN/VERCEL_KEY not found. Will only test Production environment." -ForegroundColor Yellow
    Write-Host "   Set VERCEL_TOKEN or VERCEL_KEY to test Preview and Development environments" -ForegroundColor Gray
    Write-Host ""
} else {
    $tokenName = if ($env:VERCEL_TOKEN) { "VERCEL_TOKEN" } else { "VERCEL_KEY" }
    Write-Host "✓ Using $tokenName from environment" -ForegroundColor Green
}

$vercelHeaders = @{
    "Authorization" = "Bearer $vercelToken"
    "Content-Type" = "application/json"
}

# Get preview and development URLs from Vercel
if ($vercelToken) {
    Write-Host "Fetching deployment URLs from Vercel..." -ForegroundColor Yellow
    try {
        $deployments = Invoke-RestMethod -Uri "https://api.vercel.com/v6/deployments?projectId=$VercelProjectId&teamId=$TeamId&limit=10" -Headers $vercelHeaders
        
        foreach ($deployment in $deployments.deployments) {
            if ($deployment.target -eq "preview" -and -not $Environments[1].BaseUrl) {
                $Environments[1].BaseUrl = "https://$($deployment.url)"
                Write-Host "✓ Found Preview URL: $($Environments[1].BaseUrl)" -ForegroundColor Green
            }
            if ($deployment.target -eq "development" -and -not $Environments[2].BaseUrl) {
                $Environments[2].BaseUrl = "https://$($deployment.url)"
                Write-Host "✓ Found Development URL: $($Environments[2].BaseUrl)" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "⚠️  Could not fetch deployment URLs: $_" -ForegroundColor Yellow
        Write-Host "   Will only test Production environment" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Skipping Preview/Development URL fetch (no VERCEL_TOKEN)" -ForegroundColor Yellow
}

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$Description
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ErrorAction = "Stop"
            TimeoutSec = 30
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        return @{
            Success = $true
            StatusCode = 200
            Response = $response
            Error = $null
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        return @{
            Success = $false
            StatusCode = $statusCode
            Response = $null
            Error = $_.Exception.Message
        }
    }
}

# Test results storage
$results = @()

foreach ($env in $Environments) {
    if (-not $env.BaseUrl) {
        Write-Host ""
        Write-Host "⚠️  Skipping $($env.Name) - URL not available" -ForegroundColor Yellow
        continue
    }
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Testing: $($env.Name)" -ForegroundColor $(if ($env.Name -eq "Production") { "Green" } elseif ($env.Name -eq "Preview") { "Yellow" } else { "Cyan" })
    Write-Host "URL: $($env.BaseUrl)" -ForegroundColor Gray
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    $envResults = @{
        Environment = $env.Name
        BaseUrl = $env.BaseUrl
        Tests = @()
    }
    
    # Test 1: Health endpoint (no auth)
    Write-Host "1. Testing /api/health (no auth)..." -ForegroundColor Yellow
    $healthTest = Test-Endpoint -Url "$($env.BaseUrl)/api/health" -Description "Health check"
    if ($healthTest.Success) {
        Write-Host "   ✓ Health check passed" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "   Response: $($healthTest.Response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ✗ Health check failed: $($healthTest.Error)" -ForegroundColor Red
    }
    $envResults.Tests += @{
        Test = "Health Check"
        Success = $healthTest.Success
        StatusCode = $healthTest.StatusCode
        Error = $healthTest.Error
    }
    
    # Test 2: API v1 health
    Write-Host "2. Testing /api/v1/health (no auth)..." -ForegroundColor Yellow
    $v1HealthTest = Test-Endpoint -Url "$($env.BaseUrl)/api/v1/health" -Description "V1 health check"
    if ($v1HealthTest.Success) {
        Write-Host "   ✓ V1 health check passed" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "   Response: $($v1HealthTest.Response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ✗ V1 health check failed: $($v1HealthTest.Error)" -ForegroundColor Red
    }
    $envResults.Tests += @{
        Test = "V1 Health Check"
        Success = $v1HealthTest.Success
        StatusCode = $v1HealthTest.StatusCode
        Error = $v1HealthTest.Error
    }
    
    # Test 3: Admin info (requires token - will fail without token, but tests endpoint availability)
    Write-Host "3. Testing /api/admin/info (requires token)..." -ForegroundColor Yellow
    $adminTest = Test-Endpoint -Url "$($env.BaseUrl)/api/admin/info" -Headers @{} -Description "Admin info"
    if ($adminTest.StatusCode -eq 401) {
        Write-Host "   ✓ Endpoint accessible (401 expected without token)" -ForegroundColor Green
    } elseif ($adminTest.Success) {
        Write-Host "   ✓ Admin info accessible" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Admin info failed: $($adminTest.Error)" -ForegroundColor Red
    }
    $envResults.Tests += @{
        Test = "Admin Info Endpoint"
        Success = ($adminTest.StatusCode -eq 401 -or $adminTest.Success)
        StatusCode = $adminTest.StatusCode
        Error = $adminTest.Error
    }
    
    # Test 4: GCP Secret Manager - List secrets (requires auth)
    Write-Host "4. Testing GCP Secret Manager - List secrets..." -ForegroundColor Yellow
    # Get MYKEYS_PASS - try environment variable first, then Vercel
    $mykeysPass = $env:MYKEYS_PASS
    
    if (-not $mykeysPass) {
        # Try to get from Vercel (for Preview/Development - Production is encrypted)
        $getPasswordScript = Join-Path $PSScriptRoot "get-mykeys-pass-from-vercel.ps1"
        if (Test-Path $getPasswordScript) {
            try {
                # Try Preview first (most likely to be readable)
                $mykeysPass = & $getPasswordScript -Environment "preview" -ErrorAction SilentlyContinue
                if (-not $mykeysPass) {
                    # Try Development
                    $mykeysPass = & $getPasswordScript -Environment "development" -ErrorAction SilentlyContinue
                }
                if ($mykeysPass) {
                    $env:MYKEYS_PASS = $mykeysPass
                }
            } catch {
                # Script will handle its own errors
            }
        }
    }
    
    if ($mykeysPass) {
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:$mykeysPass"))
        $authHeaders = @{
            "Authorization" = "Basic $auth"
        }
        
        $secretsTest = Test-Endpoint -Url "$($env.BaseUrl)/api/secrets" -Headers $authHeaders -Description "List secrets"
        if ($secretsTest.Success) {
            Write-Host "   ✓ GCP Secret Manager read access working" -ForegroundColor Green
            if ($Verbose -and $secretsTest.Response.secrets) {
                Write-Host "   Found $($secretsTest.Response.secrets.Count) secrets" -ForegroundColor Gray
            }
        } else {
            Write-Host "   ✗ GCP Secret Manager read failed: $($secretsTest.Error)" -ForegroundColor Red
            if ($secretsTest.Error -match "permission|credentials|authentication") {
                Write-Host "   ⚠️  This may indicate credential issues!" -ForegroundColor Yellow
            }
        }
        $envResults.Tests += @{
            Test = "GCP Secret Manager - List"
            Success = $secretsTest.Success
            StatusCode = $secretsTest.StatusCode
            Error = $secretsTest.Error
        }
    } else {
        Write-Host "   ⚠️  Skipping - MYKEYS_PASS not set" -ForegroundColor Yellow
        $envResults.Tests += @{
            Test = "GCP Secret Manager - List"
            Success = $false
            StatusCode = $null
            Error = "MYKEYS_PASS not set"
        }
    }
    
    # Test 5: Token generation endpoint (tests GCP write access)
    Write-Host "5. Testing token generation endpoint..." -ForegroundColor Yellow
    if ($mykeysPass) {
        $tokenGenTest = Test-Endpoint -Url "$($env.BaseUrl)/api/mcp/token/generate" `
            -Method "POST" `
            -Headers $authHeaders `
            -Body @{
                clientId = "verification-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
                clientType = "test"
                expiresInDays = 1
                architectCode = "test-code-that-will-fail"
            } `
            -Description "Token generation"
        
        # We expect this to fail with 401 (invalid architect code), but endpoint should be accessible
        if ($tokenGenTest.StatusCode -eq 401 -or $tokenGenTest.StatusCode -eq 400) {
            Write-Host "   ✓ Token generation endpoint accessible" -ForegroundColor Green
        } elseif ($tokenGenTest.Success) {
            Write-Host "   ✓ Token generation working (unexpected success)" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Token generation failed: $($tokenGenTest.Error)" -ForegroundColor Red
            if ($tokenGenTest.Error -match "permission|credentials|GCP") {
                Write-Host "   ⚠️  This may indicate GCP credential issues!" -ForegroundColor Yellow
            }
        }
        $envResults.Tests += @{
            Test = "Token Generation Endpoint"
            Success = ($tokenGenTest.StatusCode -eq 401 -or $tokenGenTest.StatusCode -eq 400 -or $tokenGenTest.Success)
            StatusCode = $tokenGenTest.StatusCode
            Error = $tokenGenTest.Error
        }
    } else {
        Write-Host "   ⚠️  Skipping - MYKEYS_PASS not set" -ForegroundColor Yellow
        $envResults.Tests += @{
            Test = "Token Generation Endpoint"
            Success = $false
            StatusCode = $null
            Error = "MYKEYS_PASS not set"
        }
    }
    
    # Test 6: V1 secrets endpoint
    Write-Host "6. Testing /api/v1/secrets endpoint..." -ForegroundColor Yellow
    if ($mykeysPass) {
        $v1SecretsTest = Test-Endpoint -Url "$($env.BaseUrl)/api/v1/secrets/shared" -Headers $authHeaders -Description "V1 secrets list"
        if ($v1SecretsTest.Success) {
            Write-Host "   ✓ V1 secrets endpoint working" -ForegroundColor Green
        } else {
            Write-Host "   ✗ V1 secrets endpoint failed: $($v1SecretsTest.Error)" -ForegroundColor Red
        }
        $envResults.Tests += @{
            Test = "V1 Secrets Endpoint"
            Success = $v1SecretsTest.Success
            StatusCode = $v1SecretsTest.StatusCode
            Error = $v1SecretsTest.Error
        }
    } else {
        Write-Host "   ⚠️  Skipping - MYKEYS_PASS not set" -ForegroundColor Yellow
        $envResults.Tests += @{
            Test = "V1 Secrets Endpoint"
            Success = $false
            StatusCode = $null
            Error = "MYKEYS_PASS not set"
        }
    }
    
    $results += $envResults
    
    Write-Host ""
    Write-Host "✅ $($env.Name) testing complete!" -ForegroundColor Green
}

# Check Vercel deployment logs for errors
if ($vercelToken) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Checking Vercel Deployment Logs..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    try {
        $deployments = Invoke-RestMethod -Uri "https://api.vercel.com/v6/deployments?projectId=$VercelProjectId&teamId=$TeamId&limit=5" -Headers $vercelHeaders
        
        foreach ($deployment in $deployments.deployments) {
            $envName = switch ($deployment.target) {
                "production" { "Production" }
                "preview" { "Preview" }
                "development" { "Development" }
                default { $deployment.target }
            }
            
            Write-Host "Deployment: $envName" -ForegroundColor $(if ($deployment.readyState -eq "READY") { "Green" } else { "Yellow" })
            Write-Host "  State: $($deployment.readyState)" -ForegroundColor Gray
            Write-Host "  Created: $($deployment.createdAt)" -ForegroundColor Gray
            Write-Host "  URL: https://$($deployment.url)" -ForegroundColor Gray
            
            if ($deployment.readyState -ne "READY") {
                Write-Host "  ⚠️  Deployment not ready!" -ForegroundColor Yellow
            }
            
            Write-Host ""
        }
    } catch {
        Write-Host "⚠️  Could not fetch deployment logs: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "⚠️  Skipping deployment log check (no VERCEL_TOKEN)" -ForegroundColor Yellow
    Write-Host "   Check manually at: https://vercel.com/$TeamId/zip-myl-mykeys-api/deployments" -ForegroundColor Gray
    Write-Host ""
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Verification Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0

foreach ($envResult in $results) {
    Write-Host "$($envResult.Environment):" -ForegroundColor $(if ($envResult.Environment -eq "Production") { "Green" } elseif ($envResult.Environment -eq "Preview") { "Yellow" } else { "Cyan" })
    foreach ($test in $envResult.Tests) {
        $totalTests++
        $status = if ($test.Success) {
            $passedTests++
            "✓"
        } else {
            $failedTests++
            "✗"
        }
        $color = if ($test.Success) { "Green" } else { "Red" }
        Write-Host "  $status $($test.Test): $($test.StatusCode)" -ForegroundColor $color
        if (-not $test.Success -and $test.Error) {
            Write-Host "    Error: $($test.Error)" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

Write-Host "Overall:" -ForegroundColor Yellow
Write-Host "  Total Tests: $totalTests" -ForegroundColor Gray
Write-Host "  Passed: $passedTests" -ForegroundColor Green
Write-Host "  Failed: $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "✅ All tests passed! Credential rotation successful." -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Delete old keys: .\scripts\rotate-vercel-gcp-credentials.ps1 -DeleteOldKeys" -ForegroundColor Cyan
    Write-Host "  2. Monitor deployments for 24 hours" -ForegroundColor Gray
    Write-Host "  3. Check Vercel logs periodically" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Some tests failed. Please investigate:" -ForegroundColor Yellow
    Write-Host "  1. Check Vercel deployment logs" -ForegroundColor Gray
    Write-Host "  2. Verify GCP service account permissions" -ForegroundColor Gray
    Write-Host "  3. Check environment variables in Vercel dashboard" -ForegroundColor Gray
    Write-Host "  4. Consider rolling back if critical issues found" -ForegroundColor Gray
}

Write-Host ""

