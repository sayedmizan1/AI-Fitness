from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User, FitnessProfile
from schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserOut,
    FitnessProfileCreate, FitnessProfileOut,
)
from core.security import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    h = height_cm / 100
    return round(weight_kg / (h * h), 1)


def estimate_calories(age: int, gender: str, weight_kg: float, height_cm: float, goal: str) -> int:
    # Mifflin-St Jeor
    if gender.lower() == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    tdee = bmr * 1.55  # moderate activity
    if goal == "weight_loss":
        return int(tdee - 500)
    elif goal == "muscle_gain":
        return int(tdee + 300)
    return int(tdee)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/profile", response_model=FitnessProfileOut, status_code=status.HTTP_201_CREATED)
async def create_fitness_profile(
    payload: FitnessProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(__import__("middleware.auth", fromlist=["get_current_user"]).get_current_user),
):
    # Check if profile already exists
    result = await db.execute(
        select(FitnessProfile).where(FitnessProfile.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()

    bmi = calculate_bmi(payload.weight_kg, payload.height_cm)
    calories = estimate_calories(payload.age, payload.gender, payload.weight_kg, payload.height_cm, payload.goal)
    training_days = 3 if payload.experience == "beginner" else (4 if payload.experience == "intermediate" else 5)

    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        existing.bmi = bmi
        existing.daily_calories = calories
        existing.training_days_per_week = training_days
        await db.commit()
        await db.refresh(existing)
        return FitnessProfileOut.model_validate(existing)

    profile = FitnessProfile(
        user_id=current_user.id,
        bmi=bmi,
        daily_calories=calories,
        training_days_per_week=training_days,
        **payload.model_dump(),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return FitnessProfileOut.model_validate(profile)


@router.get("/profile", response_model=FitnessProfileOut)
async def get_fitness_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(__import__("middleware.auth", fromlist=["get_current_user"]).get_current_user),
):
    result = await db.execute(
        select(FitnessProfile).where(FitnessProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Fitness profile not found")
    return FitnessProfileOut.model_validate(profile)
