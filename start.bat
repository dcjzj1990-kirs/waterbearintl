@echo off
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies. Please check your network and try again.
    pause
    exit /b 1
)

echo Starting WaterbearIntl Backend...
node server.js