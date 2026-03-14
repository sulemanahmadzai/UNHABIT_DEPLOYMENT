# ai_nodes.py
import json
import os
import re
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import ValidationError


from prompts import (
    SAFETY_PROMPT,
    QUIZ_SUMMARY_PROMPT,
    PLAN_21D_PROMPT,
    COACH_PROMPT,
    QUIZ_GENERATOR_PROMPT,
    CANONICALIZE_PROMPT,
    WHY_DAY_PROMPT
)
from schemas import HabitState, SafetyResult, QuizSummary, Plan21D, QuizForm, DayTask

load_dotenv()


def _extract_short_habit_name(raw_description: str) -> str:
    """
    Extract a short (2-6 word) habit name from a longer description.
    This is used as a fallback when the LLM doesn't provide a good short name.
    
    Examples:
    - "I doomscroll on social media before bed, usually until 2am..." → "doomscrolling"
    - "I watch too much porn and can't stop" → "pornography use"
    - "I smoke cigarettes when stressed" → "smoking"
    """
    if not raw_description:
        return "this habit"
    
    raw_lower = raw_description.lower()
    
    # Common habit patterns - check for keywords and return appropriate short names
    habit_patterns = {
        # Screen/content habits
        ("doomscroll", "doom scroll", "scrolling", "scroll"): "doomscrolling",
        ("tiktok", "tik tok"): "TikTok scrolling",
        ("instagram", "insta"): "Instagram scrolling",
        ("social media",): "social media scrolling",
        ("youtube",): "YouTube watching",
        ("netflix", "streaming", "binge watch"): "binge watching",
        ("gaming", "video game", "videogame", "game"): "gaming",
        ("porn", "prn", "p0rn", "fap", "hub", "nsfw", "adult content"): "pornography",
        
        # Substance habits
        ("zyn", "pouch", "snus"): "nicotine pouch use",
        ("vape", "vaping", "e-cig", "juul"): "vaping",
        ("smoke", "smoking", "cigarette", "cig"): "smoking",
        ("alcohol", "drink", "drinking", "beer", "wine"): "drinking",
        ("weed", "cannabis", "marijuana", "thc"): "cannabis use",
        
        # Food habits
        ("overeat", "binge eat", "eating too much"): "overeating",
        ("snack", "late-night eating", "late night eating"): "late-night snacking",
        ("sugar", "sweets", "candy"): "sugar consumption",
        ("junk food", "fast food"): "junk food",
        
        # Behavioral habits
        ("procrastinat",): "procrastination",
        ("lazy", "laziness"): "procrastination",
        ("shopping", "buying", "spending"): "impulsive shopping",
        ("gambl", "betting", "casino"): "gambling",
        ("nail biting", "bite my nails"): "nail biting",
        ("phone", "screen time"): "phone overuse",
    }
    
    for keywords, short_name in habit_patterns.items():
        for keyword in keywords:
            if keyword in raw_lower:
                return short_name
    
    # If no pattern matches, try to extract a short phrase
    # Remove common filler phrases
    cleaned = raw_description
    filler_patterns = [
        r"^I\s+(am\s+)?(addicted\s+to|can't\s+stop|have\s+a\s+problem\s+with|struggle\s+with)\s+",
        r"^I\s+(always|usually|often|constantly)\s+",
        r"^I\s+",
        r"\s*,.*$",  # Remove everything after a comma
        r"\s*\..*$",  # Remove everything after a period
        r"\s+(and|but|because|which|that).*$",  # Remove clauses
        r"\s+(before|after|when|while|until).*$",  # Remove time-related clauses
    ]
    
    for pattern in filler_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    
    cleaned = cleaned.strip()
    
    # If cleaned text is reasonable length (2-6 words), use it
    words = cleaned.split()
    if 1 <= len(words) <= 6:
        return cleaned
    elif len(words) > 6:
        # Take first 4 words
        return " ".join(words[:4])
    
    # Final fallback
    return "this habit"


def _get_model(name: str, default: str) -> str:
    """
    Read a model name from env, but NEVER return None or empty string.
    """
    value = os.getenv(name)
    if not value or value.strip().lower() == "none":
        return default
    return value.strip()

# Default to valid OpenAI model names
MODEL_JSON = os.getenv("OPENAI_MODEL_JSON", "gpt-4o-mini")  # Valid model: gpt-4o-mini, gpt-4o, gpt-4-turbo, etc.
MODEL_TEXT = os.getenv("OPENAI_MODEL_TEXT", "gpt-4o-mini")  # Valid model: gpt-4o-mini, gpt-4o, gpt-4-turbo, etc.
def _llm_json(
    prompt: str,
    max_tokens: int = 800,
    temperature: float = 0.5,
    retries: int = 2,
) -> Dict[str, Any]:
    """
    Call the JSON-optimized LLM and return a Python dict.
    Retries with slightly higher temperature and stronger JSON instructions if parsing fails.
    """
    for attempt in range(retries):
        llm = ChatOpenAI(
            model=MODEL_JSON,
            temperature=temperature + (attempt * 0.2),
            response_format={"type": "json_object"},
        )

        resp = llm.invoke(prompt).content

        try:
            return json.loads(resp)
        except Exception:
            # strengthen instructions & increase randomness
            prompt += (
                "\nReturn STRICT JSON. No commentary. "
                "Do NOT repeat previous suggestions."
            )
            continue

    # final fallback if everything fails
    return {}


