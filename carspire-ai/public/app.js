const chat = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("send");

const messages = [
  { role: "assistant", content: "Welcome to Carspire! 🚗 Ask me about cars." },
];

function render() {
  chat.innerHTML = "";
  messages.forEach((m) => {
    const div = document.createElement("div");
    div.className = "bubble " + m.role;
    div.textContent = m.content;
    chat.appendChild(div);
  });
}

async function send() {
  const text = promptInput.value.trim();
  if (!text) return;
  messages.push({ role: "user", content: text });
  render();
  promptInput.value = "";

  const res = await fetch("http://localhost:5174/api_chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json();
  messages.push({ role: "assistant", content: data.reply });
  render();
}

sendBtn.addEventListener("click", send);
render();
