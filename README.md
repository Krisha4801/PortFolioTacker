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

### AI Advisor

- Suggests improvment in current portfolio.
- Recommends trending investment options
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
Fill in your API keys in `.env` file in the project root.

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
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
