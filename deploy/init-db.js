require('dotenv').config();
const mysql = require('mysql2/promise');

async function initDatabase() {
    let connection;
    try {
        // Создаем подключение к MySQL
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });

        // Создаем базу данных, если она не существует
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        await connection.query(`USE ${process.env.DB_NAME}`);

        // Создаем таблицу пользователей
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                balance DECIMAL(10,2) DEFAULT 0.00,
                is_admin BOOLEAN DEFAULT FALSE,
                last_login DATETIME,
                computer_id INT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создаем таблицу компьютеров
        await connection.query(`
            CREATE TABLE IF NOT EXISTS computers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                number VARCHAR(50) NOT NULL UNIQUE,
                x INT NOT NULL,
                y INT NOT NULL,
                is_occupied BOOLEAN DEFAULT FALSE,
                user_id INT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Создаем таблицу сообщений
        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                text TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Создаем таблицу истории баланса
        await connection.query(`
            CREATE TABLE IF NOT EXISTS balance_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log('База данных успешно инициализирована');
    } catch (error) {
        console.error('Ошибка при инициализации базы данных:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initDatabase(); 