def _json_llm(temperature: float = 0.3) -> ChatOpenAI:
    """
    Base JSON-optimized LLM (used with structured outputs).
    """
    return ChatOpenAI(
        model=MODEL_JSON,
        temperature=temperature,
    )


def _text_llm(temperature: float = 0.6) -> ChatOpenAI:
    """
    Base text LLM for the coach.
    """
    return ChatOpenAI(
        model=MODEL_TEXT,
        temperature=temperature,
    )



def canonicalize_habit_node(state: HabitState):
    user_raw = state.habit_description or ""

    prompt = CANONICALIZE_PROMPT.format(user_habit_raw=user_raw)
    data = _llm_json(prompt)

    # Get values from LLM response
    canonical = data.get("canonical_habit_name", "")
    category = data.get("habit_category", "")
    conf = data.get("confidence", "low")
    
    # Validate and fix the canonical name if it's too long or missing
    if not canonical or len(canonical.split()) > 8:
        canonical = _extract_short_habit_name(user_raw)
    
    # Validate the category against known categories
    valid_categories = {
        "nicotine_smoking", "nicotine_vaping", "nicotine_oral",
        "pornography", "social_media", "gaming", "screen_time",
        "food_overeating", "sugar", "alcohol", "cannabis",
        "shopping_spending", "gambling", "procrastination", "other"
    }
    
    if not category or category.lower() not in valid_categories:
        # Try to infer category from the raw description
        category = _infer_category_from_description(user_raw)

    return {
        "canonical_habit_name": canonical,
        "habit_category": category,
        "canonical_confidence": conf,
    }


def _infer_category_from_description(raw_description: str) -> str:
    """
    Infer the habit category from the raw description using keyword matching.
    Used as a fallback when the LLM doesn't return a valid category.
    """
    if not raw_description:
        return "other"
    
    raw_lower = raw_description.lower()
    
    # Category patterns - check for keywords
    category_patterns = {
        # Nicotine
        "nicotine_oral": ["zyn", "pouch", "snus", "dip", "chew", "oral nic"],
        "nicotine_vaping": ["vape", "vaping", "e-cig", "juul", "puff bar", "disposable"],
        "nicotine_smoking": ["smoke", "smoking", "cigarette", "cig", "cigar", "shisha", "hookah"],
        
        # Screen/content
        "pornography": ["porn", "prn", "p0rn", "fap", "hub", "nsfw", "adult content", "explicit"],
        "social_media": ["social media", "tiktok", "instagram", "twitter", "facebook", "reddit", 
                         "scrolling", "scroll", "doomscroll", "reels", "shorts"],
        "gaming": ["gaming", "game", "video game", "gamer", "fortnite", "valorant", "league"],
        "screen_time": ["screen time", "phone", "youtube", "netflix", "streaming", "binge watch"],
        
        # Food
        "food_overeating": ["overeat", "binge eat", "eating too much", "late-night eating", "snack"],
        "sugar": ["sugar", "sweets", "candy", "soda", "chocolate"],
        
        # Substances
        "alcohol": ["alcohol", "drink", "drinking", "beer", "wine", "liquor", "drunk"],
        "cannabis": ["weed", "cannabis", "marijuana", "thc", "pot", "high"],
        
        # Behavioral
        "procrastination": ["procrastinat", "lazy", "laziness", "avoid", "delay", "putting off"],
        "shopping_spending": ["shopping", "buying", "spending", "impulse buy", "amazon"],
        "gambling": ["gambl", "betting", "casino", "poker", "slots", "sports bet"],
    }
    
    for category, keywords in category_patterns.items():
        for keyword in keywords:
            if keyword in raw_lower:
                return category
    
    return "other"


# ---------- Safety Node ----------

def safety_node(state: HabitState) -> Dict[str, Any]:
    """
    Classify the latest user text for safety and scope.

    Uses SafetyResult:
    - risk: "none" | "self_harm" | "eating_disorder" | "severe_addiction" | "violence" | "other"
    - action: "allow" | "block_and_escalate"
    - message: short, safe helper text
    """

    # Prefer the freshest user message; fall back to habit_description or empty string
    user_text = (
        getattr(state, "last_user_message", None)
        or getattr(state, "habit_description", None)
        or getattr(state, "user_input", "")
        or ""
    )

    # If no user text, allow by default
    if not user_text.strip():
        return {
            "safety": SafetyResult(
                risk="none",
                action="allow",
                message="",
            )
        }

    prompt = SAFETY_PROMPT.format(user_text=user_text)

    llm = _json_llm(temperature=0.1)
    structured_llm = llm.with_structured_output(SafetyResult)

    try:
        safety = structured_llm.invoke(prompt)
    except Exception as e:
        # Log the actual error for debugging
        import traceback
        error_details = str(e)
        error_type = type(e).__name__
        
        # Check if it's an API/configuration error vs actual safety concern
        api_error_keywords = [
            "api key", "authentication", "invalid model", "model not found",
            "rate limit", "quota", "billing", "network", "connection",
            "timeout", "openai", "api"
        ]
        
        is_api_error = any(keyword.lower() in error_details.lower() for keyword in api_error_keywords)
        
        if is_api_error:
            # For API/technical errors, show a helpful error message
            # but don't block - allow the user to proceed (they can fix API issues)
            print(f"[safety_node] API/Technical error: {error_type}: {error_details}")
            print(f"[safety_node] Traceback: {traceback.format_exc()}")
            # Allow by default for technical errors (user can fix API key, etc.)
            safety = SafetyResult(
                risk="none",
                action="allow",
                message="",
            )
        else:
            # For unknown errors, be conservative: block & escalate
            print(f"[safety_node] Unknown error during safety check: {error_type}: {error_details}")
            print(f"[safety_node] Traceback: {traceback.format_exc()}")
            safety = SafetyResult(
                risk="other",
                action="block_and_escalate",
                message=(
                    "I'm here only for habit and behavior coaching, so I can't safely respond to this. "
                    "Please avoid medical, illegal, or harmful topics, and consider reaching out to a "
                    "trusted person or local professional if you're in distress."
                ),
            )

    return {"safety": safety}



