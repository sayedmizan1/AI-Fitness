"""
Rep counter with hysteresis FSM and confidence-voted exercise detection.
Matches the frontend PoseCanvas.tsx RepCounterEngine logic exactly.
"""
from typing import Dict, Tuple, Optional
from .exercise_configs import EXERCISE_CONFIGS, EXERCISE_PRIORITY

HYSTERESIS = 8  # degrees — prevents jitter-induced false rep counts
CONFIRM_FRAMES = 6  # frames needed to confirm exercise switch
RELEASE_FRAMES = 20  # frames without match before releasing exercise


def angle_in_range(value: float, range_tuple: tuple) -> bool:
    return range_tuple[0] <= value <= range_tuple[1]


def match_state(angles: Dict[str, float], state_def: Dict) -> bool:
    return all(
        angle_in_range(angles.get(k, 0), v)
        for k, v in state_def.items()
        if k != "msg"
    )


class ExerciseClassifier:
    """Confidence-voted exercise classifier — requires N consecutive frames."""

    def __init__(self):
        self.candidate: Optional[str] = None
        self.candidate_count: int = 0
        self.current: Optional[str] = None
        self.no_match_count: int = 0

    def classify(self, angles: Dict[str, float]) -> Optional[str]:
        matched = None
        for exercise in EXERCISE_PRIORITY:
            config = EXERCISE_CONFIGS[exercise]
            recognition = config["recognition"]
            if all(
                angle_in_range(angles.get(k, -1), v)
                for k, v in recognition.items()
            ):
                matched = exercise
                break

        if matched == self.current:
            self.no_match_count = 0
            self.candidate_count = 0
            self.candidate = None
            return self.current

        if matched is None:
            self.no_match_count += 1
            if self.no_match_count >= RELEASE_FRAMES:
                self.current = None
                self.candidate = None
                self.candidate_count = 0
            return self.current

        # New candidate
        if matched != self.candidate:
            self.candidate = matched
            self.candidate_count = 1
        else:
            self.candidate_count += 1

        if self.candidate_count >= CONFIRM_FRAMES:
            self.current = matched
            self.candidate = None
            self.candidate_count = 0
            self.no_match_count = 0

        return self.current

    def reset(self):
        self.candidate = None
        self.candidate_count = 0
        self.current = None
        self.no_match_count = 0


class RepCounter:
    """
    Hysteresis FSM rep counter for all exercises.
    Mirrors the frontend RepCounterEngine class.
    """

    # Exercises where up/down thresholds are inverted (angle decreases to rep)
    CURL_STYLE = {"bicep_curl", "pullup"}
    TIMED_EXERCISES = {"plank", "wall_sit"}

    def __init__(self):
        self.reset()

    def reset(self):
        self.reps: Dict[str, int] = {ex: 0 for ex in EXERCISE_CONFIGS}
        self.phases: Dict[str, str] = {ex: "up" for ex in EXERCISE_CONFIGS}
        self.hold_frames: Dict[str, int] = {ex: 0 for ex in EXERCISE_CONFIGS}
        self.down_dwell: Dict[str, int] = {ex: 0 for ex in EXERCISE_CONFIGS}
        self.current_exercise: Optional[str] = None

    def detect_exercise(self, angles: Dict[str, float]) -> Optional[str]:
        """Kept for backward compat — use ExerciseClassifier for production."""
        for exercise in EXERCISE_PRIORITY:
            config = EXERCISE_CONFIGS[exercise]
            if all(
                angle_in_range(angles.get(k, -1), v)
                for k, v in config["recognition"].items()
            ):
                self.current_exercise = exercise
                return exercise
        self.current_exercise = None
        return None

    def count_rep(
        self, exercise: Optional[str], angles: Dict[str, float]
    ) -> Tuple[int, str]:
        """Update FSM and return (rep_count, current_phase)."""
        if not exercise or exercise not in EXERCISE_CONFIGS:
            return 0, "unknown"

        config = EXERCISE_CONFIGS[exercise]
        states_def = config["rep_states"]
        is_timed = config.get("is_timed", False)
        reps = self.reps[exercise]

        # ── Timed exercises (plank, wall sit) ───────────────────────────────
        if is_timed:
            hold_def = {k: v for k, v in states_def.get("hold", {}).items()}
            if match_state(angles, hold_def):
                self.hold_frames[exercise] += 1
                hold_secs = self.hold_frames[exercise] // 30  # ~30fps
                return hold_secs, "holding"
            return self.hold_frames[exercise] // 30, "rest"

        up_def   = {k: v for k, v in states_def.get("up",   {}).items()}
        down_def = {k: v for k, v in states_def.get("down", {}).items()}

        # ── Curl-style: angle decreases to rep ─────────────────────────────
        if exercise in self.CURL_STYLE:
            if self.phases[exercise] == "up" and match_state(angles, down_def):
                self.phases[exercise] = "down"
                self.down_dwell[exercise] = 0
            elif self.phases[exercise] == "down":
                self.down_dwell[exercise] += 1
                if match_state(angles, up_def) and self.down_dwell[exercise] >= 3:
                    self.reps[exercise] += 1
                    self.phases[exercise] = "up"
                    self.down_dwell[exercise] = 0
                    reps = self.reps[exercise]

        # ── Standard: angle decreases going DOWN ────────────────────────────
        else:
            if self.phases[exercise] == "up" and match_state(angles, down_def):
                self.phases[exercise] = "down"
                self.down_dwell[exercise] = 0
            elif self.phases[exercise] == "down":
                self.down_dwell[exercise] += 1
                if match_state(angles, up_def) and self.down_dwell[exercise] >= 3:
                    self.reps[exercise] += 1
                    self.phases[exercise] = "up"
                    self.down_dwell[exercise] = 0
                    reps = self.reps[exercise]

        return reps, self.phases[exercise]

    def get_all_reps(self) -> Dict[str, int]:
        return dict(self.reps)
