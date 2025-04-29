const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Налаштування middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Налаштування сесій
app.use(session({
    secret: 'cyberclub-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Створення бази даних
const db = new sqlite3.Database('cyberclub.db', (err) => {
    if (err) {
        console.error('Помилка при підключенні до бази даних:', err);
    } else {
        console.log('Підключено до бази даних SQLite');
        // Створюємо таблицю новин
        db.run(`CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_important BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Змінюємо структуру таблиці users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            phone TEXT UNIQUE,
            password TEXT,
            is_admin INTEGER DEFAULT 0,
            balance DECIMAL(10,2) DEFAULT 0.00,
            last_login DATETIME,
            computer_id INTEGER REFERENCES computers(id)
        )`);

        // Створення таблиці повідомлень
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            is_admin INTEGER DEFAULT 0,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Перевіряємо наявність таблиці balance_history
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='balance_history'", (err, tables) => {
            if (err) {
                console.error('Помилка при перевірці таблиці balance_history:', err);
                return;
            }
            
            if (tables.length === 0) {
                console.log('Таблиця balance_history не існує, створюємо...');
                db.run(`CREATE TABLE IF NOT EXISTS balance_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    amount DECIMAL(10,2),
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )`, (err) => {
                    if (err) {
                        console.error('Помилка при створенні таблиці balance_history:', err);
                    } else {
                        console.log('Таблиця balance_history успішно створена');
                    }
                });
            } else {
                console.log('Таблиця balance_history існує');
            }
        });

        // Перевіряємо наявність поля is_read в таблиці messages
        db.all("PRAGMA table_info(messages)", (err, rows) => {
            if (err) {
                console.error('Помилка при перевірці структури таблиці messages:', err);
                return;
            }
            
            // Перевіряємо, чи є поле is_read
            const hasIsReadField = rows.some(row => row.name === 'is_read');
            
            if (!hasIsReadField) {
                console.log('Додаємо поле is_read до таблиці messages');
                db.run('ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0', (err) => {
                    if (err) {
                        console.error('Помилка при додаванні поля is_read:', err);
                    } else {
                        console.log('Поле is_read успішно додано до таблиці messages');
                    }
                });
            }
        });

        // Створюємо таблицю комп'ютерів при запуску сервера
        db.run(`CREATE TABLE IF NOT EXISTS computers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER NOT NULL UNIQUE,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            is_occupied BOOLEAN DEFAULT 0,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Перевіряємо наявність колонки computer_id в таблиці users
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                console.error('Помилка при перевірці структури таблиці users:', err);
                return;
            }
            
            // Перевіряємо, чи є колонка computer_id
            const hasComputerIdColumn = columns.some(col => col.name === 'computer_id');
            
            if (!hasComputerIdColumn) {
                console.log('Додаємо колонку computer_id до таблиці users');
                db.run(`ALTER TABLE users ADD COLUMN computer_id INTEGER REFERENCES computers(id)`, (err) => {
                    if (err) {
                        console.error('Помилка при додаванні колонки computer_id:', err);
                    } else {
                        console.log('Колонку computer_id успішно додано до таблиці users');
                    }
                });
            }
        });

        // Створюємо таблицю для змін
        db.run(`CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            total_deposits DECIMAL(10,2) DEFAULT 0,
            total_spending DECIMAL(10,2) DEFAULT 0,
            computers_used INTEGER DEFAULT 0
        )`);

        // Створюємо таблицю тарифів
        db.run(`CREATE TABLE IF NOT EXISTS tariffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            hours INTEGER NOT NULL,
            discount INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Створюємо таблицю активних таймерів
        db.run(`CREATE TABLE IF NOT EXISTS active_timers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            minutes_left INTEGER NOT NULL,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Додаємо базові тарифи, якщо їх немає
        db.get("SELECT COUNT(*) as count FROM tariffs", (err, row) => {
            if (err) {
                console.error('Помилка при перевірці тарифів:', err);
                return;
            }
            
            if (row.count === 0) {
                db.run(`INSERT INTO tariffs (name, hours, discount) VALUES 
                    ('3 години', 3, 20),
                    ('5 годин', 5, 25)`);
            }
        });
    }
});

// Middleware для перевірки авторизації
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Middleware для перевірки прав адміністратора
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(403).send('Доступ заборонено');
    }
};

// Функція для списання грошей за час онлайн
const chargeForOnlineTime = (userId, callback) => {
    // Спочатку перевіряємо, чи є активний таймер
    db.get('SELECT * FROM active_timers WHERE user_id = ?', [userId], (err, timer) => {
        if (err) {
            return callback(err);
        }

        if (timer) {
            // Якщо є активний таймер, зменшуємо час, що залишився
            const now = new Date();
            const started = new Date(timer.started_at);
            const minutesPassed = Math.floor((now - started) / (1000 * 60));
            const newMinutesLeft = timer.minutes_left - minutesPassed;

            if (newMinutesLeft <= 0) {
                // Таймер закінчився, видаляємо його
                db.run('DELETE FROM active_timers WHERE id = ?', [timer.id], (err) => {
                    if (err) {
                        return callback(err);
                    }
                    // Оновлюємо час останнього входу
                    db.run('UPDATE users SET last_login = ? WHERE id = ?',
                        [now.toISOString(), userId],
                        (err) => callback(err, 0));
                });
            } else {
                // Оновлюємо час, що залишився, та час останнього входу
                db.run('UPDATE active_timers SET minutes_left = ?, started_at = ? WHERE id = ?',
                    [newMinutesLeft, now.toISOString(), timer.id],
                    (err) => {
                        if (err) {
                            return callback(err);
                        }
                        db.run('UPDATE users SET last_login = ? WHERE id = ?',
                            [now.toISOString(), userId],
                            (err) => callback(err, 0));
                    });
            }
        } else {
            // Якщо немає активного таймера, списуємо гроші похвилинно
            db.get('SELECT balance, last_login FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    return callback(err);
                }

                if (!user) {
                    return callback(new Error('Користувача не знайдено'));
                }

                const now = new Date();
                const lastLogin = user.last_login ? new Date(user.last_login) : now;
                const minutesOnline = Math.floor((now - lastLogin) / (1000 * 60));
                
                // 1 гривня за хвилину
                const chargeAmount = minutesOnline * 1;
                
                if (chargeAmount > 0 && user.balance >= chargeAmount) {
                    const newBalance = user.balance - chargeAmount;
                    
                    // Оновлюємо баланс та час останнього входу
                    db.run('UPDATE users SET balance = ?, last_login = ? WHERE id = ?',
                        [newBalance, now.toISOString(), userId],
                        (err) => {
                            if (err) {
                                return callback(err);
                            }
                            
                            // Додаємо запис в історію балансу
                            db.run('INSERT INTO balance_history (user_id, amount, description) VALUES (?, ?, ?)',
                                [userId, -chargeAmount, 'Списання за час онлайн'],
                                (err) => callback(err, chargeAmount));
                        });
                } else {
                    callback(null, 0);
                }
            });
        }
    });
};

// Головна сторінка
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
        return;
    }

    // Отримуємо останні новини
    db.all('SELECT * FROM news ORDER BY created_at DESC LIMIT 10', (err, news) => {
        if (err) {
            console.error('Помилка при отриманні новин:', err);
            news = [];
        }
        res.render('index', { news });
    });
});

// Реєстрація користувача
app.post('/register', async (req, res) => {
    const { username, phone, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Паролі не співпадають');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run('INSERT INTO users (username, phone, password) VALUES (?, ?, ?)',
            [username, phone, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).send('Користувач з таким ім\'ям або телефоном вже існує');
                    }
                    console.error('Помилка при реєстрації:', err);
                    return res.status(500).send('Помилка сервера');
                }

                req.session.userId = this.lastID;
                req.session.isAdmin = false;
                res.redirect('/dashboard');
            });
    } catch (err) {
        console.error('Помилка при хешуванні пароля:', err);
        res.status(500).send('Помилка сервера');
    }
});

// Вхід користувача
app.post('/login', async (req, res) => {
    const { phone, password, adminLogin } = req.body;

    db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
        if (err) {
            console.error('Помилка при вході:', err);
            return res.status(500).send('Помилка сервера');
        }

        if (!user) {
            return res.status(400).send('Користувача не знайдено');
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            
            if (!match) {
                return res.status(400).send('Невірний пароль');
            }

            if (adminLogin && !user.is_admin) {
                return res.status(403).send('Доступ заборонено');
            }

            req.session.userId = user.id;
            req.session.isAdmin = user.is_admin === 1;
            
            // Оновлюємо час останнього входу
            db.run('UPDATE users SET last_login = ? WHERE id = ?',
                [new Date().toISOString(), user.id]);

            res.redirect('/dashboard');
        } catch (err) {
            console.error('Помилка при порівнянні паролів:', err);
            res.status(500).send('Помилка сервера');
        }
    });
});

// Вихід
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Зміна пароля
app.get('/change-password', requireAuth, (req, res) => {
    res.render('change-password');
});

app.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.render('change-password', { 
            error: 'Нові паролі не співпадають' 
        });
    }

    try {
        // Отримуємо поточного користувача
        db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
            if (err) {
                console.error('Помилка при отриманні користувача:', err);
                return res.render('change-password', { 
                    error: 'Помилка сервера' 
                });
            }

            // Перевіряємо поточний пароль
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                return res.render('change-password', { 
                    error: 'Невірний поточний пароль' 
                });
            }

            // Хешуємо та зберігаємо новий пароль
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, req.session.userId],
                (err) => {
                    if (err) {
                        console.error('Помилка при оновленні пароля:', err);
                        return res.render('change-password', { 
                            error: 'Помилка при оновленні пароля' 
                        });
                    }

                    res.render('change-password', { 
                        success: 'Пароль успішно змінено' 
                    });
                });
        });
    } catch (err) {
        console.error('Помилка при зміні пароля:', err);
        res.render('change-password', { 
            error: 'Помилка сервера' 
        });
    }
});

app.get('/dashboard', requireAuth, (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/user-dashboard');
    } else {
        db.all('SELECT id, username, phone, is_admin, balance, last_login FROM users', (err, users) => {
            if (err) {
                console.error('Помилка при отриманні користувачів:', err);
                return res.status(500).send('Помилка сервера');
            }
            
            // Получаем баланс текущего пользователя
            db.get('SELECT balance FROM users WHERE id = ?', [req.session.userId], (err, user) => {
                if (err) {
                    console.error('Помилка при отриманні балансу:', err);
                    return res.status(500).send('Помилка сервера');
                }
                
                res.render('dashboard', { 
                    users, 
                    isAdmin: req.session.isAdmin,
                    balance: user ? user.balance : 0
                });
            });
        });
    }
});

// Добавляем маршрут для админ-панели
app.get('/admin', requireAuth, async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send('Доступ запрещен');
    }

    try {
        // Получаем всех пользователей
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Получаем все компьютеры
        const computers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM computers', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Получаем текущую смену
        const currentShift = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM shifts WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Получаем баланс текущего пользователя
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT balance FROM users WHERE id = ?', [req.session.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.render('dashboard', {
            users,
            computers,
            currentShift,
            isAdmin: true,
            balance: user ? user.balance : 0
        });
    } catch (error) {
        console.error('Error in /admin route:', error);
        res.status(500).send('Ошибка сервера');
    }
});

app.post('/update-balance', requireAdmin, (req, res) => {
    const { userId, amount } = req.body;
    
    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).send('Помилка сервера');
        }
        
        const newBalance = parseFloat(user.balance) + parseFloat(amount);
        if (newBalance < 0) {
            return res.status(400).send('Недостатньо коштів');
        }
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (err) => {
            if (err) {
                return res.status(500).send('Помилка при оновленні балансу');
            }
            
            // Додаємо запис в історію балансу
            const description = amount > 0 ? 'Поповнення балансу' : 'Списання коштів';
            db.run('INSERT INTO balance_history (user_id, amount, description) VALUES (?, ?, ?)',
                [userId, amount, description],
                (err) => {
                    if (err) {
                        console.error('Помилка при додаванні запису в історію:', err);
                    }
                    res.redirect('/dashboard');
                });
        });
    });
});

// Добавляем маршрут для отправки сообщений
app.post('/send-message', requireAuth, (req, res) => {
    const { message } = req.body;
    const userId = req.session.userId;
    
    if (!message || message.trim() === '') {
        return res.redirect('/user-dashboard');
    }
    
    db.run('INSERT INTO messages (user_id, text, is_admin, is_read) VALUES (?, ?, ?, ?)',
        [userId, message.trim(), 0, 0],
        (err) => {
            if (err) {
                console.error('Error sending message:', err);
                return res.status(500).send('Помилка сервера');
            }
            res.redirect('/user-dashboard');
        });
});

// Добавляем маршрут для ответа администратора
app.post('/admin/reply', requireAdmin, (req, res) => {
    const { userId, message } = req.body;
    
    if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    
    if (!userId) {
        return res.status(400).json({ error: 'Не указан ID пользователя' });
    }
    
    console.log(`Попытка отправить ответ администратора пользователю ${userId}: ${message}`);
    
    // Проверяем существование пользователя
    db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Ошибка при проверке пользователя:', err);
            return res.status(500).json({ error: 'Ошибка сервера при отправке ответа' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Отправляем сообщение
        db.run(
            'INSERT INTO messages (user_id, text, is_admin, is_read) VALUES (?, ?, 1, 1)',
            [userId, message.trim()],
            function(err) {
                if (err) {
                    console.error('Ошибка при отправке ответа администратора:', err);
                    return res.status(500).json({ error: 'Ошибка сервера при отправке ответа' });
                }
                console.log(`Ответ администратора успешно отправлен, ID: ${this.lastID}`);
                res.json({ success: true, messageId: this.lastID });
            }
        );
    });
});

// Добавляем маршрут для получения сообщений пользователя
app.get('/admin/messages/:userId', requireAdmin, (req, res) => {
    const userId = req.params.userId;
    
    db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC', [userId], (err, messages) => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        res.json(messages);
    });
});

// Добавляем маршрут для отметки сообщений как прочитанных
app.post('/admin/mark-read', requireAdmin, (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).send('Не указан ID пользователя');
    }
    
    db.run('UPDATE messages SET is_read = 1 WHERE user_id = ? AND is_admin = 0', [userId], (err) => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        res.json({ success: true });
    });
});

// Добавляем маршрут для получения количества непрочитанных сообщений
app.get('/admin/unread-count', requireAdmin, (req, res) => {
    db.all('SELECT user_id, COUNT(*) as count FROM messages WHERE is_admin = 0 AND is_read = 0 GROUP BY user_id', (err, results) => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        res.json(results);
    });
});

// Добавляем маршрут для пополнения баланса пользователя
app.post('/admin/add-funds', requireAdmin, (req, res) => {
    const { userId, amount } = req.body;
    
    if (!userId || !amount || isNaN(amount) || amount <= 0) {
        return res.status(400).send('Неверные параметры');
    }
    
    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        
        const newBalance = parseFloat(user.balance) + parseFloat(amount);
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (err) => {
            if (err) {
                return res.status(500).send('Ошибка при обновлении баланса');
            }
            
            // Добавляем запись в историю баланса
            db.run('INSERT INTO balance_history (user_id, amount, description) VALUES (?, ?, ?)',
                [userId, amount, 'Пополнение баланса администратором'],
                (err) => {
                    if (err) {
                        console.error('Ошибка при добавлении записи в историю:', err);
                    }
                    res.redirect('/dashboard');
                });
        });
    });
});

// Маршрут для пользовательской панели
app.get('/user-dashboard', requireAuth, (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/dashboard');
    }
    
    // Получаем информацию о пользователе
    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Помилка сервера');
        }
        
        if (!user) {
            req.session.destroy();
            return res.redirect('/login');
        }
        
        // Получаем сообщения чата
        db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', 
            [req.session.userId], 
            (err, messages) => {
                if (err) {
                    console.error('Error fetching messages:', err);
                    return res.status(500).send('Помилка сервера');
                }
                
                res.render('user-dashboard', { 
                    user: user,
                    messages: messages.reverse(),
                    chargeAmount: 0
                });
            });
    });
});

// Маршрут для получения сообщений через AJAX
app.get('/user-messages', requireAuth, (req, res) => {
    db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [req.session.userId],
        (err, messages) => {
            if (err) {
                console.error('Error fetching messages:', err);
                return res.status(500).json({ error: 'Помилка сервера' });
            }
            res.json(messages.reverse());
        });
});

// Добавляем маршрут для получения истории баланса
app.get('/admin/balance-history/:userId', requireAdmin, (req, res) => {
    const userId = req.params.userId;
    
    db.all('SELECT * FROM balance_history WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, history) => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        res.json(history);
    });
});

app.get('/user/balance-history', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    console.log('Запит історії балансу для користувача:', userId);
    
    // Перевіряємо існування таблиці
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='balance_history'", (err, tables) => {
        if (err) {
            console.error('Помилка при перевірці таблиці balance_history:', err);
            return res.status(500).send('Помилка сервера');
        }
        
        if (tables.length === 0) {
            console.error('Таблиця balance_history не існує');
            return res.status(500).send('Помилка сервера');
        }
        
        // Отримуємо історію балансу
        db.all('SELECT * FROM balance_history WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, history) => {
            if (err) {
                console.error('Помилка при отриманні історії балансу:', err);
                return res.status(500).send('Помилка сервера');
            }
            console.log('Отримано записів:', history ? history.length : 0);
            res.json(history);
        });
    });
});

app.post('/subscribe', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const { months } = req.body;
    const subscriptionCost = 100; // Вартість підписки за місяць
    
    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).send('Помилка сервера');
        }
        
        const totalCost = subscriptionCost * months;
        const newBalance = parseFloat(user.balance) - totalCost;
        
        if (newBalance < 0) {
            return res.status(400).send('Недостатньо коштів');
        }
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (err) => {
            if (err) {
                return res.status(500).send('Помилка при оновленні балансу');
            }
            
            // Додаємо запис в історію балансу
            db.run('INSERT INTO balance_history (user_id, amount, description) VALUES (?, ?, ?)',
                [userId, -totalCost, `Списання за підписку на ${months} ${months === 1 ? 'місяць' : 'місяці'}`],
                (err) => {
                    if (err) {
                        console.error('Помилка при додаванні запису в історію:', err);
                    }
                    res.redirect('/user-dashboard');
                });
        });
    });
});

// Маршрут для получения списка компьютеров
app.get('/admin/computers', requireAdmin, (req, res) => {
    db.all('SELECT * FROM computers ORDER BY number', (err, computers) => {
        if (err) {
            return res.status(500).json({ error: 'Помилка сервера' });
        }
        res.json(computers);
    });
});

// Маршрут для добавления нового компьютера
app.post('/admin/computers', requireAdmin, (req, res) => {
    const { number, x, y } = req.body;
    
    if (!number || !x || !y) {
        return res.status(400).json({ error: 'Всі поля обов\'язкові' });
    }
    
    db.run('INSERT INTO computers (number, x, y) VALUES (?, ?, ?)',
        [number, x, y],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Комп\'ютер з таким номером вже існує' });
                }
                return res.status(500).json({ error: 'Помилка сервера' });
            }
            res.json({ success: true, id: this.lastID });
        });
});

// Маршрут для обновления компьютера
app.put('/admin/computers/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { number, x, y } = req.body;
    
    if (!number || !x || !y) {
        return res.status(400).json({ error: 'Всі поля обов\'язкові' });
    }
    
    db.run('UPDATE computers SET number = ?, x = ?, y = ? WHERE id = ?',
        [number, x, y, id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Комп\'ютер з таким номером вже існує' });
                }
                return res.status(500).json({ error: 'Помилка сервера' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Комп\'ютер не знайдено' });
            }
            res.json({ success: true });
        });
});

// Маршрут для удаления компьютера
app.delete('/admin/computers/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM computers WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Помилка сервера' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Комп\'ютер не знайдено' });
        }
        res.json({ success: true });
    });
});

// Маршруты для управления сменами
app.get('/admin/current-shift', requireAdmin, (req, res) => {
    db.get('SELECT * FROM shifts WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1', (err, shift) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json({ shift });
    });
});

app.post('/admin/shift/start', requireAdmin, (req, res) => {
    db.run('INSERT INTO shifts (start_time) VALUES (datetime("now"))', function(err) {
        if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json({ success: true, shiftId: this.lastID });
    });
});

app.post('/admin/shift/end', requireAdmin, (req, res) => {
    db.run('UPDATE shifts SET end_time = datetime("now") WHERE end_time IS NULL', (err) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json({ success: true });
    });
});

app.get('/admin/stats', requireAdmin, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    db.get(`
        SELECT 
            COUNT(DISTINCT user_id) as onlineUsers,
            COALESCE(SUM(amount), 0) as todayIncome,
            COALESCE(AVG(amount), 0) as averageCheck
        FROM balance_history 
        WHERE date(created_at) = ? AND type = 'deposit'
    `, [today], (err, stats) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json(stats);
    });
});

app.get('/admin/shift/:id/report', requireAdmin, (req, res) => {
    const shiftId = req.params.id;
    
    db.get('SELECT * FROM shifts WHERE id = ?', [shiftId], (err, shift) => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        
        if (!shift) {
            return res.status(404).send('Смена не найдена');
        }
        
        // Получаем статистику по смене
        db.get(`
            SELECT 
                COUNT(DISTINCT user_id) as computersUsed,
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as totalDeposits,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as totalSpending
            FROM balance_history 
            WHERE created_at BETWEEN ? AND COALESCE(?, datetime('now'))
        `, [shift.start_time, shift.end_time], (err, stats) => {
            if (err) {
                return res.status(500).send('Ошибка сервера');
            }
            
            const netIncome = stats.totalDeposits - stats.totalSpending;
            
            res.render('shift-report', {
                shift,
                stats,
                netIncome
            });
        });
    });
});

// Маршрут для получения доступных тарифов
app.get('/tariffs', requireAuth, (req, res) => {
    db.all('SELECT * FROM tariffs', (err, tariffs) => {
        if (err) {
            return res.status(500).send('Помилка сервера');
        }
        res.json(tariffs);
    });
});

// Маршрут для покупки тарифа
app.post('/buy-tariff', requireAuth, (req, res) => {
    const { tariffId } = req.body;
    const userId = req.session.userId;

    // Определяем параметры тарифа
    let hours, discount;
    if (tariffId === '1') {
        hours = 3;
        discount = 20;
    } else if (tariffId === '2') {
        hours = 5;
        discount = 25;
    } else {
        return res.status(400).send('Невірний тариф');
    }

    // Рассчитываем стоимость с учетом скидки
    const pricePerHour = 60; // 60 грн в час
    const totalPrice = (hours * pricePerHour) * (1 - discount / 100);

    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).send('Помилка сервера');
        }

        if (user.balance < totalPrice) {
            return res.status(400).send('Недостатньо коштів');
        }

        // Списываем деньги и создаем таймер
        db.run('BEGIN TRANSACTION');

        db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [totalPrice, userId], (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).send('Помилка при списанні коштів');
            }

            // Добавляем запись в историю баланса
            db.run('INSERT INTO balance_history (user_id, amount, description) VALUES (?, ?, ?)',
                [userId, -totalPrice, `Купівля пакету на ${hours} ${hours === 1 ? 'годину' : 'години'}`],
                (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).send('Помилка при збереженні історії');
                    }

                    // Создаем или обновляем таймер
                    const minutes = hours * 60;
                    db.run('INSERT OR REPLACE INTO active_timers (user_id, minutes_left) VALUES (?, ?)',
                        [userId, minutes],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).send('Помилка при створенні таймера');
                            }

                            db.run('COMMIT');
                            res.redirect('/user-dashboard');
                        });
                });
        });
    });
});

// Маршрут для проверки активного таймера
app.get('/active-timer', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    db.get('SELECT * FROM active_timers WHERE user_id = ?', [userId], (err, timer) => {
        if (err) {
            return res.status(500).send('Помилка сервера');
        }
        
        if (timer) {
            // Вычисляем оставшееся время
            const now = new Date();
            const started = new Date(timer.started_at);
            const minutesPassed = Math.floor((now - started) / (1000 * 60));
            const minutesLeft = Math.max(0, timer.minutes_left - minutesPassed);
            
            res.json({
                timer: {
                    minutes_left: minutesLeft,
                    started_at: timer.started_at
                }
            });
        } else {
            res.json({ timer: null });
        }
    });
});

// Маршруты для управления новостями (только для админов)
app.get('/admin/news', requireAdmin, (req, res) => {
    db.all('SELECT * FROM news ORDER BY created_at DESC', (err, news) => {
        if (err) {
            return res.status(500).send('Помилка сервера');
        }
        res.render('admin/news', { news });
    });
});

app.post('/admin/news', requireAdmin, (req, res) => {
    const { title, content, is_important } = req.body;
    
    if (!title || !content) {
        return res.status(400).send('Всі поля обов\'язкові');
    }
    
    db.run('INSERT INTO news (title, content, is_important) VALUES (?, ?, ?)',
        [title, content, is_important ? 1 : 0],
        (err) => {
            if (err) {
                return res.status(500).send('Помилка при створенні новини');
            }
            res.redirect('/admin/news');
        });
});

app.delete('/admin/news/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM news WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Помилка при видаленні новини' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Новину не знайдено' });
        }
        res.json({ success: true });
    });
});

// Маршрут для получения оставшегося времени таймера
app.get('/get-timer', requireAuth, (req, res) => {
    const userId = req.session.userId;

    db.get('SELECT minutes_left FROM active_timers WHERE user_id = ?', [userId], (err, timer) => {
        if (err) {
            return res.status(500).json({ error: 'Помилка сервера' });
        }

        res.json({
            minutesLeft: timer ? timer.minutes_left : 0
        });
    });
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