def quiz_form_node(state: HabitState) -> Dict[str, Any]:
    """
    Generate a tailored 8–10 question MULTIPLE-CHOICE quiz based on the user's habit description.

    Guarantees:
    - The habit name / product (e.g. "Zyn", "TikTok", "porn") is preserved.
    - Questions are explicitly about THIS habit, not generic behavior.
    - Each question has EXACTLY 4 MCQ options.
    """
    habit_description = state.habit_description or ""

    prompt = QUIZ_GENERATOR_PROMPT.format(
        habit_description=habit_description
    )

    llm = ChatOpenAI(
        model=MODEL_JSON,
        temperature=0.4,
    )
    structured_llm = llm.with_structured_output(QuizForm)

    try:
        # Expecting the LLM to respect the QuizForm schema with MCQ options.
        quiz_form = structured_llm.invoke(prompt)
        
        # Validate that the LLM returned a reasonable habit_name_guess (not too long)
        if quiz_form and quiz_form.habit_name_guess:
            name_words = quiz_form.habit_name_guess.split()
            # If the habit_name_guess is too long (more than 8 words), extract a shorter one
            if len(name_words) > 8:
                quiz_form.habit_name_guess = _extract_short_habit_name(habit_description)
                
    except Exception as e:
        print(f"[quiz_form_node] LLM call failed: {e}")
        # Fallback that uses a SHORT habit label, not the full description
        habit_label = _extract_short_habit_name(habit_description)
        quiz_form = QuizForm(
            habit_name_guess=habit_label,
            questions=[
                {
                    "id": "q1",
                    "question": f"How often do you engage in {habit_label}?",
                    "helper_text": "Think about an average week.",
                    "options": [
                        {"id": "q1_a", "label": "Less than once a week", "helper_text": None},
                        {"id": "q1_b", "label": "1–3 times a week", "helper_text": None},
                        {"id": "q1_c", "label": "4–7 times a week", "helper_text": None},
                        {"id": "q1_d", "label": "Multiple times per day", "helper_text": None},
                    ],
                },
                {
                    "id": "q2",
                    "question": f"At what times of day does {habit_label} usually happen?",
                    "helper_text": None,
                    "options": [
                        {"id": "q2_a", "label": "Morning", "helper_text": None},
                        {"id": "q2_b", "label": "Afternoon", "helper_text": None},
                        {"id": "q2_c", "label": "Evening", "helper_text": None},
                        {"id": "q2_d", "label": "Late night / before sleep", "helper_text": None},
                    ],
                },
                {
                    "id": "q3",
                    "question": f"Where are you usually when {habit_label} happens?",
                    "helper_text": "For example: bedroom, desk, bathroom, outside, with friends.",
                    "options": [
                        {"id": "q3_a", "label": "Mostly at home", "helper_text": None},
                        {"id": "q3_b", "label": "Mostly outside", "helper_text": None},
                        {"id": "q3_c", "label": "Mostly at work / study place", "helper_text": None},
                        {"id": "q3_d", "label": "It changes a lot", "helper_text": None},
                    ],
                },
                {
                    "id": "q4",
                    "question": f"Right before {habit_label}, you are usually…",
                    "helper_text": "Pick the closest option.",
                    "options": [
                        {"id": "q4_a", "label": "Bored or passing time", "helper_text": None},
                        {"id": "q4_b", "label": "Stressed / anxious / overwhelmed", "helper_text": None},
                        {"id": "q4_c", "label": "Lonely / sad", "helper_text": None},
                        {"id": "q4_d", "label": "Generally okay or even excited", "helper_text": None},
                    ],
                },
                {
                    "id": "q5",
                    "question": f"What usually triggers {habit_label}?",
                    "helper_text": None,
                    "options": [
                        {"id": "q5_a", "label": "Seeing or having the product/device nearby", "helper_text": None},
                        {"id": "q5_b", "label": "Notifications, apps, or online content", "helper_text": None},
                        {"id": "q5_c", "label": "Specific people, places, or routines", "helper_text": None},
                        {"id": "q5_d", "label": "Mostly my internal feelings / thoughts", "helper_text": None},
                    ],
                },
                {
                    "id": "q6",
                    "question": f"How strong does the urge for {habit_label} feel?",
                    "helper_text": None,
                    "options": [
                        {"id": "q6_a", "label": "Mild – I can ignore it if needed", "helper_text": None},
                        {"id": "q6_b", "label": "Moderate – uncomfortable but manageable", "helper_text": None},
                        {"id": "q6_c", "label": "Strong – very hard to resist", "helper_text": None},
                        {"id": "q6_d", "label": "Overwhelming – I almost always give in", "helper_text": None},
                    ],
                },
                {
                    "id": "q7",
                    "question": f"Have you tried to reduce {habit_label} before?",
                    "helper_text": None,
                    "options": [
                        {"id": "q7_a", "label": "No, this is my first serious attempt", "helper_text": None},
                        {"id": "q7_b", "label": "Yes, once or twice", "helper_text": None},
                        {"id": "q7_c", "label": "Yes, many times with short success", "helper_text": None},
                        {"id": "q7_d", "label": "Yes, but I never really committed", "helper_text": None},
                    ],
                },
                {
                    "id": "q8",
                    "question": f"How ready do you feel to change {habit_label}?",
                    "helper_text": None,
                    "options": [
                        {"id": "q8_a", "label": "Just exploring, not really ready", "helper_text": None},
                        {"id": "q8_b", "label": "Somewhat ready, but scared / unsure", "helper_text": None},
                        {"id": "q8_c", "label": "Ready to seriously reduce it", "helper_text": None},
                        {"id": "q8_d", "label": "Very ready – I want big change", "helper_text": None},
                    ],
                },
            ],
        )

    return {"quiz_form": quiz_form}


