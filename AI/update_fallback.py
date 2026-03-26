"""
Quick script to update the _fallback_plan21 function in ai_nodes.py
Run this to fix the validation error.
"""

import re

# Read the file
with open('ai_nodes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the fallback function
# We'll replace from the function definition to the return statement

old_pattern = r'(def _fallback_plan21\(quiz_summary.*?\n.*?""".*?""".*?\n)(.*?)(    return Plan21D\(plan_summary=plan_summary, day_tasks=day_tasks\))'

new_middle = '''    if quiz_summary:
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

'''

# Do the replacement
content_new = re.sub(old_pattern, r'\1' + new_middle + r'\3', content, flags=re.DOTALL)

# Write back
with open('ai_nodes.py', 'w', encoding='utf-8') as f:
    f.write(content_new)

print("✅ Updated _fallback_plan21 function to return lists of DayTask objects")
print("🔄 Restart your AI service for changes to take effect")
