const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Настройка middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Настройка сессий
app.use(session({
    secret: 'cyberclub-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Создание подключения к MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cyberclub'
});

// Подключение к базе данных
db.connect((err) => {
    if (err) {
        console.error('Ошибка при подключении к базе данных:', err);
    } else {
        console.log('Подключено к базе данных MySQL');
    }
});

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Middleware для проверки прав администратора
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(403).send('Доступ запрещен');
    }
};

// Маршруты
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login', { error: req.query.error });
});

app.post('/login', async (req, res) => {
    const { username, password, computerNumber, adminLogin } = req.body;
    
    try {
        if (!username || !password) {
            return res.render('login', { error: 'Все поля обязательны' });
        }
        
        if (!adminLogin && !computerNumber) {
            return res.render('login', { error: 'Все поля обязательны' });
        }
        
        const [users] = await db.promise().query('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];
        
        if (!user) {
            return res.render('login', { error: 'Неверное ім\'я користувача або пароль' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.render('login', { error: 'Неверное ім\'я користувача або пароль' });
        }
        
        if (adminLogin) {
            req.session.userId = user.id;
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
        
        const [computers] = await db.promise().query('SELECT * FROM computers WHERE number = ?', [computerNumber]);
        const computer = computers[0];
        
        if (!computer) {
            return res.render('login', { error: 'Комп\'ютер з таким номером не знайдений' });
        }
        
        if (computer.is_occupied && computer.user_id !== user.id) {
            return res.render('login', { error: 'Цей комп\'ютер вже зайнятий' });
        }
        
        await db.promise().query('UPDATE computers SET is_occupied = 0, user_id = NULL WHERE user_id = ?', [user.id]);
        await db.promise().query('UPDATE computers SET is_occupied = 1, user_id = ? WHERE id = ?', [user.id, computer.id]);
        await db.promise().query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        req.session.userId = user.id;
        req.session.isAdmin = false;
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Помилка при вході в систему' });
    }
});

app.get('/logout', (req, res) => {
    if (req.session.userId) {
        db.query('UPDATE computers SET is_occupied = 0, user_id = NULL WHERE user_id = ?', [req.session.userId]);
    }
    req.session.destroy();
    res.redirect('/login');
});

app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const [users] = await db.promise().query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        const user = users[0];
        
        const [messages] = await db.promise().query(
            'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.session.userId]
        );
        
        res.render('dashboard', { user, messages });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.post('/send-message', requireAuth, async (req, res) => {
    const { message } = req.body;
    const userId = req.session.userId;
    
    if (!message || message.trim() === '') {
        return res.redirect('/dashboard');
    }
    
    try {
        await db.promise().query(
            'INSERT INTO messages (user_id, text, is_admin, is_read) VALUES (?, ?, ?, ?)',
            [userId, message.trim(), 0, 0]
        );
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const [users] = await db.promise().query('SELECT * FROM users WHERE is_admin = 0');
        const [computers] = await db.promise().query('SELECT * FROM computers');
        res.render('admin', { users, computers });
    } catch (error) {
        console.error('Admin panel error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.post('/admin/add-user', requireAdmin, async (req, res) => {
    const { username, email, password, balance } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.promise().query(
            'INSERT INTO users (username, email, password, balance) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, balance]
        );
        res.redirect('/admin');
    } catch (error) {
        console.error('Add user error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.post('/admin/add-computer', requireAdmin, async (req, res) => {
    const { number, x, y } = req.body;
    
    try {
        await db.promise().query(
            'INSERT INTO computers (number, x, y) VALUES (?, ?, ?)',
            [number, x, y]
        );
        res.redirect('/admin');
    } catch (error) {
        console.error('Add computer error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.post('/admin/update-balance', requireAdmin, async (req, res) => {
    const { userId, amount, description } = req.body;
    
    try {
        await db.promise().query('START TRANSACTION');
        
        await db.promise().query(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [amount, userId]
        );
        
        await db.promise().query(
            'INSERT INTO balance_history (user_id, amount, description) VALUES (?, ?, ?)',
            [userId, amount, description]
        );
        
        await db.promise().query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await db.promise().query('ROLLBACK');
        console.error('Update balance error:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/admin/messages/:userId', requireAdmin, async (req, res) => {
    try {
        const [messages] = await db.promise().query(
            'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC',
            [req.params.userId]
        );
        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.post('/admin/reply', requireAdmin, async (req, res) => {
    const { userId, message } = req.body;
    
    if (!message || message.trim() === '') {
        return res.status(400).send('Повідомлення не може бути порожнім');
    }
    
    try {
        await db.promise().query(
            'INSERT INTO messages (user_id, text, is_admin, is_read) VALUES (?, ?, ?, ?)',
            [userId, message.trim(), 1, 1]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Reply error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.post('/admin/mark-read', requireAdmin, async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).send('Не вказаний ID користувача');
    }
    
    try {
        await db.promise().query(
            'UPDATE messages SET is_read = 1 WHERE user_id = ? AND is_admin = 0',
            [userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.get('/admin/unread-count', requireAdmin, async (req, res) => {
    try {
        const [results] = await db.promise().query(
            'SELECT user_id, COUNT(*) as count FROM messages WHERE is_admin = 0 AND is_read = 0 GROUP BY user_id'
        );
        res.json(results);
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.get('/admin/balance-history/:userId', requireAdmin, async (req, res) => {
    try {
        const [history] = await db.promise().query(
            'SELECT * FROM balance_history WHERE user_id = ? ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(history);
    } catch (error) {
        console.error('Balance history error:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.listen(port, () => {
    console.log(`Сервер запущений на порту ${port}`);
}); 