# ---------- Quiz Summary Node ----------

def quiz_summary_node(state: HabitState) -> Dict[str, Any]:
    """
    Convert:
    - original habit_description
    - AI-generated quiz_form
    - user_quiz_answers (now usually {question_id: option_id})

    into a compact QuizSummary JSON.
    """
    habit_description = state.habit_description or ""
    quiz_form_json = state.quiz_form.model_dump() if state.quiz_form else {}

    # Backwards compatible handling:
    # - If answers is a dict, use it as-is.
    # - If it's a string (old behaviour), wrap it under "freeform".
    raw_answers = getattr(state, "user_quiz_answers", None)

    if isinstance(raw_answers, dict):
        answers_payload = raw_answers
    elif isinstance(raw_answers, str) and raw_answers.strip():
        answers_payload = {"freeform": raw_answers}
    else:
        answers_payload = {}

    prompt = QUIZ_SUMMARY_PROMPT.format(
        habit_description=habit_description,
        quiz_form_json=json.dumps(quiz_form_json, ensure_ascii=False),
        user_quiz_answers=json.dumps(answers_payload, ensure_ascii=False),
    )

    llm = ChatOpenAI(
        model=MODEL_JSON,
        temperature=0.3,
    )
    structured_llm = llm.with_structured_output(QuizSummary)

    try:
        summary = structured_llm.invoke(prompt)
    except (ValidationError, Exception):
        # Defensive fallback – still honest, no hallucinated structure
        summary = QuizSummary(
            user_habit_raw=habit_description,
            canonical_habit_name=habit_description or "user habit",
            habit_category="other",
            category_confidence="low",
            product_type="unspecified",
            severity_level="mild",
            main_trigger="unknown",
            peak_times="unknown",
            common_locations="unknown",
            emotional_patterns="unclear",
            frequency_pattern="unknown",
            previous_attempts="not_clear",
            motivation_reason="user_wants_change",
            risk_situations="unknown",
        )

    return {"quiz_summary": summary}


