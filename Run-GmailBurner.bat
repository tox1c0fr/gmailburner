@echo off
title GmailBurner CLI
echo ============================================================
echo   GmailBurner CLI - v1.0.0
echo   Initializing environment...
echo ============================================================
cd /d "%~dp0"
if not exist "node_modules\" (
  echo Installing dependencies...
  call npm.cmd install
)
node index.js
pause
