// ---------- Ambient lights (CSS-driven) ----------
(function mountFX(){
  const root = document.getElementById('fx-root');
  if (!root) return;
  const beam1 = document.createElement('div'); beam1.className = 'fx-beam';
  const beam2 = document.createElement('div'); beam2.className = 'fx-beam b2';
  const beam3 = document.createElement('div'); beam3.className = 'fx-beam b3';
  const orb1 = document.createElement('div'); orb1.className = 'fx-orb'; orb1.style.left='10%'; orb1.style.top='18%';
  const orb2 = document.createElement('div'); orb2.className = 'fx-orb o2';
  const orb3 = document.createElement('div'); orb3.className = 'fx-orb o3';
  const orb4 = document.createElement('div'); orb4.className = 'fx-orb o4';
  root.append(beam1, beam2, beam3, orb1, orb2, orb3, orb4);
})();

// ---------- Helpers ----------
function $(id){ return document.getElementById(id); }
function md(s){
  return (s || '')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

// ---------- Elements ----------
const chat = $('chat');
const promptInput = $('prompt');
const sendBtn = $('send');
const teachToggle = $('teach-toggle');
const teachBox = $('teach');
const teachText = $('teach-text');
const teachBtn = $('teach-btn');
const usedContextPill = $('used-context');

// Guard: if any is missing, stop with a clear message
if (!chat || !promptInput || !sendBtn) {
  console.error('Critical UI elements missing. Check index.html IDs.');
}

// ---------- Chat state ----------
const messages = [
  { role:'assistant', content:'Welcome to **Carspire**! 🚗 Ask anything about cars.' }
];

function render(){
  chat.innerHTML = '';
  messages.forEach(m=>{
    const row = document.createElement('div');
    row.className = 'row ' + (m.role === 'user' ? 'end' : 'start');

    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (m.role === 'user' ? 'user' : 'ai');
    bubble.innerHTML = md(m.content);

    row.appendChild(bubble);
    chat.appendChild(row);
  });
  chat.scrollTop = chat.scrollHeight;
}
render();

function addTyping(){
  const row = document.createElement('div'); row.className = 'row start'; row.id = 'typing';
  const bubble = document.createElement('div'); bubble.className = 'bubble ai';
  bubble.innerHTML = `<div class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span>Carspire is thinking…</span></div>`;
  row.appendChild(bubble); chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
}
function clearTyping(){
  const t = $('typing'); if (t) t.remove();
}

// ---------- Actions ----------
async function send() {
  const text = (promptInput.value || '').trim();
  if (!text) return;

  messages.push({ role:'user', content:text });
  promptInput.value = '';
  render();

  addTyping();
  try {
    const r = await fetch('/api_chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ messages })
    });

    let replyText = '';
    let used = 0;
    try {
      const j = await r.json();
      if (r.ok) {
        replyText = j.reply || 'Sorry, no reply.';
        used = j.usedContext || 0;
      } else {
        replyText = j.error ? `Error: ${j.error}` : `HTTP ${r.status}`;
      }
    } catch {
      replyText = `Error: invalid JSON from server (HTTP ${r.status})`;
    }

    clearTyping();
    if (usedContextPill) {
      usedContextPill.classList.remove('hidden');
      usedContextPill.textContent = 'Used context: ' + used;
    }
    messages.push({ role:'assistant', content: replyText });
    render();
  } catch (e) {
    clearTyping();
    messages.push({ role:'assistant', content: 'Network error. Is the server running at http://localhost:5174 ?' });
    render();
  }
}

async function teach() {
  const text = (teachText.value || '').trim();
  if (!text) return;
  teachBtn.disabled = true;
  try {
    const r = await fetch('/api_learn', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ text })
    });
    const j = await r.json();
    if (r.ok && j.added) {
      teachText.value = '';
      alert('Learned ' + j.added + ' new chunk(s)!');
    } else {
      alert(j.error || 'Teach failed');
    }
  } catch {
    alert('Server unavailable');
  } finally {
    teachBtn.disabled = false;
  }
}

// ---------- Wire up events ----------
if (sendBtn) sendBtn.onclick = send;
if (promptInput) {
  promptInput.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
}
if (teachToggle && teachBox) {
  teachToggle.onclick = () => {
    const isHidden = teachBox.classList.contains('hidden');
    if (isHidden) { teachBox.classList.remove('hidden'); teachToggle.textContent = 'Hide Teach Panel'; }
    else { teachBox.classList.add('hidden'); teachToggle.textContent = 'Teach Carspire'; }
  };
}
if (teachBtn) teachBtn.onclick = teach;

// Suggested chips
document.querySelectorAll('.chip[data-q]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const q = btn.getAttribute('data-q') || '';
    promptInput.value = q;
    promptInput.focus();
  });
});
