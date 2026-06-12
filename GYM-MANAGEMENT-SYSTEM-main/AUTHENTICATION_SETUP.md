# Gym Management System - Authentication & Database Setup

## Overview

This Gym Management System now includes a complete authentication system with database storage. User credentials, login history, and network information are automatically stored in a JSON file.

## Features

✅ **User Registration (Sign-up)**
- Email and password authentication
- Display name for profile
- Password hashing with SHA-256
- Sign-up bonus XP (+20 XP)

✅ **User Login**
- Secure credential verification
- Session token generation

✅ **Database Storage**
- All user data stored in `users_database.json`
- Login history with timestamps
- Response time tracking
- Network information capture:
  - Client IP address
  - User Agent (browser/device info)
  - Geographic location data (basic)

✅ **Login History**
- Successful/failed login attempts tracked
- Failed login reasons recorded
- Complete audit trail

✅ **API Endpoints**
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Authenticate user
- `GET /api/auth/history` - View login history
- `GET /api/auth/stats` - Get authentication statistics

---

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

This installs:
- **Express** - Web framework
- **body-parser** - Request body parsing
- **CORS** - Cross-Origin Resource Sharing

### 2. Start the Server

```bash
npm start
```

Or run directly:
```bash
node server.js
```

The server will start on `http://localhost:3000`

You should see:
```
Gym Management System server running on http://localhost:3000
Database file: c:\...\users_database.json
```

### 3. Access the Application

- Open your browser and navigate to `http://localhost:3000`
- The login page will automatically load
- Create a new account or login

---

## Database Structure

### `users_database.json`

```json
{
  "users": [
    {
      "id": "uuid",
      "displayName": "String",
      "email": "user@example.com",
      "password": "sha256_hash",
      "createdAt": "ISO_timestamp",
      "createdFrom": {
        "ip": "127.0.0.1",
        "userAgent": "Browser info",
        "country": "Country",
        "region": "Region",
        "city": "City"
      }
    }
  ],
  "loginHistory": [
    {
      "action": "login_success|login_failed|signup",
      "userId": "uuid",
      "displayName": "String",
      "email": "user@example.com",
      "timestamp": "ISO_timestamp",
      "responseTime": "XXms",
      "network": {
        "ip": "127.0.0.1",
        "userAgent": "Browser info",
        "country": "Country",
        "region": "Region",
        "city": "City"
      }
    }
  ]
}
```

---

## API Endpoints

### Sign Up
**POST** `/api/auth/signup`

Request:
```json
{
  "displayName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "id": "uuid",
    "displayName": "John Doe",
    "email": "john@example.com"
  },
  "bonusXP": 20,
  "responseTime": "45ms"
}
```

### Login
**POST** `/api/auth/login`

Request:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "displayName": "John Doe",
    "email": "john@example.com"
  },
  "token": "session_token_uuid",
  "responseTime": "32ms"
}
```

### View Login History
**GET** `/api/auth/history`

Response:
```json
{
  "totalUsers": 5,
  "totalLoginAttempts": 42,
  "history": [
    {
      "action": "login_success",
      "userId": "uuid",
      "displayName": "John Doe",
      "email": "john@example.com",
      "timestamp": "2024-01-15T10:30:45.123Z",
      "responseTime": "32ms",
      "network": {
        "ip": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "country": "India",
        "region": "Karnataka",
        "city": "Bangalore"
      }
    }
  ]
}
```

### Get Statistics
**GET** `/api/auth/stats`

Response:
```json
{
  "totalUsers": 5,
  "totalLoginAttempts": 42,
  "successfulLogins": 38,
  "failedLogins": 4,
  "signups": 5
}
```

---

## Project Structure

```
GYM-MANAGEMENT-SYSTEM-main/
├── server.js              # Express server & API
├── package.json           # Dependencies
├── auth-client.js         # Frontend auth logic
├── login.html             # Login page
├── index.html             # Home page
├── workout.html           # Workouts page
├── diet.html              # Diet tracking
├── progress.html          # Progress tracking
├── planner.html           # Planner
├── styles.css             # Styling (with toast notifications)
├── app.js                 # Main app logic
└── users_database.json    # User data (auto-created)
```

---

## Features Captured in Database

### Per Login/Signup:
- ✅ Timestamp (ISO format)
- ✅ Response time (in milliseconds)
- ✅ Client IP address
- ✅ User Agent string
- ✅ Geographic location (basic)
- ✅ Email & Display name
- ✅ Success/Failure status
- ✅ Unique User ID (UUID)

---

## Troubleshooting

### Port 3000 Already in Use
```bash
# Windows - Find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Permission Error
- Ensure the application has write permissions to the project directory
- Check if `users_database.json` exists and is not read-only

### CORS Errors in Console
- Make sure the server is running on `http://localhost:3000`
- Check that you're accessing it via localhost, not IP address

### Login Not Working
- Check browser console for network errors
- Verify server is running: `http://localhost:3000`
- Check that email/password format is correct

---

## Security Notes

⚠️ **Important**: This is a demo system. For production:

1. **Password Hashing**: Use bcrypt instead of SHA-256
2. **HTTPS**: Always use HTTPS in production
3. **Database**: Use a real database (MongoDB, PostgreSQL) instead of JSON files
4. **Environment Variables**: Store sensitive data in `.env` files
5. **Rate Limiting**: Implement rate limiting on auth endpoints
6. **Email Verification**: Add email verification for sign-ups
7. **Password Reset**: Implement secure password reset
8. **Session Management**: Use proper session/JWT tokens

---

## Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Two-factor authentication (2FA)
- [ ] User profile management
- [ ] Integration with real geolocation API
- [ ] Database migration to MongoDB/PostgreSQL
- [ ] Admin dashboard
- [ ] User activity analytics

---

## License

MIT

## Support

For issues or questions, please check the console logs and database file for debugging information.
