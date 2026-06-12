@echo off
REM Quick Start Script for Gym Management System

echo.
echo ======================================
echo Gym Management System - Quick Start
echo ======================================
echo.

REM Check if node is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Starting server...
echo Server will run on http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
node server.js
