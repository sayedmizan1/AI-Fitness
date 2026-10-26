"""
LangGraph multi-agent fitness coaching system — Production v2.

Upgrades over v1:
  • LLM-powered intent classification (no keyword hacks)
  • Full user profile injection (BMI, goals, experience, age, weight)
  • Multi-turn conversation context window (last 6 messages)
  • 2 new agents: Form Review Agent + Goal Planning Agent
  • All agents produce structured Markdown responses
  • Safety guardrails node — appends medical disclaimer when needed
  • SSE-friendly streaming via async generator helper
  • Singleton graph with thread-safe lazy init
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import TypedDict, List, Optional, Dict, Any

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)

# ── Environment ────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    _here    = os.path.dirname(__file__)
    _backend = os.path.abspath(os.path.join(_here, "..", "..", "backend"))
    _root    = os.path.abspath(os.path.join(_here, "..", ".."))
    for _p in [os.path.join(_backend, ".env"), os.path.join(_root, ".env")]:
        if os.path.exists(_p):
            load_dotenv(_p, override=True)
            break
except ImportError:
    pass

from ai.rag.vector_store import FitnessVectorStore

try:
    from database import AsyncSessionLocal
    from models.workout import WorkoutSession, ExerciseLog
    from models.user import User
    from models.analytics import UserProfile
except ImportError:
    try:
        from backend.database import AsyncSessionLocal
        from backend.models.workout import WorkoutSession, ExerciseLog
        from backend.models.user import User
        from backend.models.analytics import UserProfile
    except ImportError:
        AsyncSessionLocal = None
        WorkoutSession = None
        ExerciseLog = None
        User = None
        UserProfile = None


# ── LLM Factories ─────────────────────────────────────────────────────────────

def _make_groq(model: str, temperature: float, max_tokens: int) -> ChatGroq:
    return ChatGroq(
        model=model,
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=temperature,
        max_tokens=max_tokens,
    )


def invoke_with_fallback(messages: list, temperature: float = 0.7,
                         max_tokens: int = 1200) -> str:
    """
    Try models in order until one succeeds:
      1. llama-3.3-70b-versatile  — best quality
      2. llama3-70b-8192          — fallback
      3. gemini-2.0-flash         — last resort
    """
    candidates = [
        lambda: _make_groq("llama-3.3-70b-versatile", temperature, max_tokens),
        lambda: _make_groq("llama3-70b-8192",          temperature, max_tokens),
    ]
    gemini_key = os.getenv("GOOGLE_API_KEY", "")
    if gemini_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            candidates.append(
                lambda: ChatGoogleGenerativeAI(model="gemini-2.0-flash",
                                               google_api_key=gemini_key,
                                               temperature=temperature,
                                               max_tokens=max_tokens)
            )
        except ImportError:
            pass

    last_err = None
    for make in candidates:
        try:
            return make().invoke(messages).content
        except Exception as e:
            last_err = e
            logger.warning(f"LLM failed ({type(e).__name__}), trying next…")

    raise RuntimeError(f"All LLM models failed. Last: {last_err}")


# ── Graph State ────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    user_query: str
    user_id: str
    query_intent: str
    retrieved_docs: List[dict]
    context: str
    workout_history: str
    user_profile: str          # Formatted profile string injected into every agent
    conversation_history: str  # Last 6 turns as formatted text
    answer: str
    sources: List[str]
    agent_used: str
    needs_disclaimer: bool     # True → safety node appends medical disclaimer


# ── Intent Classification (LLM-powered) ───────────────────────────────────────

VALID_INTENTS = {"exercise", "nutrition", "recovery", "plan", "form_review",
                 "goal_planning", "realtime"}

_INTENT_SYSTEM = """You are an intent classifier for a fitness AI.
Classify the user message into EXACTLY one of these intents:
  exercise      — technique, form, how-to for a specific exercise
  nutrition     — food, macros, calories, diet, supplements, meal timing
  recovery      — sleep, injury, soreness, rest, mobility, stretching
  plan          — workout schedule, weekly split, program design
  form_review   — asking about THEIR OWN recent form scores, corrections, progress
  goal_planning — setting goals, body composition targets, transformation plans
  realtime      — immediate in-session coaching ("I'm doing X right now")

