@echo off
echo Starting Image Editor...

echo Starting backend server...
start /B cmd /c "cd backend && npm start"

timeout /t 3 /nobreak >nul

echo Starting frontend...
cd frontend
npm run dev

pause