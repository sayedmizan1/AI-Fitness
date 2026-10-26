from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from database import get_db
from models.user import User
from models.workout import WorkoutSession, ExerciseLog, SessionStatus
from models.analytics import ProgressMetric, ChatHistory, Goal, Notification, Achievement
from schemas.analytics import (
    ChatMessage, ChatResponse, ChatHistoryItem,
    ProgressMetricCreate, ProgressMetricOut,
    GoalCreate, GoalOut, NotificationOut, AnalyticsSummary,
)
from middleware.auth import get_current_user
from typing import List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total sessions
    total_q = await db.execute(
        select(func.count(WorkoutSession.id)).where(
            WorkoutSession.user_id == current_user.id,
            WorkoutSession.status == SessionStatus.completed,
        )
    )
    total_sessions = total_q.scalar() or 0

    # Total reps and calories
    stats_q = await db.execute(
        select(
            func.sum(ExerciseLog.total_reps),
            func.sum(WorkoutSession.calories_burned),
            func.avg(ExerciseLog.avg_form_score),
        )
        .join(WorkoutSession, WorkoutSession.id == ExerciseLog.session_id)
        .where(WorkoutSession.user_id == current_user.id)
    )
    stats = stats_q.one()
    total_reps = int(stats[0] or 0)
    total_calories = float(stats[1] or 0)
    avg_form = float(stats[2] or 0)

    # Weekly sessions (last 8 weeks)
    weekly = []
    now = datetime.utcnow()
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end = now - timedelta(weeks=i)
        count_q = await db.execute(
            select(func.count(WorkoutSession.id)).where(
                WorkoutSession.user_id == current_user.id,
                WorkoutSession.date >= week_start,
                WorkoutSession.date < week_end,
                WorkoutSession.status == SessionStatus.completed,
            )
        )
        weekly.append({"week": f"W-{i}", "sessions": count_q.scalar() or 0})

    # Exercise breakdown
    ex_q = await db.execute(
        select(ExerciseLog.exercise_name, func.count(ExerciseLog.id).label("count"))
        .join(WorkoutSession, WorkoutSession.id == ExerciseLog.session_id)
        .where(WorkoutSession.user_id == current_user.id)
        .group_by(ExerciseLog.exercise_name)
        .order_by(desc("count"))
        .limit(7)
    )
    exercise_breakdown = [{"name": r[0], "count": r[1]} for r in ex_q.all()]

    # Consistency score (sessions in last 30 days / expected)
    thirty_days_q = await db.execute(
        select(func.count(WorkoutSession.id)).where(
            WorkoutSession.user_id == current_user.id,
            WorkoutSession.date >= now - timedelta(days=30),
            WorkoutSession.status == SessionStatus.completed,
        )
    )
    recent = thirty_days_q.scalar() or 0
    consistency = min(100, round((recent / 12) * 100))

    return AnalyticsSummary(
        total_sessions=total_sessions,
        total_reps=total_reps,
        total_calories=total_calories,
        avg_form_score=avg_form,
        weekly_sessions=weekly,
        monthly_sessions=[],
        exercise_breakdown=exercise_breakdown,
        consistency_score=float(consistency),
    )


@router.post("/progress", response_model=ProgressMetricOut)
async def log_progress(
    payload: ProgressMetricCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = ProgressMetric(user_id=current_user.id, **payload.model_dump())
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return ProgressMetricOut.model_validate(metric)


@router.get("/progress", response_model=List[ProgressMetricOut])
async def get_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProgressMetric)
        .where(ProgressMetric.user_id == current_user.id)
        .order_by(ProgressMetric.date.desc())
        .limit(90)
    )
    return [ProgressMetricOut.model_validate(m) for m in result.scalars().all()]


@router.post("/goals", response_model=GoalOut)
async def create_goal(
    payload: GoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(user_id=current_user.id, **payload.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return GoalOut.model_validate(goal)


@router.get("/goals", response_model=List[GoalOut])
async def get_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at.desc())
    )
    return [GoalOut.model_validate(g) for g in result.scalars().all()]


@router.get("/notifications", response_model=List[NotificationOut])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]
