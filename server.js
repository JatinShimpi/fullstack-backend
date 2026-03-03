var express = require('express');
var cors = require('cors')
var path = require('path');
var myDb = require('./init-db');

var app = express();
app.use(cors())
app.use(express.json());

// serving the frontend stuff
app.use(express.static(path.join(__dirname, 'public')));

// get details
app.get('/api/invoices/:id', (req, res) => {
    var inv_id = req.params.id;

    myDb.get('SELECT * FROM Invoice WHERE id = ?', [inv_id], (err, invData) => {
        if (err || !invData) return res.status(404).json({ error: 'Invoice not found' });

        myDb.all('SELECT * FROM InvoiceLine WHERE invoiceId = ?', [inv_id], (err, ln) => {
            if (err) return res.status(500).json({ error: 'bad lines' });

            myDb.all('SELECT * FROM Payment WHERE invoiceId = ?', [inv_id], (err, pay) => {
                if (err) return res.status(500).json({ error: 'bad payments' });

                res.json({
                    ...invData,
                    isArchived: invData.isArchived === 1,
                    lines: ln,
                    payments: pay
                });
            });
        });
    });
});

// post new payment
app.post('/api/invoices/:id/payments', (req, res) => {
    let theId = req.params.id;
    let amt = req.body.amount;

    if (!amt || amt <= 0) {
        return res.status(400).json({ error: 'Amount > 0 pls' });
    }

    myDb.get('SELECT * FROM Invoice WHERE id = ?', [theId], (err, inv) => {
        if (err || !inv) return res.status(404).json({ error: 'not found' });

        if (amt > inv.balanceDue) {
            return res.status(400).json({ error: 'too much money' });
        }

        let newAmount = inv.amountPaid + amt;
        let newBalance = inv.total - newAmount;
        let pStatus = newBalance === 0 ? 'PAID' : 'DRAFT';
        let today = new Date().toISOString().split('T')[0];

        myDb.run('INSERT INTO Payment (invoiceId, amount, paymentDate) VALUES (?, ?, ?)', [theId, amt, today], function (err) {
            if (err) return res.status(500).json({ error: 'error saving' });

            myDb.run('UPDATE Invoice SET amountPaid = ?, balanceDue = ?, status = ? WHERE id = ?',
                [newAmount, newBalance, pStatus, theId], (err) => {
                    if (err) return res.status(500).json({ error: 'Error updating' });
                    res.json({ success: true, amountPaid: newAmount, balanceDue: newBalance, status: pStatus });
                });
        });
    });
});

// archive it
app.post('/api/invoices/archive', (req, res) => {
    var Theid = req.body.id;
    myDb.run('UPDATE Invoice SET isArchived = 1 WHERE id = ?', [Theid], function (e) {
        if (e) return res.status(500).json({ error: 'err archive' });
        res.json({ success: true, message: 'archived done' });
    });
});

// restore it back
app.post('/api/invoices/restore', (req, res) => {
    let Theid = req.body.id;
    myDb.run('UPDATE Invoice SET isArchived = 0 WHERE id = ?', [Theid], function (e) {
        if (e) return res.status(500).json({ error: 'err restore' });
        res.json({ success: true, message: 'restored' });
    });
});

// test data seed thing
app.post('/api/invoices/seed', (req, res) => {
    var totalAmt = 1250.00;
    myDb.run(`INSERT INTO Invoice (invoiceNumber, customerName, issueDate, dueDate, status, total, amountPaid, balanceDue) 
            VALUES ('INV-00123', 'John Doe Inc', '2026-03-01', '2026-03-15', 'DRAFT', ?, 0, ?)`,
        [totalAmt, totalAmt], function (err) {
            if (err) {
                console.log("oops seed error");
                return res.status(500).json({ error: 'Seed error' });
            }
            var newInvId = this.lastID;
            myDb.run('INSERT INTO InvoiceLine (invoiceId, description, quantity, unitPrice, lineTotal) VALUES (?, ?, ?, ?, ?)',
                [newInvId, 'Website coding', 10, 100, 1000]);
            myDb.run('INSERT INTO InvoiceLine (invoiceId, description, quantity, unitPrice, lineTotal) VALUES (?, ?, ?, ?, ?)',
                [newInvId, 'Hosting server', 1, 250, 250]);

            res.json({ success: true, invoiceId: newInvId });
        });
});

var thePort = process.env.PORT || 5000;
app.listen(thePort, () => {
    console.log(`server is listening on port ` + thePort);
});