def _category_guidance(summary: QuizSummary) -> str:
    """
    Rich category- and user-specific guidance so each habit type
    produces a structurally different 21-day plan.

    This is injected into the PLAN_21D_PROMPT as extra context.
    """

    cat = (summary.habit_category or "other").lower()
    severity = summary.severity_level
    name = summary.canonical_habit_name or summary.user_habit_raw or "the habit"
    raw = summary.user_habit_raw or ""
    trigger = summary.main_trigger or "unclear triggers"
    peak = summary.peak_times or "unclear peak times"
    loc = summary.common_locations or "unclear locations"
    emo = summary.emotional_patterns or "unclear emotional patterns"
    freq = summary.frequency_pattern or "unclear frequency"
    motive = summary.motivation_reason or "unclear motivation"
    risk = summary.risk_situations or "unclear risk situations"
    prev = summary.previous_attempts or "not clearly described"

    base_context = f"""
User-specific context:
- Exact wording: {raw}
- Canonical habit name: {name}
- Severity: {severity}
- Main trigger: {trigger}
- Peak times (when it MOST OFTEN happens, not the only possible times): {peak}
- Common locations (where it MOST OFTEN happens, not the only places): {loc}
- Emotional pattern: {emo}
- Frequency pattern: {freq}
- Motivation: {motive}
- High-risk situations: {risk}
- Previous attempts: {prev}

Global rules for using this information in the 21-day plan:
- Treat peak times and common locations as patterns or hotspots, NOT as exclusive rules.
- Do NOT assume the habit only happens at {loc} or only during {peak} unless the summary explicitly says so.
- At most about half of the daily tasks should explicitly mention a specific location like {loc}.
- At most about half of the daily tasks should explicitly mention a specific time window like {peak}.
- The remaining tasks should either be:
  - location-agnostic (work anywhere), or
  - clearly applicable across multiple contexts (home, outside, work, with friends, etc.).
- Use language like "often at home", "usually late at night", "especially in your room"
  instead of "only at home" or "always late at night", unless the summary literally says it ONLY happens there.
- Make sure at least a few tasks explicitly handle situations where the habit appears
  in other places or times than {loc} / {peak} (for example outside, with friends, or at random times).

Plan must explicitly reference these details across the 21 days, but in a BALANCED way that still works
if the habit also shows up in other places or times.
"""

    # Now add deep category-specific strategy
    if cat in ["nicotine_smoking", "nicotine_vaping", "nicotine_oral"]:
        cat_block = f"""
Category: Nicotine

Core strategy:
- Treat {name} as a dopamine and ritual loop, not just a chemical.
- Emphasize routines around peak times (for example {peak}), and environments like {loc}.
- Explicitly build friction around storage, access, purchase, and first use of the day.
- For oral products like pouches, include mouth and hand substitution tasks.
- For higher severity, include more aggressive environment restructuring and longer urge delays.

Must include across 21 days:
- At least 4 tasks about changing where {name} is kept or accessed.
- At least 4 tasks about first use of the day and last use window.
- At least 3 tasks about physical state regulation during withdrawal (sleep window, hydration, body movement).
- At least 3 tasks that use emotional patterns like {emo} to pre-empt urges.
"""

    elif cat == "pornography":
        cat_block = f"""
Category: Pornography / sexual content

Core strategy:
- Treat {name} as a privacy plus device plus emotional loop.
- Focus on device rules, room layout, and late-night behaviour, especially around {peak}.
- Explicitly design friction around entering high-risk locations such as {loc}.
- Use stimulus control (lights, door, blockers, charging locations) instead of just "willpower".
- Tie reflection tasks to shame cycles and emotion patterns like {emo}, but without using shame language.

Must include across 21 days:
- At least 4 tasks that change how and where the device is used.
- At least 3 tasks that pre-empt late-night or alone-time triggers.
- At least 3 tasks that redirect immediately after a strong urge into a specific alternative behaviour.
- At least 2 tasks that review a slip in a non-judgmental, purely diagnostic way.
"""

    elif cat in ["screen_time", "social_media", "gaming"]:
        cat_block = f"""
Category: Screen-based habit (social media, scrolling, or gaming)

Core strategy:
- Treat {name} as an algorithm plus environment plus boredom loop.
- Focus on first and last 30 minutes of the day, especially if peak times include {peak}.
- Redesign notification logic, home screen layout, and app availability.
- Use strong "screen zones" and "screen windows" instead of unrealistic total bans.
- Tie replacement activities to the motivation: {motive}.

Must include across 21 days:
- At least 3 tasks modifying notifications, app positions, or app removal.
- At least 3 tasks that change morning behaviour before the first use.
- At least 3 tasks that change evening behaviour and pre-sleep routines.
- At least 3 tasks that deliberately swap a high-risk scrolling window with something aligned to {motive}.
"""

    elif cat in ["alcohol", "cannabis"]:
        cat_block = f"""
Category: Substance use (alcohol or cannabis)

Core strategy:
- Treat {name} as a context plus people plus emotional regulation loop.
- Focus on social settings, routes, and specific times like {peak}.
- Include clear "no-use" contexts and re-routing strategies for high-risk places like {loc}.
- Include craving delay plus alternative rituals at the exact times they usually use.
- Tie medium-term tasks to motivation {motive} and long-term identity.

Must include across 21 days:
- At least 3 tasks that alter routes or places that usually lead to use.
- At least 3 tasks that create explicit "no-use" rules in specific contexts.
- At least 3 tasks focused on high-risk situations described as {risk}.
- At least 2 tasks rehearsing what to do during a social invite or stress spike.
"""

    elif cat in ["sugar", "food_overeating"]:
        cat_block = f"""
Category: Food / sugar / overeating

Core strategy:
- Treat {name} as a kitchen plus shopping plus emotional soothing loop.
- Focus on visibility and proximity of foods, especially around locations like {loc}.
- Tie tasks to emotional states like {emo} and times like {peak}.
- Include shopping list and preparation changes that reduce impulsive access.
- Use small plate, portion, and environment tricks rather than "never eat X again" rules.

Must include across 21 days:
- At least 3 tasks about shopping or preparing alternatives in advance.
- At least 3 tasks about changing visibility and proximity of trigger foods.
- At least 3 tasks about emotional check-ins before eating in high-risk moments.
- At least 2 tasks about how to handle evenings or specific risk situations like {risk}.
"""

    elif cat in ["shopping_spending", "gambling"]:
        cat_block = f"""
Category: Spending / gambling

Core strategy:
- Treat {name} as a excitement plus access plus impulse loop.
- Focus on financial access: cards, apps, cash, sites, groups.
- Use strong pre-commitment rules, delays, and visibility of consequences.
- Tie specific tasks to high-risk times or contexts like {peak} and {risk}.
- Use replacement forms of excitement or reward that are lower-risk.

Must include across 21 days:
- At least 3 tasks about restricting or delaying financial access.
- At least 3 tasks about changing what happens in the 10–20 minutes before spending or betting.
- At least 2 tasks about reviewing a past spending or gambling episode analytically, not emotionally.
- At least 2 tasks that explicitly reinforce the motivation: {motive}.
"""

    elif cat == "procrastination":
        cat_block = f"""
Category: Procrastination

Core strategy:
- Treat {name} as avoidance of a specific type of work or feeling.
- Tie tasks directly to the kind of work they avoid most (for example study or deep work).
- Use very small, clear start behaviours instead of vague discipline tasks.
- Design environment and time box rules around the true peak avoidance windows like {peak}.
- Link identity work to becoming someone who handles {trigger} with short, focused bursts.

Must include across 21 days:
- At least 5 tasks that define a tiny, concrete starting action (for example open document and write one sentence).
- At least 3 tasks that reduce distractions in the main work location {loc}.
- At least 3 tasks that handle emotional patterns like {emo} before work instead of during.
- At least 2 tasks that rehearse what to do after a bad day without abandoning the plan.
"""

    else:
        cat_block = f"""
Category: Other or unclear

Core strategy:
- The category label is not precise, so lean heavily on the user's actual patterns.
- Design tasks explicitly around the main trigger {trigger}, peak times {peak}, and locations {loc}.
- Use emotional pattern {emo} to time interventions before the urge becomes very strong.
- Apply standard habit-breaking tools: friction, replacement, identity, slip recovery, environment design.

Must include across 21 days:
- At least 5 tasks that directly reference the described triggers, times, or locations.
- At least 3 tasks that practice urge delay plus a named replacement behaviour.
- At least 2 tasks that explicitly connect daily actions to the motivation: {motive}.
"""

    return base_context + "\n" + cat_block


