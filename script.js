/* =====================================================
   L'ORÉAL AI BEAUTY ADVISOR
   ===================================================== */

// Cloudflare Worker URL
const WORKER_URL = "https://loreal-beauty-advisor.rsanch92.workers.dev/";

// Chat settings
const STORAGE_KEY = "loreal-chat-history";
const MAX_MESSAGES = 24;

/* DOM ELEMENTS */

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const suggestions = document.querySelectorAll(".suggestion");

// Update copyright year
document.getElementById("currentYear").textContent = new Date().getFullYear();

// Logo fallback
document.getElementById("brandLogo").addEventListener("error", () => {
  document.getElementById("brandLogo").hidden = true;
  document.getElementById("brandFallback").hidden = false;
});

/* WELCOME MESSAGE */

const welcomeMessage =
  "Hi there! ✨ I'm your L'Oréal Beauty Advisor. " +
  "Tell me about your skin type, hair goals, or the products " +
  "you're looking for, and I'll help you build your perfect routine!";

/* CONVERSATION HISTORY */

let conversation = loadHistory();
let isSending = false;

// Load previous messages
function loadHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(saved)) return [];

    return saved
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string",
      )
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

// Save conversation
function saveHistory() {
  conversation = conversation.slice(-MAX_MESSAGES);

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
  } catch {
    console.warn("Could not save conversation.");
  }
}

/* DISPLAY MESSAGES */

function addMessage(text, role, isError = false) {
  const message = document.createElement("div");

  message.className = `message message--${role}`;

  if (isError) {
    message.classList.add("message--error");
  }

  // Create avatar
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Y" : "L";
  avatar.setAttribute("aria-hidden", "true");

  // Create message container
  const body = document.createElement("div");
  body.className = "message-body";

  // Display sender
  const name = document.createElement("p");
  name.className = "message-name";
  name.textContent = role === "user" ? "You" : "L'Oréal Advisor";

  // Display text
  const content = document.createElement("p");
  content.className = "message-text";
  content.textContent = text;

  // Add elements
  body.appendChild(name);
  body.appendChild(content);

  message.appendChild(avatar);
  message.appendChild(body);

  chatWindow.appendChild(message);

  // Scroll to newest message
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return message;
}

/* TYPING ANIMATION */

function showTyping() {
  const message = addMessage("", "assistant");

  const content = message.querySelector(".message-text");

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.setAttribute("aria-label", "AI is typing");

  for (let i = 0; i < 3; i++) {
    dots.appendChild(document.createElement("span"));
  }

  content.appendChild(dots);

  return message;
}

/* INITIALIZE CHAT */

function startChat() {
  chatWindow.innerHTML = "";

  // Welcome message
  addMessage(welcomeMessage, "assistant");

  // Restore conversation
  conversation.forEach((message) => {
    addMessage(message.content, message.role);
  });
}

/* LOADING STATE */

function setBusy(busy) {
  isSending = busy;

  sendBtn.disabled = busy;
  userInput.disabled = busy;
  clearChatBtn.disabled = busy;

  suggestions.forEach((button) => {
    button.disabled = busy;
  });
}

/* SEND MESSAGE TO OPENAI */

async function sendQuestion(question) {
  const text = question.trim();

  if (!text || isSending) return;

  // Save the user's message
  conversation.push({
    role: "user",
    content: text,
  });

  saveHistory();

  // Display the user's question
  addMessage(text, "user");

  // Clear input
  userInput.value = "";

  // Disable controls while processing
  setBusy(true);

  // Show typing animation
  const typing = showTyping();

  try {
    // Send conversation to Cloudflare Worker
    const response = await fetch(WORKER_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        messages: conversation.slice(-18),
      }),
    });

    // Read response
    const data = await response.json();

    // Handle errors
    if (!response.ok) {
      throw new Error(data.error || "Unable to connect to the AI.");
    }

    // Extract OpenAI message
    const aiResponse = data.choices[0].message.content;

    if (!aiResponse) {
      throw new Error("The AI returned an empty response.");
    }

    // Save AI message
    conversation.push({
      role: "assistant",
      content: aiResponse,
    });

    saveHistory();

    // Remove typing indicator
    typing.remove();

    // Display AI response
    addMessage(aiResponse, "assistant");
  } catch (error) {
    typing.remove();

    // Display error
    addMessage(
      error.message || "Something went wrong. Please try again.",
      "assistant",
      true,
    );

    console.error("Chatbot error:", error);
  } finally {
    // Re-enable controls
    setBusy(false);
    userInput.focus();
  }
}

/* HANDLE FORM SUBMISSION */

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  sendQuestion(userInput.value);
});

/* SUGGESTED QUESTIONS */

suggestions.forEach((button) => {
  button.addEventListener("click", () => {
    sendQuestion(button.dataset.question);
  });
});

/* NEW CHAT BUTTON */

clearChatBtn.addEventListener("click", () => {
  if (isSending) return;

  // Clear conversation
  conversation = [];

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn("Could not clear chat history.");
  }

  // Restart chatbot
  startChat();

  userInput.value = "";
  userInput.focus();
});

/* START APPLICATION */

startChat();
