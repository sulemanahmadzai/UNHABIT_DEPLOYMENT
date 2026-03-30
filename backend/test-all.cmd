@echo off
echo ========================================
echo UnHabit Backend Testing Suite
echo ========================================
echo.

echo Checking if backend is running...
curl -s http://localhost:3000/api/stripe/config >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Backend is not running!
    echo Please start the backend first:
    echo   npm run dev
    echo.
    pause
    exit /b 1
)

echo Backend is running!
echo.

echo ========================================
echo Test 1: Performance Test
echo ========================================
echo.
call npx tsx test-performance.ts
echo.

echo ========================================
echo Test 2: Stripe Integration Test
echo ========================================
echo.
call npx tsx test-stripe-integration.ts
echo.

echo ========================================
echo All Tests Complete!
echo ========================================
echo.
pause
