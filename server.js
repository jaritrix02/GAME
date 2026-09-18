const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const dns        = require('dns');

// Ensure reliable SRV DNS resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch(e) {}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*" }
});
const uri    = "mongodb+srv://rock:rock@loginsetup.kprbzkv.mongodb.net/rps_game?retryWrites=true&w=majority";
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
   GAME HISTORY: SAVE (individual rounds - kept for compatibility)
   POST /api/history
   ============================================================ */
app.post('/api/history', verifyToken, async (req, res) => {
  try {
    const { round, you, cpu, result } = req.body;
    const history = db.collection("game_history");
    await history.insertOne({
      userId:   req.user.id,
      username: req.user.username,
      round, you, cpu, result,
      playedAt: new Date()
    });
    res.json({ success: true, message: 'Round saved!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GAME RESULT: SAVE full game summary
   POST /api/game-result
   Body: { yourScore, cpuScore, outcome, rounds }
   ============================================================ */
app.post('/api/game-result', verifyToken, async (req, res) => {
  try {
    const { yourScore, cpuScore, outcome } = req.body; // outcome: "win"|"lose"|"draw"
    const gameResults = db.collection("game_results");

    await gameResults.insertOne({
      userId:    req.user.id,
      username:  req.user.username,
      yourScore,
      cpuScore,
      outcome,
      playedAt:  new Date()
    });

    // Update leaderboard stats for this user
    const leaderboard = db.collection("leaderboard");
    const inc = { gamesPlayed: 1 };
    if (outcome === "win")  inc.wins   = 1;
    if (outcome === "lose") inc.losses = 1;
    if (outcome === "draw") inc.draws  = 1;

    await leaderboard.updateOne(
      { userId: req.user.id },
      {
        $inc: inc,
        $set: { username: req.user.username, lastPlayed: new Date() }
      },
      { upsert: true }
    );

    res.json({ success: true, message: 'Game result saved!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GAME HISTORY: GET - only full game results for this user
   GET /api/game-history
   ============================================================ */
app.get('/api/game-history', verifyToken, async (req, res) => {
  try {
    const gameResults = db.collection("game_results");
    const records = await gameResults
      .find({ userId: req.user.id })
      .sort({ playedAt: -1 })
      .limit(30)
      .toArray();
    res.json({ success: true, history: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GAME HISTORY: CLEAR (both round-history and game-results)
   DELETE /api/history
   ============================================================ */
app.delete('/api/history', verifyToken, async (req, res) => {
  try {
    const history     = db.collection("game_history");
    const gameResults = db.collection("game_results");
    await history.deleteMany({ userId: req.user.id });
    await gameResults.deleteMany({ userId: req.user.id });
    // Reset leaderboard stats
    const leaderboard = db.collection("leaderboard");
    await leaderboard.updateOne(
      { userId: req.user.id },
      { $set: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 } }
    );
    res.json({ success: true, message: 'History cleared!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   LEADERBOARD: GET top 20 players by wins
   GET /api/leaderboard
   ============================================================ */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = db.collection("leaderboard");
    const top = await leaderboard
      .find({})
      .sort({ wins: -1, gamesPlayed: 1 })
      .limit(20)
      .toArray();
    res.json({ success: true, leaderboard: top });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================================================
   GAME HISTORY: GET (legacy round-history - kept for ref)
   GET /api/history
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
   REAL-TIME ONLINE MULTIPLAYER (Socket.IO)
   ============================================================ */
const CHOICES = ["Rock", "Paper", "Scissors"];
const onlineRooms = {}; // roomId -> room object
let waitingQuickQueue = null; // { socketId, username }

function decideWinner(choiceA, choiceB) {
  if (choiceA === choiceB) return "draw";
  if (
    (choiceA === 0 && choiceB === 2) ||
    (choiceA === 1 && choiceB === 0) ||
    (choiceA === 2 && choiceB === 1)
  ) return "player1";
  return "player2";
}

io.on('connection', (socket) => {
  console.log("⚡ Player connected to Socket.IO:", socket.id);

  // Send current online count
  io.emit('online-count', { count: io.engine.clientsCount });

  // Quick Match
  socket.on('quick-match', (data) => {
    const username = (data && data.username) ? data.username : "Warrior_" + socket.id.slice(-4);
    if (waitingQuickQueue && waitingQuickQueue.socketId !== socket.id) {
      const roomId = "QUICK-" + Math.floor(1000 + Math.random() * 9000);
      const p1Id   = waitingQuickQueue.socketId;
      const p1Name = waitingQuickQueue.username;
      waitingQuickQueue = null;

      onlineRooms[roomId] = {
        id: roomId,
        player1: { id: p1Id, name: p1Name, score: 0 },
        player2: { id: socket.id, name: username, score: 0 },
        moves: {},
        round: 1,
        maxRounds: 5
      };

      const p1Socket = io.sockets.sockets.get(p1Id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);

      io.to(roomId).emit('match-start', {
        roomId,
        player1: { id: p1Id, name: p1Name },
        player2: { id: socket.id, name: username },
        round: 1,
        maxRounds: 5
      });
    } else {
      waitingQuickQueue = { socketId: socket.id, username };
      socket.emit('waiting-match', { message: "Searching for an online challenger..." });
    }
  });

  // Cancel Quick Match
  socket.on('cancel-quick-match', () => {
    if (waitingQuickQueue && waitingQuickQueue.socketId === socket.id) {
      waitingQuickQueue = null;
      socket.emit('quick-match-cancelled');
    }
  });

  // Create Custom Room
  socket.on('create-room', (data) => {
    const username = (data && data.username) ? data.username : "Host_" + socket.id.slice(-4);
    const roomId   = "ROOM-" + Math.floor(1000 + Math.random() * 9000);

    onlineRooms[roomId] = {
      id: roomId,
      player1: { id: socket.id, name: username, score: 0 },
      player2: null,
      moves: {},
      round: 1,
      maxRounds: 5
    };

    socket.join(roomId);
    socket.emit('room-created', { roomId, username });
  });

  // Join Custom Room
  socket.on('join-room', (data) => {
    const roomId   = (data.roomId || "").toUpperCase().trim();
    const username = (data.username || "Challenger_" + socket.id.slice(-4)).trim();
    const room     = onlineRooms[roomId];

    if (!room) {
      return socket.emit('join-error', { message: "Room not found! Check the room code." });
    }
    if (room.player2) {
      return socket.emit('join-error', { message: "Room is already full! Try another room." });
    }

    room.player2 = { id: socket.id, name: username, score: 0 };
    socket.join(room.id);

    io.to(room.id).emit('match-start', {
      roomId: room.id,
      player1: { id: room.player1.id, name: room.player1.name },
      player2: { id: room.player2.id, name: room.player2.name },
      round: room.round,
      maxRounds: room.maxRounds
    });
  });

  // Player Choice
  socket.on('make-choice', (data) => {
    const roomId = data.roomId;
    const choice = parseInt(data.choice, 10);
    const room   = onlineRooms[roomId];
    if (!room || !room.player1 || !room.player2) return;

    room.moves[socket.id] = choice;

    // Notify opponent that this player has made their choice (hidden)
    socket.to(roomId).emit('opponent-moved');

    // Both players have picked!
    if (Object.keys(room.moves).length === 2) {
      const p1Choice = room.moves[room.player1.id];
      const p2Choice = room.moves[room.player2.id];

      const winnerCode = decideWinner(p1Choice, p2Choice);
      if (winnerCode === "player1") room.player1.score++;
      if (winnerCode === "player2") room.player2.score++;

      const isGameOver = (room.round >= room.maxRounds);

      io.to(roomId).emit('round-result', {
        round: room.round,
        maxRounds: room.maxRounds,
        player1: {
          id: room.player1.id,
          name: room.player1.name,
          choice: p1Choice,
          choiceName: CHOICES[p1Choice],
          score: room.player1.score
        },
        player2: {
          id: room.player2.id,
          name: room.player2.name,
          choice: p2Choice,
          choiceName: CHOICES[p2Choice],
          score: room.player2.score
        },
        winnerCode,
        isGameOver
      });

      room.moves = {};
      if (!isGameOver) room.round++;
    }
  });

  // Next Round Trigger
  socket.on('next-round', (data) => {
    const room = onlineRooms[data.roomId];
    if (!room) return;
    io.to(room.id).emit('round-ready', { round: room.round });
  });

  // Rematch / Reset
  socket.on('rematch-request', (data) => {
    const room = onlineRooms[data.roomId];
    if (!room) return;
    room.player1.score = 0;
    room.player2.score = 0;
    room.round = 1;
    room.moves = {};
    io.to(room.id).emit('match-start', {
      roomId: room.id,
      player1: { id: room.player1.id, name: room.player1.name },
      player2: { id: room.player2.id, name: room.player2.name },
      round: 1,
      maxRounds: 5
    });
  });

  // Disconnect / Leave
  function handleDisconnect() {
    if (waitingQuickQueue && waitingQuickQueue.socketId === socket.id) {
      waitingQuickQueue = null;
    }
    for (const rid in onlineRooms) {
      const r = onlineRooms[rid];
      if (r.player1 && r.player1.id === socket.id) {
        socket.to(rid).emit('opponent-left', { message: "Player 1 disconnected. Match ended." });
        delete onlineRooms[rid];
      } else if (r.player2 && r.player2.id === socket.id) {
        socket.to(rid).emit('opponent-left', { message: "Opponent disconnected. Match ended." });
        delete onlineRooms[rid];
      }
    }
    io.emit('online-count', { count: io.engine.clientsCount });
  }

  socket.on('leave-room', handleDisconnect);
  socket.on('disconnect', handleDisconnect);
});

/* ============================================================
   START SERVER
   ============================================================ */
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server with Socket.IO running at http://localhost:${PORT}`);
});