"""
Advanced Form Analyzer — Elite Biomechanical Engine (Python backend)

• Mirrors the upgraded frontend FORM_RULES in PoseCanvas.tsx exactly
• 40+ angle-range rules with grace zones
• Scaled penalties based on deviation magnitude
• 15+ coordinate-based checks: knee cave, elbow flare, hip shift, asymmetry
• Returns corrections ranked by severity penalty
• Bilateral symmetry score
"""
from typing import Dict, List, Optional, Tuple
import math


def angle_in_range(value: float, r: tuple, grace: float = 0) -> bool:
    return (r[0] - grace) <= value <= (r[1] + grace)


# Severity penalty weights — must match frontend SEVERITY_PENALTY
SEVERITY_PENALTY = {"critical": 40, "warn": 22, "tip": 10}

# Extended form rules with grace zones, mirroring frontend FORM_RULES
FORM_RULES: Dict[str, List[Dict]] = {
    "squat": [
        {"key": "left_torso",  "good_range": (142, 180), "severity": "critical", "grace": 4, "msg": "Keep your chest up — back is rounding"},
        {"key": "right_torso", "good_range": (142, 180), "severity": "critical", "grace": 4, "msg": "Right side collapsing — keep chest tall"},
        {"key": "avg_spine",   "good_range": (138, 180), "severity": "warn",     "grace": 4, "msg": "Maintain a neutral spine throughout"},
        {"key": "left_knee",   "good_range": (45, 165),  "severity": "tip",      "grace": 0, "msg": "Go deeper — aim for thighs parallel to floor"},
        {"key": "avg_ankle",   "good_range": (58, 112),  "severity": "warn",     "grace": 5, "msg": "Heels lifting — stay flat-footed"},
        {"key": "neck_tilt",   "good_range": (118, 172), "severity": "tip",      "grace": 0, "msg": "Look straight ahead — neutral neck position"},
    ],
    "deadlift": [
        {"key": "left_torso",  "good_range": (128, 180), "severity": "critical", "grace": 3, "msg": "Brace your core — spine is rounding dangerously"},
        {"key": "right_torso", "good_range": (128, 180), "severity": "critical", "grace": 3, "msg": "Right side rounding — keep back flat"},
        {"key": "avg_spine",   "good_range": (133, 180), "severity": "critical", "grace": 3, "msg": "Neutral spine is non-negotiable — reset if needed"},
        {"key": "avg_knee",    "good_range": (120, 180), "severity": "warn",     "grace": 5, "msg": "Keep legs straighter — this is a hip hinge"},
        {"key": "neck_tilt",   "good_range": (113, 172), "severity": "tip",      "grace": 0, "msg": "Neck neutral — look at floor 2 feet ahead"},
    ],
    "pushup": [
        {"key": "avg_torso",   "good_range": (153, 180), "severity": "critical", "grace": 3, "msg": "Body must be a straight line — hips are sagging"},
        {"key": "left_torso",  "good_range": (153, 180), "severity": "critical", "grace": 3, "msg": "Left side dropping — squeeze core and glutes"},
        {"key": "right_torso", "good_range": (153, 180), "severity": "warn",     "grace": 4, "msg": "Right side lower — level your hips"},
        {"key": "avg_elbow",   "good_range": (53, 102),  "severity": "tip",      "grace": 0, "msg": "Lower chest to 1cm from floor for full range"},
        {"key": "avg_shoulder","good_range": (28, 82),   "severity": "warn",     "grace": 0, "msg": "Elbows at 45° — reduces shoulder impingement risk"},
        {"key": "neck_tilt",   "good_range": (118, 177), "severity": "tip",      "grace": 0, "msg": "Neck neutral — eyes on floor 12 inches forward"},
    ],
    "bicep_curl": [
        {"key": "avg_shoulder", "good_range": (150, 180), "severity": "critical", "grace": 4, "msg": "Stop swinging — lock elbows at your sides"},
        {"key": "left_shoulder","good_range": (150, 180), "severity": "warn",     "grace": 5, "msg": "Left elbow drifting — pin it to your side"},
        {"key": "right_shoulder","good_range": (150, 180),"severity": "warn",     "grace": 5, "msg": "Right elbow drifting — control that arm"},
        {"key": "avg_elbow",   "good_range": (22, 68),   "severity": "tip",      "grace": 0, "msg": "Curl all the way up — squeeze hard at the top"},
        {"key": "avg_wrist",   "good_range": (138, 180), "severity": "warn",     "grace": 0, "msg": "Keep wrists straight — curled wrists reduce force"},
    ],
    "shoulder_press": [
        {"key": "avg_torso",   "good_range": (148, 180), "severity": "critical", "grace": 4, "msg": "Stop arching lower back — brace core hard"},
        {"key": "left_torso",  "good_range": (148, 180), "severity": "warn",     "grace": 5, "msg": "Left side arching — engage core on that side"},
        {"key": "avg_elbow",   "good_range": (152, 180), "severity": "tip",      "grace": 0, "msg": "Lock arms fully at the top — complete each rep"},
        {"key": "avg_shoulder","good_range": (78, 162),  "severity": "warn",     "grace": 0, "msg": "Elbows slightly in front — not flared out wide"},
    ],
    "lateral_raise": [
        {"key": "avg_elbow",   "good_range": (141, 180), "severity": "warn",     "grace": 0, "msg": "Keep arms nearly straight — too much bend shifts load"},
        {"key": "avg_shoulder","good_range": (70, 107),  "severity": "tip",      "grace": 0, "msg": "Raise to shoulder level only — higher = trap recruitment"},
        {"key": "avg_torso",   "good_range": (143, 180), "severity": "critical", "grace": 0, "msg": "Stop swinging torso — isolate the deltoid"},
        {"key": "left_shoulder","good_range": (66, 112), "severity": "warn",     "grace": 0, "msg": "Left arm lagging — match it to the right side"},
        {"key": "right_shoulder","good_range": (66, 112),"severity": "warn",     "grace": 0, "msg": "Right arm lagging — raise it evenly with the left"},
    ],
    "lunge": [
        {"key": "avg_torso",   "good_range": (141, 180), "severity": "critical", "grace": 4, "msg": "Keep torso upright — forward lean overloads knees"},
        {"key": "left_knee",   "good_range": (76, 110),  "severity": "warn",     "grace": 0, "msg": "Front knee at 90° — track over the second toe"},
        {"key": "right_knee",  "good_range": (68, 122),  "severity": "tip",      "grace": 0, "msg": "Back knee should graze the floor at the bottom"},
        {"key": "avg_spine",   "good_range": (136, 180), "severity": "warn",     "grace": 0, "msg": "Spine neutral — don't let back round under load"},
    ],
    "plank": [
        {"key": "avg_torso",   "good_range": (152, 180), "severity": "critical", "grace": 3, "msg": "Hips sagging — squeeze glutes and abs NOW"},
        {"key": "avg_spine",   "good_range": (152, 180), "severity": "critical", "grace": 3, "msg": "Hips piking up — lower them to straight"},
        {"key": "avg_elbow",   "good_range": (76, 104),  "severity": "warn",     "grace": 0, "msg": "Elbows directly under shoulders for stability"},
        {"key": "neck_tilt",   "good_range": (113, 172), "severity": "warn",     "grace": 0, "msg": "Neutral neck — look straight down, not forward"},
    ],
    "wall_sit": [
        {"key": "avg_knee",    "good_range": (76, 104),  "severity": "critical", "grace": 3, "msg": "Thighs must be parallel to floor — adjust position"},
        {"key": "avg_torso",   "good_range": (152, 180), "severity": "warn",     "grace": 0, "msg": "Back flat against the wall — no gap behind lower back"},
        {"key": "avg_ankle",   "good_range": (78, 112),  "severity": "tip",      "grace": 0, "msg": "Feet flat on floor, directly under knees"},
    ],
    "pullup": [
        {"key": "avg_elbow",   "good_range": (150, 180), "severity": "tip",      "grace": 0, "msg": "Full dead hang at bottom — don't short-rep"},
        {"key": "avg_shoulder","good_range": (30, 92),   "severity": "warn",     "grace": 0, "msg": "Control the movement — no kipping or swinging"},
        {"key": "avg_torso",   "good_range": (138, 180), "severity": "warn",     "grace": 0, "msg": "Hollow body — core engaged throughout"},
    ],
    "tricep_dip": [
        {"key": "avg_torso",   "good_range": (141, 180), "severity": "critical", "grace": 4, "msg": "Keep torso upright — leaning forward shifts load to chest"},
        {"key": "avg_elbow",   "good_range": (76, 104),  "severity": "tip",      "grace": 0, "msg": "Elbows to 90° at the bottom for full range"},
        {"key": "avg_shoulder","good_range": (83, 167),  "severity": "warn",     "grace": 0, "msg": "Shoulders down and back — don't shrug at bottom"},
    ],
    "glute_bridge": [
        {"key": "avg_hip",     "good_range": (96, 134),  "severity": "tip",      "grace": 0, "msg": "Push hips higher — squeeze glutes hard at the top"},
        {"key": "avg_knee",    "good_range": (76, 110),  "severity": "warn",     "grace": 0, "msg": "Keep feet flat, knees tracking over toes at 90°"},
        {"key": "avg_spine",   "good_range": (128, 180), "severity": "warn",     "grace": 0, "msg": "Don't hyperextend lower back — use glutes, not back"},
    ],
}


