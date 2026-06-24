@echo off
setlocal
title Split .adventure File

:: ── Pick the .adventure file ────────────────────────────────────────────────
if "%~1"=="" (
    echo Drag a .adventure file onto this batch file, or enter the path:
    set /p INFILE="Path: "
) else (
    set INFILE=%~1
)

if not exist "%INFILE%" (
    echo ERROR: File not found: %INFILE%
    pause & exit /b 1
)

:: ── Output folder next to the input file ────────────────────────────────────
set BASENAME=%~n1
if "%BASENAME%"=="" for %%F in ("%INFILE%") do set BASENAME=%%~nF
set OUTDIR=%~dp1%BASENAME%_split
if "%~dp1"=="" for %%F in ("%INFILE%") do set OUTDIR=%%~dpF%BASENAME%_split

node "%~dp0..\scripts\split-adventure.js" "%INFILE%" "%OUTDIR%"
if errorlevel 1 ( pause & exit /b 1 )

echo.
echo Output folder: %OUTDIR%
echo.
pause
endlocal
