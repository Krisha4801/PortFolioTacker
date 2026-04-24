# Portfolio Tracker

A simple React app to track investments, manage transactions, and review portfolio performance with charts.

---

## Overview

Portfolio Tracker helps you keep investment data in one place.

You can record transactions, group holdings by type, and view your overall portfolio performance.

---

## Features

### Portfolio Tracking

- Track stocks, mutual funds, gold, and bank balance.
- View total value, cost, income, gains, and return percentage.

### Transaction Management

- Add new transactions.
- Edit existing transactions.
- Delete transactions when needed.

### Analytics

- View portfolio allocation.
- Compare performance using interactive charts.
- Review investment summaries by asset type.

### Authentication and Storage

- Sign in with Firebase authentication.
- Store portfolio data in Firestore.

---

## Tech Stack

| Tool | Purpose |
| --- | --- |
| React 19 | Frontend UI |
| Firebase | Authentication |
| Firestore | Database |
| Recharts | Charts and visual analytics |
| Tailwind CSS | Styling |

---

## Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Environment Variables

Create a `.env` file in the project root.

Add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGEBUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGINGSENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

---

## Project Structure

```text
PortFolio_Tracker/
|-- App.jsx
|-- firebase.js
|-- login.jsx
|-- Register.jsx
|-- App.css
|-- index.css
|-- assets/
`-- README.md
```

---

## Notes

Keep your `.env` file private.

Do not commit Firebase keys or secrets.

Use consistent filename casing, especially for `App.jsx`, to avoid Git issues on Windows.
