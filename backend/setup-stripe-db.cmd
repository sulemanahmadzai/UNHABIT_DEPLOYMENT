@echo off
echo ========================================
echo Stripe Database Setup
echo ========================================
echo.

echo Step 1: Regenerating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Prisma generate failed!
    pause
    exit /b 1
)
echo ✓ Prisma client regenerated
echo.

echo Step 2: Database Migration
echo.
echo IMPORTANT: You need to run the SQL migration manually!
echo.
echo 1. Go to: https://supabase.com/dashboard/project/kgvrycgrzhfqhklvjxso/editor
echo 2. Copy the contents of: prisma/migrations/add_stripe_tables.sql
echo 3. Paste and run in the SQL Editor
echo.
echo Press any key once you've completed the migration...
pause >nul

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Now you can run: npm run test:stripe
echo.
pause
