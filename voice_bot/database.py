from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

engine = create_engine(
    "sqlite:///chat.db",
    connect_args={"check_same_thread": False}
)

Base = declarative_base()


# -------------------------
# USER TABLE
# -------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)


# -------------------------
# CHAT TABLE
# -------------------------
class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)

    user_message = Column(Text)
    bot_message = Column(Text)

    summary = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# -------------------------
# DOCUMENT TABLE
# -------------------------
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)

    content = Column(Text)
    filename = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(engine)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)