import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import useragent from 'express-useragent';
import geoip from 'geoip-lite';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDb, insertLog, getAllLogs, clearAllLogs } from './database.js';

// Load environment variables
dotenv.config();
const parentEnvPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: parentEnvPath });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'tracker-default-jwt-secret-key-12345';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Ensure database is initialized
await initDb();

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins for the proof-of-concept tracking page
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(useragent.express());

// Serves static files from public directory (tracked document)
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiters
const trackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 tracking requests per minute
  message: { error: 'Too many requests' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later' }
});

// Authentication middleware for admin dashboard endpoints
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Deterministic hash code helper for mock data
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

// Country code to Full Name mapping
const countryNameMap = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'DE': 'Germany',
  'FR': 'France',
  'JP': 'Japan',
  'IN': 'India',
  'AU': 'Australia',
  'CN': 'China',
  'BR': 'Brazil',
  'ZA': 'South Africa',
  'RU': 'Russia',
  'NL': 'Netherlands',
  'SG': 'Singapore',
  'ES': 'Spain',
  'IT': 'Italy',
  'KR': 'South Korea',
  'MX': 'Mexico',
  'CH': 'Switzerland',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'NZ': 'New Zealand',
  'IE': 'Ireland'
};

// 1. GET /api/logo - Returns the fictional sports brand logo
app.get('/api/logo', (req, res) => {
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    res.setHeader('Content-Type', 'image/png');
    fs.createReadStream(logoPath).pipe(res);
  } else {
    // Return a status 404 or a fallback transparent 1x1 png if not generated yet
    res.status(404).send('Logo not found. Make sure the backend/assets/logo.png file exists.');
  }
});

// 2. POST /api/track - Receives tracking analytics
app.post('/api/track', trackingLimiter, async (req, res) => {
  try {
    const { session_id, referrer } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    // IP Extraction
    let rawIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || req.ip;
    if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
      rawIp = '127.0.0.1';
    }

    // Device / Browser parsing via express-useragent
    const ua = req.useragent;
    const browser = ua.browser || 'Unknown';
    const os = ua.os || 'Unknown';
    let device = 'Desktop';
    if (ua.isMobile) device = 'Mobile';
    else if (ua.isTablet) device = 'Tablet';

    // GeoIP parsing with mock fallback for localhost/local network IPs
    let country = 'Unknown';
    let city = 'Unknown';

    const isLocalIp = rawIp === '127.0.0.1' || 
                      rawIp.startsWith('192.168.') || 
                      rawIp.startsWith('10.') || 
                      rawIp.startsWith('172.16.') || 
                      rawIp.startsWith('172.17.') || 
                      rawIp.startsWith('172.18.') || 
                      rawIp.startsWith('172.19.') || 
                      rawIp.startsWith('172.20.') || 
                      rawIp.startsWith('172.21.') || 
                      rawIp.startsWith('172.22.') || 
                      rawIp.startsWith('172.23.') || 
                      rawIp.startsWith('172.24.') || 
                      rawIp.startsWith('172.25.') || 
                      rawIp.startsWith('172.26.') || 
                      rawIp.startsWith('172.27.') || 
                      rawIp.startsWith('172.28.') || 
                      rawIp.startsWith('172.29.') || 
                      rawIp.startsWith('172.30.') || 
                      rawIp.startsWith('172.31.');

    if (isLocalIp) {
      // Deterministic mock location based on session_id hash for aesthetic dashboards
      const mockLocations = [
        { city: 'San Francisco', country: 'United States' },
        { city: 'London', country: 'United Kingdom' },
        { city: 'Tokyo', country: 'Japan' },
        { city: 'Paris', country: 'France' },
        { city: 'Sydney', country: 'Australia' },
        { city: 'Berlin', country: 'Germany' },
        { city: 'Mumbai', country: 'India' },
        { city: 'Toronto', country: 'Canada' },
        { city: 'New York', country: 'United States' },
        { city: 'Munich', country: 'Germany' }
      ];
      const index = Math.abs(hashCode(session_id)) % mockLocations.length;
      city = mockLocations[index].city;
      country = mockLocations[index].country;
    } else {
      const geo = geoip.lookup(rawIp);
      if (geo) {
        country = countryNameMap[geo.country] || geo.country || 'Unknown';
        city = geo.city || 'Unknown';
      }
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      ip: rawIp,
      country,
      city,
      browser,
      os,
      device,
      user_agent: req.headers['user-agent'] || 'Unknown',
      referrer: referrer || 'Direct',
      session_id
    };

    await insertLog(logEntry);
    res.status(201).json({ success: true, message: 'Visit tracked successfully' });
  } catch (error) {
    console.error('Error tracking visit:', error);
    res.status(500).json({ error: 'Internal server error during tracking' });
  }
});

// 3. POST /api/login - Admin Login
app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  } else {
    return res.status(401).json({ error: 'Incorrect password' });
  }
});

// 4. GET /api/logs - Retrieves all logs (Admin Protected)
app.get('/api/logs', authenticateAdmin, async (req, res) => {
  try {
    const logs = await getAllLogs();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error fetching logs' });
  }
});

// 5. DELETE /api/logs - Clears all logs (Admin Protected)
app.delete('/api/logs', authenticateAdmin, async (req, res) => {
  try {
    await clearAllLogs();
    res.json({ success: true, message: 'All logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Internal server error clearing logs' });
  }
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Open tracked document: http://localhost:${PORT}/document.html`);
});
