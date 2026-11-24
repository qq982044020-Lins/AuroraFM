@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Aurora FM 打包

echo ============================================
echo   Aurora FM 一键打包
echo ============================================
echo.

echo [1/5] 清理残留的打包进程...
taskkill /F /IM 7za.exe >nul 2>&1
taskkill /F /IM makensis.exe >nul 2>&1
echo       完成

echo [2/5] 清理上次的临时文件...
del /F /Q "release\aurora-fm-1.0.0-x64.nsis.7z" >nul 2>&1
del /F /Q "release\builder-debug.yml" >nul 2>&1
del /F /Q "release\*.blockmap" >nul 2>&1
echo       完成

echo [3/5] 打包前端源码 (src -^> dist/app.js)...
call npm run build
if errorlevel 1 goto :error

echo [4/5] 生成 绿色包 + 安装包（约 1-3 分钟，请耐心等待）...
call npx electron-builder --win
if errorlevel 1 goto :error

echo [5/5] 清理临时文件...
del /F /Q "release\aurora-fm-1.0.0-x64.nsis.7z" >nul 2>&1
del /F /Q "release\builder-debug.yml" >nul 2>&1
del /F /Q "release\*.blockmap" >nul 2>&1

echo.
echo ============================================
echo   打包完成！
echo ============================================
echo   绿色包: release\AuroraFM-Portable.exe
echo   安装包: release\AuroraFM-Setup-1.0.0.exe
echo.
echo   注意：如果当前有 Aurora FM 正在运行，
echo         请先关掉它，再打开新包测试，否则会锁住旧文件。
echo ============================================
echo.
pause
exit /b 0

:error
echo.
echo [错误] 打包失败，请看上方日志排查。
echo.
pause
exit /b 1
