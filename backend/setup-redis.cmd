@echo off
REM Redis Setup Script for Windows
REM This script helps you set up and test Redis

echo.
echo ========================================
echo   Redis Setup for UnHabit Backend
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo.
    echo Please install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is installed
echo.

REM Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found
    echo Please run this script from the backend directory
    pause
    exit /b 1
)

echo [OK] docker-compose.yml found
echo.

REM Check if .env exists
if not exist ".env" (
    echo [WARNING] .env file not found
    echo Please create .env file with:
    echo   REDIS_URL="redis://localhost:6379"
    echo   REDIS_ENABLED="true"
    echo.
    pause
)

echo Starting Redis container...
docker-compose up -d redis

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Redis
    pause
    exit /b 1
)

echo.
echo [OK] Redis container started
echo.

REM Wait for Redis to be ready
echo Waiting for Redis to be ready...
timeout /t 3 /nobreak >nul

REM Test Redis connection
echo Testing Redis connection...
docker exec -it unhabit-redis redis-cli ping >nul 2>&1

if %errorlevel% neq 0 (
    echo [ERROR] Redis is not responding
    echo Try: docker-compose logs redis
    pause
    exit /b 1
)

echo [OK] Redis is responding
echo.

REM Show Redis status
echo ========================================
echo   Redis Status
echo ========================================
docker ps | findstr redis
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Redis is running and ready to use.
echo.
echo Next steps:
echo   1. Start backend: npm run dev
echo   2. Test Redis: npm run test:redis
echo   3. Monitor cache: docker exec -it unhabit-redis redis-cli MONITOR
echo.
echo To stop Redis: docker-compose stop redis
echo.
pause
