/**
 * AI Client Service - HTTP client to call unhabit-ai-project endpoints
 *
 * This service proxies requests to the FastAPI AI service
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || "30000", 10);
/**
 * Make a request to the AI service with retry logic
 */
async function makeRequest(endpoint, body, retries = 2) {
    const url = `${AI_SERVICE_URL}${endpoint}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT);
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI service error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            return { success: true, data };
        }
        catch (error) {
            if (attempt === retries) {
                const message = error instanceof Error ? error.message : "Unknown error";
                console.error(`AI service request failed after ${retries + 1} attempts:`, message);
                return { success: false, error: message };
            }
            // Wait before retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    return { success: false, error: "Request failed" };
}
/**
 * Start onboarding - Safety check + quiz form generation
 */
export async function startOnboarding(request) {
    return makeRequest("/onboarding/start", request);
}
/**
 * Canonicalize/classify a habit
 */
export async function canonicalizeHabit(request) {
    return makeRequest("/canonicalize-habit", request);
}
/**
 * Run safety assessment
 */
export async function assessSafety(request) {
    return makeRequest("/safety", request);
}
/**
 * Generate quiz form
 */
export async function generateQuizForm(request) {
    return makeRequest("/quiz-form", request);
}
/**
 * Get quiz summary
 */
export async function getQuizSummary(request) {
    return makeRequest("/quiz-summary", request);
}
/**
 * Generate 21-day plan
 */
export async function generatePlan21D(request) {
    const result = await makeRequest("/plan-21d", request);
    // If main endpoint fails, try fallback
    if (!result.success) {
        console.log("Primary plan generation failed, trying fallback...");
        return makeRequest("/plan-21d-fallback", request);
    }
    return result;
}
/**
 * AI coach chat
 */
export async function chat(request) {
    return makeRequest("/coach", request);
}
/**
 * Get explanation for a specific day
 */
export async function explainDay(request) {
    return makeRequest("/why-day", request);
}
/**
 * Health check for AI service
 */
export async function healthCheck() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${AI_SERVICE_URL}/health`, {
            method: "GET",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            return { success: true, data: { status: "healthy" } };
        }
        return { success: false, error: "AI service unhealthy" };
    }
    catch {
        return { success: false, error: "AI service unreachable" };
    }
}
//# sourceMappingURL=ai-client.service.js.map