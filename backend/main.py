from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routers import auth, workout, analytics, coach
from websocket.pose_ws import pose_websocket_handler
from core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown


app = FastAPI(
    title="FitMentor AI API",
    description="AI-powered virtual fitness trainer backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(auth.router, prefix="/api")
app.include_router(workout.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(coach.router, prefix="/api")


# WebSocket
@app.websocket("/ws/pose")
async def pose_ws(websocket: WebSocket):
    await pose_websocket_handler(websocket)


@app.get("/")
async def root():
    return {
        "name": "FitMentor AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
