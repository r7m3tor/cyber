const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('cyberclub.db');

const username = '1111111111';
const password = 'admin123';
const hashedPassword = bcrypt.hashSync(password, 10);

// Сначала удалим старого администратора
db.run("DELETE FROM users WHERE is_admin = 1", function(err) {
    if (err) {
        console.error('Ошибка при удалении старого администратора:', err);
    }
    
    // Создаем нового администратора
    db.run("INSERT INTO users (username, password, is_admin, balance) VALUES (?, ?, 1, 0.00)",
        [username, hashedPassword],
        function(err) {
            if (err) {
                console.error('Ошибка при создании администратора:', err);
            } else {
                console.log('Администратор успешно создан');
                console.log('Логин:', username);
                console.log('Пароль:', password);
            }
            db.close();
        });
}); 