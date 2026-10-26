from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.workout import WorkoutPlan, WorkoutSession, ExerciseLog, SessionStatus
from schemas.workout import (
    WorkoutPlanCreate, WorkoutPlanOut,
    SessionStart, SessionEnd, WorkoutSessionOut,
    ExerciseLogCreate, ExerciseLogOut,
)
from middleware.auth import get_current_user
from typing import List

router = APIRouter(prefix="/workout", tags=["Workout"])


@router.post("/plans", response_model=WorkoutPlanOut)
async def create_plan(
    payload: WorkoutPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = WorkoutPlan(user_id=current_user.id, **payload.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return WorkoutPlanOut.model_validate(plan)


@router.get("/plans", response_model=List[WorkoutPlanOut])
async def get_plans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.user_id == current_user.id)
    )
    return [WorkoutPlanOut.model_validate(p) for p in result.scalars().all()]


@router.post("/sessions/start", response_model=WorkoutSessionOut)
async def start_session(
    payload: SessionStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = WorkoutSession(user_id=current_user.id, plan_id=payload.plan_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return WorkoutSessionOut.model_validate(session)


@router.post("/sessions/{session_id}/end", response_model=WorkoutSessionOut)
async def end_session(
    session_id: str,
    payload: SessionEnd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WorkoutSession).where(
            WorkoutSession.id == session_id,
            WorkoutSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.duration_mins = payload.duration_mins
    session.calories_burned = payload.calories_burned
    session.notes = payload.notes
    session.status = SessionStatus.completed
    await db.commit()
    await db.refresh(session)
    return WorkoutSessionOut.model_validate(session)


@router.get("/sessions", response_model=List[WorkoutSessionOut])
async def get_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    result = await db.execute(
        select(WorkoutSession)
        .where(WorkoutSession.user_id == current_user.id)
        .order_by(WorkoutSession.date.desc())
        .limit(limit)
    )
    return [WorkoutSessionOut.model_validate(s) for s in result.scalars().all()]


@router.post("/exercise-logs", response_model=ExerciseLogOut)
async def log_exercise(
    payload: ExerciseLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = ExerciseLog(**payload.model_dump())
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return ExerciseLogOut.model_validate(log)


@router.get("/sessions/{session_id}/logs", response_model=List[ExerciseLogOut])
async def get_session_logs(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExerciseLog).where(ExerciseLog.session_id == session_id)
    )
    return [ExerciseLogOut.model_validate(l) for l in result.scalars().all()]
