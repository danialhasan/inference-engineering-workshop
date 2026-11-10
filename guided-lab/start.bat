@echo off
rem Serves this kit from 127.0.0.1 and opens the lab. Needs Python 3 or Node (either one).
rem Written for Windows 10/11 but NOT tested by the author. If it fails, open lab\index.html and use recorded data.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 tools\serve.py --open %* & goto :eof)
where python >nul 2>nul && (python tools\serve.py --open %* & goto :eof)
where node >nul 2>nul && (node tools\serve.mjs --open %* & goto :eof)
echo Neither Python nor Node was found, so the live path cannot start.
echo You can still take part: open lab\index.html in a browser and choose recorded data.
pause
