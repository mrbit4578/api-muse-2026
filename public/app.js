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

  const dramaKeyEl = document.getElementById('dramaBoundApiKey');
  if (dramaKeyEl && data.apiKey) {
    dramaKeyEl.textContent = `${data.apiKey.slice(0, 14)}...`;
    dramaKeyEl.title = data.apiKey;
  }

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


// ========================================================
// 🎬 VIETNAMESE DRAMA MUSE STUDIO PIPELINE CONTROLLER
// ========================================================
let currentDramaProduction = null;
let currentRecordedVideoBlob = null;
let isPipelineRunning = false;
let canvasAnimId = null;
let isCanvasPlaying = false;
let currentSceneIndex = 0;
let sceneTimeElapsed = 0;

const DRAMA_IDEAS_POOL = [
  "Chàng rể lái xe ôm công nghệ bị cả dòng họ vợ sỉ nhục trong tiệc mừng thọ, thực chất là người thừa kế duy nhất của đế chế nghìn tỷ.",
  "Cô con dâu nghèo bị mẹ chồng ép ký giấy từ con và đuổi đi trong đêm mưa, 3 năm sau trở lại với tư cách Chủ tịch tập đoàn mua lại toàn bộ công ty gia đình chồng.",
  "Người mẹ đơn thân nhặt ve chai nuôi con trai vào đại học, ngày cưới con lại bị mẹ vợ cấm không cho bước vào sảnh chính nhà hàng.",
  "Nữ chủ tịch giả danh nhân viên tập sự để thử lòng vị hôn phu, vạch trần bộ mặt thật của kẻ bắt cá hai tay ngay trước thềm đám cưới.",
  "Hai chị em sinh đôi bị tráo đổi số phận từ nhỏ ở vùng quê nghèo, sau 20 năm gặp lại tại phiên tòa phân chia thừa kế nghìn tỷ."
];

function goToDramaStudioWithKey() {
  switchTab('tab-drama');
  const dramaKeyEl = document.getElementById('dramaBoundApiKey');
  if (dramaKeyEl && currentApiKey) {
    dramaKeyEl.textContent = `${currentApiKey.slice(0, 14)}...`;
    dramaKeyEl.title = currentApiKey;
  }
  const ideaEl = document.getElementById('dramaIdea');
  if (ideaEl && !ideaEl.value.trim()) {
    suggestDramaIdeas();
  }
}

function suggestDramaIdeas() {
  const randomIdea = DRAMA_IDEAS_POOL[Math.floor(Math.random() * DRAMA_IDEAS_POOL.length)];
  const el = document.getElementById('dramaIdea');
  if (el) el.value = randomIdea;
}

