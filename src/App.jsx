import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { Activity, Play, FileText, Brain, AlertTriangle, HeartPulse, Eye, Zap, RefreshCw, ChevronRight, Upload, Image as ImageIcon, FileUp, X, CheckCircle2 } from 'lucide-react';

// --- Constants & Types ---
const TARGET_RANGE = { min: 3.9, max: 10.0 }; // mmol/L
const HYPO_LEVEL_1 = 3.9;
const HYPO_LEVEL_2 = 3.0;
const HYPER_LEVEL_1 = 10.0;
const HYPER_LEVEL_2 = 13.9;

// --- 1. Data Ingestion (Simulation) ---
const generateCGMData = () => {
    const days = 14;
    const pointsPerDay = 24 * 4; // 15 min intervals
    const totalPoints = days * pointsPerDay;
    const data = [];

    let currentGlucose = 6.5; // Starting baseline
    const now = new Date();
    now.setMinutes(0, 0, 0);

    for (let i = 0; i < totalPoints; i++) {
        const time = new Date(now.getTime() - (totalPoints - 1 - i) * 15 * 60 * 1000);
        const hour = time.getHours();

        let trend = 0;
        if (hour >= 6 && hour < 9) trend = 0.5;
        else if (hour >= 12 && hour < 14) trend = 0.8;
        else if (hour >= 18 && hour < 20) trend = 0.6;
        else if (hour >= 23 || hour < 4) trend = -0.2;

        const noise = (Math.random() - 0.5) * 0.8;
        currentGlucose += trend * 0.3 + noise;

        if (currentGlucose < 2.0) currentGlucose = 2.0 + Math.random();
        if (currentGlucose > 20.0) currentGlucose = 20.0 - Math.random();

        data.push({
            timestamp: time.toISOString(),
            displayTime: `${time.getDate()}/${time.getMonth() + 1} ${hour}:${time.getMinutes().toString().padStart(2, '0')}`,
            glucose: parseFloat(currentGlucose.toFixed(1))
        });
    }
    return data;
};

// --- 2. Metrics Calculation ---
const calculateMetrics = (data) => {
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.glucose);
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / total;

    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / total;
    const sd = Math.sqrt(avgSquareDiff);
    const cv = (sd / mean) * 100;

    const vLowCount = values.filter(v => v < HYPO_LEVEL_2).length;
    const lowCount = values.filter(v => v >= HYPO_LEVEL_2 && v < HYPO_LEVEL_1).length;
    const inRangeCount = values.filter(v => v >= TARGET_RANGE.min && v <= TARGET_RANGE.max).length;
    const highCount = values.filter(v => v > HYPER_LEVEL_1 && v <= HYPER_LEVEL_2).length;
    const vHighCount = values.filter(v => v > HYPER_LEVEL_2).length;

    const tir = (inRangeCount / total) * 100;
    const tbr = ((vLowCount + lowCount) / total) * 100;
    const tar = ((vHighCount + highCount) / total) * 100;

    const meanMgDl = mean * 18.0182;
    const gmi = 3.31 + 0.02392 * meanMgDl;
    const gri = ((vLowCount * 3.0) + (lowCount * 2.4) + (vHighCount * 1.6) + (highCount * 0.8)) / total * 100;

    return {
        mean: mean.toFixed(1),
        cv: cv.toFixed(1),
        tir: tir.toFixed(1),
        tbr: tbr.toFixed(1),
        tar: tar.toFixed(1),
        gmi: gmi.toFixed(1),
        gri: gri.toFixed(1)
    };
};

