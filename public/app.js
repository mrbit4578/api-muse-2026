// API Muse 2026 - Frontend Client Application
let currentApiKey = localStorage.getItem('muse_api_key') || '';
let currentBaseUrl = window.location.origin + '/v1';
let chatHistory = [];
let isGenerating = false;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initAuthModeToggles();
  initForms();
  initPlayground();
  checkGatewayStatus();
  loadStoredSession();
  loadAccountsList();
});

// 1. Tab Navigation
function initTabs() {
  const tabLinks = document.querySelectorAll('.tab-link');
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('data-tab');
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-link').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'tab-accounts') {
    loadAccountsList();
  }
}

// 2. Auth Mode Toggles
function initAuthModeToggles() {
  const btnCreds = document.getElementById('btnModeCreds');
  const btnCookie = document.getElementById('btnModeCookie');
  const formCreds = document.getElementById('formCredentials');
  const formCookie = document.getElementById('formCookie');

  btnCreds.addEventListener('click', () => {
    btnCreds.classList.add('active');
    btnCookie.classList.remove('active');
    formCreds.style.display = 'block';
    formCookie.style.display = 'none';
  });

  btnCookie.addEventListener('click', () => {
    btnCookie.classList.add('active');
    btnCreds.classList.remove('active');
    formCookie.style.display = 'block';
    formCreds.style.display = 'none';
  });
}

