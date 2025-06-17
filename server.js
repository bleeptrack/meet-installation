const express = require('express');
const app = express();
const port = 3352;
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);

// Serve static files with proper MIME types
app.use(express.static('static', {
    setHeaders: (res, path) => {
        if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));
app.use('/node_modules', express.static('node_modules'));

players = []
currentOrder = "waiting"

// Store socket ID to username mapping for reconnection handling
const socketToUsername = new Map();
const usernameToSocket = new Map();
const playerAnswers = new Map(); // Store answers by username

function startNewSession() {
  console.log("Starting new session");
  players = []
  currentOrder = "username"
  socketToUsername.clear();
  usernameToSocket.clear();
  playerAnswers.clear(); // Clear stored answers
  console.log("Sending order", currentOrder)
  io.emit(`order:${currentOrder}`)
  io.emit('info:players', players);
}

function sendNextOrder(name) {
  currentOrder = name
  console.log("Sending next order", `order:${name}`)
  for(let player of players) {
    console.log("Sending order to", player.id, `order:${name}`)
    io.to(player.id).emit(`order:${name}`, players)
  }
  io.emit('info:players', players);
}

function isUsernameTaken(username) {
  return players.some(player => player.username === username);
}

function removePlayer(socketId) {
  const username = socketToUsername.get(socketId);
  if (username) {
    usernameToSocket.delete(username);
  }
  const index = players.findIndex(player => player.id === socketId);
  if (index !== -1) {
    // Store answers before removing player
    const player = players[index];
    if (player.answers) {
      playerAnswers.set(player.username, player.answers);
    }
    players.splice(index, 1);
    socketToUsername.delete(socketId);
  }
}

app.get('/backend', (req, res) => {
  res.sendFile(__dirname + '/static/backend.html');
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/static/frontend.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('action:username', (username) => {
    console.log("Username received:", username);
    
    // Check if username is already taken by another socket
    if (isUsernameTaken(username) && usernameToSocket.get(username) !== socket.id) {
      socket.emit('error:usernameTaken', 'This username is already taken');
      return;
    }

    // Remove any existing player entry for this socket
    removePlayer(socket.id);
    
    // Add new player
    const newPlayer = {
      id: socket.id,
      username: username
    };
    
    // Restore answers if they exist
    if (playerAnswers.has(username)) {
      newPlayer.answers = playerAnswers.get(username);
    }
    
    players.push(newPlayer);
    
    // Store the mappings for reconnection handling
    socketToUsername.set(socket.id, username);
    usernameToSocket.set(username, socket.id);
    
    console.log("Players after adding:", players);
    console.log("Emitting info:players event");
    io.emit('info:players', players);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    removePlayer(socket.id);
    io.emit('info:players', players);
  });

  socket.on('action:clearSession', () => {
    startNewSession();
  });

  socket.on('info:answer', (data) => {
    console.log("Answer received:", data);
    const player = players.find(p => p.username === data.username);
    if (player) {
      if (!player.answers) {
        player.answers = [];
      }
      player.answers.push({
        questionIndex: data.questionIndex,
        answerIndex: data.answerIndex
      });
      console.log("Updated player answers:", player.answers);
    } else {
      console.log("Player not found:", data.username, players);
    }
    io.emit('info:players', players);
  });

  socket.on('action:startQuestions', () => {
    sendNextOrder("questions")
  });

  socket.on('action:startResults', () => {
    currentOrder = "results"
    // Shuffle players array in place using Fisher-Yates algorithm
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }
    // Group players into pairs and add pair index
    const pairSize = 2
    const numPairs = Math.ceil(players.length / pairSize);
    
    for (let i = 0; i < players.length; i++) {
        players[i].pairIndex = Math.floor(i / pairSize);
    }
    // Find a player that is the only one with their pairIndex
    const pairCounts = new Map();
    players.forEach(player => {
        pairCounts.set(player.pairIndex, (pairCounts.get(player.pairIndex) || 0) + 1);
    });
    
    const lonePlayer = players.find(player => pairCounts.get(player.pairIndex) === 1);
    if (lonePlayer) {
        console.log("Found lone player:", lonePlayer.username);
        lonePlayer.pairIndex = 0;
    }

    // Assign group IDs (0, 1, or 2) to pairs while keeping pairs together
    const numGroups = 3;
    const pairs = new Map();
    
    // First, group players by their pair index
    players.forEach(player => {
        if (!pairs.has(player.pairIndex)) {
            pairs.set(player.pairIndex, []);
        }
        pairs.get(player.pairIndex).push(player);
    });
    
    // Assign group IDs to pairs
    let groupId = 0;
    for (const [pairIndex, pairPlayers] of pairs) {
        // Assign the same group ID to all players in the pair
        pairPlayers.forEach(player => {
            player.groupId = groupId;
        });
        groupId = (groupId + 1) % numGroups;
    }
    sendNextOrder("results")
  });

  socket.on('action:startGrouping', () => {
    sendNextOrder("grouping")
  });
});

// Replace app.listen with server.listen
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
