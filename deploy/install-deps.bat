@echo off
echo Установка зависимостей для скрипта миграции...

cd /d %~dp0
npm install

if %ERRORLEVEL% EQU 0 (
    echo Зависимости успешно установлены!
) else (
    echo Произошла ошибка при установке зависимостей.
)

pause 