@echo off
setlocal
cd /d "%~dp0"

set "NODE="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe" (
  set "NODE=%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe"
)

if not defined NODE (
  echo Node.js not found in PATH or usual install locations.
  echo Install LTS from https://nodejs.org/ then run: node server/server.js
  exit /b 1
)

echo Using: %NODE%
"%NODE%" server/server.js
exit /b %ERRORLEVEL%
