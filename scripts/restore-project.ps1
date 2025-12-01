#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Restore project from backup including all agents

.DESCRIPTION
    Restores the project from backup including:
    - Project code
    - Project data
    - Project agents (CRITICAL for continuity)
    - Configuration files

.PARAMETER BackupPath
    Path to backup directory

.PARAMETER Destination
    Destination path (default: project root)

.PARAMETER Force
    Overwrite existing files

.EXAMPLE
    .\restore-project.ps1 -BackupPath "Z:\data\backup\project-name\project-name_2025-01-01_12-00-00"
    
.EXAMPLE
    .\restore-project.ps1 -BackupPath "Z:\data\backup\project-name\project-name_2025-01-01_12-00-00" -Force
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,
    
    [Parameter(Mandatory=$false)]
    [string]$Destination,
    
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# PROJECT-SPECIFIC: Set default destination
if (-not $Destination) {
    $Destination = Split-Path $PSScriptRoot -Parent
}

$projectName = Split-Path $Destination -Leaf

if (-not (Test-Path $BackupPath)) {
    Write-Host "Error: Backup path does not exist: $BackupPath" -ForegroundColor Red
    exit 1
}

Write-Host "Restoring $projectName project..." -ForegroundColor Cyan
Write-Host "  Backup: $BackupPath" -ForegroundColor Gray
Write-Host "  Destination: $Destination" -ForegroundColor Gray
Write-Host ""

# Read backup manifest
$manifestPath = Join-Path $BackupPath "backup-manifest.json"
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath | ConvertFrom-Json
    Write-Host "Backup Info:" -ForegroundColor Yellow
    Write-Host "  Timestamp: $($manifest.timestamp)" -ForegroundColor Gray
    Write-Host "  Project: $($manifest.project)" -ForegroundColor Gray
    Write-Host "  Includes Agents: $($manifest.includes_agents)" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠ Backup manifest not found" -ForegroundColor Yellow
}

# Warn if destination exists
if (Test-Path $Destination -and (Get-ChildItem $Destination -ErrorAction SilentlyContinue)) {
    if (-not $Force) {
        Write-Host "Error: Destination already exists: $Destination" -ForegroundColor Red
        Write-Host "Use -Force to overwrite" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "⚠ Overwriting existing destination (Force flag set)" -ForegroundColor Yellow
    }
}

# Create destination directory
if (-not (Test-Path $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

# Restore project code
Write-Host "Restoring project code..." -ForegroundColor Yellow
Get-ChildItem $BackupPath -Directory | Where-Object { 
    $_.Name -notin @("agents", "data") 
} | ForEach-Object {
    $dest = Join-Path $Destination $_.Name
    Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
    Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
}

# Restore files
Get-ChildItem $BackupPath -File | Where-Object {
    $_.Name -ne "backup-manifest.json"
} | ForEach-Object {
    $dest = Join-Path $Destination $_.Name
    Copy-Item -Path $_.FullName -Destination $dest -Force
    Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
}

# Restore agents (CRITICAL for continuity)
Write-Host ""
Write-Host "Restoring agents..." -ForegroundColor Yellow
$agentsBackup = Join-Path $BackupPath "agents"
if (Test-Path $agentsBackup) {
    $agentsDest = Join-Path $Destination "agents"
    Copy-Item -Path $agentsBackup -Destination $agentsDest -Recurse -Force
    Write-Host "  ✓ agents\ restored" -ForegroundColor Green
    Write-Host "    Agents restored with project - continuity preserved!" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠ agents\ not found in backup" -ForegroundColor Yellow
    Write-Host "    WARNING: Agents not backed up - continuity risk!" -ForegroundColor Red
}

# Restore data
Write-Host ""
Write-Host "Restoring data..." -ForegroundColor Yellow
$dataBackup = Join-Path $BackupPath "data"
if (Test-Path $dataBackup) {
    $dataDest = Join-Path $Destination "data"
    Copy-Item -Path $dataBackup -Destination $dataDest -Recurse -Force
    Write-Host "  ✓ data\ restored" -ForegroundColor Green
} else {
    Write-Host "  ⚠ data\ not found in backup (may be in /tmp)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Restore complete!" -ForegroundColor Green
Write-Host "  Project: $Destination" -ForegroundColor Cyan
Write-Host "  Agents: $(if (Test-Path (Join-Path $Destination 'agents')) { 'Restored' } else { 'Missing' })" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify project structure" -ForegroundColor Gray
Write-Host "  2. Check agents are present" -ForegroundColor Gray
Write-Host "  3. Restore database if needed" -ForegroundColor Gray
Write-Host "  4. Install dependencies (npm install / pip install)" -ForegroundColor Gray
Write-Host ""

