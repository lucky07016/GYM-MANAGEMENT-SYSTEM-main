const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const IS_DEV = process.env.NODE_ENV !== 'production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Database file path
const DB_FILE = path.join(__dirname, 'users_database.json');
const OTP_FILE = path.join(__dirname, 'otp_storage.json');

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], loginHistory: [] }, null, 2));
}

// Initialize OTP storage
if (!fs.existsSync(OTP_FILE)) {
  fs.writeFileSync(OTP_FILE, JSON.stringify({}, null, 2));
}

// Email configuration (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

function readOTPStorage() {
  try {
    const data = fs.readFileSync(OTP_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading OTP storage:', error);
    return {};
  }
}

function writeOTPStorage(data) {
  try {
    fs.writeFileSync(OTP_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing OTP storage:', error);
    return false;
  }
}

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '').trim();
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^\+?[\d\-()]{10,15}$/.test(normalized);
}

function isEmailConfigured() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  return Boolean(user && pass && user !== 'your-email@gmail.com' && pass !== 'your-app-password');
}

async function sendRegistrationOTP(email, phone, otp) {
  const subject = 'Your Gym Management System registration code';
  const text = [
    'Welcome to Gym Management System!',
    '',
    `Your registration verification code is: ${otp}`,
    '',
    `Email: ${email}`,
    `Phone: ${phone}`,
    '',
    'This code expires in 10 minutes.',
    'If you did not request this, you can ignore this email.'
  ].join('\n');

  if (!isEmailConfigured()) {
    console.log('\n--- Registration OTP (email not configured) ---');
    console.log(`Email: ${email}`);
    console.log(`Phone: ${phone}`);
    console.log(`OTP: ${otp}`);
    console.log('Configure EMAIL_USER and EMAIL_PASSWORD in .env to send real emails.\n');
    return { sent: false, devMode: true };
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text
  });

  console.log(`Registration OTP emailed to ${email}`);
  return { sent: true, devMode: false };
}

function cleanupExpiredOTPs(storage) {
  const now = Date.now();
  Object.keys(storage).forEach((key) => {
    if (!storage[key]?.expiresAt || storage[key].expiresAt <= now) {
      delete storage[key];
    }
  });
  return storage;
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

// Request OTP for registration (step 1)
app.post('/api/auth/signup/send-otp', async (req, res) => {
  const startTime = Date.now();
  const { displayName, email, phone, password } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!displayName || !normalizedEmail || !normalizedPhone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Display name, email, phone, and password are required'
    });
  }

  if (!isValidPhone(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid phone number (10–15 digits)'
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 4 characters'
    });
  }

  const db = readDatabase();
  const existingUser = db.users.find(
    (u) => u.email === normalizedEmail || u.phone === normalizedPhone
  );

  if (existingUser) {
    const field = existingUser.email === normalizedEmail ? 'Email' : 'Phone number';
    return res.status(409).json({
      success: false,
      message: `${field} is already registered`
    });
  }

  const otp = generateOTP();
  const otpStorage = cleanupExpiredOTPs(readOTPStorage());

  otpStorage[normalizedEmail] = {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    pendingSignup: {
      displayName: displayName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashPassword(password)
    }
  };

  if (!writeOTPStorage(otpStorage)) {
    return res.status(500).json({ success: false, message: 'Failed to store OTP' });
  }

  try {
    const delivery = await sendRegistrationOTP(normalizedEmail, normalizedPhone, otp);
    const responseTime = `${Date.now() - startTime}ms`;

    return res.status(200).json({
      success: true,
      message: delivery.sent
        ? 'Verification code sent to your email'
        : 'Verification code generated (check server console in dev mode)',
      email: normalizedEmail,
      phone: normalizedPhone,
      expiresInMinutes: 10,
      responseTime,
      ...(IS_DEV && delivery.devMode ? { devOtp: otp } : {})
    });
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    delete otpStorage[normalizedEmail];
    writeOTPStorage(otpStorage);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification email. Check server email settings.'
    });
  }
});

