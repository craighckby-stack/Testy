/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  Sparkles, 
  BrainCircuit, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  GitCommit,
  Lightbulb,
  Compass,
  ArrowRight
} from 'lucide-react';
import type { AnswerItem, GitCommitRecord } from '../utils/engine.ts';

interface SelfQueryLoopProps {
  answers: AnswerItem[];
  commits: GitCommitRecord[];
  onGenerateStep: (question: string, model: string, dupThreshold: number) => Promise<void>;
  onUpdateStatus: (id: string, status: 'accepted' | 'duplicate') => Promise<void>;
  isGenerating: boolean;
  model: string;
  setModel: (m: string) => void;
  dupThreshold: number;
  setDupThreshold: (v: number) => void;
  question: string;
  setQuestion: (q: string) => void;
}

export const SelfQueryLoop: React.FC<SelfQueryLoopProps> = ({
  answers,
  commits,
  onGenerateStep,
  onUpdateStatus,
  isGenerating,
  model,
  setModel,
  dupThreshold,
  setDupThreshold,
  question,
  setQuestion,
}) => {
  const [targetCycles, setTargetCycles] = useState<number>(100000);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [isRunningContinuous, setIsRunningContinuous] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isRunningRef = React.useRef<boolean>(false);
  const isPausedRef = React.useRef<boolean>(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTabooList, setShowTabooList] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<boolean>(false);
  const [tempQuestion, setTempQuestion] = useState<string>(question);

  const acceptedAnswers = answers.filter(a => a.status === 'accepted');
  const latestAnswer = answers[answers.length - 1];
  const latestCommit = commits[0];

  // Continuous autonomous runner
  const startContinuousRun = async (totalToRun: number) => {
    setIsRunningContinuous(true);
    setIsPaused(false);
    isRunningRef.current = true;
    isPausedRef.current = false;

    let current = completedCycles;
    while (isRunningRef.current && current < totalToRun) {
      if (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
      try {
        await onGenerateStep(question, model, dupThreshold);
        current++;
        setCompletedCycles(current);
      } catch (err) {
        console.error('Cycle error:', err);
        // Pause on error so user can review
        setIsPaused(true);
        isPausedRef.current = true;
        break;
      }
      // Brief breathing yield to ensure UI responsiveness
      await new Promise(r => setTimeout(r, 200));
    }

    setIsRunningContinuous(false);
    isRunningRef.current = false;
  };

  const handlePauseToggle = () => {
    const next = !isPaused;
    setIsPaused(next);
    isPausedRef.current = next;
  };

  const handleStop = () => {
    setIsRunningContinuous(false);
    setIsPaused(false);
    isRunningRef.current = false;
    isPausedRef.current = false;
  };

  const handleSingleStep = async () => {
    await onGenerateStep(question, model, dupThreshold);
    setCompletedCycles(prev => prev + 1);
  };

  const saveQuestion = () => {
    if (tempQuestion.trim()) {
      setQuestion(tempQuestion.trim());
      setEditingQuestion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Question Hero Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wider font-semibold">
                Single Seed Question
              </span>
              <span className="text-xs text-slate-400">
                The model continuously asks this exact question to itself, forbidden from repeating any earlier answer.
              </span>
            </div>

            {editingQuestion ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={tempQuestion}
                  onChange={(e) => setTempQuestion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveQuestion}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded cursor-pointer"
                  >
                    Save Question
                  </button>
                  <button
                    onClick={() => {
                      setTempQuestion(question);
                      setEditingQuestion(false);
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <h2 className="text-lg sm:text-xl font-medium text-slate-100 tracking-tight">
                  &ldquo;{question}&rdquo;
                </h2>
                <button
                  onClick={() => {
                    setTempQuestion(question);
                    setEditingQuestion(true);
                  }}
                  className="ml-3 text-xs text-slate-400 hover:text-indigo-400 underline cursor-pointer shrink-0"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Model & Threshold Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800 shrink-0">
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Model Engine</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="gemini-4-argon">gemini-4-argon (High Thinking)</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1">
                <span>Dup Threshold</span>
                <span className="font-mono text-slate-200">{Math.round(dupThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.85"
                step="0.05"
                value={dupThreshold}
                onChange={(e) => setDupThreshold(parseFloat(e.target.value))}
                className="w-24 accent-indigo-500 cursor-pointer"
                title="Similarity threshold to flag candidate as duplicate"
              />
            </div>
          </div>
        </div>

        {/* Action Bar & Cycle Controls */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {!isRunningContinuous ? (
                <>
                  <button
                    onClick={() => startContinuousRun(targetCycles)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run {targetCycles.toLocaleString()} Cycles</span>
                  </button>

                  <button
                    onClick={handleSingleStep}
                    disabled={isGenerating}
                    className="px-3 py-2 rounded-lg font-medium text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                  >
                    +1 Step
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePauseToggle}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      isPaused
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>{isPaused ? 'Resume Runner' : 'Pause'}</span>
                  </button>

                  <button
                    onClick={handleStop}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 cursor-pointer"
                  >
                    Stop Run
                  </button>

                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Running Cycle {completedCycles.toLocaleString()} of {targetCycles.toLocaleString()}</span>
                  </span>
                </div>
              )}

              {/* Cycle Presets */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                {[1, 10, 100, 1000, 100000].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setTargetCycles(cnt)}
                    disabled={isRunningContinuous}
                    className={`px-2.5 py-1 text-xs rounded font-mono transition-colors cursor-pointer ${
                      targetCycles === cnt
                        ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cnt >= 1000 ? `${cnt / 1000}k` : cnt}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowTabooList(!showTabooList)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/40 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Taboo History ({acceptedAnswers.length})</span>
                {showTabooList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Commit Hash badge */}
            {latestCommit && (
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono text-slate-300">{latestCommit.hash}</span>
                <span className="truncate max-w-[240px] text-slate-400 hidden sm:inline">&bull; {latestCommit.message}</span>
              </div>
            )}
          </div>

          {/* Progress bar if running or completed > 0 */}
          {completedCycles > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Progress: {completedCycles.toLocaleString()} / {targetCycles.toLocaleString()} cycles</span>
                <span>{((completedCycles / targetCycles) * 100).toFixed(3)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (completedCycles / targetCycles) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Guarantee banner */}
          <div className="flex items-center gap-2 text-[11px] text-emerald-400/90 bg-emerald-950/20 border border-emerald-900/40 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>
              <strong>Zero-Repetition Protocol Active:</strong> Each cycle injects the full taboo history of previous answers into prompt constraints and runs an automated similarity filter to ensure every answer explores unvisited territory.
            </span>
          </div>
        </div>

        {/* Collapsible Taboo List */}
        {showTabooList && (
          <div className="mt-4 p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <div className="flex items-center gap-1.5 text-amber-400">
                <ShieldAlert className="w-4 h-4" />
                <span>Negative Constraint Taboo List (Injected into LLM Context)</span>
              </div>
              <span className="text-slate-500">{acceptedAnswers.length} angles forbidden</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              When asking the question, the LLM receives this accumulated list and is strictly prohibited from re-using their premises, metaphors, or lines of reasoning.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 mt-2">
              {acceptedAnswers.map((item, idx) => (
                <div key={item.id} className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                  <span className="font-mono text-indigo-400 shrink-0">#{idx + 1}</span>
                  <div className="flex-1">
                    <span className="font-semibold text-slate-300 mr-2">[{item.angleExplored || 'Novel Angle'}]:</span>
                    <span className="text-slate-400">{item.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest Loop Output & Insight Card */}
      {latestAnswer && (
        <div className={`p-5 rounded-xl border transition-all ${
          latestAnswer.status === 'accepted'
            ? 'bg-slate-900 border-indigo-500/30 shadow-indigo-950/20'
            : 'bg-slate-900/90 border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 text-slate-200">
                Latest: {latestAnswer.id}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                latestAnswer.status === 'accepted'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              }`}>
                {latestAnswer.status === 'accepted' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accepted Novel Perspective</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Flagged Duplicate (sim: {Math.round((latestAnswer.nearest_sim || 0) * 100)}%)</span>
                  </>
                )}
              </span>

              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Lens: {latestAnswer.angleExplored || 'Unique Prism'}</span>
              </span>
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              Run: {latestAnswer.run} &bull; {new Date(latestAnswer.ts).toLocaleTimeString()}
            </span>
          </div>

          {/* Answer Text */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 my-3">
            <p className="text-slate-100 text-sm sm:text-base leading-relaxed font-serif tracking-wide">
              &ldquo;{latestAnswer.answer}&rdquo;
            </p>
          </div>

          {/* Cognitive Trajectory & Insight Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-indigo-300 font-semibold mb-1">
                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                <span>High Thinking Mode Trajectory</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {latestAnswer.thinkingSummary || 'Explored conceptual topology to bypass previous metaphors and formulate distinct axiomatic grounding.'}
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-1">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Insight Gained &bull; Next Horizon</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {latestAnswer.insightGained || 'Identified distinct conceptual boundary to push future inquiries toward remaining unexplored conceptual frameworks.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Answer History & Divergence Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Logged Answers ({answers.length})
            </h3>
            <span className="text-xs text-slate-400">
              Persisted in <code className="font-mono text-indigo-300">log/answers.jsonl</code>
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Click to inspect thinking &amp; nearest similarity
          </span>
        </div>

        <div className="space-y-2.5">
          {answers.slice().reverse().map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/40">
                      {item.id}
                    </span>
                    <span className="font-medium text-xs text-slate-200 px-2 py-0.5 rounded bg-slate-800">
                      {item.angleExplored || 'Novel Angle'}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      item.status === 'accepted'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}>
                      {item.status}
                    </span>
                    {item.nearest_id && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Nearest: {item.nearest_id} ({Math.round((item.nearest_sim || 0) * 100)}%)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Toggle */}
                    <button
                      onClick={() => onUpdateStatus(item.id, item.status === 'accepted' ? 'duplicate' : 'accepted')}
                      className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/70 border border-slate-700/50 cursor-pointer"
                      title="Toggle accepted vs duplicate"
                    >
                      Mark as {item.status === 'accepted' ? 'Duplicate' : 'Accepted'}
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="text-xs text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Answer snippet */}
                <p className="mt-2 text-sm text-slate-300 leading-relaxed font-serif">
                  {item.answer}
                </p>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                    {item.insightGained && (
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-amber-300 block mb-0.5">Insight Gained:</strong>
                          <span>{item.insightGained}</span>
                        </div>
                      </div>
                    )}
                    {item.thinkingSummary && (
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-start gap-2">
                        <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-indigo-300 block mb-0.5">High Thinking Trajectory:</strong>
                          <span>{item.thinkingSummary}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                      <span>Model: {item.model}</span>
                      <span>Run: {item.run}</span>
                      <span>Logged: {new Date(item.ts).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
