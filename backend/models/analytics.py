from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class GoalStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    abandoned = "abandoned"


class ProgressMetric(Base):
    __tablename__ = "progress_metrics"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    weight_kg = Column(Float, nullable=True)
    body_fat_pct = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    user = relationship("User", back_populates="progress_metrics")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)   # "reminder", "achievement", "goal"
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_history")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String, nullable=True)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="achievements")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    target_value = Column(Float, nullable=True)
    current_value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    deadline = Column(DateTime, nullable=True)
    status = Column(SAEnum(GoalStatus), default=GoalStatus.active)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="goals")
