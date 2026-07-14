@echo off
title Storyboard to Video Tool
cd /d "%~dp0"

echo ======================================================
echo          Storyboard to Video Tool Launcher
echo ======================================================
echo.

:: Check if node_modules exists, if not, run npm install
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection or Node.js installation.
        goto end
    )
    echo [SUCCESS] Dependencies installed successfully.
    echo.
)

echo [INFO] Starting the application in development mode...
call npm run dev

:end
echo.
echo Press any key to exit...
pause >nul