# ---------- 21-Day Plan Node ----------

def _fallback_plan21(quiz_summary: Optional[QuizSummary] = None) -> Plan21D:
    """
    Fallback 21-day plan if the LLM output fails validation.

    Uses QuizSummary if available (canonical_habit_name, main_trigger, motivation_reason),
    but does NOT rely on any old fields like 'habit_name'.
    """
    if quiz_summary:
        habit = (
            quiz_summary.canonical_habit_name
            or quiz_summary.user_habit_raw
            or "your habit"
        )
        trigger = quiz_summary.main_trigger or "your usual triggers"
        motive = quiz_summary.motivation_reason or "your reasons for change"
    else:
        habit = "your habit"
        trigger = "your usual triggers"
        motive = "your reasons for change"

    plan_summary = (
        f"This 21-day plan helps you reduce {habit} with small daily actions, "
        f"focusing on awareness, friction around {trigger}, and identity shifts based on {motive}."
    )

    # Return tasks as lists of DayTask objects
    day_tasks = {
        "day_1": [
            DayTask(title="Track patterns", description=f"Write down when and why {habit} happens.", kind="reflection"),
            DayTask(title="Identify trigger", description=f"Note what most often leads to {habit}.", kind="cognitive"),
            DayTask(title="Set intention", description=f"Write why reducing {habit} matters.", kind="identity"),
        ],
        "day_2": [
            DayTask(title="Pause before acting", description=f"Before {habit}, pause 30 seconds.", kind="cognitive"),
            DayTask(title="Create distance", description=f"Move away from {trigger} location.", kind="environmental"),
            DayTask(title="Choose alternative", description="Pick a 5-minute healthy activity.", kind="behavioral"),
        ],
        "day_3": [
            DayTask(title="Remove one cue", description=f"Disable one cue that feeds {habit}.", kind="environmental"),
            DayTask(title="Practice urge surfing", description="Breathe and observe urges without acting.", kind="cognitive"),
            DayTask(title="Delay once", description=f"Delay {habit} by 5 minutes today.", kind="behavioral"),
        ],
        "day_4": [
            DayTask(title="Set cutoff time", description=f"Choose when to stop {habit} today.", kind="behavioral"),
            DayTask(title="Change environment", description=f"Rearrange your {habit} location.", kind="environmental"),
            DayTask(title="Review motivation", description=f"Re-read why {motive} matters.", kind="identity"),
        ],
        "day_5": [
            DayTask(title="Reduce by half", description=f"Cut one {habit} episode in half.", kind="behavioral"),
            DayTask(title="Create trigger-free zone", description="Designate one space as off-limits.", kind="environmental"),
            DayTask(title="Practice replacement", description="Do alternative at high-risk time.", kind="behavioral"),
        ],
        "day_6": [
            DayTask(title="Plan evening", description="Create routine without main trigger.", kind="behavioral"),
            DayTask(title="Strengthen rule", description="Make cutoff 30 minutes earlier.", kind="behavioral"),
            DayTask(title="Reflect on progress", description="Note one win and one challenge.", kind="reflection"),
        ],
        "day_7": [
            DayTask(title="Weekly review", description="Review week and adjust approach.", kind="reflection"),
            DayTask(title="Celebrate wins", description="Acknowledge any progress made.", kind="identity"),
            DayTask(title="Plan week 2", description="Identify biggest challenge and strategy.", kind="cognitive"),
        ],
        "day_8": [
            DayTask(title="Increase delay", description=f"Delay {habit} by 10 minutes today.", kind="behavioral"),
            DayTask(title="Change location", description=f"Do {habit} somewhere less comfortable.", kind="environmental"),
            DayTask(title="Write to future you", description=f"Explain why reducing {habit} matters.", kind="identity"),
        ],
        "day_9": [
            DayTask(title="Create no-go rule", description=f"Define where {habit} is not allowed.", kind="behavioral"),
            DayTask(title="Prepare environment", description="Set up trigger-free first hour tomorrow.", kind="environmental"),
            DayTask(title="Urge surfing again", description="Let one urge pass unacted.", kind="cognitive"),
        ],
        "day_10": [
            DayTask(title="Full replacement", description=f"Replace one {habit} episode completely.", kind="behavioral"),
            DayTask(title="Remove access", description=f"Add barrier to {habit} access.", kind="environmental"),
            DayTask(title="Reflect on identity", description="Complete: 'I am becoming someone who...'", kind="identity"),
        ],
        "day_11": [
            DayTask(title="Handle slip mindfully", description="Review any slip analytically.", kind="reflection"),
            DayTask(title="Strengthen morning", description="Create morning routine for success.", kind="behavioral"),
            DayTask(title="Teach someone", description=f"Share insight about {habit} triggers.", kind="cognitive"),
        ],
        "day_12": [
            DayTask(title="Extend cutoff", description=f"Make no-{habit} window 1 hour longer.", kind="behavioral"),
            DayTask(title="Create accountability", description="Tell someone about your progress.", kind="identity"),
            DayTask(title="Plan for high-risk", description="Identify top 3 high-risk situations.", kind="cognitive"),
        ],
        "day_13": [
            DayTask(title="Practice prevention", description=f"Do something before high-risk time.", kind="behavioral"),
            DayTask(title="Redesign space", description="Make permanent environmental change.", kind="environmental"),
            DayTask(title="Reflect on costs", description=f"Write costs of continuing {habit}.", kind="reflection"),
        ],
        "day_14": [
            DayTask(title="Mid-point review", description="List 3 wins and 1 adjustment.", kind="reflection"),
            DayTask(title="Celebrate progress", description="Acknowledge how far you've come.", kind="identity"),
            DayTask(title="Commit to week 3", description="Write commitment to finish strong.", kind="identity"),
        ],
        "day_15": [
            DayTask(title="Implement no-go rule", description=f"Enforce no-{habit} rule strictly.", kind="behavioral"),
            DayTask(title="Add second rule", description="Define second off-limits context.", kind="behavioral"),
            DayTask(title="Visualize success", description="Visualize handling biggest trigger.", kind="cognitive"),
        ],
        "day_16": [
            DayTask(title="Go trigger-free", description="Avoid main trigger for 24 hours.", kind="behavioral"),
            DayTask(title="Strengthen identity", description="Update identity statement with evidence.", kind="identity"),
            DayTask(title="Plan maintenance", description="Think about post-day-21 maintenance.", kind="cognitive"),
        ],
        "day_17": [
            DayTask(title="Handle with confidence", description="Remind yourself you can handle urges.", kind="cognitive"),
            DayTask(title="Make it permanent", description="Choose one change to keep forever.", kind="environmental"),
            DayTask(title="Reflect on growth", description="Write about how you've changed.", kind="reflection"),
        ],
        "day_18": [
            DayTask(title="Test your strength", description=f"Expose to mild trigger without acting.", kind="behavioral"),
            DayTask(title="Refine system", description="Adjust rules that aren't working well.", kind="cognitive"),
            DayTask(title="Share learning", description=f"Teach key insight about {habit}.", kind="identity"),
        ],
        "day_19": [
            DayTask(title="Create identity statement", description="Write 2-sentence identity statement.", kind="identity"),
            DayTask(title="Plan long-term", description="Decide which 3 rules to keep permanently.", kind="cognitive"),
            DayTask(title="Prepare for challenges", description="Plan for next major trigger.", kind="behavioral"),
        ],
        "day_20": [
            DayTask(title="Keystone rule", description="Choose one non-negotiable rule.", kind="behavioral"),
            DayTask(title="Reflect on transformation", description="Compare day 1 you vs. today you.", kind="reflection"),
            DayTask(title="Plan day 22", description="Decide what to do on day 22.", kind="cognitive"),
        ],
        "day_21": [
            DayTask(title="Review journey", description="Read notes from day 1.", kind="reflection"),
            DayTask(title="Refresh identity", description="Finalize identity statement.", kind="identity"),
            DayTask(title="Set long-term vision", description=f"Write 90-day vision for {habit}.", kind="cognitive"),
            DayTask(title="Celebrate completion", description="Acknowledge your success.", kind="identity"),
        ],
    }

    return Plan21D(plan_summary=plan_summary, day_tasks=day_tasks)

