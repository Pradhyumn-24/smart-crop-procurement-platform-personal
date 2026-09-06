@echo off
echo ================================================================
echo    अपनी BAARI (Apni Baari) - e-Procurement Token & Queue System
echo    Ministry of Agriculture & Farmers Welfare, Govt of India
echo ================================================================
echo.
echo Starting Apni Baari FastAPI Server at http://127.0.0.1:8000 ...
echo Press Ctrl+C to stop the server.
echo.
py -3 -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
pause
