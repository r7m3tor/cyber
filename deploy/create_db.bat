@echo off
echo Создание базы данных MySQL...

mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% < create_mysql_db.sql

if %ERRORLEVEL% EQU 0 (
    echo База данных успешно создана!
) else (
    echo Произошла ошибка при создании базы данных.
)

pause 