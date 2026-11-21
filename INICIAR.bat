@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias do Meu Financeiro...
  call npm install
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias. Confira sua conexao e tente novamente.
    pause
    exit /b 1
  )
)
call npm run dev
pause
