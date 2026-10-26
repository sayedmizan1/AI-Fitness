"""
Loads the fitness knowledge base into ChromaDB.
Run this once to seed the vector database.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dotenv import load_dotenv
load_dotenv()

from ai.rag.vector_store import FitnessVectorStore

# ── Knowledge Base Documents ──────────────────────────────────────────────────

EXERCISE_DOCS = [
    # Squat
    ("squat", "The squat is a compound lower-body exercise. Muscles: Quadriceps, Glutes, Hamstrings, Core. Correct form: Stand with feet shoulder-width apart, toes slightly turned out. Brace your core, push hips back, lower until thighs are parallel to the floor. Keep chest up, knees tracking over toes. Drive through heels to return."),
    ("squat_mistakes", "Common squat mistakes: 1) Knee cave — fix by pushing knees outward. 2) Heels lifting — sit back more, check ankle mobility. 3) Rounding lower back — strengthen core, don't go beyond flexibility. 4) Not reaching depth — work hip mobility. 5) Leaning too far forward — strengthen upper back."),
    ("squat_variations", "Squat variations: Back squat (barbell on traps), Front squat (barbell on front delts, more quad dominant), Goblet squat (dumbbell, great for beginners), Bulgarian split squat (rear foot elevated, unilateral), Box squat (sit back to box, teaches proper depth), Sumo squat (wide stance, more glute activation)."),

    # Pushup
    ("pushup", "The push-up is a bodyweight upper-body exercise. Muscles: Pectorals, Triceps, Anterior Deltoids, Core. Correct form: Place hands slightly wider than shoulder-width, body in a straight plank. Lower chest to near the floor by bending elbows at 45 degrees from body. Push back up fully extending arms."),
    ("pushup_mistakes", "Common push-up mistakes: 1) Elbows flaring out — tuck 45 degrees from torso. 2) Sagging hips — engage core and glutes. 3) Partial range — lower chest fully. 4) Head dropping — keep neck neutral. 5) Wrist pain — try fist pushups or elevate hands."),
    ("pushup_progressions", "Push-up progressions: Wall push-up (easiest), Incline push-up, Knee push-up, Standard push-up, Diamond push-up (triceps), Archer push-up, Decline push-up (upper chest), Pike push-up (shoulders), One-arm push-up (advanced)."),

    # Deadlift
    ("deadlift", "The deadlift is the king of compound lifts. Muscles: Hamstrings, Glutes, Erector Spinae, Traps, Lats, Forearms. Correct form: Stand with bar over mid-foot. Hip hinge to grip bar. Chest up, lats engaged. Drive legs into floor and pull bar along body. Lock hips at top. Lower with control."),
    ("deadlift_mistakes", "Common deadlift mistakes: 1) Rounding lower back — most dangerous, fix first. 2) Bar drifting from body — keep bar close. 3) Jerking the bar — smooth pull from floor. 4) Hyperextending at top — just lock hips out. 5) Looking up excessively — neutral neck position."),

    # Bicep Curl
    ("bicep_curl", "Bicep curl is an isolation exercise for the biceps brachii. Correct form: Stand with dumbbells at sides, palms forward. Keep upper arms stationary against torso. Curl weights up by contracting biceps. Squeeze at top, lower with control. Full range of motion is key."),
    ("bicep_curl_mistakes", "Bicep curl mistakes: 1) Using momentum/swinging — use lighter weight, strict form. 2) Not fully extending at bottom — full ROM. 3) Elbows moving forward — pin elbows to sides. 4) Wrist deviation — keep wrists neutral. 5) Partial range — go all the way up and down."),

    # Lunge
    ("lunge", "Lunges are unilateral lower body exercises. Muscles: Quadriceps, Glutes, Hamstrings, Calves. Correct form: Step forward with one leg. Lower hips until both knees are at 90 degrees. Front knee behind toes. Keep torso upright. Drive back through front heel to return."),

    # Plank
    ("plank", "The plank is an isometric core exercise. Muscles: Transverse Abdominis, Rectus Abdominis, Obliques, Glutes, Shoulders. Correct form: Forearms on floor, elbows under shoulders. Body in straight line from head to heels. Engage core, glutes, quads. Breathe steadily. Hold without holding breath."),
    ("plank_tips", "Plank progressions: Knee plank (beginner), Standard forearm plank, High plank (arms), Side plank, Plank with leg lift, Plank to push-up, RKC plank (max tension), Ab wheel rollout (advanced). Time your plank — 60 seconds is excellent for most people."),

    # Pull-up
    ("pullup", "Pull-ups are a compound upper-body pulling exercise. Muscles: Latissimus Dorsi, Biceps, Rear Deltoids, Core. Correct form: Hang from bar with overhand grip, shoulder-width. Depress shoulder blades. Pull body up until chin clears bar. Lower with full control. Avoid kipping unless for sport."),
]

NUTRITION_DOCS = [
    ("protein", "Protein is essential for muscle repair and growth. Recommended intake: 1.6-2.2g per kg of body weight for strength training. Best sources: chicken breast, eggs, Greek yogurt, tuna, lean beef, salmon, cottage cheese, tofu, lentils, whey protein. Spread protein across 3-5 meals for optimal muscle protein synthesis."),
    ("carbohydrates", "Carbohydrates are the primary fuel for high-intensity exercise. Complex carbs: oats, brown rice, sweet potatoes, whole grain bread, quinoa. Simple carbs useful around workouts for energy. Aim for 3-5g/kg bodyweight for moderate activity, 5-7g/kg for endurance athletes."),
    ("fats", "Healthy fats support hormone production including testosterone. Sources: avocados, olive oil, nuts, seeds, fatty fish (omega-3). Aim for 0.8-1g per kg body weight. Omega-3 fatty acids reduce inflammation and support recovery. Avoid trans fats entirely."),
    ("meal_timing", "Pre-workout meal: 1-3 hours before, carbs + protein. Example: chicken + rice. Post-workout meal: within 30-60 minutes. Focus on fast protein (whey) + carbs. Helps muscle protein synthesis and glycogen replenishment. Hydration: minimum 2-3 liters water daily, more during training."),
    ("weight_loss_nutrition", "For fat loss: calorie deficit of 300-500 kcal/day. High protein (2g/kg) to preserve muscle. Prioritize: lean proteins, vegetables, complex carbs, healthy fats. Avoid: liquid calories, ultra-processed foods, excess sodium. Track calories initially to build awareness. Don't go below 1200 kcal (women) or 1500 kcal (men)."),
    ("muscle_gain_nutrition", "For muscle gain: calorie surplus of 200-400 kcal/day (lean bulk). Protein: 1.8-2.2g/kg. Creatine monohydrate: 5g/day is the most research-backed supplement for strength and muscle. Pre-sleep casein protein can support overnight muscle protein synthesis. Sleep 7-9 hours for optimal anabolic hormones."),
]

INJURY_DOCS = [
    ("lower_back", "Lower back pain in gym: Most common cause is poor deadlift/squat form. Prevention: strengthen core (planks, dead bugs), master hip hinge, never round lower back under load. Treatment: rest, ice/heat cycle, gentle stretching, see physiotherapist if persistent. McGill Big Three: curl-up, side plank, bird-dog."),
    ("knee_pain", "Knee pain in gym: Common causes — improper squat depth, knee cave, IT band syndrome, patellar tendinitis. Prevention: strengthen VMO (quad), stretch hip flexors and hamstrings, proper squat form with knees tracking over toes. If pain persists during exercise, stop immediately and consult a doctor."),
    ("shoulder_pain", "Shoulder impingement and rotator cuff issues: Common in pressing movements. Prevention: strengthen rotator cuff with external rotation exercises, face pulls, band pull-aparts. Always warm up shoulders before overhead work. Improve thoracic mobility. Balance pressing with rowing exercises."),
    ("recovery", "Recovery is when muscles grow. Minimum 48 hours rest for muscle groups. Sleep 7-9 hours — growth hormone peaks during sleep. Active recovery: light walks, swimming, yoga, foam rolling. Signs of overtraining: persistent fatigue, declining performance, mood changes, frequent illness. Deload week: reduce volume by 50% every 4-8 weeks."),
    ("warmup", "Proper warm-up reduces injury risk by 50%. General warm-up: 5-10 min cardio to raise heart rate. Specific warm-up: 2-3 sets of light work for the target muscles. Dynamic stretching before exercise (leg swings, arm circles). Static stretching AFTER exercise, not before. Never stretch cold muscles aggressively."),
    ("mobility", "Mobility exercises for gym performance: Hip flexor stretch (90/90), ankle dorsiflexion (wall stretch), thoracic rotation (thread the needle), shoulder dislocates (band), world's greatest stretch. Poor hip mobility causes squat issues. Poor ankle mobility causes heel rise. Spend 10 minutes daily on mobility for long-term gains."),
]

WORKOUT_DOCS = [
    ("ppl", "Push Pull Legs (PPL) is a 6-day workout split. Push day: chest, shoulders, triceps (bench press, overhead press, lateral raises, tricep extensions). Pull day: back, biceps, rear delts (pull-ups, rows, face pulls, bicep curls). Legs day: quads, hamstrings, glutes, calves (squats, RDL, leg press, calf raises). Run Monday-Saturday with Sunday rest, or any 2-days-on/1-day-off rotation."),
    ("upper_lower", "Upper/Lower split: 4 days per week. Upper Day A (strength): bench, rows, overhead press, pull-ups. Upper Day B (hypertrophy): incline press, cable rows, lateral raises, curls. Lower Day A (strength): squats, Romanian deadlift, leg press. Lower Day B (hypertrophy): leg press, walking lunges, leg curl, calf raises. Good for intermediate lifters."),
    ("full_body", "Full body workouts: 3 days per week (Mon/Wed/Fri). Each session hits all major muscle groups. Example: Squat, bench press, bent-over row, overhead press, Romanian deadlift. Best for beginners as it allows more practice with each movement and higher training frequency for skill acquisition."),
    ("beginner_program", "Best beginner programs: StrongLifts 5x5 (squat, bench, deadlift, overhead press, row — 3 days/week). Starting Strength (similar, Mark Rippetoe). GZCLP (good progression scheme). Focus on compound movements. Add 2.5-5kg per session as long as possible. Sleep, eat, and rest are as important as training."),
    ("progressive_overload", "Progressive overload is the foundation of all training. Methods: Add weight (most common), add reps, add sets, reduce rest time, improve form, increase ROM, increase training frequency. Without progressive overload, adaptation stops. Track every workout to ensure progression. Use a training log."),
    ("hiit", "HIIT (High-Intensity Interval Training): Alternates intense bursts with rest. Example: 20 sec sprint, 40 sec walk, repeat 10 times. Burns 25-30% more calories than steady-state cardio. Increases EPOC (afterburn effect). Limit to 2-3 sessions per week — high CNS demand. Great for fat loss while preserving muscle."),
]


def load_all_knowledge(store: FitnessVectorStore):
    print("Loading exercise knowledge...")
    ex_texts = [doc[1] for doc in EXERCISE_DOCS]
    ex_meta = [{"topic": doc[0], "category": "exercise"} for doc in EXERCISE_DOCS]
    store.add_documents("exercises", ex_texts, ex_meta)

    print("Loading nutrition knowledge...")
    nut_texts = [doc[1] for doc in NUTRITION_DOCS]
    nut_meta = [{"topic": doc[0], "category": "nutrition"} for doc in NUTRITION_DOCS]
    store.add_documents("nutrition", nut_texts, nut_meta)

    print("Loading injury prevention knowledge...")
    inj_texts = [doc[1] for doc in INJURY_DOCS]
    inj_meta = [{"topic": doc[0], "category": "injury"} for doc in INJURY_DOCS]
    store.add_documents("injuries", inj_texts, inj_meta)

    print("Loading workout programs...")
    wkt_texts = [doc[1] for doc in WORKOUT_DOCS]
    wkt_meta = [{"topic": doc[0], "category": "workout"} for doc in WORKOUT_DOCS]
    store.add_documents("workouts", wkt_texts, wkt_meta)

    print("✅ Knowledge base loaded successfully!")


if __name__ == "__main__":
    store = FitnessVectorStore()
    load_all_knowledge(store)