// Resend registration OTP
app.post('/api/auth/signup/resend-otp', async (req, res) => {
  const startTime = Date.now();
  const normalizedEmail = normalizeEmail(req.body.email);

  if (!normalizedEmail) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const otpStorage = cleanupExpiredOTPs(readOTPStorage());
  const entry = otpStorage[normalizedEmail];

  if (!entry?.pendingSignup) {
    return res.status(404).json({
      success: false,
      message: 'No pending registration found. Please sign up again.'
    });
  }

  const otp = generateOTP();
  entry.otp = otp;
  entry.expiresAt = Date.now() + OTP_EXPIRY_MS;
  otpStorage[normalizedEmail] = entry;

  if (!writeOTPStorage(otpStorage)) {
    return res.status(500).json({ success: false, message: 'Failed to store OTP' });
  }

  try {
    const delivery = await sendRegistrationOTP(
      entry.pendingSignup.email,
      entry.pendingSignup.phone,
      otp
    );

    return res.status(200).json({
      success: true,
      message: delivery.sent
        ? 'New verification code sent to your email'
        : 'New verification code generated (check server console in dev mode)',
      responseTime: `${Date.now() - startTime}ms`,
      ...(IS_DEV && delivery.devMode ? { devOtp: otp } : {})
    });
  } catch (error) {
    console.error('Failed to resend OTP email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend verification email'
    });
  }
});

// Verify OTP and complete registration (step 2)
app.post('/api/auth/signup/verify-otp', (req, res) => {
  const startTime = Date.now();
  const normalizedEmail = normalizeEmail(req.body.email);
  const otpInput = String(req.body.otp || '').trim();

  if (!normalizedEmail || !otpInput) {
    return res.status(400).json({
      success: false,
      message: 'Email and verification code are required'
    });
  }

  const otpStorage = cleanupExpiredOTPs(readOTPStorage());
  const entry = otpStorage[normalizedEmail];

  if (!entry) {
    return res.status(400).json({
      success: false,
      message: 'Verification code expired or not found. Please sign up again.'
    });
  }

  if (entry.expiresAt <= Date.now()) {
    delete otpStorage[normalizedEmail];
    writeOTPStorage(otpStorage);
    return res.status(400).json({
      success: false,
      message: 'Verification code expired. Please request a new one.'
    });
  }

  if (entry.otp !== otpInput) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code'
    });
  }

  const db = readDatabase();
  const pending = entry.pendingSignup;
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const locationData = getLocationData(clientIP);

  const duplicate = db.users.find(
    (u) => u.email === pending.email || u.phone === pending.phone
  );
  if (duplicate) {
    delete otpStorage[normalizedEmail];
    writeOTPStorage(otpStorage);
    return res.status(409).json({
      success: false,
      message: 'Email or phone number was registered while you were verifying'
    });
  }

  const userId = crypto.randomUUID();
  const newUser = {
    id: userId,
    displayName: pending.displayName,
    email: pending.email,
    phone: pending.phone,
    password: pending.password,
    emailVerified: true,
    phoneVerified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdFrom: {
      ip: clientIP,
      userAgent,
      ...locationData
    }
  };

  db.users.push(newUser);

  const historyEntry = {
    action: 'signup',
    userId,
    email: pending.email,
    phone: pending.phone,
    displayName: pending.displayName,
    timestamp: new Date().toISOString(),
    responseTime: `${Date.now() - startTime}ms`,
    network: {
      ip: clientIP,
      userAgent,
      ...locationData
    },
    xp: 20
  };

  db.loginHistory.push(historyEntry);

  delete otpStorage[normalizedEmail];

  if (!writeDatabase(db) || !writeOTPStorage(otpStorage)) {
    return res.status(500).json({ success: false, message: 'Database error' });
  }

  return res.status(201).json({
    success: true,
    message: 'Account created and verified successfully',
    user: {
      id: newUser.id,
      displayName: newUser.displayName,
      email: newUser.email,
      phone: newUser.phone
    },
    bonusXP: 20,
    responseTime: `${Date.now() - startTime}ms`
  });
});

// Legacy signup — redirect clients to OTP flow
app.post('/api/auth/signup', (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Use /api/auth/signup/send-otp then /api/auth/signup/verify-otp to register'
  });
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
      email: user.email,
      phone: user.phone || null
    },
    token: sessionToken,
    responseTime: `${responseTime}ms`
  });
});

// Get registered users (for admin)
app.get('/api/auth/users', (req, res) => {
  const db = readDatabase();
  res.json({
    totalUsers: db.users.length,
    users: db.users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone || null,
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.phoneVerified),
      createdAt: user.createdAt,
      verifiedAt: user.verifiedAt || null
    }))
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

// ===== FITNESS DATA APIs =====
const EXERCISES_FILE = path.join(__dirname, 'data', 'exercises.json');
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

app.get('/api/exercises', (req, res) => {
  const data = readJsonFile(EXERCISES_FILE, { muscleGroups: [], exercises: [] });
  const muscle = req.query.muscle;
  if (muscle) {
    return res.json({
      ...data,
      exercises: data.exercises.filter((e) => e.muscle === muscle)
    });
  }
  res.json(data);
});

