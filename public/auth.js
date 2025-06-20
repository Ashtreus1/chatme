const EMOJIS = ["😀", "😂", "😎", "😍", "🤔", "🙃", "👍", "🎉", "🚀", "🐶", "🐱"];
const emojiPick = document.getElementById('emoji-pick');
const registerBtn = document.getElementById('register-btn');
const emojiInput = document.getElementById('emoji-input');
const loginBtn = document.getElementById('login-btn');

let picks = [];

// Emoji-only regex (match emoji Unicode characters)
const emojiOnlyRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u;

function renderEmojiPicker() {
  emojiPick.innerHTML = '';
  picks = [];

  EMOJIS.forEach(e => {
    const btn = document.createElement('button');
    btn.textContent = e;
    btn.className = "text-3xl emoji-btn";
    btn.onclick = () => {
      if (btn.classList.contains('opacity-50')) {
        btn.classList.remove('opacity-50');
        picks = picks.filter(p => p !== e);
      } else if (picks.length < 3) {
        btn.classList.add('opacity-50');
        picks.push(e);
      }

      registerBtn.disabled = picks.length !== 3;
    };
    emojiPick.appendChild(btn);
  });
}

registerBtn.onclick = () => {
  const combo = picks.join('');
  fetch('/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ combo, mode: 'register' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      register_modal.close();
      emojiInput.value = combo;
      loginBtn.disabled = false;
      login_modal.showModal();
    } else {
      alert(data.error || 'Failed to register.');
    }
  });
};

// Only allow emoji characters on input
emojiInput?.addEventListener('input', () => {
  const input = emojiInput.value;
  const isValid = emojiOnlyRegex.test(input);

  if (!isValid) {
    emojiInput.classList.add('border-red-500');
    loginBtn.disabled = true;
  } else {
    emojiInput.classList.remove('border-red-500');
    loginBtn.disabled = input.length < 3;
  }
});

loginBtn.onclick = () => {
  const combo = emojiInput.value;
  if (!emojiOnlyRegex.test(combo)) {
    alert("Please enter only emojis (no letters, numbers, or symbols).");
    return;
  }

  fetch('/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ combo, mode: 'login' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      sessionStorage.setItem('sessionId', data.sessionId);
      sessionStorage.setItem('avatar', data.avatar);
      window.location.href = '/chat';
    } else {
      alert(data.error || 'Invalid emoji combo.');
    }
  });
};

const registerModal = document.getElementById('register_modal');
if (registerModal) {
  registerModal.addEventListener('close', renderEmojiPicker);
}

renderEmojiPicker();
