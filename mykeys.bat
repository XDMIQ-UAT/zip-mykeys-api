@echo off
REM MyKeys CLI Wrapper for Windows CMD
setlocal

set SCRIPT_DIR=%~dp0
set CLI_PATH=%SCRIPT_DIR%mykeys-cli.js

if not exist "%CLI_PATH%" (
    echo Error: mykeys-cli.js not found at %CLI_PATH%
    exit /b 1
)

node "%CLI_PATH%" %*




