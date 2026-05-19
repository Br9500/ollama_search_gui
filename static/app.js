const modelSelect = document.getElementById('model-select');
const activeModelName = document.getElementById('active-model-name');
const activeModelBadge = document.getElementById('active-model-badge');
const statusBanner = document.getElementById('status-banner');
const chatLog = document.getElementById('chat-log');
const chatScroll = document.getElementById('chat-scroll');
const messageInput = document.getElementById('message-input');
const webSearchButton = document.getElementById('web-search-button');
const thinkingButton = document.getElementById('thinking-button');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-button');

const history = [];
let webSearchEnabled = false;
let thinkingEnabled = false;

function formatModelBadge(modelName) {
  const parts = modelName.split(':');
  if (parts.length < 2) {
    return '';
  }
  return parts[1].toUpperCase();
}

function setStatus(message, isError = false) {
  if (!message) {
    statusBanner.classList.add('hidden');
    statusBanner.textContent = '';
    return;
  }

  statusBanner.classList.remove('hidden');
  statusBanner.textContent = message;
  statusBanner.className = isError
    ? 'mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'
    : 'mb-6 rounded-lg border border-white/10 bg-surface-container px-4 py-3 text-sm text-on-surface-variant';
}

function syncToggleStyles(button, enabled) {
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  const icon = button.querySelector('.material-symbols-outlined');
  const label = button.querySelector('span:last-child');

  if (enabled) {
    button.className = 'group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#7c3aed]/40 bg-[#7c3aed]/10 transition-all active:scale-95 hover:bg-[#7c3aed]/20';
    icon.className = 'material-symbols-outlined text-[18px] text-[#7c3aed]';
    icon.style.fontVariationSettings = '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24';
    label.className = 'text-[12px] font-mono text-on-surface';
    return;
  }

  button.className = 'group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:border-[#7c3aed]/50 transition-all active:scale-95';
  icon.className = 'material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary';
  icon.style.fontVariationSettings = '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24';
  label.className = 'text-[12px] font-mono text-on-surface-variant group-hover:text-on-surface';
}

function renderMessage(role, text, meta = {}) {
  if (role === 'user') {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-end w-full group';

    const bubble = document.createElement('div');
    bubble.className = 'max-w-[85%] bg-[#7c3aed] text-white px-6 py-4 rounded-lg shadow-sm transition-all duration-300';

    const paragraph = document.createElement('p');
    paragraph.className = 'text-base whitespace-pre-wrap';
    paragraph.textContent = text;

    const stamp = document.createElement('span');
    stamp.className = 'text-[10px] text-on-surface-variant mt-2 font-mono uppercase tracking-[0.16em]';
    stamp.textContent = `Sent ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    bubble.append(paragraph);
    wrapper.append(bubble, stamp);
    chatLog.append(wrapper);
  } else {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-start w-full gap-4';

    const head = document.createElement('div');
    head.className = 'flex items-center gap-3';
    head.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-[#7c3aed] flex items-center justify-center">
        <span class="material-symbols-outlined text-[14px] text-white">smart_toy</span>
      </div>
      <span class="text-sm font-semibold text-on-surface-variant tracking-tight">${activeModelName.textContent}</span>
    `;

    const body = document.createElement('div');
    body.className = 'w-full border-l-2 border-[#7c3aed]/30 pl-6 space-y-4';

    if (meta.thinking) {
      const thinking = document.createElement('div');
      thinking.className = 'rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant/50';
      thinking.innerHTML = `
        <div class="bg-surface-container-high px-4 py-2 border-b border-outline-variant/30">
          <span class="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest">Thinking</span>
        </div>
      `;
      const pre = document.createElement('pre');
      pre.className = 'p-6 font-code text-[13px] overflow-x-auto custom-scrollbar leading-relaxed whitespace-pre-wrap text-tertiary';
      pre.textContent = meta.thinking;
      thinking.append(pre);
      body.append(thinking);
    }

    const paragraph = document.createElement('p');
    paragraph.className = 'text-[18px] leading-relaxed whitespace-pre-wrap text-on-surface';
    paragraph.textContent = text;
    body.append(paragraph);

    if (meta.webContext) {
      const note = document.createElement('pre');
      note.className = 'rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant/50 p-6 font-code text-[13px] overflow-x-auto custom-scrollbar leading-relaxed whitespace-pre-wrap text-on-surface-variant';
      note.textContent = meta.webContext;
      body.append(note);
    }

    wrapper.append(head, body);
    chatLog.append(wrapper);
  }

  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function resetConversation() {
  history.length = 0;
  chatLog.innerHTML = '';
  setStatus('');
  messageInput.focus();
}

function updateActiveModel() {
  const selected = modelSelect.value || 'No model';
  activeModelName.textContent = selected;
  const badge = formatModelBadge(selected);
  activeModelBadge.textContent = badge;
  activeModelBadge.classList.toggle('hidden', !badge);
}

async function loadModels() {
  setStatus('Loading models...');
  modelSelect.innerHTML = '';

  try {
    const response = await fetch('/api/models');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load models.');
    }

    if (!data.models.length) {
      throw new Error('No local Ollama models found.');
    }

    for (const model of data.models) {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.name;
      modelSelect.append(option);
    }

    updateActiveModel();
    setStatus(`Loaded ${data.models.length} model(s).`);
  } catch (error) {
    activeModelName.textContent = 'No model';
    activeModelBadge.classList.add('hidden');
    setStatus(error.message, true);
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  const model = modelSelect.value;

  if (!message || !model) {
    return;
  }

  renderMessage('user', message);
  history.push({ role: 'user', content: message });
  messageInput.value = '';
  sendButton.disabled = true;
  setStatus('Waiting for Ollama...');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        message,
        history,
        enableWebSearch: webSearchEnabled,
        think: thinkingEnabled ? true : false,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Chat request failed.');
    }

    const reply = data.reply || '(No response content)';
    renderMessage('assistant', reply, {
      thinking: data.thinking || '',
      webContext: data.webContext || '',
    });
    history.push({ role: 'assistant', content: reply });
    setStatus('Response received.');
  } catch (error) {
    renderMessage('assistant', `Error: ${error.message}`);
    setStatus(error.message, true);
  } finally {
    sendButton.disabled = false;
    messageInput.focus();
  }
}

webSearchButton.addEventListener('click', () => {
  webSearchEnabled = !webSearchEnabled;
  syncToggleStyles(webSearchButton, webSearchEnabled);
});

thinkingButton.addEventListener('click', () => {
  thinkingEnabled = !thinkingEnabled;
  syncToggleStyles(thinkingButton, thinkingEnabled);
});

newChatButton.addEventListener('click', resetConversation);
modelSelect.addEventListener('change', updateActiveModel);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

syncToggleStyles(webSearchButton, webSearchEnabled);
syncToggleStyles(thinkingButton, thinkingEnabled);
loadModels();
