# Update MYKEYS_PASS in Vercel Environment Variables
# Sets new MYKEYS_PASS for Production, Preview, and Development environments

param(
    [string]$ProductionPassword,
    [string]$PreviewPassword,
    [string]$DevelopmentPassword,
    [string]$AllEnvironmentsPassword,
    [switch]$DryRun,
    [switch]$Interactive
)

$ErrorActionPreference = "Stop"

$VercelProjectId = "prj_z7PH1IzqYB7DusqyUuOcheekW77j"
$TeamId = "xdmiq"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Update MYKEYS_PASS in Vercel" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Get Vercel token (check VERCEL_KEY first, then VERCEL_TOKEN)
$vercelToken = $env:VERCEL_KEY
if (-not $vercelToken) {
    $vercelToken = $env:VERCEL_TOKEN
}
if (-not $vercelToken) {
    # Try system environment variables
    try {
        $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_KEY", "User")
    } catch {}
    if (-not $vercelToken) {
        try {
            $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN", "User")
        } catch {}
    }
    if (-not $vercelToken) {
        try {
            $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_KEY", "Machine")
        } catch {}
    }
    if (-not $vercelToken) {
        try {
            $vercelToken = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN", "Machine")
        } catch {}
    }
}

if (-not $vercelToken) {
    Write-Host "❌ VERCEL_KEY or VERCEL_TOKEN not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set one of these environment variables:" -ForegroundColor Yellow
    Write-Host "   `$env:VERCEL_KEY = 'your-vercel-key'" -ForegroundColor Cyan
    Write-Host "   OR" -ForegroundColor Gray
    Write-Host "   `$env:VERCEL_TOKEN = 'your-vercel-token'" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✓ Vercel authentication token found" -ForegroundColor Green
Write-Host ""

$vercelHeaders = @{
    "Authorization" = "Bearer $vercelToken"
    "Content-Type" = "application/json"
}

# Function to securely prompt for password
function Get-SecurePassword {
    param(
        [string]$Prompt
    )
    
    Write-Host "$Prompt" -ForegroundColor Yellow
    Write-Host "(Input will be hidden)" -ForegroundColor Gray
    
    $securePassword = Read-Host "Enter password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    
    return $plainPassword
}

# Determine passwords to use
$passwords = @{}

$needsInteractive = $false
if ($AllEnvironmentsPassword) {
    # Use same password for all environments
    $passwords.Production = $AllEnvironmentsPassword
    $passwords.Preview = $AllEnvironmentsPassword
    $passwords.Development = $AllEnvironmentsPassword
    Write-Host "✓ Using same password for all environments" -ForegroundColor Green
} elseif ($ProductionPassword -and $PreviewPassword -and $DevelopmentPassword) {
    # Use provided passwords
    $passwords.Production = $ProductionPassword
    $passwords.Preview = $PreviewPassword
    $passwords.Development = $DevelopmentPassword
    Write-Host "✓ Using provided passwords for each environment" -ForegroundColor Green
} else {
    # Need to prompt for passwords
    $needsInteractive = $true
}

if ($needsInteractive -or $Interactive) {
    # Interactive mode - prompt for passwords
    Write-Host "Interactive mode - Enter passwords for each environment:" -ForegroundColor Cyan
    Write-Host ""
    
    $useSame = Read-Host "Use the same password for all environments? (Y/n)"
    if ($useSame -eq "" -or $useSame -eq "Y" -or $useSame -eq "y") {
        $allPass = Get-SecurePassword "Enter password for all environments:"
        $passwords.Production = $allPass
        $passwords.Preview = $allPass
        $passwords.Development = $allPass
    } else {
        if ($ProductionPassword) {
            $passwords.Production = $ProductionPassword
            Write-Host "✓ Using provided Production password" -ForegroundColor Green
        } else {
            $passwords.Production = Get-SecurePassword "Enter password for Production:"
        }
        
        if ($PreviewPassword) {
            $passwords.Preview = $PreviewPassword
            Write-Host "✓ Using provided Preview password" -ForegroundColor Green
        } else {
            $passwords.Preview = Get-SecurePassword "Enter password for Preview:"
        }
        
        if ($DevelopmentPassword) {
            $passwords.Development = $DevelopmentPassword
            Write-Host "✓ Using provided Development password" -ForegroundColor Green
        } else {
            $passwords.Development = Get-SecurePassword "Enter password for Development:"
        }
    }
}

Write-Host ""

# Function to update/create environment variable
function Update-VercelEnvVar {
    param(
        [string]$Key,
        [string]$Value,
        [string]$Environment,
        [bool]$IsDryRun,
        [bool]$IsSensitive = $false
    )
    
    try {
        # Determine type: Production is sensitive (encrypted), others are plain (readable)
        $varType = if ($IsSensitive) { "encrypted" } else { "plain" }
        
        # Get existing env vars
        $envVars = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env?teamId=$TeamId" `
            -Headers $vercelHeaders `
            -Method Get
        
        $existingVar = $envVars.envs | Where-Object { 
            $_.key -eq $Key -and 
            $_.target -contains $Environment 
        } | Select-Object -First 1
        
        if ($existingVar) {
            # Update existing
            if (-not $IsDryRun) {
                $updateBody = @{
                    value = $Value
                    type = $varType
                    target = @($Environment)
                } | ConvertTo-Json
                
                Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env/$($existingVar.id)?teamId=$TeamId" `
                    -Headers $vercelHeaders `
                    -Method Patch `
                    -Body $updateBody | Out-Null
                
                return "Updated"
            } else {
                return "Would update"
            }
        } else {
            # Create new
            if (-not $IsDryRun) {
                $createBody = @{
                    key = $Key
                    value = $Value
                    type = $varType
                    target = @($Environment)
                } | ConvertTo-Json
                
                Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$VercelProjectId/env?teamId=$TeamId" `
                    -Headers $vercelHeaders `
                    -Method Post `
                    -Body $createBody | Out-Null
                
                return "Created"
            } else {
                return "Would create"
            }
        }
    } catch {
        Write-Host "  ✗ Error: $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "  Response: $responseBody" -ForegroundColor Red
            } catch {}
        }
        return "Failed"
    }
}

