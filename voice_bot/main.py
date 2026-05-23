from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import sqlite3
import os

app = FastAPI()

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# SARVAM API KEY
# =========================

SARVAM_API_KEY = "sk_qn8bdcmb_qxZHO0uFWakjJSlGLOcYCQkj"

# =========================
# DATABASE
# =========================

conn = sqlite3.connect(
    "indra_ai.db",
    check_same_thread=False
)

cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password TEXT
)
""")

conn.commit()

# =========================
# MODELS
# =========================

class AuthRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    text: str
    session_id: str = None

# =========================
# ROOT
# =========================

@app.get("/")
def root():
    return {
        "message": "Indra AI Backend Running"
    }

# =========================
# REGISTER
# =========================

@app.post("/register")
async def register(req: AuthRequest):

    try:

        cursor.execute(
            "SELECT * FROM users WHERE email=?",
            (req.email,)
        )

        existing = cursor.fetchone()

        if existing:
            return {
                "success": False,
                "message": "User already exists"
            }

        cursor.execute(
            "INSERT INTO users VALUES (?, ?)",
            (req.email, req.password)
        )

        conn.commit()

        return {
            "success": True,
            "message": "Registered successfully"
        }

    except Exception as e:

        print("REGISTER ERROR:", e)

        return {
            "success": False,
            "message": str(e)
        }

# =========================
# LOGIN
# =========================

@app.post("/login")
async def login(req: AuthRequest):

    try:

        cursor.execute(
            "SELECT * FROM users WHERE email=? AND password=?",
            (req.email, req.password)
        )

        user = cursor.fetchone()

        if not user:
            return {
                "success": False,
                "message": "Invalid credentials"
            }

        return {
            "success": True,
            "token": "indra-ai-token"
        }

    except Exception as e:

        print("LOGIN ERROR:", e)

        return {
            "success": False,
            "message": str(e)
        }

# =========================
# CHAT
# =========================

@app.post("/chat")
async def chat(req: ChatRequest):

    try:

        url = "https://api.sarvam.ai/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {SARVAM_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "sarvam-m",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Indra AI powered by Sarvam AI. "
                        "Reply naturally like ChatGPT. "
                        "Never show reasoning, thinking process, "
                        "<think> tags, tool calls, or hidden thoughts."
                    )
                },
                {
                    "role": "user",
                    "content": req.text
                }
            ]
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=60
        )

        print("STATUS:", response.status_code)
        print("RAW:", response.text)

        data = response.json()

        reply = "No response"

        # =========================
        # SUCCESS RESPONSE
        # =========================

        if "choices" in data:

            reply = data["choices"][0]["message"]["content"]

            # REMOVE THINK TAGS
            if "</think>" in reply:
                reply = reply.split("</think>")[-1]

            reply = (
                reply
                .replace("<think>", "")
                .replace("</think>", "")
                .replace("<tool_call>", "")
                .replace("</tool_call>", "")
                .strip()
            )

        # =========================
        # API ERROR
        # =========================

        elif "error" in data:

            reply = (
                "Sarvam API Error: "
                + data["error"]["message"]
            )

        return {
            "reply": reply
        }

    except Exception as e:

        print("CHAT ERROR:", e)

        return {
            "reply": f"Server error: {str(e)}"
        }

# =========================
# PDF UPLOAD
# =========================

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    try:

        os.makedirs("uploads", exist_ok=True)

        filepath = os.path.join(
            "uploads",
            file.filename
        )

        contents = await file.read()

        with open(filepath, "wb") as f:
            f.write(contents)

        return {
            "success": True,
            "message": "PDF uploaded successfully",
            "filename": file.filename
        }

    except Exception as e:

        print("UPLOAD ERROR:", e)

        return {
            "success": False,
            "message": str(e)
        }