// --- 3. LLM Analysis Simulation ---
const simulateLLMAnalysis = async (metrics, recentData) => {
    await new Promise(resolve => setTimeout(resolve, 2000));

    let summary = "";
    let videoPrompt = "";

    if (parseFloat(metrics.cv) > 36 || parseFloat(metrics.tar) > 25) {
        summary = `Patient TIR is ${metrics.tir}% with a critical CV of ${metrics.cv}%, indicating high glycemic variability. This 'Glucose Toxicity' is driving oxidative stress, accelerating endothelial dysfunction and capillary basement membrane thickening. The high TAR (${metrics.tar}%) correlates with increased risk of proliferative diabetic retinopathy and early-stage nephropathy.`;
        videoPrompt = "Cinematic medical animation, inside retinal microvessels, hyper-realistic 8k. Erratic blood sugar fluctuations causing sparks of oxidative stress. Endothelial cells shrinking and detaching. Vessel walls leaking plasma. Red blood cells clumping. Dark, inflammatory atmosphere, blurred vision effect.";
    } else {
        summary = `Patient demonstrates stable glycemic control with TIR of ${metrics.tir}%. However, minor excursions into hypoglycemia (TBR ${metrics.tbr}%) warrant monitoring to prevent autonomic failure. Microvascular integrity is largely preserved, but continued vigilance is needed.`;
        videoPrompt = "Cinematic medical animation, inside a healthy capillary, hyper-realistic 8k. Smooth blood flow, flexible vessel walls. Occasional minor constriction. Soft lighting, clean and organized cellular structure. Representing stable metabolic state.";
    }

    return {
        pathology_summary: summary,
        video_generation_prompt: videoPrompt
    };
};

// --- 4. Video Generation Simulation ---
const simulateVideoGeneration = async (prompt) => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    // Simple logic to select video based on the prompt context
    if (prompt.includes("microvessels") || prompt.includes("oxidative stress")) {
        return "video/视网膜微血管视频.mp4";
    } else {
        return "video/视网膜宏观视频.mp4";
    }
};

const requestBackendPipeline = async (data) => {
    const response = await fetch('/api/pipeline/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data,
            unit: 'auto',
            locale: 'en'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend analysis failed: ${response.status} ${errorText}`);
    }

    return response.json();
};

const requestBackendCsvParse = async (csvText) => {
    const response = await fetch('/api/cgm/parse-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            csvText,
            unit: 'auto'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend CSV parse failed: ${response.status} ${errorText}`);
    }

    return response.json();
};

