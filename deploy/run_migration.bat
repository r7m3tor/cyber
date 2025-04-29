@echo off
echo Запуск миграции данных из SQLite в MySQL...

echo.
echo Шаг 1: Создание базы данных и таблиц...
php create_db.php

echo.
echo Шаг 2: Миграция данных...
php migrate.php

echo.
echo Процесс миграции завершен!
pause 