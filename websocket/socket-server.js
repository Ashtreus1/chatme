const http = require('http');
const { Server } = require('socket.io');

const setupGeneralChat = require('./handlers/generalChat');
const setupRandomChat = require('./handlers/randomChat');

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setupGeneralChat(io.of('/general'));
setupRandomChat(io.of('/random'));

server.listen(3001, () => {
  console.log('✅ Socket.IO server running on port 3001');
});