Reply with ONLY the single intent word. No explanation."""


def classify_intent(query: str, conversation_history: str = "") -> str:
    try:
        messages = [
            SystemMessage(content=_INTENT_SYSTEM),
            HumanMessage(content=f"Conversation context:\n{conversation_history}\n\nNew message: {query}")
        ]
        llm = _make_groq("llama3-8b-8192", 0.0, 10)
        raw = llm.invoke(messages).content.strip().lower()
        # Extract first word in case LLM adds punctuation
        word = re.split(r"[\s.,!]", raw)[0]
        return word if word in VALID_INTENTS else "exercise"
    except Exception as e:
        logger.warning(f"LLM intent classification failed: {e} — falling back to keyword")
        return _keyword_classify(query)


def _keyword_classify(query: str) -> str:
    q = query.lower()
    mapping = {
        "form_review": ["my form", "my score", "how did i do", "my last session", "my corrections", "my reps"],
        "goal_planning": ["goal", "want to", "target weight", "body fat", "transform", "lose", "gain", "cut", "bulk"],
        "nutrition": ["eat", "food", "protein", "carb", "calorie", "diet", "meal", "macro", "supplement", "creatine"],
        "recovery": ["injury", "pain", "sore", "recover", "rest", "sleep", "stretch", "mobility", "ache"],
        "plan": ["plan", "program", "schedule", "routine", "split", "week", "beginner", "advanced"],
        "realtime": ["now", "currently", "doing", "right now", "this set", "just did"],
        "exercise": ["squat", "pushup", "deadlift", "form", "exercise", "workout", "rep", "set", "muscle", "lift"],
    }
    best, best_score = "exercise", 0
    for intent, keywords in mapping.items():
        score = sum(1 for kw in keywords if kw in q)
        if score > best_score:
            best, best_score = intent, score
    return best


# ── Shared Prompt Helpers ──────────────────────────────────────────────────────

def _profile_block(state: AgentState) -> str:
    p = state.get("user_profile", "")
    return f"\n\n**USER FITNESS PROFILE:**\n{p}" if p else ""


def _history_block(state: AgentState) -> str:
    h = state.get("workout_history", "")
    return f"\n\n**USER'S RECENT WORKOUT HISTORY (AI-tracked):**\n{h}" if h else ""


def _conv_block(state: AgentState) -> str:
    c = state.get("conversation_history", "")
    return f"\n\n**CONVERSATION SO FAR:**\n{c}" if c else ""


def _rag_block(state: AgentState) -> str:
    ctx = state.get("context", "")
    return f"\n\n**RELEVANT KNOWLEDGE BASE:**\n{ctx}" if ctx else ""


_FORMAT_INSTRUCTION = """

**Response format rules (MANDATORY):**
- Use **bold** for key terms and exercise names
- Use numbered lists for steps, bullet lists for tips
- Use headers (##) only for multi-section answers
- End with 1–2 specific actionable next steps
- Keep under 350 words unless a full plan is requested
- Be warm, direct, and encouraging — like a knowledgeable PT
"""


# ── Retriever ──────────────────────────────────────────────────────────────────

_vector_store: Optional[FitnessVectorStore] = None


def _get_store() -> FitnessVectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = FitnessVectorStore()
    return _vector_store


# ── Nodes ──────────────────────────────────────────────────────────────────────

def classifier_node(state: AgentState) -> AgentState:
    intent = classify_intent(state["user_query"],
                             state.get("conversation_history", ""))
    return {**state, "query_intent": intent}


def retriever_node(state: AgentState) -> AgentState:
    store = _get_store()
    qi = state["query_intent"]

    collection_map = {
        "exercise":      ["exercises"],
        "nutrition":     ["nutrition"],
        "recovery":      ["injuries"],
        "plan":          ["workouts", "exercises"],
        "form_review":   ["exercises"],
        "goal_planning": ["workouts", "nutrition"],
        "realtime":      ["exercises"],
    }
    collections = collection_map.get(qi, ["exercises"])

    docs: List[dict] = []
    for col in collections:
        try:
            results = store.search(col, state["user_query"], top_k=4)
            for r in results:
                r["collection"] = col
                docs.append(r)
        except Exception as e:
            logger.warning(f"RAG search failed for {col}: {e}")

    context = "\n\n".join(
        f"[{d['collection'].upper()}] {d['content']}" for d in docs[:6]
    )
    sources = list({d["metadata"].get("topic", d["collection"]) for d in docs[:6]})
    return {**state, "retrieved_docs": docs, "context": context, "sources": sources}


# ─ Exercise Agent ──────────────────────────────────────────────────────────────

def exercise_agent_node(state: AgentState) -> AgentState:
    sys_prompt = f"""You are **FitMentor AI's Exercise Technique Specialist** — an elite personal trainer with 15 years experience in biomechanics and strength training.
{_profile_block(state)}{_history_block(state)}{_conv_block(state)}{_rag_block(state)}
{_FORMAT_INSTRUCTION}
When relevant, reference the user's profile (BMI, experience level, goals) to personalise the advice."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])]
    )
    return {**state, "answer": answer, "agent_used": "exercise_specialist",
            "needs_disclaimer": False}


