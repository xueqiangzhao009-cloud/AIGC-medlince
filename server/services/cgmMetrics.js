export const TARGET_RANGE = { min: 3.9, max: 10.0 };
export const HYPO_LEVEL_1 = 3.9;
export const HYPO_LEVEL_2 = 3.0;
export const HYPER_LEVEL_1 = 10.0;
export const HYPER_LEVEL_2 = 13.9;
export const MG_DL_TO_MMOL_L = 18.0182;

const roundTo = (value, digits = 1) => Number(value.toFixed(digits));

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const formatDisplayTime = (date) => {
    return `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const parseTimestamp = (value, index) => {
    if (value instanceof Date && isValidDate(value)) return value;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (timeOnlyMatch) {
            const date = new Date();
            date.setHours(Number(timeOnlyMatch[1]), Number(timeOnlyMatch[2]), Number(timeOnlyMatch[3] || 0), 0);
            return date;
        }

        const parsed = new Date(trimmed);
        if (isValidDate(parsed)) return parsed;
    }

    const fallback = new Date();
    fallback.setMinutes(0, 0, 0);
    fallback.setTime(fallback.getTime() - Math.max(0, index) * 15 * 60 * 1000);
    return fallback;
};

const extractGlucose = (point) => {
    if (typeof point === 'number') return point;
    if (!point || typeof point !== 'object') return Number.NaN;

    const candidates = [
        point.glucose,
        point.value,
        point.sgv,
        point.Glucose,
        point.Value,
        point['Glucose Value'],
        point['glucose_value']
    ];

    for (const candidate of candidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) return parsed;
    }

    return Number.NaN;
};

export const inferGlucoseUnit = (values, requestedUnit = 'auto') => {
    if (requestedUnit === 'mg/dL' || requestedUnit === 'mgdl') return 'mg/dL';
    if (requestedUnit === 'mmol/L' || requestedUnit === 'mmol') return 'mmol/L';

    const validValues = values.filter(Number.isFinite);
    if (validValues.length === 0) return 'mmol/L';

    const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
    const max = Math.max(...validValues);
    return mean > 35 || max > 40 ? 'mg/dL' : 'mmol/L';
};

export const normalizeCGMData = (data, requestedUnit = 'auto') => {
    if (!Array.isArray(data)) {
        throw new Error('CGM data must be an array');
    }

    const rawValues = data.map(extractGlucose);
    const sourceUnit = inferGlucoseUnit(rawValues, requestedUnit);

    return data
        .map((point, index) => {
            const rawGlucose = extractGlucose(point);
            if (!Number.isFinite(rawGlucose)) return null;

            const timestampSource = typeof point === 'object' && point
                ? point.timestamp || point.time || point.date || point.Time || point.Timestamp
                : undefined;
            const timestamp = parseTimestamp(timestampSource, index);
            const glucose = sourceUnit === 'mg/dL' ? rawGlucose / MG_DL_TO_MMOL_L : rawGlucose;

            return {
                timestamp: timestamp.toISOString(),
                displayTime: formatDisplayTime(timestamp),
                glucose: roundTo(glucose, 1),
                sourceGlucose: rawGlucose,
                sourceUnit
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

export const calculateMetrics = (data) => {
    if (!data || data.length === 0) return null;

    const values = data.map((point) => Number(point.glucose)).filter(Number.isFinite);
    if (values.length === 0) return null;

    const total = values.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / total;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / total;
    const sd = Math.sqrt(variance);
    const cv = mean > 0 ? (sd / mean) * 100 : 0;

    const veryLowCount = values.filter((value) => value < HYPO_LEVEL_2).length;
    const lowCount = values.filter((value) => value >= HYPO_LEVEL_2 && value < HYPO_LEVEL_1).length;
    const inRangeCount = values.filter((value) => value >= TARGET_RANGE.min && value <= TARGET_RANGE.max).length;
    const highCount = values.filter((value) => value > HYPER_LEVEL_1 && value <= HYPER_LEVEL_2).length;
    const veryHighCount = values.filter((value) => value > HYPER_LEVEL_2).length;

    const tir = (inRangeCount / total) * 100;
    const tbr = ((veryLowCount + lowCount) / total) * 100;
    const tar = ((veryHighCount + highCount) / total) * 100;
    const meanMgDl = mean * MG_DL_TO_MMOL_L;
    const gmi = 3.31 + 0.02392 * meanMgDl;
    const gri = ((veryLowCount * 3.0) + (lowCount * 2.4) + (veryHighCount * 1.6) + (highCount * 0.8)) / total * 100;

    return {
        mean: mean.toFixed(1),
        cv: cv.toFixed(1),
        tir: tir.toFixed(1),
        tbr: tbr.toFixed(1),
        tar: tar.toFixed(1),
        gmi: gmi.toFixed(1),
        gri: gri.toFixed(1),
        counts: {
            total,
            veryLow: veryLowCount,
            low: lowCount,
            inRange: inRangeCount,
            high: highCount,
            veryHigh: veryHighCount
        }
    };
};

const parseCsvLine = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const nextChar = line[index + 1];

        if (char === '"' && nextChar === '"') {
            current += '"';
            index += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    cells.push(current.trim());
    return cells;
};

export const parseCSV = (csvText, requestedUnit = 'auto') => {
    if (typeof csvText !== 'string' || !csvText.trim()) {
        throw new Error('CSV text is required');
    }

    const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const glucoseIndex = headers.findIndex((header) => header.includes('glucose') || header.includes('value') || header === 'sgv');
    const timeIndex = headers.findIndex((header) => header.includes('time') || header.includes('timestamp') || header.includes('date'));

    if (glucoseIndex === -1) {
        throw new Error("CSV must include a glucose/value column");
    }

    const rawData = lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        return {
            glucose: cells[glucoseIndex],
            timestamp: timeIndex === -1 ? undefined : cells[timeIndex]
        };
    });

    return normalizeCGMData(rawData, requestedUnit);
};
