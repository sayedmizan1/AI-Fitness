"""
MediaPipe Pose wrapper using the new Tasks API (mediapipe >= 0.10).
Uses PoseLandmarker with the full model for accurate landmark detection.
"""
import cv2
import numpy as np
import os
from typing import Optional
from .joint_angles import JointAngleCalculator

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode

# Path to the .task model file (downloaded alongside this module)
_HERE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(_HERE, "pose_landmarker_full.task")

# MediaPipe 0.10 landmark indices (same physical positions as before)
LANDMARK_NAMES = [
    "NOSE", "LEFT_EYE_INNER", "LEFT_EYE", "LEFT_EYE_OUTER",
    "RIGHT_EYE_INNER", "RIGHT_EYE", "RIGHT_EYE_OUTER",
    "LEFT_EAR", "RIGHT_EAR", "MOUTH_LEFT", "MOUTH_RIGHT",
    "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW",
    "LEFT_WRIST", "RIGHT_WRIST", "LEFT_PINKY", "RIGHT_PINKY",
    "LEFT_INDEX", "RIGHT_INDEX", "LEFT_THUMB", "RIGHT_THUMB",
    "LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE",
    "LEFT_ANKLE", "RIGHT_ANKLE", "LEFT_HEEL", "RIGHT_HEEL",
    "LEFT_FOOT_INDEX", "RIGHT_FOOT_INDEX",
]


class _LandmarkProxy:
    """Adapter so JointAngleCalculator (which accesses .x/.y via index) works with the Tasks API."""
    __slots__ = ("x", "y", "z", "visibility")

    def __init__(self, lm):
        self.x = lm.x
        self.y = lm.y
        self.z = lm.z
        self.visibility = lm.visibility if hasattr(lm, "visibility") else 1.0


class PoseEngine:
    """MediaPipe Pose wrapper using the Tasks API (mediapipe >= 0.10)."""

    def __init__(self):
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Pose model not found at {MODEL_PATH}. "
                "Run: python -c \"import urllib.request; "
                "urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/"
                "pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task', "
                f"'{MODEL_PATH}')\" "
            )

        base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
        options = PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.landmarker = PoseLandmarker.create_from_options(options)
        self.angle_calc = JointAngleCalculator()

    def process_frame_bytes(self, img_bytes: bytes) -> dict:
        """Process a JPEG image as bytes and return landmarks + angles."""
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"detected": False}
        return self.process_frame(frame)

    def process_frame(self, frame: np.ndarray) -> dict:
        """Process a CV2 (BGR) frame and return landmarks + joint angles."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self.landmarker.detect(mp_image)

        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            return {"detected": False}

        raw_landmarks = result.pose_landmarks[0]  # first detected person

        # Build serializable landmark list
        landmarks = []
        for i, lm in enumerate(raw_landmarks):
            landmarks.append({
                "name": LANDMARK_NAMES[i] if i < len(LANDMARK_NAMES) else str(i),
                "x": round(lm.x, 4),
                "y": round(lm.y, 4),
                "z": round(lm.z, 4),
                "visibility": round(getattr(lm, "visibility", 1.0), 3),
            })

        # Wrap landmarks in proxy objects for JointAngleCalculator
        proxies = [_LandmarkProxy(lm) for lm in raw_landmarks]
        angles = self.angle_calc.compute_all(proxies)

        return {
            "detected": True,
            "landmarks": landmarks,
            "angles": angles,
        }

    def __del__(self):
        if hasattr(self, "landmarker") and self.landmarker:
            try:
                self.landmarker.close()
            except Exception:
                pass