# ─ Nutrition Agent ─────────────────────────────────────────────────────────────

def nutrition_agent_node(state: AgentState) -> AgentState:
    sys_prompt = f"""You are **FitMentor AI's Nutrition Scientist** — a registered sports dietitian with expertise in evidence-based nutrition for body composition and performance.
{_profile_block(state)}{_history_block(state)}{_conv_block(state)}{_rag_block(state)}
{_FORMAT_INSTRUCTION}
Always calculate recommendations using the user's actual weight/height/goal from their profile above.
Mention specific gram amounts, not just "eat more protein"."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])]
    )
    return {**state, "answer": answer, "agent_used": "nutrition_scientist",
            "needs_disclaimer": False}


# ─ Recovery Agent ─────────────────────────────────────────────────────────────

def recovery_agent_node(state: AgentState) -> AgentState:
    sys_prompt = f"""You are **FitMentor AI's Recovery & Injury Prevention Specialist** — a physiotherapist and sports scientist.
{_profile_block(state)}{_history_block(state)}{_conv_block(state)}{_rag_block(state)}
{_FORMAT_INSTRUCTION}
Look at the workout history above — if you see high-frequency training or poor form scores, call it out proactively.
For any pain or injury, always recommend professional medical assessment."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])]
    )
    needs_disclaimer = any(w in state["user_query"].lower()
                           for w in ["pain", "injury", "hurt", "sharp", "ache", "torn"])
    return {**state, "answer": answer, "agent_used": "recovery_specialist",
            "needs_disclaimer": needs_disclaimer}


# ─ Plan Agent ─────────────────────────────────────────────────────────────────

