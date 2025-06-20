const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../../chatme/database/users.db');
const db = new sqlite3.Database(dbPath);

module.exports = function(io) {
  io.on('connection', socket => {
    const { sessionId, avatar } = socket.handshake.auth || {};
    socket.sessionId = sessionId;
    socket.avatar = avatar || 'Anon';

    const joinMsg = { avatar: 'System', msg: `${socket.avatar} joined` };
    io.emit('chat message', joinMsg);
    storeMessage(joinMsg);

    socket.on('chat message', msg => {
      const chat = { avatar: socket.avatar, msg };
      io.emit('chat message', chat);
      storeMessage(chat);
    });

    socket.on('disconnect', reason => {
      const leaveMsg = { avatar: 'System', msg: `${socket.avatar} left` };
      io.emit('chat message', leaveMsg);
      storeMessage(leaveMsg);
    });
  });

  function storeMessage({ avatar, msg }) {
    db.run("INSERT INTO general_messages (avatar, msg) VALUES (?, ?)", [avatar, msg], err => {
      if (err) console.error('Failed to insert message:', err.message);
    });
  }
};
