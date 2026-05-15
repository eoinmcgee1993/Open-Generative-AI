'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Ghost, Clock, ShieldAlert, Zap, ChevronRight, Lock, Unlock, Clipboard,
  RefreshCw, BarChart3, Terminal, Activity, Camera, User, List,
  Trash2, Send, ShieldCheck, AlertTriangle, Eye, History
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, getDoc, onSnapshot,
  addDoc, query, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';

// --- CONFIG & INITIALIZATION ---

const getFirebaseConfig = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
};

let app, auth, db;
const firebaseConfig = getFirebaseConfig();
const FIREBASE_ENABLED = !!firebaseConfig;
const APP_ID = 'ghost-pause-v2';

if (FIREBASE_ENABLED) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// --- UTILS ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchGemini = async (payload) => {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  const model = 'gemini-2.5-flash-preview-09-2025';
  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) return await response.json();
    } catch (e) { /* retry */ }
    await sleep(delay);
    delay *= 2;
  }
  throw new Error('Strategy Engine Offline');
};

// localStorage fallback for targets when Firebase is not configured
const localTargets = {
  list: () => {
    try { return JSON.parse(localStorage.getItem('gp_targets') || '[]'); } catch { return []; }
  },
  save: (targets) => {
    localStorage.setItem('gp_targets', JSON.stringify(targets));
  },
};

// --- UI COMPONENTS ---

