from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    sources: Optional[List[str]] = None
    agent_used: Optional[str] = None


class ChatHistoryItem(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProgressMetricCreate(BaseModel):
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None


class ProgressMetricOut(BaseModel):
    id: str
    date: datetime
    weight_kg: Optional[float]
    body_fat_pct: Optional[float]
    notes: Optional[str]

    class Config:
        from_attributes = True


class GoalCreate(BaseModel):
    type: str
    description: str
    target_value: Optional[float] = None
    unit: Optional[str] = None
    deadline: Optional[datetime] = None


class GoalOut(BaseModel):
    id: str
    type: str
    description: str
    target_value: Optional[float]
    current_value: Optional[float]
    unit: Optional[str]
    deadline: Optional[datetime]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    total_sessions: int
    total_reps: int
    total_calories: float
    avg_form_score: float
    weekly_sessions: List[Any]
    monthly_sessions: List[Any]
    exercise_breakdown: List[Any]
    consistency_score: float
