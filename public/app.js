let socket;
let currentMode = null;

async function setupSocket(mode) {
  try {
    currentMode = mode;

    const sessionId = sessionStorage.getItem('sessionId');
    const avatar = sessionStorage.getItem('avatar');
    if (!sessionId || !avatar) {
      alert('Missing session info. Please log in again.');
      return window.location.href = '/';
    }

    const messages = document.getElementById('messages');
    const skipBtn = document.getElementById('skipBtn');
    const input = document.getElementById('msg');
    const sendBtn = document.querySelector('button[onclick="sendMsg()"]');

    function scrollToBottom() {
      if (messages) {
        messages.scrollTop = messages.scrollHeight;
      }
    }

    function setInputEnabled(enabled) {
      input.disabled = !enabled;
      sendBtn.disabled = !enabled;

      input.classList.toggle('opacity-50', !enabled);
      sendBtn.classList.toggle('opacity-50', !enabled);
    }

    // Load history for general chat only
    if (mode === 'general') {
      try {
        const res = await fetch('/chat/general/messages');
        const data = await res.json();

        data
          .filter(({ avatar: sender }) => sender !== 'System')
          .forEach(({ avatar: sender, msg }) => {
            const isOwn = sender === avatar;
            const align = isOwn ? 'chat-end' : 'chat-start';
            const bubble = isOwn ? 'chat-bubble-info' : 'chat-bubble-neutral';

            messages.innerHTML += `
              <div class="chat ${align}">
                <div class="chat-bubble ${bubble}">
                  <span class="text-sm font-bold">${sender}</span><br/>${msg}
                </div>
              </div>
            `;
          });

        scrollToBottom();
      } catch (err) {
        console.error('Failed to load message history:', err);
      }
    }

    socket = io(`http://localhost:3001/${mode}`, {
      auth: { sessionId, avatar }
    });

    socket.on('connect', () => {
      messages.innerHTML += `
        <div class="chat chat-start">
          <div class="chat-bubble chat-bubble-accent italic text-sm text-gray-300">
            Connected to ${mode} chat
          </div>
        </div>
      `;
      scrollToBottom();
      if (skipBtn) skipBtn.textContent = 'Skip';
      setInputEnabled(true);
    });

    socket.on('disconnect', () => {
      if (mode === 'random') {
        messages.innerHTML += `
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-warning italic text-sm">
              Disconnected. Press start to find a new match.
            </div>
          </div>
        `;
        scrollToBottom();
        if (skipBtn) skipBtn.textContent = 'Start';
        setInputEnabled(false);
      }
    });

    socket.on('chat message', data => {
      const isOwn = data.avatar === avatar;
      const align = isOwn ? 'chat-end' : 'chat-start';
      const bubble =
        data.avatar === 'System'
          ? 'chat-bubble-accent italic text-sm'
          : isOwn
          ? 'chat-bubble-info'
          : 'chat-bubble-neutral';

      const content =
        data.avatar === 'System'
          ? data.msg
          : `<span class="text-sm font-bold">${data.avatar}</span><br/>${data.msg}`;

      messages.innerHTML += `
        <div class="chat ${align}">
          <div class="chat-bubble ${bubble}">
            ${content}
          </div>
        </div>
      `;
      scrollToBottom();
    });

    if (mode === 'random') {
      socket.on('waiting_for_partner', () => {
        messages.innerHTML += `
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-accent italic text-sm">Waiting for a partner...</div>
          </div>
        `;
        scrollToBottom();
      });

      socket.on('partner_found', () => {
        messages.innerHTML += `
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-success italic text-sm">Partner found! Say hi.</div>
          </div>
        `;
        scrollToBottom();
        setInputEnabled(true);
        if (skipBtn) skipBtn.textContent = 'Skip';
      });

      socket.on('partner_disconnected', () => {
        messages.innerHTML += `
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-error italic text-sm">Partner disconnected. Waiting again...</div>
          </div>
        `;
        scrollToBottom();
        setInputEnabled(false);
      });

      socket.on('force_disconnect_notice', () => {
        messages.innerHTML += `
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-warning italic text-sm">
              Disconnected. Press start to find a new match.
            </div>
          </div>
        `;
        scrollToBottom();
        setInputEnabled(false);
        if (skipBtn) skipBtn.textContent = 'Start';
      });
    }
  } catch (err) {
    console.error('Setup socket failed:', err.message);
    alert('Failed to connect to chat. Try logging in again.');
    window.location.href = '/';
  }
}

function sendMsg() {
  const input = document.getElementById('msg');
  const msg = input.value.trim();
  if (msg && socket) {
    socket.emit('chat message', msg);
    input.value = '';
  }
}

function toggleConnection() {
  const messages = document.getElementById('messages');
  const skipBtn = document.getElementById('skipBtn');

  if (socket && socket.connected) {
    socket.emit('force_disconnect');
    socket.disconnect();

    skipBtn.textContent = 'Start';

    messages.innerHTML += `
      <div class="chat chat-start">
        <div class="chat-bubble chat-bubble-warning italic text-sm">Disconnected. Press start to find a new match.</div>
      </div>
    `;

    const input = document.getElementById('msg');
    const sendBtn = document.querySelector('button[onclick="sendMsg()"]');
    input.disabled = true;
    sendBtn.disabled = true;
    input.classList.add('opacity-50');
    sendBtn.classList.add('opacity-50');
  } else {
    skipBtn.textContent = 'Skip';
    document.getElementById('messages').innerHTML = '';
    setupSocket('random');
  }
}
