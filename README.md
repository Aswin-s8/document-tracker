# Document View Tracker (Aero Tracker Co.)

A premium full-stack proof-of-concept web application designed to log access analytics when a "Confidential Document" is opened. Ideal for legitimate analytics testing, demonstration, and security auditing.

---

## Features

- **Confidential Document Preview**: A highly polished, responsive sports-brand themed page simulating an internal design proposal, fetching its brand logo dynamically from the server.
- **Access Analytics Agent**: Captures access metrics asynchronously:
  - Timestamp
  - IP Address (Captured server-side)
  - Location (City, Country - via GeoIP or deterministic mock lookup on local hosts)
  - Browser profile & Operating System
  - Device type (Desktop, Mobile, Tablet)
  - Referrer origin & User Agent string
  - Unique visitor session ID
- **Admin Control Panel**:
  - Secure entry gate (JWT-token basic password auth).
  - Continuous data updates (automatic polling every 5 seconds).
  - Search, sort (by date, IP, location, referrer), and filter (by device and country) capabilities.
  - CSV audit logs export tool.
  - Absolute database reset with a confirmation modal.
  - One-click share toolbar (Copy URL, WhatsApp, Telegram, Email).

---

## Technology Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, SQLite3 (database)
- **Security**: Rate-limiting, Helmet/CORS headers, JWT credentials verification.

---

## Directory Layout

```
d:\tracker\
├── package.json                   # Root command coordinator
├── README.md                      # Guides and documentation
├── .env                           # active configurations
├── .env.example                   # template configs
├── backend/                       # Node backend engine
│   ├── package.json
│   ├── server.js                  # Express endpoints
│   ├── database.js                # SQLite data queries
│   ├── assets/
│   │   └── logo.png               # Brand logo
│   └── public/
│       └── document.html          # Tracked HTML target
└── frontend/                      # React Admin Panel
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css              # styling rules
        ├── components/
        │   ├── Login.jsx          # access portal gate
        │   └── Dashboard.jsx      # main dashboard UI
        └── utils/
            └── api.js             # server interfaces
```

---

## Installation & Setup

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v16+ recommended).

### 2. Auto-Installation
In the project root folder (`d:\tracker`), run:
```bash
npm run setup
```
This script will concurrently resolve all dependencies for the root coordinator, Express server, and Vite React frontend.

### 3. Settings Configuration
Open `.env` in the root folder and modify credentials:
```env
PORT=5000
ADMIN_PASSWORD=admin123
JWT_SECRET=super-secret-aero-tracker-key-987654321
```

---

## Local Development Execution

To spin up both the Express server (port `5000`) and the Vite development server (port `5173`) concurrently:
```bash
npm run dev
```

### URLs
- **Tracked Confidential Document**: [http://localhost:5000/document.html](http://localhost:5000/document.html)
- **Admin Dashboard Portal**: [http://localhost:5173/](http://localhost:5173/)

---

## Sharing with Friends (Local Tunneling)

If you are running the project locally on your machine and want to share the tracked document with friends over the internet, you can use a tunneling service like **ngrok** or **localtunnel**.

### Option A: Using Ngrok
1. Download and install [ngrok](https://ngrok.com/).
2. Start the backend tunnel (which serves the tracked document) by running:
   ```bash
   ngrok http 5000
   ```
3. Ngrok will output a public URL, for example: `https://abcd-123-456.ngrok-free.app`.
4. Share the link with your friends: `https://abcd-123-456.ngrok-free.app/document.html`.
5. When they open it, their actual public IP, city, country, browser, and device details will immediately display on your dashboard!

### Option B: Using Localtunnel
1. Run localtunnel directly via npm (no installation required):
   ```bash
   npx localtunnel --port 5000
   ```
2. It will provide a public URL like `https://funny-frogs-jump.loca.lt`.
3. Share the link: `https://funny-frogs-jump.loca.lt/document.html`.

---

## Production Hosting & Deployment

To run this application in a production environment:

### Option A: VPS Hosting (DigitalOcean, AWS, Linode)
1. Clone the project onto your VPS.
2. Build the production React assets inside the `frontend` folder:
   ```bash
   cd frontend
   npm run build
   ```
3. Copy the compiled assets from `frontend/dist` directly into the backend static folder `backend/public` (or adjust the express static middleware path to point to `frontend/dist`).
4. Set production environment variables in your server's process environment.
5. Start the server using a process manager like **PM2**:
   ```bash
   cd ../backend
   pm2 start server.js --name "tracker-app"
   ```

### Option B: Platform as a Service (Render, Heroku, Fly.io)
1. Deploy as a unified monorepo.
2. Configure your build setting command to build the frontend and move the assets:
   ```bash
   npm install && npm run build --prefix frontend && cp -r frontend/dist/* backend/public/
   ```
3. Configure the start command to:
   ```bash
   node backend/server.js
   ```
4. Set up the `PORT`, `ADMIN_PASSWORD`, and `JWT_SECRET` variables in the platform dashboard settings.