app.get('/api/products', (req, res) => {
  const data = readJsonFile(PRODUCTS_FILE, { categories: [], products: [] });
  const category = req.query.category;
  if (category) {
    return res.json({
      ...data,
      products: data.products.filter((p) => p.category === category)
    });
  }
  res.json(data);
});

// ===== AI FITNESS COACH =====
const FITNESS_KB = [
  { keys: ['protein', 'how much protein'], reply: 'Aim for 1.6–2.2g protein per kg body weight if you train regularly. Spread it across 3–5 meals for best muscle protein synthesis.' },
  { keys: ['lose weight', 'fat loss', 'cut', 'cutting'], reply: 'Fat loss needs a moderate calorie deficit (300–500 kcal below maintenance), high protein, resistance training 3–4×/week, and 7–9 hours sleep. Track food consistently for 2 weeks first.' },
  { keys: ['bulk', 'gain muscle', 'mass'], reply: 'Lean bulk: eat 200–400 kcal above maintenance, prioritize progressive overload, protein at ~2g/kg, and sleep 7–9 hours. Expect 0.25–0.5 kg gain per month for quality mass.' },
  { keys: ['creatine'], reply: 'Creatine monohydrate (3–5g daily) is well-researched for strength and muscle. Take it any time daily — consistency matters more than timing.' },
  { keys: ['rest', 'recovery', 'sleep'], reply: 'Muscles grow during recovery. Aim for 7–9 hours sleep, deload every 4–6 weeks, and keep rest days truly light. Soreness is not the only progress signal.' },
  { keys: ['warm up', 'warmup'], reply: 'Warm up 5–10 min: light cardio + dynamic mobility + 2 ramp-up sets on your first compound lift. This reduces injury risk and improves performance.' },
  { keys: ['split', 'program', 'routine'], reply: 'Beginners: full body 3×/week. Intermediate: upper/lower 4× or PPL 6×. Pick what fits your schedule — consistency beats the “perfect” split.' },
  { keys: ['supplement'], reply: 'Essentials: protein powder (if diet lacks protein), creatine, vitamin D if deficient. Pre-workout is optional. Whole food first — check our Mart for vetted products.' },
  { keys: ['water', 'hydration'], reply: 'Drink water throughout the day. A simple guide: pale yellow urine. During training, sip 150–250ml every 15–20 min. Track glasses in the Daily Tracker.' },
  { keys: ['cardio', 'running'], reply: 'Mix 2–3 cardio sessions weekly with lifting. LISS (walking, cycling) supports recovery; HIIT is time-efficient but don’t overdo it on leg days.' },
  { keys: ['injury', 'pain'], reply: 'Sharp or joint pain: stop the exercise and consult a physio/doctor. Muscle soreness (DOMS) is normal 24–72h after new stimulus. Never train through sharp pain.' },
  { keys: ['meal prep', 'diet plan'], reply: 'Use the Diet Lab to generate a weekly plan. Batch cook proteins and carbs on Sunday, portion into containers, and log meals in the Daily Tracker.' },
  { keys: ['hello', 'hi', 'hey'], reply: 'Hey! I\'m your Gym AI Coach. Ask about workouts, diet, supplements, recovery, or how to use any feature in this app.' }
];

function getFitnessReply(message) {
  const lower = message.toLowerCase();
  for (const entry of FITNESS_KB) {
    if (entry.keys.some((k) => lower.includes(k))) {
      return entry.reply;
    }
  }
  return 'Great question! For workouts, try the Exercises page to pick muscle groups. For nutrition, use Diet Lab + Daily Tracker. For gear, browse the Gym Mart. Ask me about protein, fat loss, bulking, splits, supplements, or recovery.';
}

app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, message: 'Message required' });
  }

  const userMessage = String(message).trim();
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a friendly, concise fitness coach for a gym management app. Give practical advice on workouts, diet, supplements, and daily habits. Keep answers under 120 words.'
            },
            ...(context ? [{ role: 'system', content: `User context: ${context}` }] : []),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 250
        })
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        return res.json({ success: true, reply: data.choices[0].message.content.trim(), source: 'openai' });
      }
    } catch (err) {
      console.error('OpenAI chat error:', err.message);
    }
  }

  res.json({ success: true, reply: getFitnessReply(userMessage), source: 'builtin' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Gym Management System server running on http://localhost:${PORT}`);
  console.log(`Database file: ${DB_FILE}`);
});
