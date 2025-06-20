const waiting = [];
const pairs = new Map();

module.exports = function (io) {
  io.on('connection', (socket) => {
    const { sessionId, avatar } = socket.handshake.auth || {};
    socket.sessionId = sessionId;
    socket.avatar = avatar || 'Anon';

    // Helper: match users if possible
    const tryMatch = () => {
      while (waiting.length >= 2) {
        const user1 = waiting.shift();
        const user2 = waiting.shift();

        pairs.set(user1.id, user2.id);
        pairs.set(user2.id, user1.id);

        user1.emit('partner_found');
        user2.emit('partner_found');
      }
    };

    // Initial matchmaking
    socket.emit('waiting_for_partner');
    waiting.push(socket);
    tryMatch();

    // Handle messaging
    socket.on('chat message', (msg) => {
      const partnerId = pairs.get(socket.id);
      const partnerSocket = partnerId ? socket.nsp.sockets.get(partnerId) : null;

      if (partnerSocket) {
        socket.emit('chat message', { avatar: socket.avatar, msg });
        partnerSocket.emit('chat message', { avatar: socket.avatar, msg });
      }
    });

    // Skip: disconnect both, remove pair, no auto-rematch
    socket.on('skip', () => {
      const partnerId = pairs.get(socket.id);
      const partnerSocket = partnerId ? socket.nsp.sockets.get(partnerId) : null;

      // Remove pairings
      pairs.delete(socket.id);
      if (partnerId) pairs.delete(partnerId);

      // Notify both sides, but no requeue
      socket.emit('force_disconnect_notice');
      socket.disconnect(true); // force disconnect self

      if (partnerSocket) {
        partnerSocket.emit('force_disconnect_notice');
        partnerSocket.disconnect(true); // force disconnect partner
      }
    });

    // Manual force disconnect (clicking "disconnect")
    socket.on('force_disconnect', () => {
      const partnerId = pairs.get(socket.id);
      const partnerSocket = partnerId ? socket.nsp.sockets.get(partnerId) : null;

      if (partnerSocket) {
        partnerSocket.emit('force_disconnect_notice');
        pairs.delete(partnerId);
        partnerSocket.disconnect(true);
      }

      pairs.delete(socket.id);
      socket.disconnect(true);
    });

    // Unexpected disconnect
    socket.on('disconnect', () => {
      // Remove from waiting list
      const index = waiting.indexOf(socket);
      if (index !== -1) waiting.splice(index, 1);

      const partnerId = pairs.get(socket.id);
      const partnerSocket = partnerId ? socket.nsp.sockets.get(partnerId) : null;

      if (partnerSocket) {
        partnerSocket.emit('partner_disconnected');
        waiting.push(partnerSocket);
        pairs.delete(partnerId);
        tryMatch();
      }

      pairs.delete(socket.id);
    });
  });
};
