var express = require('express');
var cors = require('cors')
var path = require('path');
var myDb = require('./init-db');

var app = express();
app.use(cors())
app.use(express.json());

// serving the frontend stuff
app.use(express.static(path.join(__dirname, 'public')));

// list all invoices (summary)
app.get('/api/invoices', (req, res) => {
    myDb.all('SELECT id, invoiceNumber, customerName, status, total, balanceDue, isArchived, dueDate FROM Invoice ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to retrieve invoices' });
        res.json(rows.map(r => ({ ...r, isArchived: r.isArchived === 1 })));
    });
});

// create a new invoice with line items
app.post('/api/invoices', (req, res) => {
    const { invoiceNumber, customerName, issueDate, dueDate, lines } = req.body;

    if (!invoiceNumber || !customerName || !issueDate || !dueDate) {
        return res.status(400).json({ error: 'Missing required fields: invoiceNumber, customerName, issueDate, dueDate' });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: 'At least one line item is required' });
    }

    // Calculate total from line items
    let total = 0;
    for (const line of lines) {
        if (!line.description || !line.quantity || !line.unitPrice) {
            return res.status(400).json({ error: 'Each line item needs description, quantity, and unitPrice' });
        }
        total += line.quantity * line.unitPrice;
    }

    myDb.run(
        `INSERT INTO Invoice (invoiceNumber, customerName, issueDate, dueDate, status, total, amountPaid, balanceDue)
         VALUES (?, ?, ?, ?, 'DRAFT', ?, 0, ?)`,
        [invoiceNumber, customerName, issueDate, dueDate, total, total],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Invoice number already exists' });
                }
                return res.status(500).json({ error: 'Failed to create invoice' });
            }

            const newId = this.lastID;
            let completed = 0;

            lines.forEach(line => {
                const lineTotal = line.quantity * line.unitPrice;
                myDb.run(
                    'INSERT INTO InvoiceLine (invoiceId, description, quantity, unitPrice, lineTotal) VALUES (?, ?, ?, ?, ?)',
                    [newId, line.description, line.quantity, line.unitPrice, lineTotal],
                    () => {
                        completed++;
                        if (completed === lines.length) {
                            res.json({ success: true, invoiceId: newId });
                        }
                    }
                );
            });
        }
    );
});

// update an existing invoice
app.put('/api/invoices/:id', (req, res) => {
    const invId = req.params.id;
    const { invoiceNumber, customerName, issueDate, dueDate, lines } = req.body;

    myDb.get('SELECT * FROM Invoice WHERE id = ?', [invId], (err, inv) => {
        if (err || !inv) return res.status(404).json({ error: 'Invoice not found' });

        if (inv.status === 'PAID') {
            return res.status(400).json({ error: 'Cannot edit a paid invoice' });
        }

        const updNumber = invoiceNumber || inv.invoiceNumber;
        const updCustomer = customerName || inv.customerName;
        const updIssue = issueDate || inv.issueDate;
        const updDue = dueDate || inv.dueDate;

        if (lines && Array.isArray(lines) && lines.length > 0) {
            // Recalculate total from new line items
            let newTotal = 0;
            for (const line of lines) {
                if (!line.description || !line.quantity || !line.unitPrice) {
                    return res.status(400).json({ error: 'Each line item needs description, quantity, and unitPrice' });
                }
                newTotal += line.quantity * line.unitPrice;
            }

            const newBalance = newTotal - inv.amountPaid;
            if (newBalance < 0) {
                return res.status(400).json({ error: 'New total cannot be less than amount already paid' });
            }

            // Delete old line items, insert new ones
            myDb.run('DELETE FROM InvoiceLine WHERE invoiceId = ?', [invId], (err) => {
                if (err) return res.status(500).json({ error: 'Failed to update line items' });

                let completed = 0;
                lines.forEach(line => {
                    const lineTotal = line.quantity * line.unitPrice;
                    myDb.run(
                        'INSERT INTO InvoiceLine (invoiceId, description, quantity, unitPrice, lineTotal) VALUES (?, ?, ?, ?, ?)',
                        [invId, line.description, line.quantity, line.unitPrice, lineTotal],
                        () => {
                            completed++;
                            if (completed === lines.length) {
                                myDb.run(
                                    'UPDATE Invoice SET invoiceNumber = ?, customerName = ?, issueDate = ?, dueDate = ?, total = ?, balanceDue = ? WHERE id = ?',
                                    [updNumber, updCustomer, updIssue, updDue, newTotal, newBalance, invId],
                                    (err) => {
                                        if (err) return res.status(500).json({ error: 'Failed to update invoice' });
                                        res.json({ success: true });
                                    }
                                );
                            }
                        }
                    );
                });
            });
        } else {
            // Update header only, no line item changes
            myDb.run(
                'UPDATE Invoice SET invoiceNumber = ?, customerName = ?, issueDate = ?, dueDate = ? WHERE id = ?',
                [updNumber, updCustomer, updIssue, updDue, invId],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to update invoice' });
                    res.json({ success: true });
                }
            );
        }
    });
});

