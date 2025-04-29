@echo off
echo Запуск локальной версии приложения...

echo.
echo Шаг 1: Освобождение порта 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    echo Завершение процесса %%a...
    taskkill /F /PID %%a
)

echo.
echo Шаг 2: Удаление старых зависимостей...
rmdir /s /q node_modules
del package-lock.json

echo.
echo Шаг 3: Установка зависимостей...
call npm install

echo.
echo Шаг 4: Запуск приложения...
node index.js

echo.
echo Приложение запущено!
echo Для остановки нажмите Ctrl+C
pause 