function switchDramaSubtab(tabId) {
  document.querySelectorAll('.drama-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(tabId));
  });
  document.querySelectorAll('.drama-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

function updatePipelineStep(stepNumber, state) {
  const el = document.getElementById(`step${stepNumber}`);
  if (!el) return;
  el.classList.remove('active', 'completed');
  if (state === 'active') {
    el.classList.add('active');
  } else if (state === 'completed') {
    el.classList.add('completed');
    const icon = el.querySelector('.step-icon');
    if (icon) icon.textContent = '✓';
  }
  const label = document.getElementById('pipelineProgressLabel');
  if (label && state === 'completed') {
    label.textContent = `${stepNumber} / 7 Hoàn tất`;
  }
}

async function startDramaFullPipeline() {
  if (isPipelineRunning) return;

  const idea = document.getElementById('dramaIdea')?.value.trim() || DRAMA_IDEAS_POOL[0];
  const genre = document.getElementById('dramaGenre')?.value || 'Tổng tài ngầm / Bí mật thân phận';
  const durationMinutes = parseInt(document.getElementById('dramaDuration')?.value || '5', 10);
  const narratorAccent = document.getElementById('dramaAccent')?.value || 'Nam Bắc Bộ 45 tuổi';
  const ending = document.getElementById('dramaEnding')?.value || 'Nhân quả xứng đáng';

  const btn = document.getElementById('btnStartPipeline');
  const btnText = document.getElementById('btnPipelineText');

  isPipelineRunning = true;
  btn.disabled = true;
  btnText.textContent = 'Đang sản xuất phim Drama... ⏳';

  // Reset steps
  for (let s = 1; s <= 7; s++) {
    const el = document.getElementById(`step${s}`);
    if (el) {
      el.classList.remove('active', 'completed');
      const icon = el.querySelector('.step-icon');
      if (icon) icon.textContent = String(s);
    }
  }

  try {
    // BƯỚC 1: Khởi tạo kịch bản với API Key Muse
    updatePipelineStep(1, 'active');
    
    const response = await fetch('/api/drama/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey || 'sk-muse-default'}`
      },
      body: JSON.stringify({
        idea,
        genre,
        durationMinutes,
        narratorAccent,
        ending,
        apiKey: currentApiKey
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Lỗi HTTP ${response.status}`);
    }

    const data = await response.json();
    currentDramaProduction = data;
    updatePipelineStep(1, 'completed');

    // BƯỚC 2: Tối ưu 20+ Prompts Muse IVS
    updatePipelineStep(2, 'active');
    renderDramaPrompts(data.prompts || []);
    renderDramaStory(data.title, data.storyMarkdown);
    await delay(400);
    updatePipelineStep(2, 'completed');

    // BƯỚC 3: Tạo phụ đề chuẩn SRT millisecond
    updatePipelineStep(3, 'active');
    renderDramaSubtitles(data.srtContent || '');
    await delay(400);
    updatePipelineStep(3, 'completed');

    // BƯỚC 4: Vẽ ảnh Storyboard Keyframes (qua Muse Image API)
    updatePipelineStep(4, 'active');
    await renderDramaStoryboard(data.scenes || []);
    updatePipelineStep(4, 'completed');

    // BƯỚC 5: Lồng tiếng AI Voice
    updatePipelineStep(5, 'active');
    renderDramaVoiceTracks(data.scenes || []);
    await delay(500);
    updatePipelineStep(5, 'completed');

    // BƯỚC 6: Dựng phim & Ghép hiệu ứng Ken Burns
    updatePipelineStep(6, 'active');
    await composeAndRenderVideo(data.scenes || []);
    updatePipelineStep(6, 'completed');

    // BƯỚC 7: Xuất bản Video Thành Phẩm
    updatePipelineStep(7, 'completed');
    switchDramaSubtab('dsub-video');
    alert(`🎉 Chúc mừng! Bộ phim drama "${data.title}" đã được sản xuất và xuất bản video thành công!`);

  } catch (err) {
    alert('Lỗi sản xuất phim: ' + err.message);
  } finally {
    isPipelineRunning = false;
    btn.disabled = false;
    btnText.textContent = '🚀 TẠO PHIM DRAMA TRỌN GÓI';
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Render subtab contents
function renderDramaPrompts(prompts) {
  const countEl = document.getElementById('dramaPromptsCount');
  if (countEl) countEl.textContent = `${prompts.length} Prompts Muse AI chuẩn IVS`;
  const listEl = document.getElementById('dramaPromptsList');
  if (!listEl) return;

  listEl.innerHTML = prompts.map((p, idx) => `
    <div class="prompt-item">
      <button type="button" class="btn-copy-mini" onclick="copyPromptItem(${idx})">Copy</button>
      <div id="drama_p_${idx}">${p}</div>
    </div>
  `).join('');
}

function copyPromptItem(idx) {
  const el = document.getElementById(`drama_p_${idx}`);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    alert(`Đã copy Prompt ${idx + 1}!`);
  });
}

function copyAllDramaPrompts() {
  if (!currentDramaProduction || !currentDramaProduction.prompts) return;
  navigator.clipboard.writeText(currentDramaProduction.prompts.join('\n\n')).then(() => {
    alert(`Đã copy toàn bộ ${currentDramaProduction.prompts.length} prompts Muse AI!`);
  });
}

function renderDramaStory(title, markdown) {
  const titleEl = document.getElementById('dramaStoryTitle');
  const textEl = document.getElementById('dramaStoryMarkdown');
  if (titleEl) titleEl.textContent = title || 'Kịch bản Drama';
  if (textEl) textEl.value = markdown || '';
}

function renderDramaSubtitles(srtText) {
  const el = document.getElementById('dramaSrtText');
  if (el) el.value = srtText || '';
}

function downloadSrtDirect() {
  const srt = document.getElementById('dramaSrtText')?.value;
  if (!srt) return alert('Chưa có nội dung phụ đề!');
  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentDramaProduction?.title || 'drama'}_subtitles.srt`;
  a.click();
}

async function renderDramaStoryboard(scenes) {
  const countEl = document.getElementById('sbCount');
  const gridEl = document.getElementById('dramaStoryboardGrid');
  if (countEl) countEl.textContent = `${scenes.length} hình ảnh phân cảnh`;
  if (!gridEl) return;

  gridEl.innerHTML = scenes.map(s => `
    <div class="sb-card">
      <div class="sb-img-wrapper">
        <span class="sb-badge">Clip ${s.clipNumber}</span>
        <img src="${s.imageUrl}" alt="Phân cảnh ${s.clipNumber}" loading="lazy">
      </div>
      <div class="sb-content">
        <div class="sb-scene-title">${s.sceneName}</div>
        <div class="sb-voice-preview">"${s.narration.slice(0, 45)}..."</div>
      </div>
    </div>
  `).join('');
}

function renderDramaVoiceTracks(scenes) {
  const listEl = document.getElementById('dramaVoiceList');
  if (!listEl) return;

  listEl.innerHTML = scenes.map(s => `
    <div class="voice-track-item">
      <div class="voice-track-info">
        <span class="voice-actor-tag">🎙️ NARRATOR_001 (MC Lời bình) - Phân cảnh ${s.clipNumber}</span>
        <span class="voice-track-text">"${s.narration}"</span>
        ${s.dialogue ? `<span class="voice-actor-tag" style="color: #38bdf8; margin-top: 4px;">💬 ${s.dialogueOwner} (Thoại): "${s.dialogue}"</span>` : ''}
      </div>
      <button type="button" class="btn-player" onclick="speakText('${escapeQuotes(s.narration + ' ' + (s.dialogue || ''))}')">
        🔊 Nghe thử
      </button>
    </div>
  `).join('');
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'vi-VN';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

function speakAllScenesSequentially() {
  if (!currentDramaProduction || !currentDramaProduction.scenes) return;
  const fullText = currentDramaProduction.scenes.map(s => s.narration + '. ' + (s.dialogue ? s.dialogueOwner + ' nói: ' + s.dialogue : '')).join('. ');
  speakText(fullText);
}

// ========================================================
// 🎬 CINEMATIC VIDEO COMPOSER & MEDIA RECORDER ENGINE
// ========================================================
async function composeAndRenderVideo(scenes) {
  const canvas = document.getElementById('dramaCanvas');
  const videoOverlay = document.getElementById('videoOverlayEmpty');
  const videoPlayer = document.getElementById('renderedVideoPlayer');
  const downloadBtn = document.getElementById('btnDownloadVideo');
  if (!canvas) return;

  if (videoOverlay) videoOverlay.style.display = 'none';

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Pre-load images
  const loadedImages = [];
  for (const s of scenes.slice(0, 10)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = s.imageUrl;
    await new Promise(r => {
      img.onload = () => r();
      img.onerror = () => r();
    });
    loadedImages.push({ img, scene: s });
  }

  // Setup MediaRecorder
  let recordedChunks = [];
  let stream = canvas.captureStream(30);
  let mediaRecorder = null;
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
  } catch {
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      console.warn('MediaRecorder not fully supported');
    }
  }

  if (mediaRecorder) {
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      currentRecordedVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      if (videoPlayer) {
        videoPlayer.src = URL.createObjectURL(currentRecordedVideoBlob);
        videoPlayer.style.display = 'block';
        canvas.style.display = 'none';
      }
      if (downloadBtn) downloadBtn.disabled = false;
    };
    mediaRecorder.start();
  }

  // Animate scenes on Canvas (Ken Burns Zoom + Subtitles Overlay)
  const durationPerSceneMs = 3000; // 3 seconds preview per scene for instant rendering
  const totalScenes = loadedImages.length;
  let startTime = performance.now();

  function drawFrame(currentTime) {
    const elapsed = currentTime - startTime;
    const sceneIdx = Math.min(totalScenes - 1, Math.floor(elapsed / durationPerSceneMs));
    const sceneProgress = (elapsed % durationPerSceneMs) / durationPerSceneMs;
    const current = loadedImages[sceneIdx];

    if (!current) return;

    // 1. Draw Image with Ken Burns Zoom (1.0 -> 1.1)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    if (current.img && current.img.complete && current.img.naturalWidth > 0) {
      const scale = 1.0 + sceneProgress * 0.1;
      const sw = width * scale;
      const sh = height * scale;
      const sx = -(sw - width) / 2;
      const sy = -(sh - height) / 2;
      ctx.drawImage(current.img, sx, sy, sw, sh);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Cinematic Vignette & Bottom Gradient
    const gradient = ctx.createLinearGradient(0, height - 200, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - 200, width, 200);

    // 3. Draw Subtitles
    const subtitleText = sceneProgress < 0.6 ? current.scene.narration : (current.scene.dialogue ? `[${current.scene.dialogueOwner}]: "${current.scene.dialogue}"` : current.scene.narration);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Subtitle background pill
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(subtitleText, width / 2, height - 40);

    ctx.fillStyle = sceneProgress < 0.6 ? '#fef08a' : '#ffffff';
    ctx.fillText(subtitleText, width / 2, height - 40);

    // 4. Clip watermarking badge
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`PROMPT ${String(current.scene.clipNumber).padStart(3, '0')} | VIETNAMESE DRAMA MUSE PRO`, 30, 45);

    // Update time tracker
    const timeTrackEl = document.getElementById('videoTimeTrack');
    if (timeTrackEl) {
      const curSec = Math.floor(elapsed / 1000);
      const totalSec = Math.floor((totalScenes * durationPerSceneMs) / 1000);
      timeTrackEl.textContent = `00:${String(curSec).padStart(2, '0')} / 00:${String(totalSec).padStart(2, '0')}`;
    }

    if (elapsed < totalScenes * durationPerSceneMs) {
      canvasAnimId = requestAnimationFrame(drawFrame);
    } else {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }
  }

  canvasAnimId = requestAnimationFrame(drawFrame);
}

function toggleCanvasPlay() {
  const videoPlayer = document.getElementById('renderedVideoPlayer');
  const icon = document.getElementById('playIconText');
  if (videoPlayer && videoPlayer.style.display !== 'none') {
    if (videoPlayer.paused) {
      videoPlayer.play();
      if (icon) icon.textContent = '⏸️ Tạm Dừng';
    } else {
      videoPlayer.pause();
      if (icon) icon.textContent = '▶️ Phát Video';
    }
  } else if (currentDramaProduction && currentDramaProduction.scenes) {
    composeAndRenderVideo(currentDramaProduction.scenes);
  }
}

function downloadRenderedVideo() {
  if (!currentRecordedVideoBlob) return alert('Chưa có video được render!');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(currentRecordedVideoBlob);
  a.download = `${currentDramaProduction?.title || 'vietnamese_drama'}.webm`;
  a.click();
}

function downloadAllDramaAssets() {
  if (!currentDramaProduction) return alert('Chưa có dự án phim nào được sản xuất!');

  const fullData = {
    title: currentDramaProduction.title,
    metadata: currentDramaProduction.metadata,
    prompts: currentDramaProduction.prompts,
    srtSubtitles: currentDramaProduction.srtContent,
    storyMarkdown: currentDramaProduction.storyMarkdown,
    scenes: currentDramaProduction.scenes
  };

  const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentDramaProduction.title}_production_package.json`;
  a.click();
  alert('Đã tải trọn bộ hồ sơ sản xuất phim Drama (.json)! Bạn có thể tải thêm file .SRT và .WEBM ở các nút bên cạnh.');
}