def plan_agent_node(state: AgentState) -> AgentState:
    sys_prompt = f"""You are **FitMentor AI's Workout Programming Expert** — specialising in evidence-based periodisation and progressive overload.
{_profile_block(state)}{_history_block(state)}{_conv_block(state)}{_rag_block(state)}
{_FORMAT_INSTRUCTION}
Build the plan around the user's training days/week, experience, and goal shown in their profile.
Always include: frequency, exercise selection with sets/reps, progression scheme, and a note on deload."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])],
        max_tokens=1800,
    )
    return {**state, "answer": answer, "agent_used": "programming_expert",
            "needs_disclaimer": False}


# ─ Form Review Agent (NEW) ────────────────────────────────────────────────────

def form_review_agent_node(state: AgentState) -> AgentState:
    """Reviews the user's own captured form data and provides targeted feedback."""
    sys_prompt = f"""You are **FitMentor AI's Form Analysis Coach** — you analyse real biomechanical data captured by AI pose detection.
{_profile_block(state)}{_history_block(state)}{_conv_block(state)}{_rag_block(state)}
{_FORMAT_INSTRUCTION}
Your job: look at the workout history above (form scores, corrections, reps) and give the user a SPECIFIC, personalised form review.
- Name the exact corrections that appeared most often
- Explain the biomechanical reason for each issue
- Give a drill or cue to fix each problem
- Celebrate improvements if scores are trending up
If no history is available, ask them to complete an AI camera session first."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])]
    )
    return {**state, "answer": answer, "agent_used": "form_review_coach",
            "needs_disclaimer": False}


# ─ Goal Planning Agent (NEW) ──────────────────────────────────────────────────

def goal_planning_agent_node(state: AgentState) -> AgentState:
    """Creates a personalised transformation plan based on the user's profile."""
    sys_prompt = f"""You are **FitMentor AI's Goal & Transformation Planner** — a certified strength coach and body composition specialist.
{_profile_block(state)}{_history_block(state)}{_conv_block(state)}{_rag_block(state)}
{_FORMAT_INSTRUCTION}
Create a complete, realistic transformation roadmap using the user's profile data:
- State their current position (BMI, experience) and target clearly
- Break the journey into 4-week phases
- Cover training + nutrition + recovery
- Set measurable milestones
- Warn about common pitfalls for their goal type
Be honest about realistic timelines — no false promises."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])],
        max_tokens=1800,
    )
    return {**state, "answer": answer, "agent_used": "goal_planner",
            "needs_disclaimer": False}


# ─ Real-time Agent ────────────────────────────────────────────────────────────

def realtime_agent_node(state: AgentState) -> AgentState:
    """Ultra-fast coaching for in-session queries (≤ 120 words)."""
    sys_prompt = f"""You are FitMentor AI giving LIVE coaching during an active workout set.
{_profile_block(state)}{_history_block(state)}
**Rules:** Max 2–3 sentences. No markdown. Direct, motivating, actionable.
If you see their current form score in the history, reference it specifically."""

    answer = invoke_with_fallback(
        [SystemMessage(content=sys_prompt),
         HumanMessage(content=state["user_query"])],
        temperature=0.35,
        max_tokens=150,
    )
    return {**state, "answer": answer, "agent_used": "realtime_coach",
            "needs_disclaimer": False}


# ─ Safety Guardrail Node ──────────────────────────────────────────────────────

_DISCLAIMER = (
    "\n\n---\n> ⚕️ **Medical Note:** If you are experiencing sharp, persistent, "
    "or worsening pain, please stop training and consult a qualified healthcare "
    "professional before resuming exercise."
)


def safety_node(state: AgentState) -> AgentState:
    if state.get("needs_disclaimer"):
        return {**state, "answer": state["answer"] + _DISCLAIMER}
    return state


# ── Router ─────────────────────────────────────────────────────────────────────

def route_by_intent(state: AgentState) -> str:
    return state["query_intent"]


# ── Graph Build ────────────────────────────────────────────────────────────────

def build_graph():
    g = StateGraph(AgentState)

    g.add_node("classifier",      classifier_node)
    g.add_node("retriever",       retriever_node)
    g.add_node("exercise_agent",  exercise_agent_node)
    g.add_node("nutrition_agent", nutrition_agent_node)
    g.add_node("recovery_agent",  recovery_agent_node)
    g.add_node("plan_agent",      plan_agent_node)
    g.add_node("form_review_agent",  form_review_agent_node)
    g.add_node("goal_planning_agent", goal_planning_agent_node)
    g.add_node("realtime_agent",  realtime_agent_node)
    g.add_node("safety",          safety_node)

    g.set_entry_point("classifier")
    g.add_edge("classifier", "retriever")

    g.add_conditional_edges(
        "retriever",
        route_by_intent,
        {
            "exercise":      "exercise_agent",
            "nutrition":     "nutrition_agent",
            "recovery":      "recovery_agent",
            "plan":          "plan_agent",
            "form_review":   "form_review_agent",
            "goal_planning": "goal_planning_agent",
            "realtime":      "realtime_agent",
        },
    )

    for agent in [
        "exercise_agent", "nutrition_agent", "recovery_agent",
        "plan_agent", "form_review_agent", "goal_planning_agent",
        "realtime_agent",
    ]:
        g.add_edge(agent, "safety")

    g.add_edge("safety", END)
    return g.compile()


_graph = None
_graph_lock = asyncio.Lock()


async def _get_graph():
    global _graph
    if _graph is None:
        async with _graph_lock:
            if _graph is None:
                _graph = build_graph()
    return _graph


# ── Context Fetchers ───────────────────────────────────────────────────────────

async def fetch_user_workout_history(user_id: str) -> str:
    if AsyncSessionLocal is None or WorkoutSession is None:
        return "No database connection available."
    try:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        async with AsyncSessionLocal() as session:
            stmt = (
                select(WorkoutSession)
                .where(WorkoutSession.user_id == user_id)
                .options(selectinload(WorkoutSession.exercise_logs))
                .order_by(WorkoutSession.date.desc())
                .limit(5)
            )
            res = await session.execute(stmt)
            sessions = res.scalars().all()

            if not sessions:
                return "No AI camera sessions recorded yet. Start a workout session to enable AI form tracking."

            lines = []
            for s in sessions:
                date_str = s.date.strftime("%b %d %Y, %H:%M")
                line = f"📅 {date_str} | Status: {s.status.value.upper()}"
                if s.duration_mins:
                    line += f" | {s.duration_mins:.0f} min"
                if s.calories_burned:
                    line += f" | {s.calories_burned:.0f} kcal"
                lines.append(line)

                if s.exercise_logs:
                    for el in s.exercise_logs:
                        form_label = f"{el.avg_form_score:.0f}% form" if el.avg_form_score else "N/A form"
                        set_rep = f"{el.sets_completed} sets × {el.total_reps} reps"
                        lines.append(f"  • {el.exercise_name.replace('_',' ').title()}: {set_rep} | {form_label}")
                        if el.feedback_json:
                            corrections = list(set(el.feedback_json))[:3]
                            lines.append(f"    Corrections: {', '.join(corrections)}")
                else:
                    lines.append("  (no exercises logged)")

            return "\n".join(lines)
    except Exception as e:
        logger.warning(f"fetch_user_workout_history error: {e}")
        return "Could not retrieve workout history."


async def fetch_user_profile(user_id: str) -> str:
    """Fetch user profile for injection into agent system prompts."""
    if AsyncSessionLocal is None:
        return ""
    try:
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            # Fetch base user
            user_res = await session.execute(
                select(User).where(User.id == user_id)
            ) if User else None
            user = user_res.scalars().first() if user_res else None

            # Fetch profile
            profile_res = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            ) if UserProfile else None
            profile = profile_res.scalars().first() if profile_res else None

            parts = []
            if user:
                parts.append(f"Name: {user.full_name}")
            if profile:
                if profile.age:        parts.append(f"Age: {profile.age}")
                if profile.weight_kg:  parts.append(f"Weight: {profile.weight_kg:.1f} kg")
                if profile.height_cm:  parts.append(f"Height: {profile.height_cm:.0f} cm")
                if profile.bmi:        parts.append(f"BMI: {profile.bmi:.1f}")
                if profile.goal:       parts.append(f"Goal: {profile.goal.replace('_', ' ')}")
                if profile.experience: parts.append(f"Experience: {profile.experience}")
                if profile.training_days_per_week:
                    parts.append(f"Training days/week: {profile.training_days_per_week}")
                if profile.daily_calories:
                    parts.append(f"Daily calorie target: {profile.daily_calories} kcal")

            return "\n".join(parts) if parts else "No profile data yet."
    except Exception as e:
        logger.warning(f"fetch_user_profile error: {e}")
        return ""


def format_conversation_history(history: list) -> str:
    """Format last 6 DB chat messages into a readable context block."""
    if not history:
        return ""
    lines = []
    for msg in history[-6:]:
        role = "User" if msg.get("role") == "user" else "Assistant"
        content = msg.get("content", "")[:300]  # trim very long messages
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


# ── Public Entry Point ─────────────────────────────────────────────────────────

async def run_fitness_agent(
    user_query: str,
    user_id: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
) -> dict:
    """
    Run the fitness agent graph and return a structured response.

    Args:
        user_query:           The user's message
        user_id:              Authenticated user ID
        conversation_history: List of {role, content} dicts (recent messages)

    Returns:
        {answer, sources, agent, intent, user_profile_loaded}
    """
    graph = await _get_graph()

    # Gather context in parallel
    workout_history, user_profile = await asyncio.gather(
        fetch_user_workout_history(user_id),
        fetch_user_profile(user_id),
    )

    conv_str = format_conversation_history(conversation_history or [])

    initial_state = AgentState(
        user_query=user_query,
        user_id=user_id,
        query_intent="",
        retrieved_docs=[],
        context="",
        workout_history=workout_history,
        user_profile=user_profile,
        conversation_history=conv_str,
        answer="",
        sources=[],
        agent_used="",
        needs_disclaimer=False,
    )

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, graph.invoke, initial_state)

    return {
        "answer":               result["answer"],
        "sources":              result["sources"],
        "agent":                result["agent_used"],
        "intent":               result["query_intent"],
        "user_profile_loaded":  bool(user_profile),
    }
