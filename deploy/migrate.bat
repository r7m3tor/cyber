@echo off
echo Запуск миграции данных из SQLite в MySQL...

node migrate.js

if %ERRORLEVEL% EQU 0 (
    echo Миграция успешно завершена!
) else (
    echo Произошла ошибка при миграции данных.
)

pause 