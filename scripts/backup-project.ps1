#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Backup project including all agents

.DESCRIPTION
    Backs up the project including:
    - Project code
    - Project data
    - Project agents (if exists)
    - Configuration files
    
    Excludes:
    - node_modules
    - .git
    - Build artifacts
    - Logs
    - Temporary files

.PARAMETER Destination
    Backup destination path

.PARAMETER IncludeAgents
    Include agents in backup (default: true)

.EXAMPLE
    .\backup-project.ps1 -Destination "Z:\data\backup\project-name"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Destination,
    
    [switch]$IncludeAgents = $true
)

$ErrorActionPreference = "Stop"

# PROJECT-SPECIFIC: Set your project path here
$projectPath = Split-Path $PSScriptRoot -Parent
$projectName = Split-Path $projectPath -Leaf

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
# Create backup in project subfolder: Destination/project-name/project-name_timestamp
$projectBackupDir = Join-Path $Destination $projectName
$backupPath = Join-Path $projectBackupDir "$projectName`_$timestamp"

Write-Host "Backing up $projectName project..." -ForegroundColor Cyan
Write-Host "  Project: $projectPath" -ForegroundColor Gray
Write-Host "  Destination: $backupPath" -ForegroundColor Gray
Write-Host "  Include Agents: $IncludeAgents" -ForegroundColor Gray
Write-Host ""

# Create backup directory
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

# PROJECT-SPECIFIC: Customize what to backup
# Automatically discover all folders and files (except exclusions)
$excludeFolders = @("node_modules", ".git", "dist", "out", "build", "__pycache__", ".venv", "venv", "secrets", ".warp", ".claude-code")
$excludeFiles = @("*.tmp", "*.cache", "*.log", "*.lock")

# Get all folders to backup (except exclusions)
$foldersToBackup = Get-ChildItem -Path $projectPath -Directory -ErrorAction SilentlyContinue | 
    Where-Object { 
        $_.Name -notlike ".*" -and 
        $_.Name -notin $excludeFolders 
    } | Select-Object -ExpandProperty Name

# Get all files to backup (except exclusions)
$filesToBackup = Get-ChildItem -Path $projectPath -File -ErrorAction SilentlyContinue | 
    Where-Object { 
        $_.Name -notlike ".*" -and
        $_.Extension -notin @(".tmp", ".cache", ".log", ".lock")
    } | Select-Object -ExpandProperty Name

$codeItems = $foldersToBackup + $filesToBackup

# Backup project code
Write-Host "Backing up project code..." -ForegroundColor Yellow
Write-Host "  Found $($foldersToBackup.Count) folder(s) and $($filesToBackup.Count) file(s) to backup" -ForegroundColor Gray
Write-Host ""

foreach ($item in $codeItems) {
    $source = Join-Path $projectPath $item
    if (Test-Path $source) {
        $dest = Join-Path $backupPath $item
        $destParent = Split-Path $dest -Parent
        if (-not (Test-Path $destParent)) {
            New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        }
        Copy-Item -Path $source -Destination $dest -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ $item" -ForegroundColor Green
    }
}

# Backup agents (CRITICAL for continuity)
if ($IncludeAgents) {
    Write-Host ""
    Write-Host "Backing up agents..." -ForegroundColor Yellow
    $agentsPath = Join-Path $projectPath "agents"
    if (Test-Path $agentsPath) {
        $agentsDest = Join-Path $backupPath "agents"
        Copy-Item -Path $agentsPath -Destination $agentsDest -Recurse -Force
        Write-Host "  ✓ agents\" -ForegroundColor Green
        Write-Host "    This ensures agents restore with project!" -ForegroundColor Cyan
    } else {
        Write-Host "  ⚠ agents\ not found (no project-specific agents)" -ForegroundColor Yellow
    }
}

# Backup data (if exists)
Write-Host ""
Write-Host "Backing up data..." -ForegroundColor Yellow
$dataPath = Join-Path $projectPath "data"
if (Test-Path $dataPath) {
    $dataDest = Join-Path $backupPath "data"
    Copy-Item -Path $dataPath -Destination $dataDest -Recurse -Force
    Write-Host "  ✓ data\" -ForegroundColor Green
} else {
    Write-Host "  ⚠ data\ not found (may be in /tmp in production)" -ForegroundColor Yellow
}

# Create backup manifest
Write-Host ""
Write-Host "Creating backup manifest..." -ForegroundColor Yellow
$manifest = @{
    timestamp = $timestamp
    project = $projectName
    project_path = $projectPath
    backup_path = $backupPath
    includes_agents = $IncludeAgents
    items = @{
        code = $codeItems
        agents = if ($IncludeAgents -and (Test-Path (Join-Path $projectPath "agents"))) { "agents\" } else { $null }
        data = if (Test-Path $dataPath) { "data\" } else { $null }
    }
    excludes = @(
        "node_modules",
        ".git",
        "dist",
        "out",
        "build",
        "logs",
        "__pycache__",
        ".venv",
        "venv",
        "*.tmp",
        "*.cache"
    )
}

$manifestPath = Join-Path $backupPath "backup-manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath
Write-Host "  ✓ backup-manifest.json" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Backup complete!" -ForegroundColor Green
Write-Host "  Location: $backupPath" -ForegroundColor Cyan
Write-Host "  Agents included: $IncludeAgents" -ForegroundColor Cyan
Write-Host ""