// get details
app.get('/api/invoices/:id', (req, res) => {
    var inv_id = req.params.id;

    myDb.get('SELECT * FROM Invoice WHERE id = ?', [inv_id], (err, invData) => {
        if (err || !invData) return res.status(404).json({ error: 'Invoice not found' });

        myDb.all('SELECT * FROM InvoiceLine WHERE invoiceId = ?', [inv_id], (err, ln) => {
            if (err) return res.status(500).json({ error: 'Failed to retrieve line items' });

            myDb.all('SELECT * FROM Payment WHERE invoiceId = ?', [inv_id], (err, pay) => {
                if (err) return res.status(500).json({ error: 'Failed to retrieve payments' });

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
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    myDb.get('SELECT * FROM Invoice WHERE id = ?', [theId], (err, inv) => {
        if (err || !inv) return res.status(404).json({ error: 'not found' });

        if (amt > inv.balanceDue) {
            return res.status(400).json({ error: 'Amount exceeds balance due' });
        }

        let newAmount = inv.amountPaid + amt;
        let newBalance = inv.total - newAmount;
        let pStatus = newBalance === 0 ? 'PAID' : 'DRAFT';
        let today = new Date().toISOString().split('T')[0];

        myDb.run('INSERT INTO Payment (invoiceId, amount, paymentDate) VALUES (?, ?, ?)', [theId, amt, today], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to save payment' });

            myDb.run('UPDATE Invoice SET amountPaid = ?, balanceDue = ?, status = ? WHERE id = ?',
                [newAmount, newBalance, pStatus, theId], (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to update invoice' });
                    res.json({ success: true, amountPaid: newAmount, balanceDue: newBalance, status: pStatus });
                });
        });
    });
});

// archive it
app.post('/api/invoices/archive', (req, res) => {
    var Theid = req.body.id;
    myDb.run('UPDATE Invoice SET isArchived = 1 WHERE id = ?', [Theid], function (e) {
        if (e) return res.status(500).json({ error: 'Failed to archive invoice' });
        res.json({ success: true, message: 'Invoice archived successfully' });
    });
});

// restore it back
app.post('/api/invoices/restore', (req, res) => {
    let Theid = req.body.id;
    myDb.run('UPDATE Invoice SET isArchived = 0 WHERE id = ?', [Theid], function (e) {
        if (e) return res.status(500).json({ error: 'Failed to restore invoice' });
        res.json({ success: true, message: 'Invoice restored successfully' });
    });
});

// test data seed thing
app.post('/api/invoices/seed', (req, res) => {
    var totalAmt = 1250.00;
    myDb.run(`INSERT INTO Invoice (invoiceNumber, customerName, issueDate, dueDate, status, total, amountPaid, balanceDue) 
            VALUES ('INV-00123', 'John Doe Inc', '2026-03-01', '2026-03-15', 'DRAFT', ?, 0, ?)`,
        [totalAmt, totalAmt], function (err) {
            if (err) {
                console.error('Seed error:', err);
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