def compute_symmetry(angles: Dict[str, float]) -> int:
    """Bilateral symmetry score from left/right angle comparison."""
    pairs = [
        ("left_knee", "right_knee"),
        ("left_elbow", "right_elbow"),
        ("left_shoulder", "right_shoulder"),
        ("left_hip", "right_hip"),
        ("left_torso", "right_torso"),
    ]
    total_diff, count = 0.0, 0
    for l, r in pairs:
        lv, rv = angles.get(l, 0), angles.get(r, 0)
        if lv > 0 and rv > 0:
            total_diff += abs(lv - rv)
            count += 1
    if count == 0:
        return 100
    avg_diff = total_diff / count
    return max(40, round(100 - avg_diff * 1.8))


class FormAnalyzer:
    """
    Elite biomechanical form analyzer.
    Matches the upgraded frontend analyzeForm() in PoseCanvas.tsx.
    """

    def analyze(
        self,
        exercise: Optional[str],
        landmarks: List[dict],
        angles: Dict[str, float],
    ) -> Dict:
        if not exercise or exercise not in FORM_RULES:
            return {"score": 0, "mistakes": [], "corrections": [], "symmetry": 100}

        rules = FORM_RULES[exercise]
        all_corrections: List[Dict] = []
        deduction = 0.0

        for rule in rules:
            angle_key = rule["key"]
            good_range = rule["good_range"]
            grace = rule.get("grace", 0)
            val = angles.get(angle_key, 0)

            if val == 0:
                continue  # Skip missing landmarks

            lo, hi = good_range
            if not ((lo - grace) <= val <= (hi + grace)):
                dist = (lo - val) if val < lo else (val - hi)
                base_pen = SEVERITY_PENALTY.get(rule["severity"], 20)
                scaled = min(base_pen * 1.4, base_pen * (1 + dist / 30))
                all_corrections.append({"msg": rule["msg"], "penalty": round(scaled)})
                deduction += round(scaled)

        # Coordinate-based checks
        coord_issues = self._coordinate_checks(exercise, landmarks, angles)
        for issue in coord_issues:
            pen = SEVERITY_PENALTY.get(issue["severity"], 20)
            all_corrections.append({"msg": issue["msg"], "penalty": pen})
            deduction += pen

        # Sort by penalty (most critical first)
        all_corrections.sort(key=lambda x: -x["penalty"])

        score = max(0, round(100 - deduction))
        symmetry = compute_symmetry(angles)

        return {
            "score": score,
            "mistakes": [c["msg"] for c in all_corrections],
            "corrections": [c["msg"] for c in all_corrections[:3]],
            "symmetry": symmetry,
        }

    def _coordinate_checks(
        self,
        exercise: str,
        landmarks: List[dict],
        angles: Dict[str, float],
    ) -> List[Dict]:
        """Landmark x/y coordinate checks beyond simple angle rules."""
        # Build index map: MediaPipe landmark index -> dict
        lm = {i: l for i, l in enumerate(landmarks) if isinstance(l, dict)}

        def get(i):
            return lm.get(i)

        def vis(i):
            return lm.get(i, {}).get("visibility", 0)

        def vp(a, b):
            return vis(a) > 0.38 and vis(b) > 0.38

        results = []

        if exercise == "squat":
            # Knee cave: left
            if vp(25, 27):
                lk, la = get(25), get(27)
                if lk and la and abs(lk["x"] - la["x"]) > 0.10:
                    results.append({"msg": "Push your knees OUT — they're caving inward (valgus collapse)", "severity": "critical"})
            # Knee cave: right
            if vp(26, 28):
                rk, ra = get(26), get(28)
                if rk and ra and abs(rk["x"] - ra["x"]) > 0.10:
                    results.append({"msg": "Right knee caving — push knees outward over toes", "severity": "critical"})
            # Hip shift
            if vis(23) > 0.4 and vis(24) > 0.4 and vis(27) > 0.4 and vis(28) > 0.4:
                hip_x = (get(23)["x"] + get(24)["x"]) / 2
                ank_x = (get(27)["x"] + get(28)["x"]) / 2
                if abs(hip_x - ank_x) > 0.13:
                    results.append({"msg": "Hip shift — keep weight centered between both feet", "severity": "warn"})

        elif exercise == "deadlift":
            if vp(11, 23):
                sh, hip = get(11), get(23)
                if sh and hip and sh["x"] > hip["x"] + 0.15:
                    results.append({"msg": "Shoulders drifting too far forward — bar stays close to body", "severity": "critical"})

        elif exercise == "pushup":
            if vp(13, 11):
                elbow, shoulder = get(13), get(11)
                if elbow and shoulder and abs(elbow["x"] - shoulder["x"]) > 0.18:
                    results.append({"msg": "Elbows flaring out — tuck them to 45° to protect shoulders", "severity": "warn"})
            if vis(23) > 0.4 and vis(11) > 0.4 and vis(25) > 0.4:
                hip, sh, knee = get(23), get(11), get(25)
                mid_y = (sh["y"] + knee["y"]) / 2
                if hip and abs(hip["y"] - mid_y) > 0.06:
                    results.append({"msg": "Body not straight — hips sagging or piking", "severity": "critical"})

        elif exercise == "bicep_curl":
            if vp(13, 23):
                elbow, hip = get(13), get(23)
                if elbow and hip and elbow["y"] < hip["y"] - 0.12:
                    results.append({"msg": "Left elbow lifting forward — pin it to your side", "severity": "critical"})
            if vp(14, 24):
                elbow, hip = get(14), get(24)
                if elbow and hip and elbow["y"] < hip["y"] - 0.12:
                    results.append({"msg": "Right elbow lifting forward — pin it to your side", "severity": "critical"})
            if vp(15, 16):
                lw, rw = get(15), get(16)
                if lw and rw and abs(lw["y"] - rw["y"]) > 0.09:
                    results.append({"msg": "Uneven curl — left and right arms at different heights", "severity": "warn"})

        elif exercise == "shoulder_press":
            if vp(15, 16):
                lw, rw = get(15), get(16)
                if lw and rw and abs(lw["y"] - rw["y"]) > 0.07:
                    results.append({"msg": "Uneven press — one arm is leading the other", "severity": "warn"})

        elif exercise == "lunge":
            if vp(25, 31):
                knee, foot = get(25), get(31)
                if knee and foot and abs(knee["x"] - foot["x"]) > 0.09:
                    results.append({"msg": "Front knee past toes — step further forward to protect joint", "severity": "critical"})
            if vp(11, 12):
                lsh, rsh = get(11), get(12)
                if lsh and rsh and abs(lsh["y"] - rsh["y"]) > 0.07:
                    results.append({"msg": "Shoulder tilt detected — keep shoulders level throughout", "severity": "warn"})

        elif exercise == "plank":
            if vp(23, 24):
                lh, rh = get(23), get(24)
                if lh and rh and abs(lh["y"] - rh["y"]) > 0.06:
                    results.append({"msg": "Hips rotated — keep pelvis square and level", "severity": "warn"})
            if vp(13, 11):
                elbow, sh = get(13), get(11)
                if elbow and sh and abs(elbow["x"] - sh["x"]) > 0.10:
                    results.append({"msg": "Elbows not under shoulders — reposition for proper load", "severity": "warn"})

        elif exercise == "glute_bridge":
            if vp(23, 24):
                lh, rh = get(23), get(24)
                if lh and rh and abs(lh["y"] - rh["y"]) > 0.07:
                    results.append({"msg": "Hip rotation — push both sides up evenly", "severity": "warn"})

        elif exercise == "lateral_raise":
            if vp(15, 16):
                lw, rw = get(15), get(16)
                if lw and rw and abs(lw["y"] - rw["y"]) > 0.09:
                    results.append({"msg": "Uneven raise — one arm higher than the other", "severity": "warn"})

        elif exercise == "pullup":
            if vp(15, 16):
                lw, rw = get(15), get(16)
                if lw and rw and abs(lw["y"] - rw["y"]) > 0.09:
                    results.append({"msg": "One arm pulling more — focus on even bilateral pull", "severity": "warn"})

        return results[:2]  # max 2 coordinate corrections
