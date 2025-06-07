const express = require('express');
const app = express();
const port = 3352;
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);

app.get('/backend', (req, res) => {
  res.sendFile(__dirname + '/static/backend.html');
});
app.use(express.static('static'));



io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Replace app.listen with server.listen
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
