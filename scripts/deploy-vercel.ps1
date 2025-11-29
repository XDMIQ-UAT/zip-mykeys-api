# PowerShell script to deploy mykeys.zip API to Vercel
# Usage: 
#   .\scripts\deploy-vercel.ps1              # Preview deployment
#   .\scripts\deploy-vercel.ps1 -Prod        # Production deployment
#   .\scripts\deploy-vercel.ps1 -Dev          # Development deployment

param(
    [switch]$Prod,
    [switch]$Dev
)

# Handle deployment target
$allArgs = $args + $PSBoundParameters.Keys
$deploymentTarget = "preview"

if ($allArgs -contains '--prod' -or $allArgs -contains '-prod' -or $Prod) {
    $deploymentTarget = "production"
    Write-Host "✅ Production deployment mode" -ForegroundColor Green
} elseif ($allArgs -contains '--dev' -or $allArgs -contains '-dev' -or $Dev) {
    $deploymentTarget = "development"
    Write-Host "✅ Development deployment mode" -ForegroundColor Cyan
} else {
    Write-Host "ℹ️  Preview deployment mode" -ForegroundColor Yellow
}

Write-Host "=== Deploy mykeys.zip API to Vercel ===" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
try {
    $vercelVersion = vercel --version 2>&1
    Write-Host "✅ Found Vercel CLI: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm i -g vercel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Vercel CLI" -ForegroundColor Red
        exit 1
    }
}

# Check if logged in
Write-Host "Checking Vercel authentication..." -ForegroundColor Yellow
$whoami = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in to Vercel. Please run: vercel login" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Opening Vercel login..." -ForegroundColor Cyan
    vercel login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to login to Vercel" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Logged in as: $whoami" -ForegroundColor Green
}

# Check if project is linked
Write-Host ""
Write-Host "Checking project link..." -ForegroundColor Yellow
if (-not (Test-Path ".vercel")) {
    Write-Host "⚠️  Project not linked. Linking to Vercel project..." -ForegroundColor Yellow
    Write-Host ""
    vercel link --yes 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Auto-link failed. You may need to link manually:" -ForegroundColor Yellow
        Write-Host "   vercel link" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "✅ Project linked" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Project already linked" -ForegroundColor Green
}

Write-Host ""
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "Project: mykeys-api (Express.js)" -ForegroundColor Gray
Write-Host ""

