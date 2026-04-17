import { config } from '../config.js';

const withTimeout = async (promiseFactory, timeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await promiseFactory(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
};

export const generateVideo = async ({ prompt, requireVideo = false }) => {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Video prompt is required');
    }

    if (!config.video.apiUrl) {
        if (requireVideo) throw new Error('VIDEO_API_URL is required');
        return {
            videoUrl: '/video_placeholder.svg',
            source: 'placeholder',
            generated: false,
            prompt
        };
    }

    const payload = await withTimeout(async (signal) => {
        const response = await fetch(config.video.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.video.apiKey ? { Authorization: `Bearer ${config.video.apiKey}` } : {})
            },
            body: JSON.stringify({ prompt }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Video request failed with ${response.status}: ${errorText.slice(0, 500)}`);
        }

        return response.json();
    }, config.video.timeoutMs);

    return {
        videoUrl: payload.videoUrl || payload.url || payload.output_url,
        source: 'api',
        generated: true,
        providerResponse: payload,
        prompt
    };
};
