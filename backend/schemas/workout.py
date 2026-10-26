from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from models.workout import SessionStatus


class WorkoutPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule_json: Optional[Any] = None
    exercises_json: Optional[Any] = None
    duration_weeks: int = 4


class WorkoutPlanOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    schedule_json: Optional[Any]
    exercises_json: Optional[Any]
    duration_weeks: int
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True


class SessionStart(BaseModel):
    plan_id: Optional[str] = None


class SessionEnd(BaseModel):
    duration_mins: float
    calories_burned: Optional[float] = None
    notes: Optional[str] = None


class WorkoutSessionOut(BaseModel):
    id: str
    plan_id: Optional[str]
    date: datetime
    duration_mins: Optional[float]
    calories_burned: Optional[float]
    status: SessionStatus
    notes: Optional[str]

    class Config:
        from_attributes = True


class ExerciseLogCreate(BaseModel):
    session_id: str
    exercise_name: str
    sets_completed: int = 0
    total_reps: int = 0
    avg_form_score: Optional[float] = None
    feedback_json: Optional[List[str]] = None
    duration_secs: Optional[float] = None


class ExerciseLogOut(BaseModel):
    id: str
    exercise_name: str
    sets_completed: int
    total_reps: int
    avg_form_score: Optional[float]
    feedback_json: Optional[List[str]]
    duration_secs: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True
