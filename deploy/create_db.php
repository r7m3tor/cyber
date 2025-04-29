<?php
// Включаем отображение ошибок для отладки
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Проверяем наличие файла .env
if (!file_exists('../.env')) {
    die('Файл .env не найден. Убедитесь, что он находится в корневой директории проекта.');
}

// Загрузка переменных окружения
$env = parse_ini_file('../.env');

// Проверяем наличие всех необходимых переменных
$required_vars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
foreach ($required_vars as $var) {
    if (!isset($env[$var])) {
        die("Переменная $var не найдена в файле .env");
    }
}

// Параметры подключения к MySQL
$host = $env['DB_HOST'];
$port = $env['DB_PORT'];
$user = $env['DB_USER'];
$password = $env['DB_PASSWORD'];
$dbname = $env['DB_NAME'];

try {
    // Подключение к MySQL без выбора базы данных
    $pdo = new PDO("mysql:host=$host;port=$port", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Проверяем, существует ли база данных
    $result = $pdo->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$dbname'");
    $dbExists = $result->fetch();
    
    if (!$dbExists) {
        // Создание базы данных
        $pdo->exec("CREATE DATABASE `$dbname`");
        echo "База данных успешно создана<br>";
    } else {
        echo "База данных уже существует<br>";
    }
    
    // Выбор базы данных
    $pdo->exec("USE `$dbname`");
    
    // Создание таблицы пользователей
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0.00,
        is_admin BOOLEAN DEFAULT FALSE,
        last_login DATETIME,
        computer_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    echo "Таблица users создана<br>";
    
    // Создание таблицы компьютеров
    $pdo->exec("CREATE TABLE IF NOT EXISTS computers (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        number INTEGER NOT NULL UNIQUE,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        is_occupied BOOLEAN DEFAULT FALSE,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");
    echo "Таблица computers создана<br>";
    
    // Создание таблицы сообщений
    $pdo->exec("CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");
    echo "Таблица messages создана<br>";
    
    // Создание таблицы истории баланса
    $pdo->exec("CREATE TABLE IF NOT EXISTS balance_history (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");
    echo "Таблица balance_history создана<br>";
    
    echo "<br>Все таблицы успешно созданы!";
    
} catch(PDOException $e) {
    echo "Ошибка: " . $e->getMessage();
}
?> 