import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;
export async function getSuggestion(prompt) {
    if (openai) {
        const resp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        return resp.choices[0]?.message?.content ?? "";
    }
    if (anthropic) {
        const resp = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 400,
            messages: [{ role: "user", content: prompt }],
        });
        return resp.content?.[0]?.type === "text" ? resp.content[0].text : "";
    }
    throw new Error("No AI provider configured");
}
//# sourceMappingURL=ai.service.js.map