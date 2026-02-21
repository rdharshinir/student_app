const express = require('express');
const multer = require('multer');
const path = require('path');
const { execFile } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

const DB_PATH = path.join(__dirname, 'data', 'seating.db');
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH));

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  // Create students table
  db.run(`CREATE TABLE IF NOT EXISTS students (
    reg_no TEXT,
    seat_no TEXT,
    room TEXT,
    course_code TEXT,
    course_title TEXT,
    date TEXT,
    session TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reg_no, date, session)
  )`);

  // Create admin table with single user credentials
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    username TEXT PRIMARY KEY,
    password TEXT
  )`);

  // Ensure default admin exists and password is always correct
  db.run(
    "INSERT INTO admin (username, password) VALUES (?, ?) " +
    "ON CONFLICT(username) DO UPDATE SET password = excluded.password",
    ['Kgkite', 'Kite@123'],
    (err) => {
      if (err) {
        console.error('Failed to upsert default admin user:', err.message);
      } else {
        console.log('Default admin ensured: username=Kgkite, password=Kite@123');
      }
    }
  );
});

// Endpoint: Admin login
app.post('/api/admin/login', express.json(), (req, res) => {
  const { username, password } = req.body;
  
  console.log(`Login attempt: Username - ${username}, Password - ${password}`);

  if (!username || !password) {
    console.log('Login failed: Username or password missing.');
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT username FROM admin WHERE username = ? AND password = ?',
    [username, password], (err, row) => {
      if (err) {
        console.error('Database error during login:', err.message);
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        console.log('Login failed: Invalid credentials for user', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      console.log('Login successful for user', username);
      res.json({ success: true });
    });
});

// Endpoint: Upload Excel file (requires admin auth)
app.post('/api/admin/upload', upload.single('file'), (req, res) => {
  const { username, password, date } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!username || !password) return res.status(401).json({ error: 'Admin credentials required' });

  // Validate admin
  db.get('SELECT username FROM admin WHERE username = ? AND password = ?',
    [username, password], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });

      // Process Excel file
      const filePath = req.file.path;
      const args = [path.join(__dirname, 'excel_worker.py'), filePath, DB_PATH];
      if (date) args.push(date);

      execFile('python', args, (err, stdout, stderr) => {
        if (err) {
          console.error('Excel processing error:', err, stderr);
          return res.status(500).json({ error: 'Failed to process Excel file', details: stderr || err.message });
        }
        try {
          const result = JSON.parse(stdout);
          return res.json({ success: true, ...result });
        } catch (e) {
          return res.status(500).json({ error: 'Invalid response from Excel processor' });
        }
      });
  });
});

// Endpoint: Query student seating
app.get('/api/student', (req, res) => {
  const { regno, session } = req.query;

  if (!regno || !session) {
    return res.status(400).json({ error: 'Registration number and session required' });
  }

  db.get(
    'SELECT * FROM students WHERE reg_no = ? AND session = ? ORDER BY date DESC LIMIT 1',
    [regno.trim(), session.trim().toUpperCase()],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'No seating arrangement found' });
      res.json(row);
    }
  );
});

// Admin endpoint: View all seating arrangements
app.get('/api/admin/seating', (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(401).json({ error: 'Admin credentials required' });
  }

  db.get('SELECT username FROM admin WHERE username = ? AND password = ?',
    [username, password], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });

      db.all('SELECT * FROM students ORDER BY date DESC, session ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      });
  });
});

// Admin endpoint: Delete seating record
app.delete('/api/admin/seating', (req, res) => {
  const { username, password, reg_no, date, session } = req.body;

  if (!username || !password) {
    return res.status(401).json({ error: 'Admin credentials required' });
  }

  if (!reg_no || !date || !session) {
    return res.status(400).json({ error: 'Registration number, date and session required' });
  }

  db.get('SELECT username FROM admin WHERE username = ? AND password = ?',
    [username, password], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });

      db.run('DELETE FROM students WHERE reg_no = ? AND date = ? AND session = ?',
        [reg_no, date, session], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
  });
});

// Admin endpoint: Get raw data for a registration number (for debugging)
app.get('/api/admin/debug/student/:regno', (req, res) => {
  const { username, password } = req.query;
  const { regno } = req.params;

  if (!username || !password) {
    return res.status(401).json({ error: 'Admin credentials required' });
  }

  db.get('SELECT username FROM admin WHERE username = ? AND password = ?',
    [username, password], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });

      db.get('SELECT * FROM students WHERE reg_no = ?', [regno], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Student not found' });
        res.json(row);
      });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
