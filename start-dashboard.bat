@echo off
title ML Trading Dashboard Server
cd /d "C:\Users\Stephen\OneDrive\Desktop\Cursor Projects\Machine Learning"

echo Stopping any existing server...
taskkill /F /IM python.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo Starting server... Chrome will open in 6 seconds.
echo Keep this window open while trading. Close it to stop the server.
echo.

:: Open Chrome after 6 seconds using PowerShell (runs silently in background)
powershell -WindowStyle Hidden -Command "Start-Sleep 6; Start-Process 'chrome' 'http://localhost:3000/live-trading.html'"

:: Run Flask server directly in this window
py live-server.py