def plan21_node(state: HabitState) -> Dict[str, Any]:
    """
    Generate the 21-day plan using the QuizSummary as context
    + category-specific guidance so different habits feel truly different.
    """
    if not state.quiz_summary:
        return {"plan21": _fallback_plan21(None)}

    quiz_json = state.quiz_summary.model_dump()
    guidance = _category_guidance(state.quiz_summary)

    prompt = PLAN_21D_PROMPT.format(
        quiz_summary_json=json.dumps(quiz_json, ensure_ascii=False),
        category_guidance=guidance,
    )

    # 🔹 Use your JSON LLM helper, NOT MODEL_JSON, NOT _json_llm
    data = _llm_json(prompt, max_tokens=1600, temperature=0.35)

    try:
        # Basic sanitization — day_tasks values should be lists of task dicts
        day_tasks = data.get("day_tasks", {}) or {}
        fallback = _fallback_plan21(state.quiz_summary)
        for i in range(1, 22):
            key = f"day_{i}"
            if key not in day_tasks or not isinstance(day_tasks[key], list) or len(day_tasks[key]) < 2:
                day_tasks[key] = fallback.day_tasks[key]
            else:
                valid = [t for t in day_tasks[key] if isinstance(t, dict) and t.get("title")]
                day_tasks[key] = valid if len(valid) >= 2 else fallback.day_tasks[key]

        data["day_tasks"] = day_tasks

        if "plan_summary" not in data or not isinstance(data["plan_summary"], str):
            data["plan_summary"] = (
                f"Personalized 21-day behavioural plan to reduce {state.quiz_summary.canonical_habit_name}."
            )

        plan = Plan21D(**data)
    except:
        plan = _fallback_plan21(state.quiz_summary)

    return {"plan21": plan}


