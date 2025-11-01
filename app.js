// ----- Ambient lights (CSS-driven) -----
(function mountFX(){
  const root = document.getElementById('fx-root');
  const beam1 = document.createElement('div'); beam1.className = 'fx-beam';
  const beam2 = document.createElement('div'); beam2.className = 'fx-beam b2';
  const beam3 = document.createElement('div'); beam3.className = 'fx-beam b3';
  const orb1 = document.createElement('div'); orb1.className = 'fx-orb'; orb1.style.left='10%'; orb1.style.top='18%';
  const orb2 = document.createElement('div'); orb2.className = 'fx-orb o2';
  const orb3 = document.createElement('div'); orb3.className = 'fx-orb o3';
  const orb4 = document.createElement('div'); orb4.className = 'fx-orb o4';
  root.append(beam1, beam2, beam3, orb1, orb2, orb3, orb4);
})();

// ----- UI elements -----
const chat = document.getElementById('chat');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send');
const teachToggle = document.getElementById('teach-toggle');
const teachBox = document.getElementById('teach');
const teachText = document.getElementById('teach-text');
const teachBtn = document.getElementById('teach-btn');
const usedContextPill = document.getElementById('used-context');

// Logo bits
const logoImg = document.getElementById('logo');
const logoPh = document.getElementById('logo-placeholder');
const logoBtn = document.getElementById('logo-choose');
const logoInput = document.getElementById('logo-input');

// Restore saved logo
const savedLogo = localStorage.getItem('carspire_logo');
if (savedLogo) {
  logoImg.src = savedLogo; logoImg.classList.remove('hidden'); logoPh.classList.add('hidden');
}

logoBtn.onclick = () => logoInput.click();
logoInput.onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  logoImg.src = url;
  logoImg.classList.remove('hidden');
  logoPh.classList.add('hidden');
  localStorage.setItem('carspire_logo', url);
};

// Sample chips
document.querySelectorAll('.chip[data-q]').forEach(btn=>{
  btn.onclick = () => { promptInput.value = btn.getAttribute('data-q'); promptInput.focus(); };
});

// Teach panel
teachToggle.onclick = () => {
  const open = teachBox.classList.contains('hidden');
  if (open) { teachBox.classList.remove('hidden'); teachToggle.textContent = 'Hide Teach Panel'; }
  else { teachBox.classList.add('hidden'); teachToggle.textContent = 'Teach Carspire'; }
};
teachBtn.onclick = async () => {
  const text = (teachText.value || '').trim();
  if (!text) return;
  teachBtn.disabled = true;
  try {
    const r = await fetch('/api_learn', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
    const j = await r.json();
    if (j.added) {
      teachText.value = '';
      alert('Learned ' + j.added + ' new chunk(s)!');
    } else {
      alert(j.error || 'Failed to learn');
    }
  } catch {
    alert('Server unavailable');
  } finally {
    teachBtn.disabled = false;
  }
};

// Chat state
const messages = [
  { role:'assistant', content:'Welcome to **Carspire**! 🚗 Ask anything about cars.' }
];

function md(s){
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}
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
  const t = document.getElementById('typing');
  if (t) t.remove();
}

async function send() {
  const text = (promptInput.value || '').trim();
  if (!text) return;
  messages.push({ role:'user', content:text });
  promptInput.value = ''; render();

  addTyping();
  try {
    const r = await fetch('/api_chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages }) });
    const j = await r.json();
    clearTyping();
    usedContextPill.classList.remove('hidden');
    usedContextPill.textContent = 'Used context: ' + (j.usedContext || 0);
    messages.push({ role:'assistant', content: j.reply || 'Sorry, no reply.' });
    render();
  } catch {
    clearTyping();
    messages.push({ role:'assistant', content:'Server unavailable. Try again.' });
    render();
  }
}

sendBtn.onclick = send;
promptInput.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
