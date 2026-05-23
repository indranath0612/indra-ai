from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import fitz

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

import os
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("sk_qn8bdcmb_qxZHO0uFWakjJSlGLOcYCQkj")

# =========================
# TEMP USER STORAGE
# =========================

users = {}

# PDF TEXT STORAGE
pdf_text_storage = ""

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
    return {"message": "Indra AI Backend Running"}

# =========================
# REGISTER
# =========================

@app.post("/register")
async def register(req: AuthRequest):

    if req.email in users:
        return {
            "success": False,
            "message": "User already exists"
        }

    users[req.email] = req.password

    return {
        "success": True,
        "message": "Registered successfully"
    }

# =========================
# LOGIN
# =========================

@app.post("/login")
async def login(req: AuthRequest):

    if req.email not in users:
        return {
            "success": False,
            "message": "User not found"
        }

    if users[req.email] != req.password:
        return {
            "success": False,
            "message": "Wrong password"
        }

    return {
        "success": True,
        "token": "indra-ai-token"
    }

# =========================
# CHAT
# =========================

@app.post("/chat")
async def chat(req: ChatRequest):

    global pdf_text_storage

    try:
        user_message = req.text

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
                    "content": f"""
You are Indra AI powered by Sarvam AI.

Never reveal thinking tokens, internal reasoning,
tool calls, or chain of thought.

If PDF content exists, answer using it.

PDF CONTENT:
{pdf_text_storage}
"""
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            "temperature": 0.7
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload
        )

        print("STATUS:", response.status_code)
        print("TEXT:", response.text)

        data = response.json()

        # =========================
        # SUCCESS
        # =========================

        if "choices" in data:

            reply = data["choices"][0]["message"]["content"]

            # REMOVE THINK TOKENS
            if "</think>" in reply:
                reply = reply.split("</think>")[-1].strip()

            reply = reply.replace("<think>", "")
            reply = reply.replace("</think>", "")

            # REMOVE TOOL CALL TOKENS
            if "<tool_call>" in reply:
                reply = reply.split("</tool_call>")[-1].strip()

            reply = reply.replace("<tool_call>", "")
            reply = reply.replace("</tool_call>", "")

            # CLEAN EXTRA SPACES
            reply = reply.strip()

            return {
                "reply": reply
            }

        # =========================
        # API ERROR
        # =========================

        return {
            "reply": f"Sarvam API Error: {data}"
        }

    except Exception as e:

        print("FULL ERROR:", e)

        return {
            "reply": f"Server error: {str(e)}"
        }

# =========================
# PDF UPLOAD
# =========================

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    global pdf_text_storage

    try:
        contents = await file.read()

        with open(file.filename, "wb") as f:
            f.write(contents)

        # READ PDF
        doc = fitz.open(file.filename)

        extracted_text = ""

        for page in doc:
            extracted_text += page.get_text()

        doc.close()

        # STORE PDF TEXT
        pdf_text_storage = extracted_text[:12000]

        print("PDF TEXT LOADED")

        return {
            "message": "PDF uploaded and processed successfully"
        }

    except Exception as e:
        print(e)

        return {
            "message": "Upload failed"
        }