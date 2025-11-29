# Connect GitHub repository to Vercel project via API
# Usage: .\scripts\connect-github-vercel.ps1

param(
    [string]$VercelToken,
    [string]$GitHubRepo = "XDM-ZSBW/zip-mykeys-api"
)

Write-Host "`n=== Connect GitHub Repository to Vercel ===" -ForegroundColor Cyan

# Check if project is linked
if (-not (Test-Path ".vercel\project.json")) {
    Write-Host "❌ Project not linked. Run 'vercel link' first." -ForegroundColor Red
    exit 1
}

$project = Get-Content ".vercel\project.json" | ConvertFrom-Json
$projectId = $project.projectId
$orgId = $project.orgId

Write-Host "`nProject Details:" -ForegroundColor White
Write-Host "  Project ID: $projectId" -ForegroundColor Gray
Write-Host "  Org ID: $orgId" -ForegroundColor Gray
Write-Host "  Repository: $GitHubRepo" -ForegroundColor Gray

# Get Vercel token
if (-not $VercelToken) {
    $VercelToken = $env:VERCEL_TOKEN
    if (-not $VercelToken) {
        Write-Host "`n⚠️  VERCEL_TOKEN not found in environment" -ForegroundColor Yellow
        Write-Host "`nGet your token from: https://vercel.com/account/tokens" -ForegroundColor Cyan
        $VercelToken = Read-Host "Enter Vercel token"
    }
}

if (-not $VercelToken) {
    Write-Host "❌ Vercel token required" -ForegroundColor Red
    exit 1
}

# Parse GitHub repo
$repoParts = $GitHubRepo -split '/'
if ($repoParts.Count -ne 2) {
    Write-Host "❌ Invalid GitHub repository format. Use: owner/repo" -ForegroundColor Red
    exit 1
}

$repoOwner = $repoParts[0]
$repoName = $repoParts[1]

Write-Host "`nConnecting GitHub repository..." -ForegroundColor Yellow

# Use Vercel API to connect GitHub repository
$headers = @{
    "Authorization" = "Bearer $VercelToken"
    "Content-Type" = "application/json"
}

$body = @{
    gitRepository = @{
        type = "github"
        repo = $GitHubRepo
    }
} | ConvertTo-Json -Depth 10

$url = "https://api.vercel.com/v9/projects/$projectId?teamId=$orgId"

try {
    $response = Invoke-RestMethod -Uri $url -Method PATCH -Headers $headers -Body $body
    
    Write-Host "`n✅ Successfully connected GitHub repository!" -ForegroundColor Green
    Write-Host "`nRepository: $GitHubRepo" -ForegroundColor White
    Write-Host "Project: $($response.name)" -ForegroundColor White
    
    Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Verify connection: https://vercel.com/xdmiq/zip-mykeys-api/settings/git" -ForegroundColor Gray
    Write-Host "  2. Make a test commit to trigger deployment" -ForegroundColor Gray
    Write-Host "  3. Check deployments: https://vercel.com/xdmiq/zip-mykeys-api/deployments" -ForegroundColor Gray
    
} catch {
    Write-Host "`n❌ Failed to connect repository" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "`n⚠️  Authentication failed. Check your Vercel token." -ForegroundColor Yellow
    } elseif ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "`n⚠️  Access denied. Ensure:" -ForegroundColor Yellow
        Write-Host "  • Vercel GitHub app is authorized" -ForegroundColor Gray
        Write-Host "  • You have access to the repository" -ForegroundColor Gray
        Write-Host "  • Repository is not private (or Vercel has access)" -ForegroundColor Gray
    }
    
    Write-Host "`n💡 Alternative: Connect via Vercel Dashboard" -ForegroundColor Cyan
    Write-Host "  https://vercel.com/xdmiq/zip-mykeys-api/settings/git" -ForegroundColor White
    
    exit 1
}