const parseLocalTimestamp = (timeStr, idx) => {
    const trimmed = String(timeStr || '').trim();
    const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (timeOnlyMatch) {
        const date = new Date();
        date.setHours(Number(timeOnlyMatch[1]), Number(timeOnlyMatch[2]), Number(timeOnlyMatch[3] || 0), 0);
        return date;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const fallback = new Date();
    fallback.setMinutes(0, 0, 0);
    fallback.setTime(fallback.getTime() - Math.max(0, idx) * 15 * 60 * 1000);
    return fallback;
};

// --- 5. UI Components ---

const MetricCard = ({ label, value, unit, status, description, icon: Icon }) => {
    const statusStyles = {
        success: 'from-emerald-50 to-teal-50 border-emerald-100 text-emerald-800',
        warning: 'from-amber-50 to-orange-50 border-amber-100 text-amber-800',
        danger: 'from-rose-50 to-red-50 border-rose-100 text-rose-800',
        neutral: 'from-slate-50 to-gray-50 border-slate-100 text-slate-700'
    };

    const indicatorColors = {
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-rose-500',
        neutral: 'bg-slate-400'
    };

    return (
        <div className={`relative overflow-hidden p-5 rounded-2xl border bg-gradient-to-br ${statusStyles[status] || statusStyles.neutral} shadow-sm hover:shadow-md transition-all duration-300 group`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${indicatorColors[status] || indicatorColors.neutral}`}></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
                </div>
                {Icon && <Icon className="w-4 h-4 opacity-40 group-hover:opacity-60 transition-opacity" />}
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight">{value}</span>
                <span className="text-sm font-medium opacity-60">{unit}</span>
            </div>
            {description && (
                <div className="mt-3 pt-3 border-t border-black/5">
                    <p className="text-[10px] font-medium opacity-60 leading-relaxed">{description}</p>
                </div>
            )}
        </div>
    );
};

const DataUploadCard = ({ onDataLoaded }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, processing, success
    const [previewImage, setPreviewImage] = useState(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) processFile(files[0]);
    };

    const processFile = (file) => {
        setUploadStatus('uploading');

        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            // Process CSV
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                parseCSV(text);
            };
            reader.readAsText(file);
        } else if (file.type.startsWith('image/')) {
            // Process Image
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target.result);
                simulateImageProcessing();
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please upload a valid CSV or Image file.');
            setUploadStatus('idle');
        }
    };

    const parseCSV = (text) => {
        setUploadStatus('processing');
        setTimeout(async () => {
            try {
                try {
                    const backendResult = await requestBackendCsvParse(text);
                    onDataLoaded(backendResult.data);
                    setUploadStatus('success');
                    return;
                } catch (backendError) {
                    console.warn('Backend CSV parser unavailable, falling back to local parser.', backendError);
                }

                const lines = text.split('\n');
                const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
                const glucoseIndex = headers.findIndex(h => h.includes('glucose') || h.includes('value'));
                const timeIndex = headers.findIndex(h => h.includes('time') || h.includes('timestamp'));

                if (glucoseIndex === -1) throw new Error("Missing 'glucose' column");

                const newData = lines.slice(1).filter(l => l.trim()).map((line, idx) => {
                    const cols = line.split(',');
                    const glucose = parseFloat(cols[glucoseIndex]);
                    if (isNaN(glucose)) return null;

                    let timeStr = timeIndex !== -1 ? cols[timeIndex] : new Date().toISOString();
                    // Basic date parsing fallback
                    const time = parseLocalTimestamp(timeStr, idx);

                    return {
                        timestamp: time.toISOString(),
                        displayTime: `${time.getDate()}/${time.getMonth() + 1} ${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`,
                        glucose: glucose
                    };
                }).filter(Boolean);

                if (newData.length === 0) throw new Error("No valid data found");

                onDataLoaded(newData);
                setUploadStatus('success');
            } catch (err) {
                console.error(err);
                alert("Error parsing CSV: " + err.message);
                setUploadStatus('idle');
            }
        }, 1000);
    };

    const simulateImageProcessing = () => {
        setUploadStatus('processing');
        // Simulate OCR / Vision API delay
        setTimeout(() => {
            // Generate mock data based on "image analysis"
            const mockData = generateCGMData();
            onDataLoaded(mockData);
            setUploadStatus('success');
        }, 2500);
    };

    return (
        <div
            className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'
                }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="p-8 flex flex-col items-center justify-center text-center">

                {uploadStatus === 'idle' && (
                    <>
                        <div className="flex gap-4 mb-6">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition-all w-32"
                            >
                                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <FileUp className="w-5 h-5 text-blue-600" />
                                </div>
                                <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700">Upload CSV</span>
                            </button>
                            <button
                                onClick={() => imageInputRef.current?.click()}
                                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 transition-all w-32"
                            >
                                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <ImageIcon className="w-5 h-5 text-purple-600" />
                                </div>
                                <span className="text-xs font-semibold text-slate-600 group-hover:text-purple-700">Upload Image</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                            Drag & Drop files here or choose an option
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                            Supports .csv (CGM export) or .png/.jpg (Screenshots)
                        </p>
                    </>
                )}

                {uploadStatus === 'processing' && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="relative w-16 h-16 mb-4">
                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            {previewImage && (
                                <div className="absolute inset-2 rounded-full overflow-hidden border-2 border-white">
                                    <img src={previewImage} className="w-full h-full object-cover opacity-50" />
                                </div>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                            {previewImage ? 'Analyzing Image Structure...' : 'Parsing Data...'}
                        </p>
                    </div>
                )}

                {uploadStatus === 'success' && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-800">Data Loaded Successfully</p>
                        <button
                            onClick={() => setUploadStatus('idle')}
                            className="mt-4 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                            Upload Another File
                        </button>
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
                <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
            </div>
        </div>
    );
};

// --- 6. Main Application ---

function App() {
    const [cgmData, setCgmData] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [status, setStatus] = useState('idle');
    const [analysis, setAnalysis] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [showUpload, setShowUpload] = useState(true);

    useEffect(() => {
        const data = generateCGMData();
        setCgmData(data);
        setMetrics(calculateMetrics(data));
    }, []);

    const handleDataLoaded = (newData) => {
        setCgmData(newData);
        setMetrics(calculateMetrics(newData));
        setStatus('idle');
        setAnalysis(null);
        setVideoUrl(null);
        // Optional: Auto-hide upload after success
        // setShowUpload(false); 
    };

    const handleRegenerateData = () => {
        const data = generateCGMData();
        setCgmData(data);
        setMetrics(calculateMetrics(data));
        setStatus('idle');
        setAnalysis(null);
        setVideoUrl(null);
    };

    const handleRunAnalysis = async () => {
        if (!metrics) return;
        setStatus('analyzing');

        try {
            const backendResult = await requestBackendPipeline(cgmData);
            setCgmData(backendResult.data || cgmData);
            setMetrics(backendResult.metrics || metrics);
            setAnalysis(backendResult.analysis);
            setVideoUrl(backendResult.video?.videoUrl || null);
            setStatus('complete');
            return;
        } catch (backendError) {
            console.warn('Backend unavailable, falling back to local simulation.', backendError);
        }

        try {
            const result = await simulateLLMAnalysis(metrics, cgmData.slice(-96));
            setAnalysis(result);
            setStatus('generating');
            const video = await simulateVideoGeneration(result.video_generation_prompt);
            setVideoUrl(video);
            setStatus('complete');
        } catch (e) {
            console.error(e);
            setStatus('idle');
        }
    };

    const getStatus = (metric, value) => {
        const val = parseFloat(value);
        switch (metric) {
            case 'tir': return val > 70 ? 'success' : (val > 50 ? 'warning' : 'danger');
            case 'tar': return val < 25 ? 'success' : (val < 40 ? 'warning' : 'danger');
            case 'tbr': return val < 4 ? 'success' : (val < 8 ? 'warning' : 'danger');
            case 'cv': return val <= 36 ? 'success' : 'danger';
            default: return 'neutral';
        }
    };

    const chartData = useMemo(() => cgmData.slice(-96), [cgmData]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Navbar */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg text-slate-800 tracking-tight">Diabetes Evolution <span className="text-blue-600">Visualizer</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowUpload(!showUpload)}
                            className={`group flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all shadow-sm ${showUpload ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {showUpload ? 'Hide Upload' : 'Upload Data'}
                        </button>
                        <button
                            onClick={handleRegenerateData}
                            className="group flex items-center gap-2 text-xs font-semibold bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-600 px-3 py-2 rounded-lg transition-all shadow-sm hover:shadow"
                        >
                            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                            Regenerate Data
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">

                {/* Data Upload Section */}
                {showUpload && (
                    <section className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-blue-500" />
                                Data Input
                            </h2>
                        </div>
                        <DataUploadCard onDataLoaded={handleDataLoaded} />
                    </section>
                )}

                {/* Metrics Section */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            Clinical Metrics <span className="text-slate-400 font-normal text-sm ml-2">14-Day Average</span>
                        </h2>
                    </div>

                    {metrics && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <MetricCard label="Time In Range" value={metrics.tir} unit="%" status={getStatus('tir', metrics.tir)} description="Target >70%" />
                            <MetricCard label="Time Above Range" value={metrics.tar} unit="%" status={getStatus('tar', metrics.tar)} description="Target <25%" />
                            <MetricCard label="Time Below Range" value={metrics.tbr} unit="%" status={getStatus('tbr', metrics.tbr)} description="Target <4%" />
                            <MetricCard label="Coeff. Variation" value={metrics.cv} unit="%" status={getStatus('cv', metrics.cv)} description="Target ≤36%" />
                            <MetricCard label="GMI (Est. HbA1c)" value={metrics.gmi} unit="%" status="neutral" description="Glucose Mgmt Indicator" />
                            <MetricCard label="Glycemia Risk Index" value={metrics.gri} unit="" status={parseFloat(metrics.gri) < 40 ? 'success' : 'warning'} description="Composite Risk Score" />
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Visualization */}
                    <div className="lg:col-span-7 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div className="bg-white p-1 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                            <div className="bg-white rounded-[20px] p-6">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-blue-500" />
                                            24h Glucose Trend
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">Real-time simulation of last 24 hours</p>
                                    </div>
                                    <div className="flex gap-3 text-[10px] font-medium uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Range</span>
                                        <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-100"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> High</span>
                                    </div>
                                </div>
                                <div className="h-[380px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorGlucose" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis
                                                dataKey="displayTime"
                                                stroke="#94a3b8"
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                interval={12}
                                                dy={10}
                                            />
                                            <YAxis
                                                stroke="#94a3b8"
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                domain={[0, 25]}
                                                unit=" mmol/L"
                                                dx={-10}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                                                itemStyle={{ color: '#1e293b', fontWeight: 600, fontSize: '13px' }}
                                                labelStyle={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}
                                                cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }}
                                            />
                                            <ReferenceLine y={10.0} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                                            <ReferenceLine y={3.9} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />

                                            <Area
                                                type="monotone"
                                                dataKey="glucose"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorGlucose)"
                                                animationDuration={1500}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: AI Analysis */}
                    <div className="lg:col-span-5 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        <div className="bg-white p-1 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 h-full">
                            <div className="bg-white rounded-[20px] p-6 h-full flex flex-col relative overflow-hidden">
                                {/* Decorative background blob */}
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-purple-600" />
                                        AI Pathology Analysis
                                    </h3>
                                    {status === 'idle' && (
                                        <button
                                            onClick={handleRunAnalysis}
                                            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5"
                                        >
                                            <Play className="w-4 h-4 fill-current" /> Run Analysis
                                        </button>
                                    )}
                                </div>

                                {/* State: Idle */}
                                {status === 'idle' && !analysis && (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                                            <Zap className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h4 className="text-slate-900 font-semibold mb-1">Ready to Analyze</h4>
                                        <p className="text-slate-500 text-xs max-w-[200px] leading-relaxed">AI will process 14-day CGM data to predict pathological risks.</p>
                                    </div>
                                )}

                                {/* State: Processing */}
                                {(status === 'analyzing' || status === 'generating') && (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                                        <div className="relative w-20 h-20">
                                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Brain className="w-8 h-8 text-purple-600 animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-slate-800 text-lg">
                                                {status === 'analyzing' ? 'Analyzing Patterns...' : 'Generating Simulation...'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2 font-medium uppercase tracking-wide">
                                                {status === 'analyzing' ? 'Correlating Clinical Guidelines' : 'Rendering 3D Pathology Model'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* State: Complete */}
                                {analysis && status === 'complete' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
                                        {/* Text Summary */}
                                        <div className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                Pathology Summary
                                            </h4>
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                {analysis.pathology_summary}
                                            </p>
                                        </div>

                                        {/* Video Player */}
                                        <div className="rounded-2xl overflow-hidden bg-black relative group aspect-video shadow-2xl shadow-purple-900/20 border border-slate-900/10">
                                            <div className="absolute top-4 left-4 z-10 flex gap-2">
                                                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                                    AI GENERATED
                                                </span>
                                            </div>

                                            {videoUrl && videoUrl.endsWith('.mp4') ? (
                                                <video
                                                    src={videoUrl}
                                                    className="w-full h-full object-cover"
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <>
                                                    <img
                                                        src={videoUrl || "https://placehold.co/600x400/0f172a/1e293b?text=Video+Placeholder"}
                                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700 scale-105 group-hover:scale-100 transition-transform"
                                                        alt="Pathology Visualization"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform cursor-pointer shadow-2xl">
                                                            <Play className="w-6 h-6 text-white fill-white ml-1" />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                                <p className="text-[10px] text-white/50 font-mono line-clamp-1 mb-1">PROMPT GENERATED:</p>
                                                <p className="text-xs text-white/90 font-medium line-clamp-2 leading-relaxed">
                                                    {analysis.video_generation_prompt}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Risk Indicators */}
                                        <div className="grid grid-cols-3 gap-3 mt-auto">
                                            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center hover:bg-rose-100 transition-colors">
                                                <Eye className="w-5 h-5 text-rose-500 mx-auto mb-2" />
                                                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Retinopathy</span>
                                            </div>
                                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center hover:bg-amber-100 transition-colors">
                                                <HeartPulse className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">CV Risk</span>
                                            </div>
                                            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center hover:bg-indigo-100 transition-colors">
                                                <Zap className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
                                                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">Neuropathy</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
