from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, Chat, Document, User
from auth import hash_password, verify_password, create_token
from sarvam_api import chat_with_bot

from pypdf import PdfReader
import re

app = FastAPI(title="Voice Bot API")

# -------------------------
# CORS
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# MODELS
# -------------------------
class Message(BaseModel):
    text: str
    session_id: str


class AuthData(BaseModel):
    email: str
    password: str


# -------------------------
# BASIC ROUTES
# -------------------------
@app.get("/")
def home():
    return {"message": "API running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# -------------------------
# AUTH
# -------------------------
@app.post("/register")
def register(data: AuthData):
    db = SessionLocal()

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        return {"error": "User already exists"}

    user = User(
        email=data.email,
        password=hash_password(data.password)
    )

    db.add(user)
    db.commit()

    return {"message": "User created"}


@app.post("/login")
def login(data: AuthData):
    db = SessionLocal()

    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password):
        return {"error": "Invalid credentials"}

    token = create_token({"email": user.email})

    return {"token": token}


# -------------------------
# PDF UPLOAD
# -------------------------
@app.post("/upload-pdf")
def upload_pdf(
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    db = SessionLocal()

    try:
        reader = PdfReader(file.file)

        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        doc = Document(
            session_id=session_id,
            content=text[:5000],
            filename=file.filename
        )

        db.add(doc)
        db.commit()

        return {"message": "PDF uploaded"}

    except Exception as e:
        print("PDF error:", e)
        return {"message": "Upload failed"}

    finally:
        db.close()


# -------------------------
# CHAT
# -------------------------
@app.post("/chat")
def chat(msg: Message):
    db = SessionLocal()

    try:
        all_msgs = (
            db.query(Chat)
            .filter(Chat.session_id == msg.session_id)
            .order_by(Chat.id.asc())
            .all()
        )

        RECENT_K = 5

        older = all_msgs[:-RECENT_K] if len(all_msgs) > RECENT_K else []
        recent = all_msgs[-RECENT_K:] if len(all_msgs) > RECENT_K else all_msgs

        summary_text = ""

        if older:
            older_block = ""
            for h in older:
                older_block += f"User: {h.user_message}\n"
                older_block += f"Assistant: {h.bot_message}\n"

            prompt = f"Summarize:\n{older_block}"
            response = chat_with_bot(prompt)

            raw = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            summary_text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

        docs = (
            db.query(Document)
            .filter(Document.session_id == msg.session_id)
            .order_by(Document.id.desc())
            .all()
        )

        pdf_context = docs[0].content[:2000] if docs else ""

        prompt = "You are a helpful assistant.\n\n"

        if pdf_context:
            prompt += f"Document:\n{pdf_context}\n\n"

        if summary_text:
            prompt += f"Summary:\n{summary_text}\n\n"

        for h in recent:
            prompt += f"User: {h.user_message}\nAssistant: {h.bot_message}\n"

        prompt += f"User: {msg.text}\nAssistant:"

        response = chat_with_bot(prompt)

        raw_reply = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        reply = re.sub(r"<think>.*?</think>", "", raw_reply, flags=re.DOTALL).strip()

        if not reply:
            reply = "Sorry, I couldn't generate a response."

        chat_entry = Chat(
            session_id=msg.session_id,
            user_message=msg.text,
            bot_message=reply,
            summary=summary_text
        )

        db.add(chat_entry)
        db.commit()

        return {"reply": reply}

    except Exception as e:
        print("Error:", e)
        return {"reply": "Something went wrong"}

    finally:
        db.close()