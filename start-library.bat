@echo off
REM Double-click this to open Ponyo's Little Library.
REM It starts a small local web server and opens your browser.
REM Close this window when you are done reading.

title Ponyo's Little Library
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
