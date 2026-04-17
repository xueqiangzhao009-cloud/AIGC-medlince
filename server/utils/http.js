export class HttpError extends Error {
    constructor(statusCode, message, details = undefined) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

export const setCorsHeaders = (res, origin = '*') => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
};

export const readRequestBody = (req, limitBytes) => {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        const chunks = [];

        req.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > limitBytes) {
                reject(new HttpError(413, `Request body exceeds ${limitBytes} bytes`));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
};

export const readJsonBody = async (req, limitBytes) => {
    const bodyText = await readRequestBody(req, limitBytes);
    if (!bodyText.trim()) return {};

    try {
        return JSON.parse(bodyText);
    } catch (error) {
        throw new HttpError(400, 'Invalid JSON request body', error.message);
    }
};

export const parseRequestUrl = (req) => {
    return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
};

export const getErrorPayload = (error) => {
    const statusCode = error.statusCode || 500;
    return {
        error: {
            message: statusCode >= 500 ? 'Internal server error' : error.message,
            details: statusCode >= 500 ? undefined : error.details
        }
    };
};
