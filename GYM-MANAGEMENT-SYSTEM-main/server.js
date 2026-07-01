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
      ...(IS_DEV ? { devOtp: otp } : {})
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
      ...(IS_DEV ? { devOtp: otp } : {})
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
  { keys: ['protein', 'how much protein'], reply: 'Aim for 1.6–2.2g protein per kg body weight if you train regularly. Spread it across 3–5 meals to support muscle repair and recovery.' },
  { keys: ['lose weight', 'fat loss', 'cut', 'cutting'], reply: 'For fat loss, use a small calorie deficit of about 300–500 kcal, keep protein high, lift 3–4 times per week, and sleep 7–9 hours. Stay consistent for at least 2 weeks before judging results.' },
  { keys: ['bulk', 'gain muscle', 'mass', 'hypertrophy'], reply: 'A lean bulk works best with a 200–400 kcal surplus, progressive overload, and protein around 1.8–2.2g/kg. Train hard, recover well, and aim for slow, steady gains.' },
  { keys: ['creatine'], reply: 'Creatine monohydrate is one of the best-supported supplements for strength and muscle. Take 3–5g daily; consistency matters more than timing.' },
  { keys: ['rest', 'recovery', 'sleep', 'deload'], reply: 'Recovery drives progress. Sleep 7–9 hours, keep at least 1–2 lighter days each week, and don’t ignore soreness, mobility, and hydration.' },
  { keys: ['warm up', 'warmup'], reply: 'Warm up for 5–10 minutes with light cardio, mobility, and 2 ramp-up sets on your first main lift. That helps reduce injury risk and improves performance.' },
  { keys: ['split', 'program', 'routine', 'workout split'], reply: 'Beginners often do best with a full-body routine 3x per week. Intermediates may prefer upper/lower or push/pull/legs, depending on time and recovery.' },
  { keys: ['supplement', 'pre workout', 'vitamin d'], reply: 'The essentials are protein powder if needed, creatine, and vitamin D if you are deficient. Pre-workout is optional; whole food should stay your priority.' },
  { keys: ['water', 'hydration'], reply: 'Drink water throughout the day and keep urine pale yellow. During training, sip about 150–250ml every 15–20 minutes.' },
  { keys: ['cardio', 'running', 'hiit', 'liss'], reply: 'A strong plan usually combines lifting with 2–3 cardio sessions per week. LISS helps recovery, while HIIT is great for conditioning when you are not overdoing leg volume.' },
  { keys: ['injury', 'pain', 'doms'], reply: 'Sharp or joint pain means stop and get checked. Delayed soreness is normal for 24–72 hours after a new stimulus, but pain that worsens is not.' },
  { keys: ['meal prep', 'diet plan', 'calorie', 'macro'], reply: 'Use the Diet Lab to build a weekly plan, prep proteins and carbs in advance, and track meals in the Daily Tracker so you can adjust based on results.' },
  { keys: ['bench', 'press', 'chest', 'push'], reply: 'For chest and pressing, focus on progressive overload with bench, incline press, dips, or push-ups, and keep your reps in a challenging range with good form.' },
  { keys: ['squat', 'deadlift', 'leg', 'pull'], reply: 'Squats and deadlifts are excellent for lower body and posterior chain strength. Start with controlled reps, balance your volume, and add load slowly.' },
  { keys: ['beginner', 'new to gym'], reply: 'Start simple: 3 full-body sessions per week, learn basic movement patterns, and keep the weights manageable. Consistency matters more than doing everything at once.' },
  { keys: ['hello', 'hi', 'hey'], reply: 'Hey! I’m your Gym AI Coach. I can help with workouts, diet, supplements, recovery, and how to use the app’s fitness tools. Ask me anything specific.' }
];

function getFitnessReply(message) {
  const lower = message.toLowerCase();

  if (/workout plan|plan for|routine for|program for/.test(lower)) {
    return 'A solid beginner-friendly routine is 3 full-body sessions each week with 5–6 movements, 2–4 sets per exercise, and 8–12 reps for most lifts. Add progressive overload slowly and aim for recovery between sessions.';
  }

  if (/form|technique|exercise form/.test(lower)) {
    return 'Good form is the main priority. Move with control, keep the target muscle under tension, and stop if the movement feels unstable or painful. A lighter weight with clean reps beats sloppy heavy reps.';
  }

  if (/progress|weight loss|muscle gain|strength/.test(lower)) {
    return 'Track your workouts and body measurements weekly. If strength is rising and recovery is good, your plan is working. Adjust calories or volume only when progress stalls for 2–3 weeks.';
  }

  for (const entry of FITNESS_KB) {
    if (entry.keys.some((k) => lower.includes(k))) {
      return entry.reply;
    }
  }

  return 'Great question! For workouts, use the Exercises page to choose a muscle group. For nutrition, use the Diet Lab and Daily Tracker. For gear, browse the Gym Mart. I can also help with fat loss, bulking, splits, supplements, recovery, and gym basics.';
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
              content: 'You are a friendly, expert fitness coach for a gym management app. Give practical, evidence-informed advice on workouts, nutrition, recovery, supplements, exercise form, and gym habits. Keep answers clear, motivating, and under 180 words. If the user asks for a plan, include sets, reps, progression, and recovery guidance.'
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
