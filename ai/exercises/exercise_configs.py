"""
Exercise configurations for 12 exercises.
Biomechanical angle thresholds — all angles in degrees.
Matches the frontend PoseCanvas.tsx EXERCISES config exactly.
"""

EXERCISE_CONFIGS = {
    # ── SQUAT ────────────────────────────────────────────────────────────────
    "squat": {
        "recognition": {
            "avg_knee": (45, 175),
            "avg_hip":  (45, 175),
            "avg_torso":(60, 175),
        },
        "rep_states": {
            "up":   {"avg_knee": (155, 180)},   # standing
            "down": {"avg_knee": (45, 105)},     # below parallel
        },
        "form_rules": {
            "back_rounding": {"left_torso": (145, 180), "msg": "Keep your chest up — back is rounding"},
            "spine_neutral":  {"avg_spine":  (140, 180), "msg": "Maintain a neutral spine throughout"},
            "squat_depth":    {"avg_knee":   (60, 120),  "msg": "Go deeper — aim for thighs parallel"},
        },
        "display_name": "Squat",
        "muscles": ["Quadriceps", "Glutes", "Hamstrings", "Core"],
    },

    # ── DEADLIFT ─────────────────────────────────────────────────────────────
    "deadlift": {
        "recognition": {
            "avg_hip":   (40, 165),
            "avg_knee":  (120, 180),
            "avg_torso": (50, 170),
        },
        "rep_states": {
            "down": {"avg_hip": (40, 100)},     # hip hinge
            "up":   {"avg_hip": (155, 180)},    # standing
        },
        "form_rules": {
            "spine_neutral": {"left_torso":  (130, 180), "msg": "Brace your core — spine is rounding"},
            "lower_back":    {"avg_spine":   (135, 180), "msg": "Neutral spine — don't round your lower back"},
        },
        "display_name": "Deadlift",
        "muscles": ["Hamstrings", "Glutes", "Lower Back", "Traps"],
    },

    # ── PUSH-UP ─────────────────────────────────────────────────────────────
    "pushup": {
        "recognition": {
            "avg_elbow":  (50, 175),
            "avg_torso":  (140, 180),
            "avg_shoulder": (30, 100),
        },
        "rep_states": {
            "up":   {"avg_elbow": (150, 180)},  # arms extended
            "down": {"avg_elbow": (50, 95)},    # chest near floor
        },
        "form_rules": {
            "body_alignment": {"avg_torso":  (155, 180), "msg": "Body must form a straight line — hips sagging"},
            "elbow_depth":    {"avg_elbow":  (55, 100),  "msg": "Lower your chest closer to the floor"},
            "core_brace":     {"left_torso": (155, 180), "msg": "Brace your core and squeeze your glutes"},
        },
        "display_name": "Push-up",
        "muscles": ["Chest", "Triceps", "Anterior Deltoid", "Core"],
    },

    # ── BICEP CURL ──────────────────────────────────────────────────────────
    "bicep_curl": {
        "recognition": {
            "avg_elbow":   (25, 165),
            "avg_shoulder":(140, 180),
        },
        "rep_states": {
            "down": {"avg_elbow": (145, 180)},  # arm extended
            "up":   {"avg_elbow": (25, 65)},    # fully curled
        },
        "form_rules": {
            "swinging":   {"avg_shoulder": (155, 180), "msg": "Stop swinging — lock your elbows at your sides"},
            "full_curl":  {"avg_elbow":    (25, 70),   "msg": "Curl all the way up — squeeze at the top"},
        },
        "display_name": "Bicep Curl",
        "muscles": ["Biceps Brachii", "Brachialis", "Forearms"],
    },

    # ── SHOULDER PRESS ──────────────────────────────────────────────────────
    "shoulder_press": {
        "recognition": {
            "avg_elbow":   (60, 175),
            "avg_shoulder":(70, 150),
        },
        "rep_states": {
            "down": {"avg_elbow": (60, 100), "avg_shoulder": (75, 140)},
            "up":   {"avg_elbow": (155, 180)},
        },
        "form_rules": {
            "lower_back":  {"avg_torso":  (150, 180), "msg": "Stop arching your lower back — engage your core"},
            "lockout":     {"avg_elbow":  (155, 180), "msg": "Lock arms fully at the top of each rep"},
        },
        "display_name": "Shoulder Press",
        "muscles": ["Deltoids", "Triceps", "Upper Traps"],
    },

    # ── LATERAL RAISE ───────────────────────────────────────────────────────
    "lateral_raise": {
        "recognition": {
            "avg_shoulder": (40, 110),
            "avg_elbow":    (150, 180),
        },
        "rep_states": {
            "down": {"avg_shoulder": (10, 30)},
            "up":   {"avg_shoulder": (80, 110)},
        },
        "form_rules": {
            "elbow_bend":  {"avg_elbow":   (145, 180), "msg": "Keep arms nearly straight — slight bend only"},
            "raise_height":{"avg_shoulder":(75, 100),  "msg": "Raise to shoulder level — no higher"},
        },
        "display_name": "Lateral Raise",
        "muscles": ["Medial Deltoid", "Supraspinatus"],
    },

    # ── LUNGE ────────────────────────────────────────────────────────────────
    "lunge": {
        "recognition": {
            "left_knee":  (45, 165),
            "right_knee": (45, 165),
            "avg_torso":  (120, 180),
        },
        "rep_states": {
            "up":   {"avg_knee": (150, 180)},
            "down": {"left_knee": (80, 110), "right_knee": (45, 130)},
        },
        "form_rules": {
            "torso_lean": {"avg_torso":  (145, 180), "msg": "Keep your torso upright and tall"},
            "knee_angle": {"left_knee":  (80, 105),  "msg": "Front knee should be at 90° at the bottom"},
        },
        "display_name": "Lunge",
        "muscles": ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    },

    # ── PLANK ────────────────────────────────────────────────────────────────
    "plank": {
        "recognition": {
            "avg_torso":  (150, 180),
            "avg_elbow":  (75, 105),
        },
        "rep_states": {
            "hold": {"avg_torso": (150, 180)},
        },
        "is_timed": True,
        "form_rules": {
            "hip_sag":   {"avg_torso": (155, 180), "msg": "Hips sagging — squeeze glutes & core hard"},
            "hip_pike":  {"avg_spine": (155, 180), "msg": "Don't let your hips pike up or drop down"},
        },
        "display_name": "Plank",
        "muscles": ["Core", "Glutes", "Shoulders", "Transverse Abdominis"],
    },

    # ── WALL SIT ─────────────────────────────────────────────────────────────
    "wall_sit": {
        "recognition": {
            "avg_knee":  (75, 105),
            "avg_torso": (150, 180),
        },
        "rep_states": {
            "hold": {"avg_knee": (75, 105), "avg_torso": (150, 180)},
        },
        "is_timed": True,
        "form_rules": {
            "knee_angle": {"avg_knee":  (80, 100),  "msg": "Thighs must be parallel to the floor"},
            "back_flat":  {"avg_torso": (155, 180), "msg": "Keep your back flat against the wall"},
        },
        "display_name": "Wall Sit",
        "muscles": ["Quadriceps", "Glutes", "Calves"],
    },

    # ── PULL-UP ──────────────────────────────────────────────────────────────
    "pullup": {
        "recognition": {
            "avg_elbow":   (25, 155),
            "avg_shoulder":(25, 125),
        },
        "rep_states": {
            "down": {"avg_elbow": (145, 180)},  # dead hang
            "up":   {"avg_elbow": (25, 65)},    # chin over bar
        },
        "form_rules": {
            "dead_hang":   {"avg_elbow":   (155, 180), "msg": "Fully extend at the bottom — dead hang"},
            "kipping":     {"avg_shoulder":(35, 90),   "msg": "Control the movement — avoid kipping"},
        },
        "display_name": "Pull-up",
        "muscles": ["Latissimus Dorsi", "Biceps", "Rear Deltoids"],
    },

    # ── TRICEP DIP ───────────────────────────────────────────────────────────
    "tricep_dip": {
        "recognition": {
            "avg_elbow":   (55, 165),
            "avg_shoulder":(90, 160),
        },
        "rep_states": {
            "down": {"avg_elbow": (80, 100)},
            "up":   {"avg_elbow": (150, 180)},
        },
        "form_rules": {
            "torso_lean": {"avg_torso": (145, 180), "msg": "Keep your torso upright — don't lean forward"},
            "full_range": {"avg_elbow": (80, 100),  "msg": "Lower until elbows hit 90° for full range"},
        },
        "display_name": "Tricep Dip",
        "muscles": ["Triceps", "Anterior Deltoid", "Pectoralis Minor"],
    },

    # ── GLUTE BRIDGE ─────────────────────────────────────────────────────────
    "glute_bridge": {
        "recognition": {
            "avg_hip":   (100, 170),
            "avg_knee":  (75, 110),
            "avg_torso": (100, 160),
        },
        "rep_states": {
            "down": {"avg_hip": (145, 180)},  # hips on floor
            "up":   {"avg_hip": (100, 130)},  # hips raised
        },
        "form_rules": {
            "hip_thrust":   {"avg_hip":  (100, 130), "msg": "Push hips higher — squeeze glutes at the top"},
            "knee_position":{"avg_knee": (80, 105),  "msg": "Keep feet flat, knees at 90°"},
        },
        "display_name": "Glute Bridge",
        "muscles": ["Glutes", "Hamstrings", "Lower Back"],
    },
}

EXERCISE_PRIORITY = [
    "plank", "wall_sit", "pullup", "tricep_dip",
    "deadlift", "glute_bridge",
    "squat", "lunge",
    "shoulder_press", "lateral_raise",
    "pushup", "bicep_curl",
]
