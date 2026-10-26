"""
Joint angle calculator using MediaPipe pose landmark indices.
Computes 3D angles using world landmarks when available.
Mirrors the frontend computeAngles() function in PoseCanvas.tsx exactly.
"""
import numpy as np
from typing import List, Dict, Optional

# MediaPipe Pose landmark indices (BlazePose 33-point)
NOSE        = 0
L_EAR       = 7;  R_EAR       = 8
L_SHOULDER  = 11; R_SHOULDER  = 12
L_ELBOW     = 13; R_ELBOW     = 14
L_WRIST     = 15; R_WRIST     = 16
L_INDEX     = 19; R_INDEX     = 20
L_HIP       = 23; R_HIP       = 24
L_KNEE      = 25; R_KNEE      = 26
L_ANKLE     = 27; R_ANKLE     = 28
L_HEEL      = 29; R_HEEL      = 30
L_FOOT_IDX  = 31; R_FOOT_IDX  = 32


def _vec(a, b):
    """Vector from b to a (3D if z available, else 2D)."""
    ax = getattr(a, 'x', a[0])
    ay = getattr(a, 'y', a[1])
    az = getattr(a, 'z', 0.0)
    bx = getattr(b, 'x', b[0])
    by = getattr(b, 'y', b[1])
    bz = getattr(b, 'z', 0.0)
    return np.array([ax - bx, ay - by, az - bz], dtype=np.float32)


def angle_between(a, b, c) -> float:
    """3D angle at joint b formed by a-b-c, in degrees."""
    ba = _vec(a, b)
    bc = _vec(c, b)
    mag_ba = np.linalg.norm(ba)
    mag_bc = np.linalg.norm(bc)
    if mag_ba < 1e-9 or mag_bc < 1e-9:
        return 0.0
    cosine = np.dot(ba, bc) / (mag_ba * mag_bc)
    return float(np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0))))


class JointAngleCalculator:
    """Computes key joint angles from MediaPipe pose landmarks (3D-aware)."""

    MIN_VISIBILITY = 0.15

    def _vis(self, lm, idx: int) -> float:
        l = lm[idx]
        return getattr(l, 'visibility', 1.0)

    def compute_all(self, landmarks) -> Dict[str, float]:
        lm = landmarks
        angles: Dict[str, float] = {}

        def safe(a_idx: int, b_idx: int, c_idx: int, name: str):
            try:
                vis = (self._vis(lm, a_idx) *
                       self._vis(lm, b_idx) *
                       self._vis(lm, c_idx))
                if vis < self.MIN_VISIBILITY:
                    angles[name] = angles.get(name, 0.0)
                    return
                angles[name] = round(angle_between(lm[a_idx], lm[b_idx], lm[c_idx]), 1)
            except Exception:
                angles[name] = 0.0

        # ── Arms ─────────────────────────────────────────────────────────────
        safe(L_SHOULDER, L_ELBOW,    L_WRIST,    "left_elbow")
        safe(R_SHOULDER, R_ELBOW,    R_WRIST,    "right_elbow")
        safe(L_ELBOW,    L_SHOULDER, L_HIP,      "left_shoulder")
        safe(R_ELBOW,    R_SHOULDER, R_HIP,      "right_shoulder")
        safe(L_ELBOW,    L_WRIST,    L_INDEX,    "left_wrist")
        safe(R_ELBOW,    R_WRIST,    R_INDEX,    "right_wrist")

        # ── Legs ─────────────────────────────────────────────────────────────
        safe(L_HIP,      L_KNEE,     L_ANKLE,    "left_knee")
        safe(R_HIP,      R_KNEE,     R_ANKLE,    "right_knee")
        safe(L_SHOULDER, L_HIP,      L_KNEE,     "left_hip")
        safe(R_SHOULDER, R_HIP,      R_KNEE,     "right_hip")
        safe(L_KNEE,     L_ANKLE,    L_FOOT_IDX, "left_ankle")
        safe(R_KNEE,     R_ANKLE,    R_FOOT_IDX, "right_ankle")

        # ── Spine / Torso ─────────────────────────────────────────────────────
        safe(L_SHOULDER, L_HIP,      L_ANKLE,    "left_torso")
        safe(R_SHOULDER, R_HIP,      R_ANKLE,    "right_torso")
        safe(L_SHOULDER, L_HIP,      L_KNEE,     "left_spine")
        safe(R_SHOULDER, R_HIP,      R_KNEE,     "right_spine")

        # ── Neck ─────────────────────────────────────────────────────────────
        safe(L_SHOULDER, NOSE,       R_SHOULDER, "neck_tilt")

        # ── Averages ─────────────────────────────────────────────────────────
        def avg(k1: str, k2: str, out: str):
            angles[out] = round((angles.get(k1, 0.0) + angles.get(k2, 0.0)) / 2, 1)

        avg("left_elbow",    "right_elbow",    "avg_elbow")
        avg("left_shoulder", "right_shoulder",  "avg_shoulder")
        avg("left_knee",     "right_knee",      "avg_knee")
        avg("left_hip",      "right_hip",       "avg_hip")
        avg("left_torso",    "right_torso",     "avg_torso")
        avg("left_spine",    "right_spine",     "avg_spine")
        avg("left_ankle",    "right_ankle",     "avg_ankle")

        return angles
