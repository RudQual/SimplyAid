# SimplyAID 🏥

**Professional Industry First Aid Management System**

A MERN-based application for managing workplace first aid operations, compliant with Indian Factories Act, 1948.

## Features

- 🏭 **Multi-Company Support** — Manage multiple factories/companies
- 👥 **Department-wise User Management** — Role-based access control
- 🩹 **Incident Reporting** — Full lifecycle tracking with Form 18 generation
- 📦 **First Aid Box Inventory** — Track stock levels per Indian regulations
- 📊 **Compliance Dashboard** — Real-time compliance status
- 📄 **Report Generation** — PDF, Excel, CSV exports
- 🌐 **Bilingual** — English + Hindi switchable interface
- 🔒 **Secure** — JWT authentication with role-based access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS |
| Backend | Express.js + Node.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Charts | Recharts |
| PDF | PDFKit |

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd SimplyAID

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Setup environment
cp .env.example server/.env
# Edit server/.env with your MongoDB URI and JWT secret

# Seed the database
cd ../server && npm run seed

# Run both (from root)
cd .. 
# Terminal 1: npm run server
# Terminal 2: npm run client
```

## Indian Compliance

Built following the **Factories Act, 1948**:
- Section 45 — First Aid Box requirements
- Section 88 — Accident reporting
- Form 18 — Standard accident notice
- Prescribed first aid box contents (Class A/B/C)

## License

MIT
