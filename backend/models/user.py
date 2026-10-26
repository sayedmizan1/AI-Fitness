from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class GoalType(str, enum.Enum):
    weight_loss = "weight_loss"
    muscle_gain = "muscle_gain"
    endurance = "endurance"
    strength = "strength"
    flexibility = "flexibility"
    general_fitness = "general_fitness"


class ExperienceLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    fitness_profile = relationship("FitnessProfile", back_populates="user", uselist=False, cascade="all, delete")
    workout_sessions = relationship("WorkoutSession", back_populates="user", cascade="all, delete")
    workout_plans = relationship("WorkoutPlan", back_populates="user", cascade="all, delete")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete")
    goals = relationship("Goal", back_populates="user", cascade="all, delete")
    achievements = relationship("Achievement", back_populates="user", cascade="all, delete")
    progress_metrics = relationship("ProgressMetric", back_populates="user", cascade="all, delete")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete")


class FitnessProfile(Base):
    __tablename__ = "fitness_profiles"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)
    goal = Column(SAEnum(GoalType), nullable=False)
    experience = Column(SAEnum(ExperienceLevel), nullable=False)
    bmi = Column(Float, nullable=True)
    daily_calories = Column(Integer, nullable=True)
    training_days_per_week = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="fitness_profile")
