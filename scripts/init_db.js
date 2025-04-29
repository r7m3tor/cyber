const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('cyberclub.db');

// Создаем таблицу пользователей
const createTables = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Удаляем старые таблицы если они существуют
            db.run("DROP TABLE IF EXISTS users");
            db.run("DROP TABLE IF EXISTS messages");
            db.run("DROP TABLE IF EXISTS computers");
            db.run("DROP TABLE IF EXISTS balance_history");
            db.run("DROP TABLE IF EXISTS news");

            // Создаем таблицу пользователей
            db.run(`CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                phone TEXT UNIQUE,
                password TEXT,
                is_admin INTEGER DEFAULT 0,
                balance DECIMAL(10,2) DEFAULT 0.00,
                last_login DATETIME,
                computer_id INTEGER
            )`);

            // Создаем таблицу сообщений
            db.run(`CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                text TEXT,
                is_admin INTEGER DEFAULT 0,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // Создаем таблицу компьютеров
            db.run(`CREATE TABLE computers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number INTEGER NOT NULL UNIQUE,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                is_occupied BOOLEAN DEFAULT 0,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // Создаем таблицу истории баланса
            db.run(`CREATE TABLE balance_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                amount DECIMAL(10,2),
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // Создаем таблицу новостей
            db.run(`CREATE TABLE news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                is_important BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Создаем администратора
            const adminPhone = '1111111111';
            const adminPassword = 'admin123';
            const hashedPassword = bcrypt.hashSync(adminPassword, 10);

            db.run(`INSERT INTO users (username, phone, password, is_admin) VALUES (?, ?, ?, 1)`,
                [adminPhone, adminPhone, hashedPassword],
                (err) => {
                    if (err) {
                        console.error('Ошибка при создании администратора:', err);
                        reject(err);
                    } else {
                        console.log('База данных успешно создана');
                        console.log('Создан администратор:');
                        console.log('Телефон:', adminPhone);
                        console.log('Пароль:', adminPassword);
                        resolve();
                    }
                });
        });
    });
};

createTables()
    .then(() => {
        console.log('Все таблицы успешно созданы');
        db.close();
    })
    .catch((err) => {
        console.error('Ошибка при создании таблиц:', err);
        db.close();
    }); 