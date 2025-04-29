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
    // Проверяем наличие файла SQLite
    if (!file_exists('../cyber.db')) {
        die('Файл cyber.db не найден. Убедитесь, что он находится в корневой директории проекта.');
    }
    
    // Подключение к SQLite
    $sqlite = new SQLite3('../cyber.db');
    
    // Подключение к MySQL
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Подключение к базам данных установлено<br>";
    
    // Очищаем таблицы в MySQL перед миграцией
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("TRUNCATE TABLE balance_history");
    $pdo->exec("TRUNCATE TABLE messages");
    $pdo->exec("TRUNCATE TABLE computers");
    $pdo->exec("TRUNCATE TABLE users");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "Таблицы в MySQL очищены<br>";
    
    // Миграция пользователей
    $users = $sqlite->query('SELECT * FROM users');
    $userCount = 0;
    while ($user = $users->fetchArray(SQLITE3_ASSOC)) {
        $stmt = $pdo->prepare('INSERT INTO users (id, username, password, balance, is_admin, last_login, computer_id) 
                              VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $user['id'],
            $user['username'],
            $user['password'],
            $user['balance'],
            $user['is_admin'],
            $user['last_login'],
            $user['computer_id']
        ]);
        $userCount++;
    }
    echo "Перенесено пользователей: $userCount<br>";
    
    // Миграция компьютеров
    $computers = $sqlite->query('SELECT * FROM computers');
    $computerCount = 0;
    while ($computer = $computers->fetchArray(SQLITE3_ASSOC)) {
        $stmt = $pdo->prepare('INSERT INTO computers (id, number, x, y, is_occupied, user_id) 
                              VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $computer['id'],
            $computer['number'],
            $computer['x'],
            $computer['y'],
            $computer['is_occupied'],
            $computer['user_id']
        ]);
        $computerCount++;
    }
    echo "Перенесено компьютеров: $computerCount<br>";
    
    // Миграция сообщений
    $messages = $sqlite->query('SELECT * FROM messages');
    $messageCount = 0;
    while ($message = $messages->fetchArray(SQLITE3_ASSOC)) {
        $stmt = $pdo->prepare('INSERT INTO messages (id, user_id, text, is_admin, is_read, created_at) 
                              VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $message['id'],
            $message['user_id'],
            $message['text'],
            $message['is_admin'],
            $message['is_read'],
            $message['created_at']
        ]);
        $messageCount++;
    }
    echo "Перенесено сообщений: $messageCount<br>";
    
    // Миграция истории баланса
    $balanceHistory = $sqlite->query('SELECT * FROM balance_history');
    $balanceCount = 0;
    while ($record = $balanceHistory->fetchArray(SQLITE3_ASSOC)) {
        $stmt = $pdo->prepare('INSERT INTO balance_history (id, user_id, amount, description, created_at) 
                              VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            $record['id'],
            $record['user_id'],
            $record['amount'],
            $record['description'],
            $record['created_at']
        ]);
        $balanceCount++;
    }
    echo "Перенесено записей истории баланса: $balanceCount<br>";
    
    echo "<br>Миграция успешно завершена!";
    
} catch(Exception $e) {
    echo "Ошибка: " . $e->getMessage();
}
?> 