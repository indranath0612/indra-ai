import { useEffect, useRef, useState } from "react";

document.body.style.margin = "0";
document.body.style.overflow = "hidden";


function App() {
  // =========================
  // STATES
  // =========================
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const [token, setToken] = useState(localStorage.getItem("token"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authMode, setAuthMode] = useState("login");

  const [speakingText, setSpeakingText] = useState(null);

  const [isListening, setIsListening] = useState(false);

  const chatEndRef = useRef(null);

  const BASE = "https://indra-ai-backend.onrender.com";

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    if (!token) return;

    const stored = JSON.parse(localStorage.getItem("sessions") || "[]");

    if (stored.length === 0) {
      createNewChat();
    } else {
      setSessions(stored);
      setActiveSession(stored[0].id);
      setMessages(stored[0].messages || []);
    }
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // =========================
  // AUTH
  // =========================
  async function authUser() {
    try {
      const endpoint = authMode === "login" ? "/login" : "/register";

      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (authMode === "register") {
        alert("Registered Successfully");
        setAuthMode("login");
        return;
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else {
        alert(data.detail || "Authentication failed");
      }
    } catch (err) {
      console.log(err);
      alert("Backend not running");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  // =========================
  // CHAT FUNCTIONS
  // =========================
  function createNewChat() {
    const newSession = {
      id: "session-" + Date.now(),
      name: "New Chat",
      messages: [],
    };

    const updated = [newSession, ...sessions];

    setSessions(updated);
    setActiveSession(newSession.id);
    setMessages([]);

    localStorage.setItem("sessions", JSON.stringify(updated));
  }

  function switchChat(id) {
    const selected = sessions.find((s) => s.id === id);

    setActiveSession(id);
    setMessages(selected?.messages || []);
  }

  function deleteChat(id) {
    const filtered = sessions.filter((s) => s.id !== id);

    if (filtered.length === 0) {
      createNewChat();
      return;
    }

    setSessions(filtered);

    setActiveSession(filtered[0].id);
    setMessages(filtered[0].messages || []);

    localStorage.setItem("sessions", JSON.stringify(filtered));
  }

  function startEdit(id, name) {
    setEditingId(id);
    setEditingText(name);
  }

  function saveEdit(id) {
    const updated = sessions.map((s) =>
      s.id === id
        ? {
            ...s,
            name: editingText || "Untitled",
          }
        : s
    );

    setSessions(updated);

    localStorage.setItem("sessions", JSON.stringify(updated));

    setEditingId(null);
  }

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage(textOverride = null) {
    const text = textOverride || input;

    if (!text.trim()) return;

    const userMessage = {
      text,
      sender: "user",
    };

    const botTyping = {
      text: "Indra AI is typing...",
      sender: "bot",
      typing: true,
    };

    const updatedMessages = [...messages, userMessage, botTyping];

    setMessages(updatedMessages);

    setInput("");

    const updatedSessions = sessions.map((s) =>
      s.id === activeSession
        ? {
            ...s,
            messages: updatedMessages,
          }
        : s
    );

    setSessions(updatedSessions);

    localStorage.setItem(
      "sessions",
      JSON.stringify(updatedSessions)
    );

    try {
      const res = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          text,
          session_id: activeSession,
        }),
      });

      const data = await res.json();

      // STREAMING EFFECT
      let streamedText = "";

      const finalMessages = [
        ...updatedMessages.filter((m) => !m.typing),
        {
          text: "",
          sender: "bot",
        },
      ];

      setMessages(finalMessages);

      for (let i = 0; i < data.reply.length; i++) {
        streamedText += data.reply[i];

        await new Promise((r) => setTimeout(r, 8));

        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1].text = streamedText;
          return [...copy];
        });
      }

      const latest = sessions.map((s) =>
        s.id === activeSession
          ? {
              ...s,
              messages: [
                ...updatedMessages.filter((m) => !m.typing),
                {
                  text: data.reply,
                  sender: "bot",
                },
              ],
            }
          : s
      );

      setSessions(latest);

      localStorage.setItem(
        "sessions",
        JSON.stringify(latest)
      );
    } catch (err) {
      console.log(err);

      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        {
          text: "Server error",
          sender: "bot",
        },
      ]);
    }
  }

  // =========================
  // VOICE INPUT
  // =========================
  function startVoice() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Use Chrome browser");
      return;
    }

    const recognition = new SpeechRecognition();

    // ✅ BETTER SETTINGS
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = "";
    let silenceTimer;

    setIsListening(true);

    recognition.start();

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      // 🔊 SHOW LIVE SPEECH
      setMessages((prev) => [
        ...prev.filter((m) => !m.listening),
        {
          text:
            "🎤 Listening: " +
            (finalTranscript + interim),
          sender: "bot",
          listening: true,
        },
      ]);

      // 🧠 RESET SILENCE TIMER
      clearTimeout(silenceTimer);

      silenceTimer = setTimeout(() => {
        recognition.stop();
      }, 1500);
    };

    recognition.onerror = (e) => {
      console.log("Speech error:", e);

      setIsListening(false);

      recognition.stop();
    };

    recognition.onend = () => {
      setIsListening(false);

      setMessages((prev) =>
        prev.filter((m) => !m.listening)
      );

      if (finalTranscript.trim()) {
        sendMessage(finalTranscript);
      } else {
        console.log("No speech detected");
      }
    };
  }

  // =========================
  // SPEAK BOT RESPONSE
  // =========================
  function speak(text) {
    if (
      speakingText === text &&
      speechSynthesis.speaking
    ) {
      speechSynthesis.cancel();
      setSpeakingText(null);
      return;
    }

    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-US";

    setSpeakingText(text);

    speech.onend = () => {
      setSpeakingText(null);
    };

    speechSynthesis.speak(speech);
  }

  // =========================
  // PDF UPLOAD
  // =========================
  async function uploadPDF(file) {
    const formData = new FormData();

    formData.append("file", file);

    setMessages((prev) => [
      ...prev,
      {
        text: "Uploading PDF...",
        sender: "bot",
      },
    ]);

    try {
      await fetch(`${BASE}/upload-pdf`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });

      setMessages((prev) => [
        ...prev,
        {
          text: "PDF uploaded successfully",
          sender: "bot",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          text: "PDF upload failed",
          sender: "bot",
        },
      ]);
    }
  }

  // =========================
  // LOGIN UI
  // =========================
  if (!token) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>
            🎙️ Indra AI
          </h1>

          <p style={styles.authSubtitle}>
            Powered by Sarvam AI
          </p>

          <input
            style={styles.authInput}
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            type="password"
            style={styles.authInput}
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button
            style={styles.authBtn}
            onClick={authUser}
          >
            {authMode === "login"
              ? "Login"
              : "Register"}
          </button>

          <p style={{ color: "#94a3b8" }}>
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </p>

          <button
            style={styles.switchBtn}
            onClick={() =>
              setAuthMode(
                authMode === "login"
                  ? "register"
                  : "login"
              )
            }
          >
            {authMode === "login"
              ? "Create Account"
              : "Go to Login"}
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // MAIN UI
  // =========================
  return (
    <div style={styles.page}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          🎙️ Indra AI
        </div>

        <div style={styles.powered}>
          Powered by Sarvam AI
        </div>

        <button
          style={styles.newChatBtn}
          onClick={createNewChat}
        >
          + New Chat
        </button>

        <div style={styles.chatList}>
          {sessions.map((s) => (
            <div
              key={s.id}
              style={{
                ...styles.chatItem,
                background:
                  activeSession === s.id
                    ? "#ececec"
                    : "transparent",
              }}
            >
              {editingId === s.id ? (
                <input
                  value={editingText}
                  autoFocus
                  style={styles.renameInput}
                  onChange={(e) =>
                    setEditingText(
                      e.target.value
                    )
                  }
                  onBlur={() =>
                    saveEdit(s.id)
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    saveEdit(s.id)
                  }
                />
              ) : (
                <div
                  style={styles.chatName}
                  onClick={() =>
                    switchChat(s.id)
                  }
                >
                  {s.name}
                </div>
              )}

              <div style={styles.actionBtns}>
                <button
                  style={styles.iconBtn}
                  onClick={() =>
                    startEdit(
                      s.id,
                      s.name
                    )
                  }
                >
                  ✏️
                </button>

                <button
                  style={styles.iconBtn}
                  onClick={() =>
                    deleteChat(s.id)
                  }
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          style={styles.logoutBtn}
          onClick={logout}
        >
          Logout
        </button>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {/* CHAT */}
        <div style={styles.chatArea}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent:
                  m.sender === "user"
                    ? "flex-end"
                    : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.message,
                  ...(m.sender === "user"
                  ? styles.userMessage
                  : styles.botMessage),
  }}
      >
              
                {m.text}

                {m.sender === "bot" &&
                  !m.typing &&
                  !m.listening && (
                    <button
                      style={
                        styles.speakBtn
                      }
                      onClick={() =>
                        speak(m.text)
                      }
                    >
                      {speakingText === m.text
                        ? "⏹️"
                       : "🔊"}
                
                    </button>
                  )}
              </div>
            </div>
          ))}

          {isListening && (
            <div style={styles.listening}>
              🎤 Listening...
            </div>
          )}

          <div ref={chatEndRef}></div>
        </div>

        {/* INPUT */}
        <div style={styles.bottomBar}>
          <input
            style={styles.input}
            placeholder="Message Indra AI..."
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === "Enter" &&
              sendMessage()
            }
          />

          <button
            style={styles.sendBtn}
            onClick={() =>
              sendMessage()
            }
          >
            ➤
          </button>

          <button
            style={styles.micBtn}
            onClick={startVoice}
          >
            🎤
          </button>

          <label style={styles.pdfBtn}>
            📄
            <input
              type="file"
              hidden
              accept=".pdf"
              onChange={(e) =>
                uploadPDF(
                  e.target.files[0]
                )
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  // =========================
  // PAGE
  // =========================

  page: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    background: "#ffffff",
    color: "#111111",
    fontFamily:
      "'Inter', 'Segoe UI', Arial, sans-serif",
    overflow: "hidden",
  },

  // =========================
  // SIDEBAR
  // =========================

  sidebar: {
    width: "300px",
    minWidth: "300px",
    background: "#f9f9f9",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRight: "1px solid #e5e5e5",
  },

  logo: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#111111",
    marginTop: "10px",
    marginBottom: "4px",
    paddingLeft: "10px",
  },

  powered: {
    color: "#666666",
    marginBottom: "20px",
    fontSize: "13px",
    paddingLeft: "12px",
  },

  newChatBtn: {
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #dcdcdc",
    background: "#ffffff",
    color: "#111111",
    cursor: "pointer",
    marginBottom: "14px",
    fontSize: "14px",
    fontWeight: "600",
  },

  chatList: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: "2px",
  },

  chatItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px",
    borderRadius: "10px",
    marginBottom: "4px",
    cursor: "pointer",
    transition: "0.2s",
  },

  chatName: {
    flex: 1,
    color: "#111111",
    fontSize: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  actionBtns: {
    display: "flex",
    gap: "6px",
  },

  iconBtn: {
    background: "#efefef",
    border: "none",
    color: "#111111",
    borderRadius: "8px",
    padding: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },

  renameInput: {
    flex: 1,
    background: "#ffffff",
    color: "#111111",
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    padding: "8px",
    fontSize: "13px",
  },

  logoutBtn: {
    padding: "13px",
    borderRadius: "12px",
    border: "none",
    background: "#ef4444",
    color: "white",
    cursor: "pointer",
    marginTop: "12px",
    fontSize: "14px",
    fontWeight: "600",
  },

  // =========================
  // MAIN
  // =========================

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#ffffff",
    overflow: "hidden",
  },

  // =========================
  // CHAT AREA
  // =========================

  chatArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    boxSizing: "border-box",
    background: "#ffffff",
    width: "100%",
  },

  // =========================
  // MESSAGES
  // =========================

 // =========================
