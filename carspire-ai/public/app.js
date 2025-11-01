// -------------------------
// CONFIG
// -------------------------
// If you have a backend, put its URL here (must include https://).
// For now this will fall back to a local "fake answer" if left empty.
const BACKEND_URL = ""; // e.g., "https://carspire-backend.onrender.com/api/chat"

// -------------------------
// BASIC CHAT WIRES
// -------------------------
const chat = document.getElementById("chat");
const form = document.getElementById("ask");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("send");

// initial welcome
addBot("Hi! I’m Carspire. Ask me anything about cars—oil, tires, brakes, EVs, buying advice.");

// Submit handler
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = (promptInput.value || "").trim();
  if (!text) return;

  addUser(text);
  promptInput.value = "";
  setLoading(true);

  try {
    const answer = BACKEND_URL ? await callBackend(text) : await localAnswer(text);
    addBot(answer);
  } catch (err) {
    addBot(`Sorry, I couldn't process that.`, true);
    console.error(err);
  } finally {
    setLoading(false);
  }
});

// -------------------------
// RENDER HELPERS
// -------------------------
function addUser(content){
  addMsg("user", content);
}
function addBot(content, isError=false){
  addMsg("bot", content, isError);
}
function addMsg(role, content, isError=false){
  const div = document.createElement("div");
  div.className = `msg ${role}${isError ? " error" : ""}`;
  div.innerText = content;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function setLoading(state){
  sendBtn.disabled = state;
  promptInput.disabled = state;
  chat.classList.toggle("loading", state);
}

// -------------------------
// BACKEND CALL (optional)
// -------------------------
async function callBackend(prompt){
  // Adjust the payload to match your backend.
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>res.statusText);
    throw new Error(`HTTP ${res.status} – ${text}`);
  }
  const data = await res.json();
  // Expect { reply: "..." } or similar
  return data.reply || data.answer || JSON.stringify(data);
}

// -------------------------
// OFFLINE / DEMO ANSWERS
// -------------------------
async function localAnswer(q){
  // tiny fake "AI" so the UI works on GitHub Pages
  const s = q.toLowerCase();
  if (s.includes("oil")) {
    return "Use the grade/spec in your owner’s manual (e.g., 0W-20 API SP). Change on time, not just mileage.";
  }
  if (s.includes("brake")) {
    return "Squeal often means glazing or worn pads. Check pad thickness and consider new shims/grease; warped rotors cause vibration when braking.";
  }
  if (s.includes("tire") || s.includes("pressure")) {
    return "Check cold pressures monthly (incl. spare). Rotate every 8–10k km; cross for non-directional tires.";
  }
  if (s.includes("ev") || s.includes("battery")) {
    return "Precondition before fast charging. Keep SOC between ~10–80% day-to-day for longevity.";
  }
  return "Here’s my general take: give me your car model/year and the symptom; I’ll give exact steps, specs, and parts to check.";
}
