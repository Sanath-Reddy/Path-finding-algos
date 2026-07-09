@echo off
title 🚑 EOC Command Center Launcher
echo ==========================================================
echo       Smart Ambulance Dispatch ^& Routing Command Center
echo                 Launching Full-Stack Operations
echo ==========================================================
echo.

:: 1. Check if backend folder compiles
echo [ EOC SYSTEM ] Verifying backend environment...
python -c "import sys; sys.path.append('backend'); import main; print('Backend verification passed!')"
if %errorlevel% neq 0 (
    echo [ ERROR ] Backend compilation failed. Please fix python import errors.
    pause
    exit /b %errorlevel%
)

:: 2. Launch FastAPI Server (Port 8000)
echo [ EOC SYSTEM ] Starting FastAPI WebSocket Server on port 8000...
start "FastAPI Server" cmd /k "python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000"

:: 3. Launch React Vite Dev Server (Port 5173)
echo [ EOC SYSTEM ] Starting Vite React Dev Server on port 5173...
start "Vite Dev Server" cmd /k "npm run dev --prefix frontend"

echo.
echo [ EOC SYSTEM ] Both servers are initializing in the background.
echo [ INFO ] Access the operations center UI at: http://localhost:5173
echo [ INFO ] WebSocket stream active on: ws://127.0.0.1:8000/ws
echo.
echo Press any key to shutdown the command prompts...
pause
