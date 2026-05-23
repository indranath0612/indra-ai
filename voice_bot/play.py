import pyttsx3

engine = pyttsx3.init()

def speak_text(text):
    engine.say(text)
    engine.runAndWait()