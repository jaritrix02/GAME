const express    = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');

const app    = express();
const uri    = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const SECRET = "rps_secret_key_2024";  // In production use env variable

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));  // Serve static files

/* ============================================================
   MongoDB Connect
   ============================================================ */
let db;
async function connectDB() {
  try {
    await client.connect();
    db = client.db("rps_game");
    console.log("✅ MongoDB connected → rps_game");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
}
connectDB();

/* ============================================================
   Middleware: Verify Token
   ============================================================ */
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/* ============================================================
   PING / ROOT
   ============================================================ */
app.get('/ping', (req, res) => {
  res.json({ success: true, message: 'Server is working! ✅' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ============================================================
   AUTH: SIGNUP
   POST /api/signup
   Body: { username, name, email, password }
   ============================================================ */
app.post('/api/signup', async (req, res) => {
  try {
    const { username, name, email, password } = req.body;

    if (!username || !name || !email || !password) {
      return res.json({ success: false, message: 'All fields are required!' });
    }
    if (password.length < 6) {
      return res.json({ success: false, message: 'Password must be at least 6 characters!' });
    }

    const users = db.collection("users");

    const usernameExists = await users.findOne({ username: username.toLowerCase() });
    if (usernameExists) {
      return res.json({ success: false, message: 'Username already taken!' });
    }

    const emailExists = await users.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.json({ success: false, message: 'Email already registered!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await users.insertOne({
      username:  username.toLowerCase(),
      name:      name.trim(),
      email:     email.toLowerCase(),
      password:  hashedPassword,
      createdAt: new Date()
    });

    const token = jwt.sign(
      { id: result.insertedId, username: username.toLowerCase(), name: name.trim() },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { username: username.toLowerCase(), name: name.trim(), email: email.toLowerCase() }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/* ============================================================
   AUTH: LOGIN
   POST /api/login
   Body: { emailOrUsername, password }
   ============================================================ */
app.post('/api/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.json({ success: false, message: 'Please fill all fields!' });
    }

    const users = db.collection("users");
    const user = await users.findOne({
      $or: [
        { email:    emailOrUsername.toLowerCase() },
        { username: emailOrUsername.toLowerCase() }
      ]
    });

    if (!user) {
      return res.json({ success: false, message: 'User not found!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Incorrect password!' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, name: user.name },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: { username: user.username, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/* ============================================================
   GAME HISTORY: SAVE
   POST /api/history
   Headers: Authorization: Bearer <token>
   Body: { round, you, cpu, result }
   ============================================================ */
app.post('/api/history', verifyToken, async (req, res) => {
  try {
    const { round, you, cpu, result } = req.body;
    const history = db.collection("game_history");

    await history.insertOne({
      userId:    req.user.id,
      username:  req.user.username,
      round, you, cpu, result,
      playedAt:  new Date()
    });

    res.json({ success: true, message: 'Round saved!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GAME HISTORY: GET (last 50)
   GET /api/history
   Headers: Authorization: Bearer <token>
   ============================================================ */
app.get('/api/history', verifyToken, async (req, res) => {
  try {
    const history = db.collection("game_history");
    const records = await history
      .find({ userId: req.user.id })
      .sort({ playedAt: -1 })
      .limit(50)
      .toArray();

    res.json({ success: true, history: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GAME HISTORY: CLEAR
   DELETE /api/history
   ============================================================ */
app.delete('/api/history', verifyToken, async (req, res) => {
  try {
    const history = db.collection("game_history");
    await history.deleteMany({ userId: req.user.id });
    res.json({ success: true, message: 'History cleared!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   START SERVER
   ============================================================ */
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});