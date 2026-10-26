from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models.user import User
from models.analytics import ChatHistory
from schemas.analytics import ChatMessage, ChatResponse, ChatHistoryItem
from middleware.auth import get_current_user
from typing import List, Optional
from pydantic import BaseModel
import sys
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/coach", tags=["AI Coach"])


# ── Lazy import ────────────────────────────────────────────────────────────────
def get_fitness_graph():
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
        from ai.agents.graph import run_fitness_agent
        return run_fitness_agent
    except Exception as e:
        logger.warning(f"AI agent load failed: {e}")
        return None


# ── Schemas ────────────────────────────────────────────────────────────────────
class SessionAnalysisRequest(BaseModel):
    exercise_name: str
    duration_secs: int
    total_reps: int
    avg_form_score: float
    sets_completed: int
    goal_sets: int
    calories: int
    set_history: Optional[List[dict]] = []
    personal_best: bool = False


class SessionAnalysisResponse(BaseModel):
    analysis: str
    agent_used: str


# ── Chat endpoint ──────────────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse)
async def chat_with_coach(
    payload: ChatMessage,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Save user message
    user_msg = ChatHistory(user_id=current_user.id, role="user", content=payload.message)
    db.add(user_msg)
    await db.commit()

    # Fetch last 10 messages for context
    history_result = await db.execute(
        select(ChatHistory)
        .where(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(10)
    )
    recent = list(reversed(history_result.scalars().all()))
    conversation_history = [{"role": m.role, "content": m.content} for m in recent]

    # Try real AI agent
    run_agent = get_fitness_graph()
    reply = ""
    agent_used = "local"
    sources = []

    if run_agent:
        try:
            result = await run_agent(
                user_query=payload.message,
                user_id=current_user.id,
                conversation_history=conversation_history,
            )
            reply = result.get("answer", "")
            sources = result.get("sources", [])
            agent_used = result.get("agent", "llm")
        except Exception as e:
            logger.error(f"Agent error: {e}")
            reply = (
                "I'm having a momentary connection issue with my AI systems. "
                "Please try again in a few seconds — I'm still here to help!"
            )
    else:
        reply = (
            "👋 I'm FitMentor AI, your personal fitness coach! "
            "To unlock full AI coaching, add your GROQ_API_KEY to the backend .env file. "
            "I can help with workout plans, form tips, nutrition, recovery, and goal planning!"
        )

    # Save assistant reply
    ai_msg = ChatHistory(user_id=current_user.id, role="assistant", content=reply)
    db.add(ai_msg)
    await db.commit()

    return ChatResponse(reply=reply, sources=sources, agent_used=agent_used)


# ── Session Analysis endpoint ──────────────────────────────────────────────────
@router.post("/session-analysis", response_model=SessionAnalysisResponse)
async def analyze_session(
    payload: SessionAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a real AI analysis of a completed workout session."""
    run_agent = get_fitness_graph()
    agent_used = "local"
    analysis = ""

    if run_agent:
        try:
            set_breakdown = ""
            if payload.set_history:
                set_breakdown = " | ".join(
                    f"Set {s.get('setNum', i+1)}: {s.get('reps', 0)} reps @ {s.get('avgFormScore', 0):.0f}% form"
                    for i, s in enumerate(payload.set_history)
                )

            query = (
                f"I just finished a workout session. Exercise: {payload.exercise_name}. "
                f"Duration: {payload.duration_secs // 60}m {payload.duration_secs % 60}s. "
                f"Total reps: {payload.total_reps}. "
                f"Sets: {payload.sets_completed}/{payload.goal_sets}. "
                f"Average form score: {payload.avg_form_score:.0f}%. "
                f"Calories burned: ~{payload.calories}. "
                f"{f'Set breakdown: {set_breakdown}.' if set_breakdown else ''} "
                f"{'I hit a new personal record!' if payload.personal_best else ''} "
                "Please give me a concise, specific analysis of this session: "
                "what I did well, what to improve next time, and one key takeaway."
            )

            result = await run_agent(
                user_query=query,
                user_id=current_user.id,
                conversation_history=[],
            )
            analysis = result.get("answer", "")
            agent_used = result.get("agent", "llm")
        except Exception as e:
            logger.error(f"Session analysis error: {e}")

    # Fallback to local generation if AI unavailable
    if not analysis:
        analysis = _local_session_analysis(payload)
        agent_used = "local"

    return SessionAnalysisResponse(analysis=analysis, agent_used=agent_used)


def _local_session_analysis(payload: SessionAnalysisRequest) -> str:
    """Deterministic local analysis as fallback."""
    parts = []
    score = payload.avg_form_score
    completion = (payload.sets_completed / max(payload.goal_sets, 1)) * 100

    if score >= 85:
        parts.append(f"Outstanding session! Your {payload.exercise_name} technique was elite-level throughout.")
    elif score >= 70:
        parts.append(f"Solid session on {payload.exercise_name}. Your form held up well across the workout.")
    else:
        parts.append(f"Good effort on {payload.exercise_name}. Focus on form quality in your next session.")

    if payload.personal_best:
        parts.append(f"You hit a new personal record — {payload.total_reps} total reps! 🏆")

    if completion >= 100:
        parts.append(f"Perfect goal completion: {payload.sets_completed}/{payload.goal_sets} sets finished.")
    elif completion >= 75:
        parts.append(f"You completed {completion:.0f}% of your target — great consistency.")

    if payload.set_history and len(payload.set_history) > 1:
        first_score = payload.set_history[0].get("avgFormScore", 0)
        last_score = payload.set_history[-1].get("avgFormScore", 0)
        if last_score > first_score + 5:
            parts.append("Your form actually improved across sets — excellent fatigue management!")
        elif last_score < first_score - 10:
            parts.append("Form dropped toward the end. Consider ending sets earlier next time to protect quality.")

    parts.append("Keep it up — consistency is the secret to long-term results. See you in the next session!")
    return " ".join(parts)


# ── History endpoints ──────────────────────────────────────────────────────────
@router.get("/history", response_model=List[ChatHistoryItem])
async def get_chat_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    result = await db.execute(
        select(ChatHistory)
        .where(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(limit)
    )
    items = result.scalars().all()
    return [ChatHistoryItem.model_validate(i) for i in reversed(items)]


@router.delete("/history")
async def clear_chat_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatHistory).where(ChatHistory.user_id == current_user.id)
    )
    for item in result.scalars().all():
        await db.delete(item)
    await db.commit()
    return {"message": "Chat history cleared"}
