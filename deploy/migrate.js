require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function migrateData() {
    let sqliteDb;
    let mysqlConnection;

    try {
        // Подключаемся к SQLite
        sqliteDb = new sqlite3.Database('./cyber.db');

        // Подключаемся к MySQL
        mysqlConnection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Подключение к базам данных установлено');

        // Мигрируем пользователей
        const users = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const user of users) {
            await mysqlConnection.execute(
                'INSERT INTO users (id, username, password, balance, is_admin, last_login, computer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [user.id, user.username, user.password, user.balance, user.is_admin, user.last_login, user.computer_id]
            );
        }

        // Мигрируем компьютеры
        const computers = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM computers', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const computer of computers) {
            await mysqlConnection.execute(
                'INSERT INTO computers (id, number, x, y, is_occupied, user_id) VALUES (?, ?, ?, ?, ?, ?)',
                [computer.id, computer.number, computer.x, computer.y, computer.is_occupied, computer.user_id]
            );
        }

        // Мигрируем сообщения
        const messages = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM messages', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const message of messages) {
            await mysqlConnection.execute(
                'INSERT INTO messages (id, user_id, text, is_admin, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [message.id, message.user_id, message.text, message.is_admin, message.is_read, message.created_at]
            );
        }

        // Мигрируем историю баланса
        const balanceHistory = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM balance_history', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const record of balanceHistory) {
            await mysqlConnection.execute(
                'INSERT INTO balance_history (id, user_id, amount, description, created_at) VALUES (?, ?, ?, ?, ?)',
                [record.id, record.user_id, record.amount, record.description, record.created_at]
            );
        }

        console.log('Миграция успешно завершена');

    } catch (error) {
        console.error('Ошибка при миграции данных:', error);
    } finally {
        if (sqliteDb) {
            sqliteDb.close();
        }
        if (mysqlConnection) {
            await mysqlConnection.end();
        }
    }
}

migrateData(); 