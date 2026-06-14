@echo off
cd /d "D:\AI Investing\MarketSignal"

echo [1/2] Running data scraper and updating cache...
python "src/app/api/market-data/get_kospi_fundamentals.py" --batch

echo.
echo [2/2] Pushing updated cache to GitHub...
git add src/app/api/market-data/krx_cache.json
git diff --cached --quiet
if errorlevel 1 (
    echo New cache data detected. Committing and pushing...
    git commit -m "Auto-update KRX cache data"
    git push origin main
) else (
    echo No new cache data to update. Skipping commit/push.
)

echo.
echo Process completed successfully!

:: Pause only if the batch file was run by double-clicking in Explorer (so the window doesn't close immediately)
echo %cmdcmdline% | find /i "cmd.exe /c" >nul
if %errorlevel% == 0 (
    echo.
    echo Press any key to close...
    pause >nul
)
