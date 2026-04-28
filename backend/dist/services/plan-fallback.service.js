/**
 * Plan Fallback Service
 *
 * Generates a deterministic, personalised 21-day reduction plan WITHOUT
 * calling the LLM. Used as the instant response when:
 *   - the Redis cache misses, AND
 *   - the AI service does not return within the soft deadline
 *
 * The shape is intentionally identical to what the AI service `/plan-21d`
 * endpoint returns (Plan21DResponse) so the frontend doesn't have to branch
 * on the source.
 *
 * This is a pure function: ~1ms to compute, no network, no I/O.
 *
 * Behaviour mirrors the Python `_fallback_plan21` in `AI/ai_nodes.py` so that
 * the experience is consistent regardless of which side serves the fallback.
 */
const t = (title, description, reason, kind) => ({ title, description, reason, kind });
export function buildFallbackPlan(ctx = {}) {
    const habit = (ctx.habit && String(ctx.habit).trim()) || "your habit";
    const trigger = (ctx.trigger && String(ctx.trigger).trim()) || "your usual triggers";
    const motive = (ctx.motive && String(ctx.motive).trim()) || "your reasons for change";
    const plan_summary = `This 21-day plan helps you reduce ${habit} with small daily actions, ` +
        `focusing on awareness, friction around ${trigger}, and identity shifts based on ${motive}.`;
    const day_tasks = {
        day_1: [
            t("Track patterns", `Write down when and why ${habit} happens.`, "Understanding your patterns is the first step to breaking them.", "reflection"),
            t("Identify trigger", `Note what most often leads to ${habit}.`, "Knowing your triggers helps you prepare and avoid automatic responses.", "cognitive"),
            t("Set intention", `Write why reducing ${habit} matters.`, "Clear motivation strengthens your commitment when urges arise.", "identity"),
        ],
        day_2: [
            t("Pause before acting", `Before ${habit}, pause 30 seconds.`, "This breaks the automatic trigger-response loop and creates space for choice.", "cognitive"),
            t("Create distance", `Move away from ${trigger} location.`, "Physical distance weakens the cue-craving connection in your brain.", "environmental"),
            t("Choose alternative", "Pick a 5-minute healthy activity.", "Building alternative dopamine sources reduces dependence on the habit.", "behavioral"),
        ],
        day_3: [
            t("Remove one cue", `Disable one cue that feeds ${habit}.`, "Eliminating triggers makes it harder for the habit to start automatically.", "environmental"),
            t("Practice urge surfing", "Breathe and observe urges without acting.", "Learning that urges pass without action builds confidence and control.", "cognitive"),
            t("Delay once", `Delay ${habit} by 5 minutes today.`, "Delaying proves you have control and weakens the urgency of cravings.", "behavioral"),
        ],
        day_4: [
            t("Set cutoff time", `Choose when to stop ${habit} today.`, "Clear boundaries create structure and reduce decision fatigue.", "behavioral"),
            t("Change environment", `Rearrange your ${habit} location.`, "Disrupting familiar settings breaks automatic behavior patterns.", "environmental"),
            t("Review motivation", `Re-read why ${motive} matters.`, "Reconnecting with your why strengthens resolve during difficult moments.", "identity"),
        ],
        day_5: [
            t("Reduce by half", `Cut one ${habit} episode in half.`, "Gradual reduction builds confidence while avoiding overwhelming withdrawal.", "behavioral"),
            t("Create trigger-free zone", "Designate one space as off-limits.", "Protected spaces give you safe zones where the habit can't follow.", "environmental"),
            t("Practice replacement", "Do alternative at high-risk time.", "Replacing the habit at peak times rewires your reward system.", "behavioral"),
        ],
        day_6: [
            t("Plan evening", "Create routine without main trigger.", "Structured routines reduce exposure to high-risk situations.", "behavioral"),
            t("Strengthen rule", "Make cutoff 30 minutes earlier.", "Progressive tightening builds discipline and shrinks the habit window.", "behavioral"),
            t("Reflect on progress", "Note one win and one challenge.", "Acknowledging progress maintains motivation and identifies areas to improve.", "reflection"),
        ],
        day_7: [
            t("Weekly review", "Review week and adjust approach.", "Regular assessment helps you learn what works and adapt your strategy.", "reflection"),
            t("Celebrate wins", "Acknowledge any progress made.", "Celebrating success reinforces positive identity change and builds momentum.", "identity"),
            t("Plan week 2", "Identify biggest challenge and strategy.", "Proactive planning prepares you to handle obstacles before they arise.", "cognitive"),
        ],
        day_8: [
            t("Increase delay", `Delay ${habit} by 10 minutes today.`, "Longer delays strengthen your ability to tolerate discomfort and urges.", "behavioral"),
            t("Change location", `Do ${habit} somewhere less comfortable.`, "Making the habit inconvenient reduces its automatic appeal.", "environmental"),
            t("Write to future you", `Explain why reducing ${habit} matters.`, "Connecting with your future self strengthens long-term thinking over impulse.", "identity"),
        ],
        day_9: [
            t("Create no-go rule", `Define where ${habit} is not allowed.`, "Clear rules eliminate negotiation with yourself in weak moments.", "behavioral"),
            t("Prepare environment", "Set up trigger-free first hour tomorrow.", "Morning success sets a positive tone and builds daily momentum.", "environmental"),
            t("Urge surfing again", "Let one urge pass unacted.", "Repeated practice proves urges are temporary and manageable.", "cognitive"),
        ],
        day_10: [
            t("Full replacement", `Replace one ${habit} episode completely.`, "Complete replacement demonstrates you can meet needs without the habit.", "behavioral"),
            t("Remove access", `Add barrier to ${habit} access.`, "Friction points give you time to reconsider before acting impulsively.", "environmental"),
            t("Reflect on identity", "Complete: 'I am becoming someone who...'", "Identity shifts create internal motivation stronger than willpower alone.", "identity"),
        ],
        day_11: [
            t("Handle slip mindfully", "Review any slip analytically.", "Learning from setbacks prevents shame spirals and builds resilience.", "reflection"),
            t("Strengthen morning", "Create morning routine for success.", "Strong mornings create positive momentum that carries through the day.", "behavioral"),
            t("Teach someone", `Share insight about ${habit} triggers.`, "Teaching solidifies your understanding and reinforces your commitment.", "cognitive"),
        ],
        day_12: [
            t("Extend cutoff", `Make no-${habit} window 1 hour longer.`, "Expanding restriction zones progressively shrinks the habit's territory.", "behavioral"),
            t("Create accountability", "Tell someone about your progress.", "External accountability adds social motivation to internal commitment.", "identity"),
            t("Plan for high-risk", "Identify top 3 high-risk situations.", "Anticipating challenges lets you prepare coping strategies in advance.", "cognitive"),
        ],
        day_13: [
            t("Practice prevention", "Do something before high-risk time.", "Proactive action prevents the habit before cravings intensify.", "behavioral"),
            t("Redesign space", "Make permanent environmental change.", "Lasting changes create ongoing support without requiring daily willpower.", "environmental"),
            t("Reflect on costs", `Write costs of continuing ${habit}.`, "Awareness of consequences strengthens motivation to maintain change.", "reflection"),
        ],
        day_14: [
            t("Mid-point review", "List 3 wins and 1 adjustment.", "Halfway reflection builds confidence and refines your approach.", "reflection"),
            t("Celebrate progress", "Acknowledge how far you've come.", "Recognition of growth reinforces your new identity and sustains effort.", "identity"),
            t("Commit to week 3", "Write commitment to finish strong.", "Renewed commitment prevents mid-journey dropout and maintains focus.", "identity"),
        ],
        day_15: [
            t("Implement no-go rule", `Enforce no-${habit} rule strictly.`, "Strict enforcement builds self-trust and eliminates negotiation.", "behavioral"),
            t("Add second rule", "Define second off-limits context.", "Multiple boundaries create comprehensive protection against triggers.", "behavioral"),
            t("Visualize success", "Visualize handling biggest trigger.", "Mental rehearsal prepares your brain to respond effectively under pressure.", "cognitive"),
        ],
        day_16: [
            t("Go trigger-free", "Avoid main trigger for 24 hours.", "Complete avoidance proves you can function without the trigger.", "behavioral"),
            t("Strengthen identity", "Update identity statement with evidence.", "Evidence-based identity change is more powerful than aspirational thinking.", "identity"),
            t("Plan maintenance", "Think about post-day-21 maintenance.", "Long-term planning prevents relapse after the structured program ends.", "cognitive"),
        ],
        day_17: [
            t("Handle with confidence", "Remind yourself you can handle urges.", "Self-efficacy beliefs directly predict success in behavior change.", "cognitive"),
            t("Make it permanent", "Choose one change to keep forever.", "Permanent commitments shift from temporary effort to lasting lifestyle.", "environmental"),
            t("Reflect on growth", "Write about how you've changed.", "Documenting transformation reinforces new identity and prevents backsliding.", "reflection"),
        ],
        day_18: [
            t("Test your strength", "Expose to mild trigger without acting.", "Controlled exposure builds confidence that you can resist in real situations.", "behavioral"),
            t("Refine system", "Adjust rules that aren't working well.", "Optimization ensures your system remains effective and sustainable.", "cognitive"),
            t("Share learning", `Teach key insight about ${habit}.`, "Teaching others deepens your mastery and strengthens commitment.", "identity"),
        ],
        day_19: [
            t("Create identity statement", "Write 2-sentence identity statement.", "Clear identity statements guide decisions when motivation fluctuates.", "identity"),
            t("Plan long-term", "Decide which 3 rules to keep permanently.", "Selecting core rules creates sustainable structure without overwhelming complexity.", "cognitive"),
            t("Prepare for challenges", "Plan for next major trigger.", "Preparation prevents panic and ensures you have strategies ready.", "behavioral"),
        ],
        day_20: [
            t("Keystone rule", "Choose one non-negotiable rule.", "A single unbreakable rule creates a foundation for all other changes.", "behavioral"),
            t("Reflect on transformation", "Compare day 1 you vs. today you.", "Recognizing transformation validates effort and builds confidence for the future.", "reflection"),
            t("Plan day 22", "Decide what to do on day 22.", "Planning beyond the program prevents the 'finish line' relapse effect.", "cognitive"),
        ],
        day_21: [
            t("Review journey", "Read notes from day 1.", "Seeing your progress from start to finish reinforces how far you've come.", "reflection"),
            t("Refresh identity", "Finalize identity statement.", "A clear identity statement guides future decisions and prevents regression.", "identity"),
            t("Set long-term vision", `Write 90-day vision for ${habit}.`, "Long-term vision ensures this is the beginning of lasting change, not the end.", "cognitive"),
            t("Celebrate completion", "Acknowledge your success.", "Celebration reinforces positive identity and marks this as a significant life achievement.", "identity"),
        ],
    };
    return { plan_summary, day_tasks };
}
/**
 * Extract fallback context from a parsed quiz_summary object.
 * Tolerant of missing/null fields.
 */
export function extractFallbackContext(quizSummary, habitGoal) {
    if (!quizSummary || typeof quizSummary !== "object") {
        return { habit: habitGoal };
    }
    const q = quizSummary;
    const pickStr = (k) => {
        const v = q[k];
        return typeof v === "string" && v.trim().length > 0 ? v : undefined;
    };
    return {
        habit: pickStr("canonical_habit_name") || pickStr("user_habit_raw") || habitGoal,
        trigger: pickStr("main_trigger") || pickStr("collapse_condition"),
        motive: pickStr("motivation_reason") || pickStr("identity_link"),
    };
}
//# sourceMappingURL=plan-fallback.service.js.map