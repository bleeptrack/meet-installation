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
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));
app.use('/node_modules', express.static('node_modules', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

players = []
currentOrder = "waiting"

// Store socket ID to username mapping for reconnection handling
const socketToUsername = new Map();
const usernameToSocket = new Map();
const playerAnswers = new Map(); // Store answers by username
let currentSessionToken = null; // Store the current session token
let groupingDone = false; // Track if grouping has been done for this session

// Function to recalculate pairing based on current group assignments
function recalculatePairing() {
  console.log("Recalculating pairing based on current group assignments");
  
  // Build units: parent-child as one unit, others as single units
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

  // Organize units by their assigned group
  const unitsByGroup = { 0: [], 1: [], 2: [] };
  units.forEach(unit => {
    const groupId = unit[0].groupId; // All players in a unit have the same groupId
    unitsByGroup[groupId].push(unit);
  });
  
  console.log("Units by group for recalculation:", {
    group0: unitsByGroup[0].length,
    group1: unitsByGroup[1].length,
    group2: unitsByGroup[2].length
  });
  
  // Smart cross-group pairing algorithm
  const recalcPairs = [];
  let pairIndex = 1;
  
  // Create a list of all units with their group info
  const allUnits = [];
  Object.keys(unitsByGroup).forEach(groupId => {
    unitsByGroup[groupId].forEach(unit => {
      allUnits.push({ unit, groupId: parseInt(groupId) });
    });
  });
  
  // Shuffle to randomize order
  const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  
  const shuffledUnits = shuffleArray([...allUnits]);
  
  // MAXIMUM CROSS-GROUP PAIRING: ensure optimal cross-group combinations
  const createMaximumCrossGroupPairs = (units) => {
    const recalcPairs2 = [];
    let currentPairIndex = 1;
    
    // Create a working copy of units
    const remainingUnits = [...units];
    
    // Group units by their group ID for easier cross-group matching
    const unitsByGroup = { 0: [], 1: [], 2: [] };
    remainingUnits.forEach(unit => {
      unitsByGroup[unit.groupId].push(unit);
    });
    
    console.log("Starting pairing recalculation with units by group:", {
      group0: unitsByGroup[0].length,
      group1: unitsByGroup[1].length,
      group2: unitsByGroup[2].length
    });
    
    // Strategy: Always try to pair units from different groups
    while (remainingUnits.length > 0) {
      const pairUnits = [];
      const usedGroups = new Set();
      
      // First unit: take any available unit
      let firstUnitGroupId = null;
      if (remainingUnits.length > 0) {
        const firstUnit = remainingUnits.shift();
        pairUnits.push(firstUnit.unit);
        usedGroups.add(firstUnit.groupId);
        firstUnitGroupId = firstUnit.groupId;
        
        // Remove from grouped units
        const groupIndex = unitsByGroup[firstUnit.groupId].findIndex(u => u === firstUnit);
        if (groupIndex !== -1) {
          unitsByGroup[firstUnit.groupId].splice(groupIndex, 1);
        }
      }
      
      // Second unit: find the BEST cross-group match
      if (remainingUnits.length > 0) {
        let bestMatchIndex = -1;
        let bestMatchUnit = null;
        
        // Look for a unit from a different group
        for (let i = 0; i < remainingUnits.length; i++) {
          if (!usedGroups.has(remainingUnits[i].groupId)) {
            bestMatchIndex = i;
            bestMatchUnit = remainingUnits[i];
            break; // Take the first cross-group match
          }
        }
        
        if (bestMatchIndex !== -1 && bestMatchUnit) {
          // Found a cross-group match
          const secondUnit = remainingUnits.splice(bestMatchIndex, 1)[0];
          pairUnits.push(secondUnit.unit);
          usedGroups.add(secondUnit.groupId);
          
          // Remove from grouped units
          const groupIndex = unitsByGroup[secondUnit.groupId].findIndex(u => u === secondUnit);
          if (groupIndex !== -1) {
            unitsByGroup[secondUnit.groupId].splice(groupIndex, 1);
          }
          
          console.log(`Created cross-group pair: Group ${firstUnitGroupId} + Group ${secondUnit.groupId}`);
        } else {
          // No cross-group option available - this should be rare
          console.log("Warning: No cross-group option available, using same-group pairing");
          const secondUnit = remainingUnits.shift();
          pairUnits.push(secondUnit.unit);
          usedGroups.add(secondUnit.groupId);
          
          // Remove from grouped units
          const groupIndex = unitsByGroup[secondUnit.groupId].findIndex(u => u === secondUnit);
          if (groupIndex !== -1) {
            unitsByGroup[secondUnit.groupId].splice(groupIndex, 1);
          }
          
          console.log(`Created same-group pair: Group ${secondUnit.groupId} + Group ${secondUnit.groupId}`);
        }
      }
      
      // If we have exactly one unit left, add it to this pair (group of 3)
      if (remainingUnits.length === 1) {
        const lastUnit = remainingUnits.shift();
        pairUnits.push(lastUnit.unit);
        usedGroups.add(lastUnit.groupId);
        
        // Remove from grouped units
        const groupIndex = unitsByGroup[lastUnit.groupId].findIndex(u => u === lastUnit);
        if (groupIndex !== -1) {
          unitsByGroup[lastUnit.groupId].splice(groupIndex, 1);
        }
      }
      
      // Create the pair
      if (pairUnits.length > 0) {
        const pairPlayers = [];
        pairUnits.forEach(unit => {
          pairPlayers.push(...unit);
        });
        
        // Assign pairIndex and imageIndex to each player
        let imageIndex = 0;
        pairPlayers.forEach(p => {
          p.pairIndex = currentPairIndex;
          p.imageIndex = imageIndex;
          imageIndex = (imageIndex + 1) % 2; // Alternate between 0 and 1
        });
        
        recalcPairs2.push(pairPlayers);
        currentPairIndex++;
      }
    }
    
    return recalcPairs2;
  };
  
  const recalcResult = createMaximumCrossGroupPairs(shuffledUnits);
  
  console.log("Smart cross-group pairing recalculation completed:", {
    totalPairs: recalcResult.length,
    pairDetails: recalcResult.map((pair, index) => ({
      pairIndex: index + 1,
      players: pair.map(p => ({ username: p.username, groupId: p.groupId }))
    }))
  });
  
  return recalcResult;
}

function startNewSession() {
  console.log("Starting new session");
  players = []
  currentOrder = "username"
  socketToUsername.clear();
  usernameToSocket.clear();
  playerAnswers.clear(); // Clear stored answers
  groupingDone = false; // Reset grouping flag for new session
  
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
  groupingDone = false; // Reset grouping flag when session ends
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

app.get('/playerlist', (req, res) => {
  res.sendFile(__dirname + '/static/playerlist.html');
});

app.get('/', (req, res) => {
  // Prevent caching of the root route
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  if (currentSessionToken) {
    res.redirect(`/playing?token=${currentSessionToken}`);
  } else {
    res.send(`<h1>No session running. Try again later.</h1>`);
  }
});

app.get('/playing', (req, res) => {
  // Prevent caching of the playing route
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
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
    
    // Extract username and token from data
    const username = typeof data === 'string' ? data : data.username;
    const clientToken = data.token;
    
    // Validate session token - only reject if we have a session token and it doesn't match
    if (currentSessionToken && clientToken && clientToken !== currentSessionToken) {
      console.log("Invalid session token:", clientToken, "Expected:", currentSessionToken);
      if (callback) {
        callback({ 
          success: false, 
          error: 'Invalid session token. Please refresh and try again.',
          phase: 'invalid_session'
        });
      }
      return;
    }

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
        // Ensure player has a language property
        if (!player.language) {
          player.language = 'de-DE';
        }
        console.log("Updating player via id", player);
      }else{
        player = { id: socket.id, username: username, connected: true, language: 'de-DE' };
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
    // Only do grouping and pairing if it hasn't been done yet for this session
    if (!groupingDone) {
      console.log("Performing grouping and pairing for the first time this session");
      
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

       // 2. SMART CROSS-GROUP PAIRING: pair units from different groups
       // This will be done after grouping is complete

      // 3. Grouping: prioritize DGS players in groups 1 and 2, then English speakers to groups 0 and 2, then balance with German speakers
      const numGroups = 3;
      
      // Separate units by DGS status, language preference, and other criteria
      const dgsUnits = [];
      const englishUnits = [];
      const germanUnits = [];
      
      units.forEach(unit => {
        const hasDGSPlayer = unit.some(p => p.dgs === true);
        const hasEnglishSpeaker = unit.some(p => (p.language || 'de-DE') === 'en-US');
        
        if (hasDGSPlayer) {
          dgsUnits.push(unit);
        } else if (hasEnglishSpeaker) {
          englishUnits.push(unit);
        } else {
          germanUnits.push(unit);
        }
      });
      
      // Shuffle arrays for random distribution within each category
      const shuffleArray = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      
      const shuffledDgsUnits = shuffleArray([...dgsUnits]);
      const shuffledEnglishUnits = shuffleArray([...englishUnits]);
      const shuffledGermanUnits = shuffleArray([...germanUnits]);
      
      // Initialize group counts
      const groupCounts = [0, 0, 0]; // Track players in each group
      
      // First, assign DGS players to groups 1 and 2 only
      shuffledDgsUnits.forEach(unit => {
        // Choose between group 1 and 2 based on which has fewer players
        const targetGroup = groupCounts[1] <= groupCounts[2] ? 1 : 2;
        unit.forEach(p => p.groupId = targetGroup);
        groupCounts[targetGroup] += unit.length;
      });
      
      // Second, assign English speakers to groups 0 and 2 only
      shuffledEnglishUnits.forEach(unit => {
        // Choose between group 0 and 2 based on which has fewer players
        const targetGroup = groupCounts[0] <= groupCounts[2] ? 0 : 2;
        unit.forEach(p => p.groupId = targetGroup);
        groupCounts[targetGroup] += unit.length;
      });
      
      // Finally, fill remaining slots with German speakers to balance groups
      shuffledGermanUnits.forEach(unit => {
        // Find the group with the fewest players
        const minCount = Math.min(...groupCounts);
        const targetGroup = groupCounts.indexOf(minCount);
        unit.forEach(p => p.groupId = targetGroup);
        groupCounts[targetGroup] += unit.length;
      });
      
       console.log("Final group distribution:", {
         group0: groupCounts[0],
         group1: groupCounts[1], 
         group2: groupCounts[2],
         dgsUnits: dgsUnits.length,
         englishUnits: englishUnits.length,
         germanUnits: germanUnits.length
       });

       // 4. SMART CROSS-GROUP PAIRING: pair units from different groups
       // Organize units by their assigned group
       const unitsByGroup = { 0: [], 1: [], 2: [] };
       units.forEach(unit => {
         const groupId = unit[0].groupId; // All players in a unit have the same groupId
         unitsByGroup[groupId].push(unit);
       });
       
       console.log("Units by group for pairing:", {
         group0: unitsByGroup[0].length,
         group1: unitsByGroup[1].length,
         group2: unitsByGroup[2].length
       });
       
       // Smart cross-group pairing algorithm
       const initialPairs2 = [];
       let pairIndex = 1;
       
       // Create a list of all units with their group info
       const allUnits = [];
       Object.keys(unitsByGroup).forEach(groupId => {
         unitsByGroup[groupId].forEach(unit => {
           allUnits.push({ unit, groupId: parseInt(groupId) });
         });
       });
       
       // Shuffle to randomize order
       const shuffledUnits = shuffleArray([...allUnits]);
       
       // OPTIMAL CROSS-GROUP PAIRING: find the best possible cross-group combinations
       const createOptimalCrossGroupPairs = (units) => {
         const pairs = [];
         let currentPairIndex = 1;
         
         // Group units by their group ID
         const unitsByGroup = { 0: [], 1: [], 2: [] };
         units.forEach(unit => {
           unitsByGroup[unit.groupId].push(unit);
         });
         
         console.log("Starting optimal pairing with units by group:", {
           group0: unitsByGroup[0].length,
           group1: unitsByGroup[1].length,
           group2: unitsByGroup[2].length
         });
         
         // Strategy: Try to create as many cross-group pairs as possible
         // by being smarter about which units to pair together
         
         const createPairs = () => {
           const result = [];
           let pairIndex = 1;
           
           // Create a working copy of grouped units
           const workingGroups = {
             0: [...unitsByGroup[0]],
             1: [...unitsByGroup[1]], 
             2: [...unitsByGroup[2]]
           };
           
           // Try to create cross-group pairs first
           while (Object.values(workingGroups).some(group => group.length > 0)) {
             const pairUnits = [];
             const usedGroups = new Set();
             
             // Find the best cross-group combination
             const availableGroups = Object.keys(workingGroups).filter(g => workingGroups[g].length > 0);
             
             if (availableGroups.length >= 2) {
               // Try to pair from different groups
               const group1 = availableGroups[0];
               const group2 = availableGroups[1];
               
               // Take one unit from each group
               const unit1 = workingGroups[group1].shift();
               const unit2 = workingGroups[group2].shift();
               
               pairUnits.push(unit1.unit, unit2.unit);
               usedGroups.add(parseInt(group1));
               usedGroups.add(parseInt(group2));
               
               console.log(`Created cross-group pair: Group ${group1} + Group ${group2}`);
             } else if (availableGroups.length === 1) {
               // Only one group has units left
               const group = availableGroups[0];
               if (workingGroups[group].length >= 2) {
                 // Take two units from the same group
                 const unit1 = workingGroups[group].shift();
                 const unit2 = workingGroups[group].shift();
                 pairUnits.push(unit1.unit, unit2.unit);
                 usedGroups.add(parseInt(group));
                 console.log(`Created same-group pair: Group ${group} + Group ${group} (no other groups available)`);
               } else {
                 // Only one unit left, add it to the last pair or create a new one
                 const unit = workingGroups[group].shift();
                 pairUnits.push(unit.unit);
                 usedGroups.add(parseInt(group));
                 console.log(`Added single unit from Group ${group} to pair`);
               }
             }
             
             // Create the pair
             if (pairUnits.length > 0) {
               const pairPlayers = [];
               pairUnits.forEach(unit => {
                 pairPlayers.push(...unit);
               });
               
               // Assign pairIndex and imageIndex to each player
               let imageIndex = 0;
               pairPlayers.forEach(p => {
                 p.pairIndex = pairIndex;
                 p.imageIndex = imageIndex;
                 imageIndex = (imageIndex + 1) % 2; // Alternate between 0 and 1
               });
               
               result.push(pairPlayers);
               pairIndex++;
             }
           }
           
           return result;
         };
         
         return createPairs();
       };
       
       const finalPairs = createOptimalCrossGroupPairs(shuffledUnits);
       
       console.log("Smart cross-group pairing completed:", {
         totalPairs: finalPairs.length,
         pairDetails: finalPairs.map((pair, index) => ({
           pairIndex: index + 1,
           players: pair.map(p => ({ username: p.username, groupId: p.groupId }))
         }))
       });

       // Mark grouping as done for this session
       groupingDone = true;
       console.log("Grouping and pairing completed for this session");
    } else {
      console.log("Grouping already done for this session, proceeding to questions");
    }

    sendNextOrder("questions");
  });

  socket.on('action:startResults', () => {
    console.log("Starting results phase - grouping should already be completed");
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

  socket.on('action:language', (data, callback) => {
    console.log("Language change received:", data);
    const username = data.username;
    const language = data.language;
    
    const player = players.find(p => p.username === username);
    if (player) {
      player.language = language;
      console.log("Updated player language:", player.username, "to", language);
      io.emit('info:players', players);
      if (callback) {
        callback({ success: true, player: player });
      }
    } else {
      console.log("Player not found for language update:", username);
      if (callback) {
        callback({ success: false, error: 'Player not found' });
      }
    }
  });

  socket.on('action:updateDGS', (data, callback) => {
    console.log("DGS update received:", data);
    const username = data.username;
    const dgs = data.dgs;
    
    const player = players.find(p => p.username === username);
    if (player) {
      player.dgs = dgs;
      console.log("Updated player DGS status:", player.username, "to", dgs);
      io.emit('info:players', players);
      if (callback) {
        callback({ success: true, player: player });
      }
    } else {
      console.log("Player not found for DGS update:", username);
      if (callback) {
        callback({ success: false, error: 'Player not found' });
      }
    }
  });

  socket.on('action:reassignGroup', (data, callback) => {
    console.log("Group reassignment received:", data);
    const username = data.username;
    const newGroupId = data.newGroupId;
    
    const player = players.find(p => p.username === username);
    if (player) {
      // If this player has a child, move the child to the same group
      if (player.childId) {
        const child = players.find(p => p.id === player.childId);
        if (child) {
          child.groupId = newGroupId;
          console.log("Moved child", child.username, "to group", newGroupId);
        }
      }
      
      // If this player is a child, move the parent to the same group
      if (player.isChild) {
        const parent = players.find(p => p.childId === player.id);
        if (parent) {
          parent.groupId = newGroupId;
          console.log("Moved parent", parent.username, "to group", newGroupId);
        }
      }
      
       // Move the player to the new group
       player.groupId = newGroupId;
       console.log("Moved player", player.username, "to group", newGroupId);
       
       // Recalculate pairing to maintain cross-group pairing
       if (groupingDone) {
         console.log("Recalculating pairing due to group change");
         recalculatePairing();
       }
       
       io.emit('info:players', players);
       if (callback) {
         callback({ success: true, player: player });
       }
    } else {
      console.log("Player not found for group reassignment:", username);
      if (callback) {
        callback({ success: false, error: 'Player not found' });
      }
    }
  });
});

// Replace app.listen with server.listen
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
