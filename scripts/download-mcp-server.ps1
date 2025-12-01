# Download MCP Server from mykeys.zip
# Usage: .\download-mcp-server.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Downloading MyKeys MCP Server ===" -ForegroundColor Cyan
Write-Host ""

# Create directory if it doesn't exist
$mykeysDir = Join-Path $env:USERPROFILE ".mykeys"
if (-not (Test-Path $mykeysDir)) {
    Write-Host "Creating directory: $mykeysDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $mykeysDir -Force | Out-Null
    Write-Host "✅ Directory created" -ForegroundColor Green
} else {
    Write-Host "✅ Directory exists: $mykeysDir" -ForegroundColor Green
}

# Download the MCP server
$outputPath = Join-Path $mykeysDir "mcp-server.js"
$downloadUrl = "https://mykeys.zip/mcp-server.js"

Write-Host ""
Write-Host "Downloading from: $downloadUrl" -ForegroundColor Yellow
Write-Host "Saving to: $outputPath" -ForegroundColor Yellow
Write-Host ""

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath -ErrorAction Stop
    Write-Host "✅ Download successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "MCP server saved to: $outputPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Use this path in your Cursor MCP config: $outputPath" -ForegroundColor Gray
    Write-Host "2. Or use: `$env:USERPROFILE\.mykeys\mcp-server.js" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor Gray
    Write-Host "2. Verify the URL is accessible: $downloadUrl" -ForegroundColor Gray
    Write-Host "3. Check if the file exists: https://mykeys.zip/mcp-server.js" -ForegroundColor Gray
    exit 1
}






