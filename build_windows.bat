@echo off
setlocal

echo === Building frontend ===
cd frontend
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd ..

echo === Setting up backend venv ===
cd backend
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -r requirements-desktop.txt
if errorlevel 1 goto :error

echo === Building RadIAtorViewer.exe with PyInstaller ===
pyinstaller --noconfirm desktop.spec
if errorlevel 1 goto :error
cd ..

echo.
echo Build OK: backend\dist\RadIAtorViewer\RadIAtorViewer.exe
pause
exit /b 0

:error
echo.
echo Build FAILED - see the error above.
pause
exit /b 1