# Check for vercel.json configuration
if (-not (Test-Path "vercel.json")) {
    Write-Host "⚠️  No vercel.json found. Creating basic configuration..." -ForegroundColor Yellow
    
    $vercelConfig = @{
        version = 2
        builds = @(
            @{
                src = "server.js"
                use = "@vercel/node"
            }
        )
        routes = @(
            @{
                src = "/(.*)"
                dest = "/server.js"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $vercelConfig | Out-File -FilePath "vercel.json" -Encoding UTF8
    Write-Host "✅ Created vercel.json" -ForegroundColor Green
    Write-Host ""
}

# Deploy
Write-Host "📦 Preparing deployment..." -ForegroundColor Yellow
Write-Host "   • Checking files..." -ForegroundColor Gray

# Check for required files
$requiredFiles = @("server.js", "package.json", "vercel.json")
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file found" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file missing!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
$targetDisplay = $deploymentTarget.ToUpper()
$targetColor = switch ($deploymentTarget) {
    "production" { "Green" }
    "development" { "Cyan" }
    default { "Yellow" }
}
Write-Host "Deployment target: $targetDisplay" -ForegroundColor $targetColor
Write-Host ""

# Initialize exit code variable
$exitCode = 0

if ($deploymentTarget -eq "production") {
    Write-Host "🚀 Deploying to PRODUCTION..." -ForegroundColor Cyan
    Write-Host "   This may take 1-3 minutes..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "📤 Starting deployment (showing real-time progress)..." -ForegroundColor Yellow
    Write-Host ""
    
    # Use a function to stream output in real-time
    $deploymentUrls = @()
    $deployArgs = @("--prod")
    
    # Create a process that streams output
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "vercel"
    $processInfo.Arguments = "deploy --prod"  # Explicit deploy with production target
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    
    # Add event handlers for real-time output
    $outputHandler = {
        $line = $EventArgs.Data
        if ($line) {
            Write-Host $line -ForegroundColor Gray
            if ($line -match 'https://.*vercel\.app') {
                $script:deploymentUrls += $matches[0]
            }
        }
    }
    
    $errorHandler = {
        $line = $EventArgs.Data
        if ($line) {
            Write-Host $line -ForegroundColor Red
        }
    }
    
    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $outputHandler | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $errorHandler | Out-Null
    
    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()
    
    Write-Host "   [Deployment in progress...]" -ForegroundColor Yellow
    
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    
    # Wait a moment for events to finish
    Start-Sleep -Milliseconds 500
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Production URLs:" -ForegroundColor Yellow
        Write-Host "   Custom Domain: https://mykeys.zip" -ForegroundColor Green
        if ($deploymentUrls.Count -gt 0) {
            Write-Host "   Deployment URL: $($deploymentUrls[0])" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "⏳ Note: It may take 1-2 minutes for changes to propagate" -ForegroundColor DarkGray
        Write-Host ""
    } else {
        Write-Host "❌ Deployment failed with exit code: $exitCode" -ForegroundColor Red
    }
} else {
    Write-Host "🚀 Deploying to PREVIEW..." -ForegroundColor Cyan
    Write-Host "   This may take 1-2 minutes..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "📤 Starting deployment (showing real-time progress)..." -ForegroundColor Yellow
    Write-Host ""
    
    $previewUrls = @()
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "vercel"
    $processInfo.Arguments = "deploy --target=preview"  # Explicit deploy with preview target
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    
    $outputHandler = {
        $line = $EventArgs.Data
        if ($line) {
            Write-Host $line -ForegroundColor Gray
            if ($line -match 'https://.*vercel\.app') {
                $script:previewUrls += $matches[0]
            }
        }
    }
    
    $errorHandler = {
        $line = $EventArgs.Data
        if ($line) {
            Write-Host $line -ForegroundColor Red
        }
    }
    
    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $outputHandler | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $errorHandler | Out-Null
    
    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()
    
    Write-Host "   [Deployment in progress...]" -ForegroundColor Yellow
    
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    
    Start-Sleep -Milliseconds 500
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Preview URL:" -ForegroundColor Yellow
        if ($previewUrls.Count -gt 0) {
            Write-Host "   $($previewUrls[0])" -ForegroundColor Green
        }
        Write-Host ""
    } else {
        Write-Host "❌ Deployment failed with exit code: $exitCode" -ForegroundColor Red
    }
} elseif ($deploymentTarget -eq "development") {
    Write-Host "🚀 Deploying to DEVELOPMENT..." -ForegroundColor Cyan
    Write-Host "   This may take 1-2 minutes..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "📤 Starting deployment (showing real-time progress)..." -ForegroundColor Yellow
    Write-Host ""
    
    $devUrls = @()
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "vercel"
    $processInfo.Arguments = "deploy --target=development"  # Explicit deploy with development target
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    
    $outputHandler = {
        $line = $EventArgs.Data
        if ($line) {
            Write-Host $line -ForegroundColor Gray
            if ($line -match 'https://.*vercel\.app') {
                $script:devUrls += $matches[0]
            }
        }
    }
    
    $errorHandler = {
        $line = $EventArgs.Data
        if ($line) {
            Write-Host $line -ForegroundColor Red
        }
    }
    
    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $outputHandler | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $errorHandler | Out-Null
    
    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()
    
    Write-Host "   [Deployment in progress...]" -ForegroundColor Yellow
    
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    
    Start-Sleep -Milliseconds 500
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Development URL:" -ForegroundColor Yellow
        if ($devUrls.Count -gt 0) {
            Write-Host "   $($devUrls[0])" -ForegroundColor Green
        }
        Write-Host ""
    } else {
        Write-Host "❌ Deployment failed with exit code: $exitCode" -ForegroundColor Red
    }
}

# Update LASTEXITCODE for compatibility
if (-not (Test-Path variable:exitCode)) {
    $exitCode = 0
}
$global:LASTEXITCODE = $exitCode

if ($exitCode -ne 0) {
    Write-Host ''
    Write-Host '❌ Deployment failed' -ForegroundColor Red
    Write-Host 'Check the error messages above' -ForegroundColor Yellow
    exit 1
} else {
    Write-Host 'Next steps:' -ForegroundColor Yellow
    Write-Host '1. Test the deployment URL above' -ForegroundColor Gray
    Write-Host '2. Environment variables managed in Vercel Dashboard:' -ForegroundColor Gray
    Write-Host '   https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables' -ForegroundColor Cyan
    Write-Host '   - GCP_PROJECT' -ForegroundColor Gray
    Write-Host '   - GOOGLE_APPLICATION_CREDENTIALS' -ForegroundColor Gray
    Write-Host '   - MYKEYS_PASS' -ForegroundColor Gray
    if ($deploymentTarget -eq "production") {
        Write-Host '3. Custom domain (mykeys.zip) is already configured' -ForegroundColor Gray
    }
    Write-Host ''
    Write-Host '💡 Tip: Use Vercel CLI for faster deployments:' -ForegroundColor Cyan
    Write-Host "   vercel deploy --prod              # Production" -ForegroundColor White
    Write-Host "   vercel deploy --target=preview    # Preview" -ForegroundColor White
    Write-Host "   vercel deploy --target=development  # Development" -ForegroundColor White
    Write-Host ""
    Write-Host "   Note: All deployments use explicit --target flags" -ForegroundColor Gray
    Write-Host ''
}

