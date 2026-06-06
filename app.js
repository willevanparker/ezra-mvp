// app.js — drives Ezra's chat: talks to /.netlify/functions/chat, renders the
// transcript, and keeps the textarea / suggestions feeling responsive.

(() => {
  'use strict';

  const ENDPOINT = '/.netlify/functions/chat';

  const messagesEl = document.getElementById('messages');
  const formEl = document.getElementById('chat-form');
  const inputEl = document.getElementById('chat-input');
  const sendEl = document.getElementById('chat-send');
  const suggestionsEl = document.getElementById('suggestions');

  // Conversation history sent to the function on every turn ({role, content}).
  const history = [];
  let waiting = false;

  const GREETING =
    "Hello, I'm Ezra. I help independent insurance agency owners think through " +
    'questions about valuation, succession, and what a sale could look like — ' +
    "confidentially and with no pressure. What's on your mind?";

  // --- Rendering ----------------------------------------------------------

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text, variant) {
    const wrap = document.createElement('div');
    wrap.className =
      'msg ' + (role === 'user' ? 'msg--user' : 'msg--ezra') +
      (variant === 'error' ? ' msg--error' : '');

    const bubble = document.createElement('div');
    bubble.className = 'msg__bubble';
    bubble.textContent = text;

    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg--ezra';
    wrap.id = 'typing-indicator';
    wrap.innerHTML =
      '<div class="msg__bubble"><span class="typing">' +
      '<span></span><span></span><span></span></span></div>';
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function hideTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  // --- Sending ------------------------------------------------------------

  function setWaiting(state) {
    waiting = state;
    sendEl.disabled = state;
    inputEl.disabled = state;
    if (!state) inputEl.focus();
  }

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || waiting) return;

    addMessage('user', content);
    history.push({ role: 'user', content });

    inputEl.value = '';
    autoResize();
    hideSuggestions();
    setWaiting(true);
    showTyping();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json().catch(() => ({}));
      hideTyping();

      if (!res.ok || !data.reply) {
        const message =
          data.error ||
          'Ezra is unavailable right now. Please try again in a moment.';
        addMessage('ezra', message, 'error');
        return;
      }

      addMessage('ezra', data.reply);
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      hideTyping();
      addMessage(
        'ezra',
        'Something interrupted the connection. Please check your network and try again.',
        'error'
      );
    } finally {
      setWaiting(false);
    }
  }

  // --- Suggestions --------------------------------------------------------

  function hideSuggestions() {
    if (suggestionsEl && suggestionsEl.children.length) {
      suggestionsEl.style.display = 'none';
    }
  }

  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      sendMessage(chip.dataset.prompt || chip.textContent);
    });
  }

  // --- Textarea behaviour -------------------------------------------------

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  }

  inputEl.addEventListener('input', autoResize);

  inputEl.addEventListener('keydown', (e) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(inputEl.value);
  });

  // --- Boot ---------------------------------------------------------------

  addMessage('ezra', GREETING);
  inputEl.focus();
})();
