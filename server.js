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
let currentSessionToken = null; // Store the current session token

function startNewSession() {
  console.log("Starting new session");
  players = []
  currentOrder = "username"
  socketToUsername.clear();
  usernameToSocket.clear();
  playerAnswers.clear(); // Clear stored answers
  
  // Generate new session token
  currentSessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  console.log("New session token:", currentSessionToken);
  
  console.log("Sending order", currentOrder)
  io.emit(`order:${currentOrder}`)
  io.emit('info:players', players);
  io.emit('info:sessionStatus', {status: "started", token: currentSessionToken});
}

function endSession() {
  console.log("Ending session");
  players = []
  currentOrder = ""
  socketToUsername.clear();
  usernameToSocket.clear();
  playerAnswers.clear();
  currentSessionToken = null;
  io.emit('info:sessionStatus', {status: "ended"});
  io.emit('info:players', players);
}

function sendNextOrder(name) {
  currentOrder = name
  console.log("Sending next order", `order:${name}`)

  io.emit(`order:${name}`, players)
  io.emit('info:players', players);
}

function isUsernameTaken(username) {
  return players.some(player => player.username === username);
}

/*
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
*/

app.get('/backend', (req, res) => {
  res.sendFile(__dirname + '/static/backend.html');
});

app.get('/', (req, res) => {
  if (currentSessionToken) {
    res.redirect(`/playing?token=${currentSessionToken}`);
  } else {
    res.send(`<h1>No session running. Try again later.</h1>`);
  }
});

app.get('/playing', (req, res) => {
  const token = req.query.token;
  if (token === currentSessionToken) {
    res.sendFile(__dirname + '/static/frontend.html');
  } else {
    res.send('<h1>Wrong session token. Has your session ended?</h1>');
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');
  io.emit('info:players', players);

  socket.on("action:getPlayers", (data, callback) => {
    callback({players: players, currentOrder: currentOrder, sessionToken: currentSessionToken});
  });
  
  socket.on('action:username', (data, callback) => {
    console.log("Username received:", data);
    
    // Extract username from data (ignore token)
    const username = typeof data === 'string' ? data : data.username;
    // No token validation here

    // Check if username is already taken by another socket
    let player = players.find(p => p.username === username);
    if (player) {
      // Update socket id and set connected flag
      player.id = socket.id;
      player.connected = true;
      socketToUsername.set(socket.id, username);
      usernameToSocket.set(username, socket.id);
    } else {
      // Add new player
      player = players.find(p => p.id === socket.id);
      if(player) {
        player.username = username;
        console.log("Updating player via id", player);
      }else{
        player = { id: socket.id, username: username, connected: true };
        players.push(player);
        console.log("Adding new player", player);
      }
      
      socketToUsername.set(socket.id, username);
      usernameToSocket.set(username, socket.id);
    }
    // If this player is a child, update any parent's childUsername to the new username
    players.forEach(parent => {
      if (parent.childUsername === username) {
        // Optionally, update a cached childId for fast lookup
        parent.childId = player.id;
      }
    });
    console.log("Players after adding/updating:", players);
    console.log("Emitting info:players event");
    io.emit('info:players', players);
    // Send session token to this client only
    if (callback) {
      callback({ phase: currentOrder, player: player, players: players });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    const username = socketToUsername.get(socket.id);
    if (username) {
      const player = players.find(p => p.username === username);
      if (player) {
        player.connected = false;
      }
      socketToUsername.delete(socket.id);
      usernameToSocket.delete(username);
    }
    io.emit('info:players', players);
  });

  socket.on('action:startSession', () => {
    startNewSession();
  });

  socket.on('action:endSession', () => {
    endSession();
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
    currentOrder = "results";

    // 1. Build units: parent-child as one unit, others as single units
    const units = [];
    const usedIds = new Set();
    players.forEach(player => {
      if (player.childId && !usedIds.has(player.id) && !usedIds.has(player.childId)) {
        const child = players.find(p => p.id === player.childId);
        if (child) {
          units.push([player, child]);
          usedIds.add(player.id);
          usedIds.add(child.id);
        }
      } else if (!player.isChild && !usedIds.has(player.id)) {
        units.push([player]);
        usedIds.add(player.id);
      }
    });

    // 2. Pairing: shuffle units, pair in twos (last group of three if odd)
    const shuffledUnits = [...units];
    for (let i = shuffledUnits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledUnits[i], shuffledUnits[j]] = [shuffledUnits[j], shuffledUnits[i]];
    }
    let pairIndex = 0;
    for (let i = 0; i < shuffledUnits.length; ) {
      const group = [];
      group.push(...shuffledUnits[i]);
      if (i + 1 < shuffledUnits.length) {
        group.push(...shuffledUnits[i + 1]);
        i += 2;
      } else {
        i += 1;
      }
      group.forEach(p => p.pairIndex = pairIndex);
      pairIndex++;
    }

    // 3. Grouping: shuffle units again, assign to 3 groups round-robin
    const groupShuffledUnits = [...units];
    for (let i = groupShuffledUnits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groupShuffledUnits[i], groupShuffledUnits[j]] = [groupShuffledUnits[j], groupShuffledUnits[i]];
    }
    const numGroups = 3;
    let groupId = 0;
    groupShuffledUnits.forEach(unit => {
      unit.forEach(p => p.groupId = groupId);
      groupId = (groupId + 1) % numGroups;
    });

    sendNextOrder("results");
  });

  socket.on('action:startGrouping', () => {
    sendNextOrder("grouping")
  });

  socket.on('action:assignParentChild', ({ parentUsername, childUsername }) => {
    const parent = players.find(p => p.username === parentUsername);
    const child = players.find(p => p.username === childUsername);
    if (parent && child) {
      parent.childUsername = child.username;
      parent.childId = child.id; // Optionally, for fast lookup
      child.isChild = true;
      io.emit('info:players', players);
    } else {
      socket.emit('error:assignParentChild', 'Parent or child not found');
    }
  });

  socket.on('action:removeParentChild', ({ parentUsername }) => {
    const parent = players.find(p => p.username === parentUsername);
    if (parent && parent.childUsername) {
      const child = players.find(p => p.username === parent.childUsername);
      if (child) {
        delete child.isChild;
      }
      delete parent.childUsername;
      delete parent.childId;
      io.emit('info:players', players);
    } else {
      socket.emit('error:removeParentChild', 'Parent or connection not found');
    }
  });
});

// Replace app.listen with server.listen
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
