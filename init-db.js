const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'invoices.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Database connected.');
        
        // Create tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS Invoice (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoiceNumber TEXT UNIQUE,
                customerName TEXT,
                issueDate TEXT,
                dueDate TEXT,
                status TEXT DEFAULT 'DRAFT',
                total REAL DEFAULT 0,
                amountPaid REAL DEFAULT 0,
                balanceDue REAL DEFAULT 0,
                isArchived INTEGER DEFAULT 0
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS InvoiceLine (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoiceId INTEGER,
                description TEXT,
                quantity INTEGER,
                unitPrice REAL,
                lineTotal REAL,
                FOREIGN KEY (invoiceId) REFERENCES Invoice(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS Payment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoiceId INTEGER,
                amount REAL,
                paymentDate TEXT,
                FOREIGN KEY (invoiceId) REFERENCES Invoice(id)
            )`);
            console.log('Tables initialized properly.');
        });
    } //end else
});

module.exports = db;
