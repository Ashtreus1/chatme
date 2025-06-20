const waiting = [];
const pairs = new Map();

module.exports = function(io) {
  io.on('connection', socket => {
    const { sessionId, avatar } = socket.handshake.auth || {};
    socket.sessionId = sessionId;
    socket.avatar = avatar || 'Anon';

    // Matchmaking
    if (waiting.length > 0) {
      const partner = waiting.shift();
      pairs.set(socket.id, partner.id);
      pairs.set(partner.id, socket.id);

      socket.emit('partner_found');
      partner.emit('partner_found');
    } else {
      waiting.push(socket);
      socket.emit('waiting_for_partner');
    }

    // Message handling
    socket.on('chat message', msg => {
      const partnerId = pairs.get(socket.id);
      if (partnerId) {
        socket.emit('chat message', { avatar: socket.avatar, msg });
        io.to(partnerId).emit('chat message', { avatar: socket.avatar, msg });
      }
    });


    // Force disconnect
    socket.on('force_disconnect', () => {
      if (socket.partner) {
        socket.to(socket.partner).emit('force_disconnect_notice');
      }
      socket.disconnect();
    });


    // Disconnection
    socket.on('disconnect', reason => {
      const idx = waiting.indexOf(socket);
      if (idx !== -1) {
        waiting.splice(idx, 1);
      }

      const partnerId = pairs.get(socket.id);
      if (partnerId) {
        const partner = io.sockets.get(partnerId);
        if (partner) {
          partner.emit('partner_disconnected');
          waiting.push(partner);
          partner.emit('waiting_for_partner');

          // Try to rematch if another user is waiting
          if (waiting.length > 1) {
            const next = waiting.shift();
            const nextPartner = waiting.shift();

            pairs.set(next.id, nextPartner.id);
            pairs.set(nextPartner.id, next.id);

            next.emit('partner_found');
            nextPartner.emit('partner_found');
          }
        }

        pairs.delete(partnerId);
      }

      pairs.delete(socket.id);
    });

  });
};
