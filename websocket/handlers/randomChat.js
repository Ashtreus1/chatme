const waiting = [];
const pairs = new Map();

// Simple banned words list (you can expand this)
const bannedWords = [
  "sex", "nude", "fuck", "f*ck", "dick", "boobs", "asshole", "bitch", "slut",
  "rape", "horny", "pedo", "kill", "murder", "die", "violence", "nigga", "nigger",
  "pakyu", "kantot", "potangina", "gago", "tanga", "kakainin kita"
];

// Check if a message contains banned content
function isInappropriate(msg) {
  const leetMap = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
    '@': 'a', '$': 's', '!': 'i'
  };

  // Normalize message: lowercase, replace leetspeak, remove punctuation/spaces
  let normalized = msg
    .toLowerCase()
    .replace(/[^a-z0-9@$!]/g, '') // keep leet characters
    .split('')
    .map(char => leetMap[char] || char)
    .join('');

  // Now check banned words
  return bannedWords.some(word => normalized.includes(word));
}


module.exports = function (io) {
  io.on('connection', (socket) => {
    const { sessionId, avatar } = socket.handshake.auth || {};
    socket.sessionId = sessionId;
    socket.avatar = avatar || 'Anon';

    // Try pairing up waiting users
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

    // Queue user and try to match
    socket.emit('waiting_for_partner');
    waiting.push(socket);
    tryMatch();

    // Handle chat messages
    socket.on('chat message', (msg) => {
      const partnerId = pairs.get(socket.id);
      const partnerSocket = partnerId ? socket.nsp.sockets.get(partnerId) : null;

      // Always echo back to sender
      socket.emit('chat message', { avatar: socket.avatar, msg });

      // Shadowban if message is inappropriate
      if (isInappropriate(msg)) {
        console.log(`[SHADOWBAN] ${socket.avatar || socket.id}: "${msg}" blocked`);
        return; // stop here, don't forward
      }

      // Forward to partner if appropriate
      if (partnerSocket) {
        partnerSocket.emit('chat message', { avatar: socket.avatar, msg });
      }
    });

    // Skip: force disconnect both users
    socket.on('skip', () => {
      const partnerId = pairs.get(socket.id);
      const partnerSocket = partnerId ? socket.nsp.sockets.get(partnerId) : null;

      pairs.delete(socket.id);
      if (partnerId) pairs.delete(partnerId);

      socket.emit('force_disconnect_notice');
      socket.disconnect(true);

      if (partnerSocket) {
        partnerSocket.emit('force_disconnect_notice');
        partnerSocket.disconnect(true);
      }
    });

    // Manual force disconnect
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

    // Handle unexpected disconnect
    socket.on('disconnect', () => {
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
