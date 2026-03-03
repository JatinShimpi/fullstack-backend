# Invoice Details Module - Full Stack Assignment

A clean, responsive full-stack implementation of an Invoice Details module integrating a robust backend and a "Monefy-inspired" frontend UI properly managed without node bundle locking. 

The application is built around standard technologies for direct evaluation environments. It is structured synchronously to operate immediately without requiring complex build steps or generator frameworks.

## 🛠️ Technology Stack
- **Backend:** Node.js, Express, strict RESTful API architecture.
- **Database:** SQLite3 local file database (`invoices.db`).
- **Frontend:** HTML5, CSS3, TailwindCSS (glassmorphism UI patterns), pure asynchronous DOM JavaScript interactions connecting directly to REST APIs. Served dynamically via Express `public/`. 

## ⚙️ Features Implemented
- Models for **Invoice**, **InvoiceLine**, **Payment**.
- Realtime mathematical computations (**line total**, **sums**, **balance constraints**).
- Endpoints completely mapping to DRAFT/PAID flow checks.
- Preventative logic blocking validation errors (refusing overpayment, requiring `> 0`, updating status efficiently).
- Archive and Restore functionalities via SQL models correctly mapped over Express.
- Beautiful, fully responsive Frontend dynamically calculating DOM layout metrics reflecting real backend data statuses instantly.

---

## 🚀 Setup & Run Instructions

**Step 1. Navigate to Backend Project Folder**
Open your terminal and navigate to the `fullstack-backend` directory where the monolithic code resides.
```bash
cd "fullstack-backend"
```

**Step 2. Install Project Dependencies**
Install standard Express and SQLite packages.
```bash
npm install
```
*(If dependencies fail to install naturally gracefully due to nested Windows module structures, simply run: `npm install express cors sqlite3` manually)*

**Step 3. Run Application Data Services & Frontend UI**
Start the application server using Node natively.
```bash
node server.js
```

**Step 4. Access the Application!**
The unified server mounts your API paths automatically and delivers the frontend UI payload. 
Navigate inside your web browser to:
[http://localhost:5000](http://localhost:5000)

---

### Important Notes on the Application Data (Mock Seed Process)
Because the SQLite database initializes cleanly without predefined data out-of-the-box, the Frontend JavaScript engine is designed to intelligently check for an **Empty Database**!

When you load `http://localhost:5000` for the first time, the UI automatically hits an internal `POST /api/invoices/seed` endpoint invisibly in the background. It injects a mock Draft Invoice (`INV-2026-001`) with LineItems corresponding exactly to evaluate the frontend interactions! 

Feel free to dynamically add payments ranging exactly to balance constraints natively within the clean Modals implemented!
