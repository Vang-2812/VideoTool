@echo off
title Build Storyboard to Video Tool
cd /d "%~dp0"

echo ======================================================
echo          Storyboard to Video Tool Builder
echo ======================================================
echo.

:: Check if node_modules exists, if not, run npm install
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        goto end
    )
    echo [SUCCESS] Dependencies installed successfully.
    echo.
)

echo [INFO] Packaging the application...
call npm run dist

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Packaging failed! Please review the error log above.
    goto end
)

echo.
echo [SUCCESS] Packaging complete!
echo Output executable files are located in the "release" folder.
echo.

:end
echo Press any key to exit...
pause >nul
