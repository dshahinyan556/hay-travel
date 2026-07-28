@echo off
chcp 65001 >nul
title Hay Travel - launcher

set "ROOT=%~dp0"
set "FRONTEND=%ROOT%Hay Travel\Frontend"
set "BACKEND=%ROOT%Hay Travel\Backend\ATTours.ClientAPI\ATTours.ClientAPI.csproj"

echo ==========================================
echo   Hay Travel - starting servers
echo ==========================================
echo.

echo [1/2] Backend  -^> http://localhost:5254
start "Hay Travel BACKEND (5254)" cmd /k dotnet run --project "%BACKEND%" --urls http://localhost:5254

echo [2/2] Frontend -^> http://localhost:5173
start "Hay Travel FRONTEND (5173)" cmd /k cd /d "%FRONTEND%" ^&^& npm run dev

echo.
echo Waiting for frontend to boot...
timeout /t 8 /nobreak >nul
start "" http://localhost:5173

echo.
echo Done. Two console windows are running the servers.
echo Close those windows to stop the servers.
echo.
timeout /t 5 /nobreak >nul
