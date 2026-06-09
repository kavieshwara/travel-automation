const chatLog = document.querySelector("[data-chat-log]");
const chatForm = document.querySelector("[data-chat-form]");
const sessionOutput = document.querySelector("[data-session-output]");
const customerId = "whatsapp:+919999999999";

function addBubble(text, who) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${who}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updateSession(session) {
  sessionOutput.textContent = JSON.stringify(session || {}, null, 2);
}

async function sendMessage(text) {
  addBubble(text, "customer");
  const response = await fetch("/api/simulator/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId, name: "Demo Customer", text }),
  });
  const data = await response.json();
  data.replies.forEach((reply) => addBubble(reply, "bot"));
  updateSession(data.session);
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = chatForm.elements.message;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await sendMessage(text);
});

document.querySelectorAll("[data-send]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.send));
});

document.querySelector("[data-reset]").addEventListener("click", async () => {
  await fetch("/api/simulator/session-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
  await fetch("/api/simulator/reset", { method: "POST" });
  chatLog.innerHTML = "";
  updateSession({});
});

addBubble("Use the shortcuts or type: Hi, I want to book a trip.", "bot");
