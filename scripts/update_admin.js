const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('cyberclub.db');

db.run("UPDATE users SET username = '1111111111' WHERE is_admin = 1", function(err) {
    if (err) {
        console.error('Ошибка при обновлении:', err);
    } else {
        console.log('Логин администратора успешно обновлен на 1111111111');
    }
    db.close();
}); 