const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Database file path
const DB_FILE = path.join(__dirname, 'users_database.json');

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], loginHistory: [] }, null, 2));
}

// Helper function to read database
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { users: [], loginHistory: [] };
  }
}

// Helper function to write database
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         'Unknown';
}

// Get geolocation (basic, would need API for real data)
function getLocationData(ip) {
  if (ip === '::1' || ip === '127.0.0.1') {
    return {
      ip: ip,
      country: 'Local',
      region: 'Local Machine',
      city: 'Localhost'
    };
  }
  // In production, you would use a service like ip-api.com or maxmind
  return {
    ip: ip,
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown'
  };
}

// Middleware to track response time
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Sign up endpoint
app.post('/api/auth/signup', (req, res) => {
  const startTime = Date.now();
  const { displayName, email, password } = req.body;

  // Validate input
  if (!displayName || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields' 
    });
  }

  const db = readDatabase();
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const locationData = getLocationData(clientIP);

  // Check if email already exists
  const existingUser = db.users.find(u => u.email === email);
  if (existingUser) {
    const responseTime = Date.now() - startTime;
    return res.status(409).json({ 
      success: false, 
      message: 'Email already exists',
      responseTime: `${responseTime}ms`
    });
  }

  // Create new user
  const userId = crypto.randomUUID();
  const hashedPassword = hashPassword(password);
  
  const newUser = {
    id: userId,
    displayName,
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    createdFrom: {
      ip: clientIP,
      userAgent: userAgent,
      ...locationData
    }
  };

  db.users.push(newUser);

  // Log signup in history
  const historyEntry = {
    action: 'signup',
    userId: userId,
    email: email,
    displayName: displayName,
    timestamp: new Date().toISOString(),
    responseTime: `${Date.now() - startTime}ms`,
    network: {
      ip: clientIP,
      userAgent: userAgent,
      ...locationData
    },
    xp: 20  // Sign-up bonus
  };

  db.loginHistory.push(historyEntry);

  // Write to database
  if (writeDatabase(db)) {
    const responseTime = Date.now() - startTime;
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        displayName: newUser.displayName,
        email: newUser.email
      },
      bonusXP: 20,
      responseTime: `${responseTime}ms`
    });
  } else {
    return res.status(500).json({ 
      success: false, 
      message: 'Database error' 
    });
  }
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const startTime = Date.now();
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password required' 
    });
  }

  const db = readDatabase();
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const locationData = getLocationData(clientIP);

  // Find user
  const user = db.users.find(u => u.email === email);
  
  if (!user) {
    const responseTime = Date.now() - startTime;
    const failedEntry = {
      action: 'login_failed',
      email: email,
      reason: 'User not found',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      network: {
        ip: clientIP,
        userAgent: userAgent,
        ...locationData
      }
    };
    db.loginHistory.push(failedEntry);
    writeDatabase(db);
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }

  // Check password
  const hashedPassword = hashPassword(password);
  if (user.password !== hashedPassword) {
    const responseTime = Date.now() - startTime;
    const failedEntry = {
      action: 'login_failed',
      userId: user.id,
      email: email,
      reason: 'Invalid password',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      network: {
        ip: clientIP,
        userAgent: userAgent,
        ...locationData
      }
    };
    db.loginHistory.push(failedEntry);
    writeDatabase(db);
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }

  // Successful login
  const responseTime = Date.now() - startTime;
  const successEntry = {
    action: 'login_success',
    userId: user.id,
    displayName: user.displayName,
    email: email,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    network: {
      ip: clientIP,
      userAgent: userAgent,
      ...locationData
    }
  };

  db.loginHistory.push(successEntry);
  writeDatabase(db);

  // Generate session token
  const sessionToken = crypto.randomUUID();

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email
    },
    token: sessionToken,
    responseTime: `${responseTime}ms`
  });
});

// Get login history (for admin/debugging)
app.get('/api/auth/history', (req, res) => {
  const db = readDatabase();
  res.json({
    totalUsers: db.users.length,
    totalLoginAttempts: db.loginHistory.length,
    history: db.loginHistory.slice(-50) // Last 50 entries
  });
});

// Get user stats
app.get('/api/auth/stats', (req, res) => {
  const db = readDatabase();
  const stats = {
    totalUsers: db.users.length,
    totalLoginAttempts: db.loginHistory.length,
    successfulLogins: db.loginHistory.filter(h => h.action === 'login_success').length,
    failedLogins: db.loginHistory.filter(h => h.action === 'login_failed').length,
    signups: db.loginHistory.filter(h => h.action === 'signup').length
  };
  res.json(stats);
});

// Start server
app.listen(PORT, () => {
  console.log(`Gym Management System server running on http://localhost:${PORT}`);
  console.log(`Database file: ${DB_FILE}`);
});