// 3. Forms Handling (Auto Login & Cookie Extract)
function initForms() {
  const formCreds = document.getElementById('formCredentials');
  const formCookie = document.getElementById('formCookie');

  formCreds.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value;
    const btn = document.getElementById('btnSubmitLogin');

    setButtonLoading(btn, true);
    showNotice('', '');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        handleAuthSuccess(data);
        showNotice(data.message, 'success');
      } else {
        showNotice(data.error || 'Đăng nhập không thành công', 'error');
      }
    } catch (err) {
      showNotice(`Lỗi kết nối máy chủ: ${err.message}`, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  formCookie.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cookieString = document.getElementById('inputCookieStr').value.trim();
    const btn = document.getElementById('btnSubmitCookie');

    if (!cookieString) {
      showNotice('Vui lòng dán chuỗi Cookie từ trình duyệt.', 'error');
      return;
    }

    setButtonLoading(btn, true);
    showNotice('', '');

    try {
      const res = await fetch('/api/auth/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString })
      });
      const data = await res.json();

      if (data.success) {
        handleAuthSuccess(data);
        showNotice(data.message, 'success');
      } else {
        showNotice(data.error || 'Trích xuất token thất bại', 'error');
      }
    } catch (err) {
      showNotice(`Lỗi kết nối: ${err.message}`, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function handleAuthSuccess(data) {
  currentApiKey = data.apiKey;
  localStorage.setItem('muse_api_key', currentApiKey);
  localStorage.setItem('muse_session_data', JSON.stringify(data));

  updateDashboardWithSession(data);
  loadAccountsList();
}

function updateDashboardWithSession(data) {
  const displayKey = document.getElementById('displayApiKey');
  const displayBase = document.getElementById('displayBaseUrl');
  const badge = document.getElementById('badgeActiveStatus');

  displayKey.value = data.apiKey || currentApiKey;
  displayBase.value = currentBaseUrl;

  badge.className = 'status-tag active';
  badge.textContent = `Active (${data.account?.plan || 'Pro'})`;

  // Tokens
  if (data.tokens) {
    document.getElementById('valHatchSess').textContent = data.tokens.hatch_sess || '-';
    document.getElementById('valHatchGw').textContent = data.tokens.hatch_gw || '-';
    document.getElementById('valHatchVml').textContent = data.tokens.hatch_vml || '-';
    document.getElementById('valHatchDevice').textContent = data.tokens.hatch_native_auth_device || '-';
  }

  // Integration code blocks
  updateIntegrationCodes(data.apiKey || currentApiKey);

  // Quota
  if (data.account && data.account.quota) {
    const q = data.account.quota;
    document.getElementById('quotaNumbers').textContent = `${q.remaining.toLocaleString()} / ${q.total.toLocaleString()} tokens`;
    const pct = Math.min(100, Math.round((q.used / q.total) * 100));
    document.getElementById('quotaFill').style.width = `${pct}%`;
  }
}

function updateIntegrationCodes(key) {
  const k = key || currentApiKey || 'sk-muse-your-api-key';
  const url = currentBaseUrl;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('codeNextChatUrl', url);
  setEl('codeNextChatKey', k);
  setEl('codeLobeUrl', url);
  setEl('codeLobeKey', k);
  setEl('codeCherryUrl', url);
  setEl('codeCherryKey', k);
}

function loadStoredSession() {
  const raw = localStorage.getItem('muse_session_data');
  if (raw) {
    try {
      const data = JSON.parse(raw);
      updateDashboardWithSession(data);
    } catch {
      localStorage.removeItem('muse_session_data');
    }
  } else {
    updateIntegrationCodes();
    document.getElementById('displayBaseUrl').value = currentBaseUrl;
  }
}

// 4. Status & Metric Checking
async function checkGatewayStatus() {
  const statusLabel = document.getElementById('gwStatus');
  try {
    const res = await fetch('/api/proxy-check');
    if (res.ok) {
      const data = await res.json();
      statusLabel.textContent = `Online (${data.latencyMs}ms)`;
    } else {
      statusLabel.textContent = 'Degraded';
    }
  } catch {
    statusLabel.textContent = 'Standby (Local)';
  }
}

// 5. Account Pool Management
async function loadAccountsList() {
  const tbody = document.getElementById('accountsTableBody');
  const countLabel = document.getElementById('accCount');

  try {
    const res = await fetch('/api/accounts');
    const data = await res.json();

    if (data.success && Array.isArray(data.accounts)) {
      countLabel.textContent = data.accounts.length;

      if (data.accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-muted);">Chưa có tài khoản nào được kết nối. Hãy đăng nhập tài khoản Muse ở Tab 1.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.accounts.map(acc => `
        <tr>
          <td><strong>${acc.email}</strong></td>
          <td><span class="status-tag active">${acc.plan || 'Pro'}</span></td>
          <td><code class="inline-code">${acc.apiKeyPreview}</code></td>
          <td>${acc.quota ? (acc.quota.remaining).toLocaleString() : '1,000,000'} tokens</td>
          <td><span class="dot live"></span> Sẵn sàng</td>
          <td>
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="useAccountAsActive('${acc.apiKey}')">Dùng key này</button>
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px; color: #f87171;" onclick="deleteAccount('${acc.id}')">Xóa</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.warn('Cannot load accounts pool:', e);
  }
}

async function deleteAccount(id) {
  if (!confirm('Bạn có chắc muốn xóa tài khoản này khỏi pool?')) return;
  try {
    await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    loadAccountsList();
  } catch (e) {
    alert('Lỗi: ' + e.message);
  }
}

function useAccountAsActive(apiKey) {
  currentApiKey = apiKey;
  localStorage.setItem('muse_api_key', apiKey);
  document.getElementById('displayApiKey').value = apiKey;
  updateIntegrationCodes(apiKey);
  alert('Đã chuyển sang dùng API Key này!');
}

// 6. AI Playground (Streaming Chat & Image Gen)
function initPlayground() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || isGenerating) return;

    input.value = '';
    appendChatMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    const model = document.getElementById('pgModel').value;
    const isStream = document.getElementById('pgStream').checked;

    isGenerating = true;
    const sendBtn = document.getElementById('btnSendChat');
    sendBtn.disabled = true;

    // Create assistant message container
    const assistantMsgEl = appendChatMessage('assistant', '');
    const bubble = assistantMsgEl.querySelector('.msg-bubble');

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentApiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: chatHistory,
          stream: isStream
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      if (isStream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullReply = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                fullReply += delta;
                bubble.innerHTML = renderMarkdown(fullReply);
                scrollChatToBottom();
              } catch {}
            }
          }
        }
        chatHistory.push({ role: 'assistant', content: fullReply });
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        bubble.innerHTML = renderMarkdown(content);
        chatHistory.push({ role: 'assistant', content });
        scrollChatToBottom();
      }
    } catch (err) {
      bubble.textContent = `❌ Lỗi API: ${err.message}`;
    } finally {
      isGenerating = false;
      sendBtn.disabled = false;
    }
  });
}

function appendChatMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  msg.innerHTML = `<div class="msg-bubble">${renderMarkdown(text)}</div>`;
  container.appendChild(msg);
  scrollChatToBottom();
  return msg;
}

function scrollChatToBottom() {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

function clearPlaygroundChat() {
  chatHistory = [];
  document.getElementById('chatMessages').innerHTML = `
    <div class="message system">
      <div class="msg-bubble">
        👋 Lịch sử chat đã được xóa. Hãy nhập tin nhắn bên dưới để tiếp tục.
      </div>
    </div>
  `;
}

function setPlaygroundMode(mode) {
  const btnChat = document.getElementById('btnModeChat');
  const btnImg = document.getElementById('btnModeImage');
  const paneChat = document.getElementById('pgChatPane');
  const paneImg = document.getElementById('pgImagePane');

  if (mode === 'chat') {
    btnChat.classList.add('active');
    btnImg.classList.remove('active');
    paneChat.style.display = 'flex';
    paneImg.style.display = 'none';
  } else {
    btnImg.classList.add('active');
    btnChat.classList.remove('active');
    paneChat.style.display = 'none';
    paneImg.style.display = 'flex';
  }
}

async function generateImage() {
  const promptInput = document.getElementById('imagePrompt');
  const prompt = promptInput.value.trim();
  const btn = document.getElementById('btnGenImage');
  const container = document.getElementById('imageResultContainer');

  if (!prompt) {
    alert('Vui lòng nhập mô tả ảnh (prompt)!');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang vẽ ảnh với Muse AI... ⏳';

  try {
    const res = await fetch('/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey}`
      },
      body: JSON.stringify({ prompt, n: 1 })
    });

    const data = await res.json();
    if (data.data && data.data[0]) {
      const card = document.createElement('div');
      card.className = 'image-card';
      card.innerHTML = `
        <img src="${data.data[0].url}" alt="${prompt}" loading="lazy">
        <div style="padding: 10px; font-size: 12px; color: var(--text-muted);">
          <p><strong>Prompt:</strong> ${prompt}</p>
          <a href="${data.data[0].url}" target="_blank" style="color: var(--primary); text-decoration: none; display: inline-block; margin-top: 6px;">Mở ảnh gốc ↗</a>
        </div>
      `;
      container.prepend(card);
    } else {
      alert('Không nhận được ảnh: ' + (data.error?.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Lỗi tạo ảnh: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo ảnh AI 🎨';
  }
}

// 7. Utility Functions
function copyField(elementId) {
  const input = document.getElementById(elementId);
  if (!input) return;

  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = event?.target;
    if (btn) {
      const oldText = btn.textContent;
      btn.textContent = 'Copied! ✅';
      setTimeout(() => { btn.textContent = oldText; }, 1500);
    }
  }).catch(() => {
    document.execCommand('copy');
  });
}

function toggleTokensAccordion() {
  const content = document.getElementById('tokensAccordionContent');
  const arrow = document.getElementById('accordionArrow');
  const isHidden = content.hidden;
  content.hidden = !isHidden;
  arrow.textContent = isHidden ? '▲' : '▼';
}

function showNotice(msg, type) {
  const box = document.getElementById('authNotice');
  if (!msg) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.className = `alert-box ${type}`;
  box.textContent = msg;
}

function setButtonLoading(btn, isLoading) {
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  btn.disabled = isLoading;
  if (text) text.style.opacity = isLoading ? '0.7' : '1';
  if (spinner) spinner.hidden = !isLoading;
}

function renderMarkdown(text) {
  if (!text) return '';
  // Basic markdown sanitizer and renderer for code blocks and bold
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks ```code```
  html = html.replace(/```([a-z0-9]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    return `<pre><code class="code-block">${code}</code></pre>`;
  });

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}