def why_day_node(state: HabitState, day_key: str) -> Dict[str, Any]:
    """
    Given the current HabitState and a specific day key ("day_1", "day_2", ...),
    return an elite-level explanation of WHY this task exists.

    This version:
    - uses the same ChatOpenAI stack as the rest of the app
    - does NOT use WHY_DAY_PROMPT.format(...) (no KeyError on placeholders)
    - returns a dict so update_state() can attach explanation to HabitState
    """

    # -------- Basic guards -------- #
    if state.plan21 is None:
        # No plan = nothing to explain
        explanation = (
            "I can't explain this task yet because your 21-day plan hasn't been generated. "
            "Please complete the quiz and generate the plan first."
        )
        return {
            "last_why_day": day_key,
            "last_why_explanation": explanation,
        }

    if state.quiz_summary is None:
        explanation = (
            "I can't explain this task yet because the diagnostic summary is missing. "
            "Try re-running the quiz and plan generation."
        )
        return {
            "last_why_day": day_key,
            "last_why_explanation": explanation,
        }

    day_task = state.plan21.day_tasks.get(day_key)
    if not day_task:
        explanation = f"No task found for {day_key}, so there is nothing to explain."
        return {
            "last_why_day": day_key,
            "last_why_explanation": explanation,
        }

    # -------- Build context for the LLM -------- #
    quiz_summary_json = json.dumps(state.quiz_summary.model_dump(), ensure_ascii=False)
    plan_21d_json = json.dumps(state.plan21.model_dump(), ensure_ascii=False)
    habit_description = state.habit_description or ""

    # IMPORTANT: we DO NOT call WHY_DAY_PROMPT.format(...)
    # We just use it as a base instruction and append context ourselves.
    prompt_parts = [
        WHY_DAY_PROMPT,
        "\n\n---------------- CONTEXT ----------------\n",
        "User habit description:\n",
        habit_description,
        "\n\nQuiz summary JSON:\n",
        quiz_summary_json,
        "\n\nFull 21-day plan JSON:\n",
        plan_21d_json,
        "\n\nFOCUS DAY:\n",
        f"day_key: {day_key}\n",
        f"day_task: {day_task}\n",
        "\nExplain in 3–6 sentences:\n",
        "- Why this specific task exists in the protocol,\n",
        "- Which part of the habit mechanism it targets (trigger, craving, avoidance, reward, identity, environment),\n",
        "- Why it is placed at this point in the 21-day sequence.\n",
        "Be surgical and concrete. No generic motivation talk.\n",
    ]

    user_prompt = "".join(prompt_parts)

    # -------- Call LLM -------- #
    llm = _text_llm(temperature=0.4)

    fallback_explanation = (
        "This task targets a critical part of your habit loop: the moment between urge and escape. "
        "By executing it exactly as written, you train your brain to associate that discomfort with "
        "action and progress instead of avoidance and short-term relief."
    )

    try:
        resp = llm.invoke(user_prompt)
        explanation = (resp.content or "").strip()

        # If model returns something empty or garbage-short, use fallback
        if not explanation or len(explanation.split()) < 5:
            explanation = fallback_explanation

    except Exception as e:
        print(f"[why_day_node] Error while generating explanation for {day_key}: {e}")
        explanation = fallback_explanation

    # Return a dict so update_state() can attach this to HabitState
    return {
        "last_why_day": day_key,
        "last_why_explanation": explanation,
    }


# ---------- Coach Node ----------

def coach_node(state: HabitState) -> Dict[str, Any]:
    """
    Context-aware AI coach that uses:
    - safety (to block out-of-scope / dangerous requests)
    - quiz_summary
    - plan21
    - chat_history
    - last_user_message
    """

    # 1) Hard safety block for medical / illegal / minors / self-harm / violence / etc.
    # With the new SafetyResult, we check `action`, not `status`.
    safety = state.safety
    if safety is not None and getattr(safety, "action", None) == "block_and_escalate":
        reply = (
            "I’m here only for habit and behavior coaching, so I can’t help with medical, legal, "
            "explicit, or illegal requests. If this is about your health, safety, or a serious "
            "situation, please talk to a qualified professional or someone you trust in real life."
        )

        # update chat history even on blocked replies
        new_history = list(state.chat_history or [])
        user_message = state.last_user_message or state.habit_description or ""
        if user_message:
            new_history.append({"role": "user", "content": user_message})
        new_history.append({"role": "assistant", "content": reply})

        return {
            "coach_reply": reply,
            "chat_history": new_history,
        }

    # 2) Normal coaching flow (safe content)
    quiz_json = state.quiz_summary.model_dump() if state.quiz_summary else {}
    plan_json = state.plan21.model_dump() if state.plan21 else {}

    # Format history
    history_lines = []
    for msg in state.chat_history or []:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_lines.append(f"{role}: {content}")
    history_text = "\n".join(history_lines)

    user_message = state.last_user_message or state.habit_description or ""

    base_prompt = COACH_PROMPT + "\n\n"
    base_prompt += f"quiz_summary_json:\n{json.dumps(quiz_json, ensure_ascii=False)}\n\n"
    base_prompt += f"plan_21d_json:\n{json.dumps(plan_json, ensure_ascii=False)}\n\n"
    base_prompt += f"history_text:\n{history_text}\n\n"
    base_prompt += f"user_message:\n{user_message}\n"

    llm = _text_llm()
    try:
        reply = llm.invoke(base_prompt).content.strip()
    except Exception:
        reply = "Let’s focus on one small step you can do today that matches your plan."

    # update chat history
    new_history = list(state.chat_history or [])
    if user_message:
        new_history.append({"role": "user", "content": user_message})
    new_history.append({"role": "assistant", "content": reply})

    return {
        "coach_reply": reply,
        "chat_history": new_history,
    }

