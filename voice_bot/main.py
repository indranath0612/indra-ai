from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SARVAM_API_KEY = "YOUR_API_KEY"

class ChatRequest(BaseModel):
    text: str

@app.get("/")
def root():
    return {"message": "Indra AI Running"}

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
                    "content": "You are Indra AI powered by Sarvam AI."
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
            json=payload
        )

        data = response.json()

        reply = data["choices"][0]["message"]["content"]

        return {
            "reply": reply
        }

    except Exception as e:
        return {
            "reply": str(e)
        }