# Update passwords for each environment
# Production is sensitive (encrypted, can't be read), Preview/Development are plain (readable)
$environments = @(
    @{ Name = "Production"; VercelEnv = "production"; Password = $passwords.Production; IsSensitive = $true },
    @{ Name = "Preview"; VercelEnv = "preview"; Password = $passwords.Preview; IsSensitive = $false },
    @{ Name = "Development"; VercelEnv = "development"; Password = $passwords.Development; IsSensitive = $false }
)

$successCount = 0
$failCount = 0

foreach ($env in $environments) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Updating: $($env.Name)" -ForegroundColor $(if ($env.Name -eq "Production") { "Green" } elseif ($env.Name -eq "Preview") { "Yellow" } else { "Cyan" })
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Updating MYKEYS_PASS..." -ForegroundColor Yellow
    $sensitivity = if ($env.IsSensitive) { "encrypted (sensitive)" } else { "plain (readable)" }
    Write-Host "  Type: $sensitivity" -ForegroundColor Gray
    $result = Update-VercelEnvVar -Key "MYKEYS_PASS" -Value $env.Password -Environment $env.VercelEnv -IsDryRun $DryRun -IsSensitive $env.IsSensitive
    
    if ($result -match "Updated|Created|Would") {
        Write-Host "  ✓ $result MYKEYS_PASS for $($env.Name)" -ForegroundColor Green
        if (-not $DryRun) {
            Write-Host "  Password length: $($env.Password.Length) characters" -ForegroundColor Gray
            if ($env.IsSensitive) {
                Write-Host "  ⚠️  Production password is encrypted - cannot be read back!" -ForegroundColor Yellow
            } else {
                Write-Host "  ✓ Password is readable (can be retrieved from Vercel)" -ForegroundColor Green
            }
        }
        $successCount++
    } else {
        Write-Host "  ✗ Failed to update MYKEYS_PASS for $($env.Name)" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
    Write-Host "✅ $($env.Name) update complete!" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "✅ Dry Run Complete!" -ForegroundColor Green
    Write-Host "Run without -DryRun to apply changes" -ForegroundColor Yellow
} else {
    Write-Host "📋 Results:" -ForegroundColor Yellow
    Write-Host "  ✓ Successfully updated: $successCount" -ForegroundColor Green
    if ($failCount -gt 0) {
        Write-Host "  ✗ Failed: $failCount" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. New deployments will automatically use the new password" -ForegroundColor Gray
    Write-Host "  2. Test authentication with the new password:" -ForegroundColor Gray
    Write-Host "     `$env:MYKEYS_PASS = 'your-new-password'" -ForegroundColor Cyan
    Write-Host "     .\scripts\test-gcp-secret-manager.ps1 -Verbose" -ForegroundColor Cyan
    Write-Host "  3. Verify deployments are working correctly" -ForegroundColor Gray
}

Write-Host ""

