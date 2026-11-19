@echo off
rem Abre el visualizador con un servidor local (hace falta Python). Sirve si el mapa de fondo no carga al abrir index.html con doble clic.
cd /d "%~dp0"
start "" /b python -m http.server 8000
timeout /t 2 >nul
start "" http://localhost:8000/index.html
echo Visualizador en http://localhost:8000  -  cerrar esta ventana para detenerlo.
pause >nul
