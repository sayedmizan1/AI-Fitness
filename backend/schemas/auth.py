from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from models.user import GoalType, ExperienceLevel


# ── Auth ──────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ── User ──────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


# ── Fitness Profile ───────────────────────────────────────────────────────────
class FitnessProfileCreate(BaseModel):
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    goal: GoalType
    experience: ExperienceLevel


class FitnessProfileOut(BaseModel):
    id: str
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    goal: GoalType
    experience: ExperienceLevel
    bmi: Optional[float]
    daily_calories: Optional[int]
    training_days_per_week: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
