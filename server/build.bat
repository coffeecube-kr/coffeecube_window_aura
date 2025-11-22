@echo off
echo Building Python server...

REM PyInstaller 설치 확인
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

REM 이전 빌드 삭제
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build

REM PyInstaller로 빌드
pyinstaller build-server.spec

if exist dist\serial-server.exe (
    echo.
    echo ✓ Build successful!
    echo ✓ Executable: dist\serial-server.exe
) else (
    echo.
    echo ✗ Build failed!
    exit /b 1
)
