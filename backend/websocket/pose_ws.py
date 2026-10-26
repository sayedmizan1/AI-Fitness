import json
import asyncio
import base64
import logging
from fastapi import WebSocket, WebSocketDisconnect
from core.security import decode_token
import sys, os

logger = logging.getLogger(__name__)

# Add the PROJECT ROOT to path so `ai.*` package imports work
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


async def pose_websocket_handler(websocket: WebSocket):
    """
    WebSocket endpoint for real-time pose detection.
    
    Protocol:
    - Client sends: { "token": "...", "action": "frame", "data": "<base64 jpeg>" }
    - Server sends: { "landmarks": [...], "angles": {...}, "exercise": "...", 
                      "reps": N, "form_score": N, "corrections": [...], "state": "..." }
    """
    await websocket.accept()
    
    # Authenticate
    try:
        auth_msg = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        auth_data = json.loads(auth_msg)
        token = auth_data.get("token", "")
        payload = decode_token(token)
        if not payload:
            await websocket.send_json({"error": "Unauthorized"})
            await websocket.close()
            return
        user_id = payload.get("sub")
    except Exception:
        await websocket.close()
        return

    # Load AI engines (lazy)
    mediapipe_engine = None
    rep_counter = None
    form_analyzer = None
    
    try:
        from ai.pose.mediapipe_engine import PoseEngine
        from ai.exercises.rep_counter import RepCounter
        from ai.form.analyzer import FormAnalyzer
        mediapipe_engine = PoseEngine()
        rep_counter = RepCounter()
        form_analyzer = FormAnalyzer()
        logger.info("AI pose engines loaded successfully")
    except Exception as e:
        logger.error(f"AI engines failed to load: {e}", exc_info=True)
        await websocket.send_json({"warning": f"AI engines not loaded: {str(e)}"})

    await websocket.send_json({"status": "connected", "user_id": user_id})

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            action = data.get("action")

            if action == "frame" and mediapipe_engine:
                # Decode base64 image
                img_b64 = data.get("data", "")
                img_bytes = base64.b64decode(img_b64)
                
                # Run MediaPipe
                result = mediapipe_engine.process_frame_bytes(img_bytes)
                
                if result["detected"]:
                    landmarks = result["landmarks"]
                    angles = result["angles"]
                    
                    # Recognize exercise + count reps
                    exercise = rep_counter.detect_exercise(angles)
                    reps, state = rep_counter.count_rep(exercise, angles)
                    
                    # Form analysis
                    form_result = form_analyzer.analyze(exercise, landmarks, angles)
                    
                    await websocket.send_json({
                        "detected": True,
                        "landmarks": landmarks,
                        "angles": angles,
                        "exercise": exercise,
                        "reps": reps,
                        "state": state,
                        "form_score": form_result["score"],
                        "corrections": form_result["corrections"],
                        "mistakes": form_result["mistakes"],
                    })
                else:
                    await websocket.send_json({"detected": False})

            elif action == "reset":
                if rep_counter:
                    rep_counter.reset()
                await websocket.send_json({"status": "reset"})

            elif action == "ping":
                await websocket.send_json({"status": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
