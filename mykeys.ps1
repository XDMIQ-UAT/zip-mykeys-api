#!/usr/bin/env pwsh
<#
.SYNOPSIS
    MyKeys CLI Wrapper
.DESCRIPTION
    Wrapper script to run mykeys-cli.js as a command
.PARAMETER Command
    Command to execute (admin, generate-token, session-history, session-compare)
.PARAMETER Args
    Additional arguments for the command
#>

param(
    [Parameter(Position=0)]
    [string]$Command,
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$scriptPath = $PSScriptRoot
if (-not $scriptPath) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$cliPath = Join-Path $scriptPath "mykeys-cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "Error: mykeys-cli.js not found at $cliPath" -ForegroundColor Red
    exit 1
}

# Build command arguments
$nodeArgs = @($cliPath)
if ($Command) {
    $nodeArgs += $Command
}
if ($Args) {
    $nodeArgs += $Args
}

# Run Node.js CLI
& node $nodeArgs





