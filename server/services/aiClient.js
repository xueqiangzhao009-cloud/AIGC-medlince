import { config } from '../config.js';
import { buildFallbackAnalysis } from './fallbackAnalysis.js';

const buildPrompt = ({ metrics, recentData, locale }) => {
    const language = locale.toLowerCase().startsWith('zh') ? 'Chinese' : 'English';
    return [
        `You are a clinical decision-support assistant for a diabetes CGM visualization demo.`,
        `Return only a JSON object with these keys: risk_level, pathology_summary, video_generation_prompt, recommendations.`,
        `Use ${language}. Do not diagnose. Mention that findings should be reviewed with clinical context.`,
        `Metrics: ${JSON.stringify(metrics)}`,
        `Recent CGM data, mmol/L: ${JSON.stringify((recentData || []).slice(-96))}`
    ].join('\n');
};

const extractJsonObject = (text) => {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
};

const withTimeout = async (promiseFactory, timeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await promiseFactory(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
};

const getChatCompletionsUrl = () => {
    if (config.ai.chatCompletionsUrl) return config.ai.chatCompletionsUrl;
    return `${config.ai.baseUrl}/chat/completions`;
};

export const analyzePathology = async ({ metrics, recentData = [], locale = 'en', requireAI = false }) => {
    const fallback = buildFallbackAnalysis(metrics, locale);

    if (!config.ai.apiKey) {
        if (requireAI) throw new Error('AI_API_KEY or OPENAI_API_KEY is required');
        return {
            ...fallback,
            source: 'rules',
            model: null
        };
    }

    try {
        const responsePayload = await withTimeout(async (signal) => {
            const response = await fetch(getChatCompletionsUrl(), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.ai.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.ai.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You produce concise clinical visualization support JSON for a diabetes CGM application.'
                        },
                        {
                            role: 'user',
                            content: buildPrompt({ metrics, recentData, locale })
                        }
                    ]
                }),
                signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI request failed with ${response.status}: ${errorText.slice(0, 500)}`);
            }

            return response.json();
        }, config.ai.timeoutMs);

        const content = responsePayload.choices?.[0]?.message?.content || responsePayload.output_text || '';
        const parsed = extractJsonObject(content);

        if (!parsed) {
            throw new Error('AI response did not contain a JSON object');
        }

        return {
            ...fallback,
            ...parsed,
            source: 'ai',
            provider: config.ai.provider,
            model: config.ai.model
        };
    } catch (error) {
        if (requireAI) throw error;
        return {
            ...fallback,
            source: 'rules',
            model: null,
            ai_error: error.message
        };
    }
};