// MESSAGES
// =========================

message: {
  fontSize: "15px",
  lineHeight: 1.8,
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
},

userMessage: {
  alignSelf: "flex-end",
  background: "#111111",
  color: "#ffffff",
  padding: "14px 18px",
  borderRadius: "18px",
  maxWidth: "70%",
  width: "fit-content",
  textAlign: "left",
},

botMessage: {
  alignSelf: "flex-start",
  background: "transparent",
  color: "#111111",
  padding: "0px",
  borderRadius: "0px",
  boxShadow: "none",
  width: "fit-content",
  maxWidth: "95%",
  textAlign: "left",
},

listening: {
  color: "#10b981",
  fontWeight: "600",
  fontSize: "14px",
},

speakBtn: {
  marginLeft: "10px",
  background: "transparent",
  border: "none",
  color: "#666666",
  cursor: "pointer",
  fontSize: "14px",
},
  // =========================
  // INPUT BAR
  // =========================

 bottomBar: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "16px 24px",
  borderTop: "1px solid #e5e5e5",
  background: "#ffffff",
},

  input: {
    flex: 1,
    padding: "16px 20px",
    borderRadius: "28px",
    border: "1px solid #dcdcdc",
    outline: "none",
    background: "#ffffff",
    color: "#111111",
    fontSize: "15px",
  },

  sendBtn: {
    width: "48px",
    height: "48px",
    border: "none",
    borderRadius: "50%",
    background: "#111111",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: "bold",
  },

  micBtn: {
    width: "48px",
    height: "48px",
    border: "none",
    borderRadius: "50%",
    background: "#10b981",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "18px",
  },

  pdfBtn: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#7c3aed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "18px",
    color: "white",
  },

  // =========================
  // AUTH PAGE
  // =========================

  authPage: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#ffffff",
  },

  authCard: {
    width: "380px",
    background: "#ffffff",
    padding: "32px",
    borderRadius: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    border: "1px solid #e5e5e5",
  },

  authTitle: {
    textAlign: "center",
    fontSize: "30px",
    margin: 0,
    color: "#111111",
  },

  authSubtitle: {
    textAlign: "center",
    color: "#666666",
    marginTop: "-6px",
    fontSize: "14px",
  },

  authInput: {
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #dcdcdc",
    background: "#ffffff",
    color: "#111111",
    fontSize: "14px",
    outline: "none",
  },

  authBtn: {
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "#111111",
    color: "#ffffff",
    fontSize: "15px",
    cursor: "pointer",
    fontWeight: "600",
  },

  switchBtn: {
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #dcdcdc",
    background: "#ffffff",
    color: "#111111",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },
};


export default App;
