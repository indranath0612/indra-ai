import requests
import os
from dotenv import load_dotenv

# Load API key from .env
load_dotenv()
API_KEY = os.getenv("SARVAM_API_KEY")

# Common headers
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# -------------------------
# CHAT FUNCTION (MAIN)
# -------------------------
def chat_with_bot(user_text):
    url = "https://api.sarvam.ai/v1/chat/completions"

    response = requests.post(
        url,
        headers=HEADERS,
        json={
            "model": "sarvam-m",
            "messages": [
                {
                    "role": "user",
                    "content": user_text
                }
            ]
        }
    )

    return response.json()


# -------------------------
# SPEECH TO TEXT (FOR LATER)
# -------------------------
def speech_to_text(audio_file):
    url = "https://api.sarvam.ai/v1/speech-to-text"

    with open(audio_file, "rb") as f:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {API_KEY}"},
            files={"file": f}
        )

    return response.json()


# -------------------------
# TEXT TO SPEECH (FOR LATER)
# -------------------------
def text_to_speech(text, output_file="output.wav"):
    url = "https://api.sarvam.ai/v1/generate/audio"

    response = requests.post(
        url,
        headers=HEADERS,
        json={
            "text": text,
            "voice": "ananya",
            "audio_format": "wav"
        }
    )

    content_type = response.headers.get("Content-Type", "")

    if "audio" in content_type:
        with open(output_file, "wb") as f:
            f.write(response.content)
        return True
    else:
        print("❌ TTS Error:", response.text)
        return False