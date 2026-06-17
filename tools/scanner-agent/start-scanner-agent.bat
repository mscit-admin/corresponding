@echo off
chcp 65001 >nul
title GSDMS Scanner Agent

REM Self-elevate to Administrator (HttpListener needs it for the localhost port)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo طلب صلاحيات المسؤول...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0gsdms-scanner-agent.ps1"
pause
