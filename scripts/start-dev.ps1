# Starts backend and frontend dev servers in separate PowerShell windows
$backend = Join-Path $PSScriptRoot "..\backend"
$frontend = Join-Path $PSScriptRoot "..\frontend"

Write-Host "Opening backend dev server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command","npm install; npm run dev" -WorkingDirectory $backend

Start-Sleep -Seconds 2

Write-Host "Opening frontend dev server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command","npm install; npm run dev" -WorkingDirectory $frontend

Write-Host "Both windows launched. Backend on http://localhost:4000, Frontend on http://localhost:3000" -ForegroundColor Cyan