const Card = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 transition-all ${onClick ? 'cursor-pointer active:scale-95' : ''} ${className}`}
  >
    {children}
  </div>
);

const GhostTimer = ({ delayMinutes, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(Math.round(delayMinutes * 60));

  useEffect(() => {
    if (timeLeft <= 0) { onComplete?.(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (s) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((delayMinutes * 60 - timeLeft) / (delayMinutes * 60)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Tactical Delay Active</p>
          <h3 className="text-3xl font-black text-white font-mono tracking-tighter">{formatTime(timeLeft)}</h3>
        </div>
        <Lock className="text-zinc-700 animate-pulse" size={20} />
      </div>
      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
        <div
          className="bg-white h-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function GhostPauseApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [input, setInput] = useState({ message: '', latency: 15, context: 'Mixed' });
  const [isLocked, setIsLocked] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [calibrationText, setCalibrationText] = useState('');
  const [calibratedOutput, setCalibratedOutput] = useState(null);
  const [error, setError] = useState(null);

  // Firebase Auth & Data (or localStorage fallback)
  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      setUser({ uid: 'local-user' });
      setTargets(localTargets.list());
      return;
    }

    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error(e); }
    };
    initAuth();

    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (!FIREBASE_ENABLED) {
      setTargets(localTargets.list());
      return;
    }

    const targetsCol = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'targets');
    const unsubscribe = onSnapshot(targetsCol, (snapshot) => {
      setTargets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error);
    return () => unsubscribe();
  }, [user]);

  // Strategic Engine
  const runAnalysis = async (msg, lat, ctx, targetId = null) => {
    setLoading(true);
    setError(null);
    setView('analysis');

    const systemPrompt = `You are the GhostPause Interaction Analysis Engine.
    Evaluate the message: "${msg}" with latency ${lat} mins and context: ${ctx}.
    Calculate:
    1. Investment Score (0-100): 100 is high target interest, 0 is ghosted.
    2. Power Balance: Who holds the frame?
    3. Three Blueprints: Option A (Open Loop), Option B (Tension), Option C (Reset).
    Respond ONLY in JSON. Format: {score, level: "High/Mixed/Low", frame, delayFactor, blueprints: [{title, text, type}]}`;

    try {
      const result = await fetchGemini({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      });
      const data = JSON.parse(result.candidates[0].content.parts[0].text);

      const analysisData = {
        ...data,
        message: msg,
        latency: lat,
        timestamp: Date.now(),
        strategicDelay: Math.round(lat * (data.delayFactor || 1.6)),
      };

      setAnalysis(analysisData);
      setIsLocked(true);

      if (user && targetId && FIREBASE_ENABLED) {
        const targetRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'targets', targetId);
        const existing = targets.find(t => t.id === targetId);
        await updateDoc(targetRef, {
          lastScore: data.score,
          lastInteraction: serverTimestamp(),
          history: [...(existing?.history || []).slice(-10), analysisData],
        });
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Analysis failed. Check your API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshot = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      try {
        const result = await fetchGemini({
          contents: [{
            role: 'user',
            parts: [
              { text: 'Analyze this chat screenshot. Extract: 1. The last message text from them. 2. Estimated time since that message. Return JSON: {message, estimatedLatency}' },
              { inlineData: { mimeType: 'image/png', data: base64Data } },
            ],
          }],
          generationConfig: { responseMimeType: 'application/json' },
        });
        const extracted = JSON.parse(result.candidates[0].content.parts[0].text);
        setInput(prev => ({ ...prev, message: extracted.message, latency: extracted.estimatedLatency || 15 }));
        setView('intake');
      } catch (e) {
        console.error(e);
        setError('Screenshot analysis failed.');
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const runCalibration = async () => {
    if (!calibrationText) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGemini({
        contents: [{
          parts: [{
            text: `Validation Vacuum: Analyze this message: "${calibrationText}". Strip all unearned praise, emojis, and needy filler. Re-write it to be cold, high-value, and 30% shorter. Return JSON: {original, calibrated, removedElements: [], needyScore: 0-10}`,
          }],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      });
      setCalibratedOutput(JSON.parse(result.candidates[0].content.parts[0].text));
    } catch (e) {
      console.error(e);
      setError('Calibration failed. Check your API key.');
    }
    setLoading(false);
  };

  const createTarget = async (name) => {
    if (!user) return;
    const newTarget = { name, lastScore: 50, history: [], createdAt: Date.now() };

    if (!FIREBASE_ENABLED) {
      const updated = [...targets, { ...newTarget, id: `local-${Date.now()}` }];
      localTargets.save(updated);
      setTargets(updated);
      return;
    }

    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'targets'), {
      ...newTarget,
      createdAt: serverTimestamp(),
    });
  };

  const deleteTarget = async (id) => {
    if (!user) return;

    if (!FIREBASE_ENABLED) {
      const updated = targets.filter(t => t.id !== id);
      localTargets.save(updated);
      setTargets(updated);
      if (currentTarget?.id === id) setCurrentTarget(null);
      return;
    }

    await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'targets', id));
    if (currentTarget?.id === id) setCurrentTarget(null);
  };

  const handleCopy = (text, id) => {
    if (isLocked) return;
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const uid = user?.uid?.slice(0, 6) ?? '------';

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans pb-20" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative max-w-md mx-auto p-6 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-white flex items-center justify-center rounded">
              <Ghost size={20} className="text-black" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">GhostPause</h1>
          </div>
          <div className="flex gap-4 items-center">
            <span className="text-[10px] font-mono text-zinc-600">ID: {uid}</span>
            <Activity size={16} className={loading ? 'text-white animate-pulse' : 'text-zinc-800'} />
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-lg flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-mono text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-300 text-xs">✕</button>
          </div>
        )}

        {/* Views */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3">
              <Card onClick={() => setView('intake')} className="bg-zinc-800/50 border-zinc-700 flex flex-col gap-4 py-6 items-center justify-center">
                <Zap size={24} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em]">New Analysis</span>
              </Card>
              <Card onClick={() => setView('calibrate')} className="bg-zinc-800/50 border-zinc-700 flex flex-col gap-4 py-6 items-center justify-center">
                <ShieldCheck size={24} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Vacuum Calibration</span>
              </Card>
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Active Targets</span>
                </div>
                <button
                  onClick={() => {
                    const name = prompt('Enter Target Name/Alias:');
                    if (name?.trim()) createTarget(name.trim());
                  }}
                  className="text-[10px] font-bold text-white uppercase tracking-tighter bg-zinc-800 px-2 py-1 rounded"
                >
                  + Add Target
                </button>
              </div>

              <div className="space-y-3">
                {targets.map(t => (
                  <Card key={t.id} className="relative group overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() => { setCurrentTarget(t); setView('intake'); }}
                      >
                        <h3 className="font-bold text-lg">{t.name}</h3>
                        <div className="flex gap-3 items-center mt-1">
                          <span className={`text-[10px] font-mono uppercase px-1.5 rounded ${t.lastScore > 60 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                            Score: {t.lastScore}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-600 uppercase">
                            {t.lastInteraction ? 'Active' : 'No Data'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTarget(t.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-700 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Card>
                ))}
                {targets.length === 0 && (
                  <div className="border border-dashed border-zinc-800 rounded-lg p-10 text-center">
                    <p className="text-zinc-600 text-xs font-mono uppercase italic">Target Database Empty</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {view === 'intake' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setView('dashboard')} className="text-zinc-500 hover:text-white transition-colors">
                <ChevronRight className="rotate-180" size={20} />
              </button>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">Intake Phase</span>
            </div>

            <section className="space-y-4">
              <Card className="border-dashed border-zinc-700 p-0 overflow-hidden relative">
                <label className="flex flex-col items-center justify-center p-8 gap-3 cursor-pointer hover:bg-zinc-800/30 transition-all">
                  <Camera size={28} className="text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Scan Screenshot</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleScreenshot} />
                </label>
                {loading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <RefreshCw className="animate-spin" />
                  </div>
                )}
              </Card>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Incoming Message</label>
                <textarea
                  value={input.message}
                  onChange={(e) => setInput(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter message text..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 h-32 focus:outline-none focus:border-zinc-500 transition-colors text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Latency (Mins)</label>
                  <input
                    type="number"
                    value={input.latency}
                    onChange={(e) => setInput(prev => ({ ...prev, latency: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Target</label>
                  <select
                    value={currentTarget?.id || ''}
                    onChange={(e) => {
                      const t = targets.find(t => t.id === e.target.value);
                      setCurrentTarget(t || null);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm appearance-none"
                  >
                    <option value="">Global / No Target</option>
                    {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <button
              onClick={() => runAnalysis(input.message, input.latency, input.context, currentTarget?.id)}
              disabled={!input.message || loading}
              className="w-full py-4 bg-white text-black rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:bg-zinc-300 disabled:opacity-50 transition-colors"
            >
              Execute Analysis
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {view === 'analysis' && (
          <div className="space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Zap className="text-white animate-bounce" size={32} />
                <p className="text-xs font-mono text-white animate-pulse tracking-[0.4em] uppercase">Calculating Frame...</p>
              </div>
            )}

            {!loading && analysis && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-white text-black border-none">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Engage Score</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black italic">{analysis.score}</span>
                      <span className="text-xs font-bold">/100</span>
                    </div>
                  </Card>
                  <Card>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Investment</p>
                    <span className={`text-sm font-bold uppercase ${analysis.level === 'Low' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {analysis.level}
                    </span>
                  </Card>
                </div>

                <Card className="border-white/20 bg-zinc-900/80">
                  <GhostTimer delayMinutes={analysis.strategicDelay} onComplete={() => setIsLocked(false)} />
                </Card>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <BarChart3 size={14} className="text-zinc-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Power Metrics</span>
                  </div>
                  <Card className="divide-y divide-zinc-800 py-0 overflow-hidden">
                    <div className="py-3 flex justify-between items-center text-xs">
                      <span className="text-zinc-500 uppercase">Frame Holder</span>
                      <span className="text-white font-mono">{analysis.frame}</span>
                    </div>
                    <div className="py-3 flex justify-between items-center text-xs">
                      <span className="text-zinc-500 uppercase">Latency Multiplier</span>
                      <span className="text-white font-mono">{analysis.delayFactor}x</span>
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Blueprints</span>
                    {isLocked && <Lock size={12} className="text-zinc-700" />}
                  </div>
                  <div className="space-y-3">
                    {analysis.blueprints?.map((bp, i) => (
                      <button
                        key={i}
                        disabled={isLocked}
                        onClick={() => handleCopy(bp.text, i)}
                        className={`w-full text-left transition-all ${isLocked ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:-translate-y-1'}`}
                      >
                        <Card className={`border-zinc-800 hover:border-zinc-500 ${copiedId === i ? 'border-white bg-zinc-800' : ''}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">{bp.title || bp.type}</span>
                            {copiedId === i
                              ? <span className="text-[10px] text-white">COPIED</span>
                              : <Clipboard size={12} className="text-zinc-700" />
                            }
                          </div>
                          <p className="text-sm italic text-zinc-300">"{bp.text}"</p>
                        </Card>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setView('dashboard')} className="w-full py-4 text-zinc-500 text-xs font-mono uppercase hover:text-white transition-colors">
                  Back to Command Center
                </button>
              </>
            )}

            {!loading && !analysis && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertTriangle size={32} className="text-red-500" />
                <p className="text-xs font-mono text-zinc-500 uppercase">Analysis Failed</p>
                <button onClick={() => setView('intake')} className="text-xs text-white underline">Try Again</button>
              </div>
            )}
          </div>
        )}

        {view === 'calibrate' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setView('dashboard')} className="text-zinc-500 hover:text-white transition-colors">
                <ChevronRight className="rotate-180" size={20} />
              </button>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">Validation Vacuum</span>
            </div>

            <section className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Your Draft Message</label>
                <textarea
                  value={calibrationText}
                  onChange={(e) => setCalibrationText(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 h-32 focus:outline-none focus:border-zinc-500 text-sm resize-none"
                />
              </div>

              <button
                onClick={runCalibration}
                disabled={!calibrationText || loading}
                className="w-full py-4 bg-zinc-100 text-black rounded-lg font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Run Calibration'}
              </button>

              {calibratedOutput && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Calibrated Output</span>
                  </div>
                  <Card className="bg-zinc-800/30 border-emerald-900/40 relative group">
                    <p className="text-sm italic text-emerald-100 pr-8">"{calibratedOutput.calibrated}"</p>
                    <button
                      onClick={() => handleCopy(calibratedOutput.calibrated, 'cal')}
                      className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                    >
                      {copiedId === 'cal'
                        ? <span className="text-[10px] font-bold">COPIED</span>
                        : <Clipboard size={16} />
                      }
                    </button>
                  </Card>

                  <div className="grid grid-cols-2 gap-3">
                    <Card className="py-2 px-3">
                      <span className="text-[9px] text-zinc-500 uppercase block">Needy Score</span>
                      <span className={`text-sm font-bold ${calibratedOutput.needyScore > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {calibratedOutput.needyScore}/10
                      </span>
                    </Card>
                    <Card className="py-2 px-3">
                      <span className="text-[9px] text-zinc-500 uppercase block">Elements Removed</span>
                      <span className="text-sm font-bold text-white">{calibratedOutput.removedElements?.length || 0}</span>
                    </Card>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Nav Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex justify-around items-center z-40 max-w-md mx-auto">
          <button
            onClick={() => setView('dashboard')}
            className={`p-2 transition-colors ${view === 'dashboard' ? 'text-white' : 'text-zinc-600'}`}
          >
            <List size={20} />
          </button>
          <button
            onClick={() => setView('intake')}
            className={`p-2 transition-colors ${view === 'intake' || view === 'analysis' ? 'text-white' : 'text-zinc-600'}`}
          >
            <Zap size={20} />
          </button>
          <button
            onClick={() => setView('calibrate')}
            className={`p-2 transition-colors ${view === 'calibrate' ? 'text-white' : 'text-zinc-600'}`}
          >
            <ShieldCheck size={20} />
          </button>
        </nav>
      </div>
    </div>
  );
}
