from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class SessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


class WorkoutPlan(Base):
    __tablename__ = "workout_plans"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    schedule_json = Column(JSON, nullable=True)   # {"mon": [...], "wed": [...], ...}
    exercises_json = Column(JSON, nullable=True)  # full plan structure
    duration_weeks = Column(Integer, default=4)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="workout_plans")
    sessions = relationship("WorkoutSession", back_populates="plan")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    plan_id = Column(String, ForeignKey("workout_plans.id"), nullable=True)
    date = Column(DateTime, default=datetime.utcnow)
    duration_mins = Column(Float, nullable=True)
    calories_burned = Column(Float, nullable=True)
    status = Column(SAEnum(SessionStatus), default=SessionStatus.in_progress)
    notes = Column(Text, nullable=True)

    user = relationship("User", back_populates="workout_sessions")
    plan = relationship("WorkoutPlan", back_populates="sessions")
    exercise_logs = relationship("ExerciseLog", back_populates="session", cascade="all, delete")


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("workout_sessions.id"), nullable=False)
    exercise_name = Column(String, nullable=False)
    sets_completed = Column(Integer, default=0)
    total_reps = Column(Integer, default=0)
    avg_form_score = Column(Float, nullable=True)  # 0-100
    feedback_json = Column(JSON, nullable=True)    # list of correction strings
    duration_secs = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("WorkoutSession", back_populates="exercise_logs")
    pose_analyses = relationship("PoseAnalysis", back_populates="exercise_log", cascade="all, delete")


class PoseAnalysis(Base):
    __tablename__ = "pose_analysis"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("workout_sessions.id"), nullable=False)
    exercise_log_id = Column(String, ForeignKey("exercise_logs.id"), nullable=False)
    landmarks_json = Column(JSON, nullable=True)
    joint_angles_json = Column(JSON, nullable=True)
    form_score = Column(Float, nullable=True)
    rep_count = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)

    exercise_log = relationship("ExerciseLog", back_populates="pose_analyses")
