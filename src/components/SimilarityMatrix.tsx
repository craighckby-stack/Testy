/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Layers,
  Sparkles
} from 'lucide-react';
import { calculateLexicalSimilarity, type AnswerItem, type PairLabel } from '../utils/engine.ts';

interface SimilarityMatrixProps {
  answers: AnswerItem[];
  labels: Record<string, PairLabel>;
  dupThreshold: number;
  setDupThreshold: (v: number) => void;
}

export const SimilarityMatrix: React.FC<SimilarityMatrixProps> = ({
  answers,
  labels,
  dupThreshold,
  setDupThreshold,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ a: AnswerItem; b: AnswerItem; sim: number } | null>(null);

  // Compute pairwise matrix for up to top 15 answers to keep display readable
  const displayAnswers = useMemo(() => answers.slice(0, 15), [answers]);

  const matrixData = useMemo(() => {
    const list: { a: AnswerItem; b: AnswerItem; sim: number }[] = [];
    for (let i = 0; i < displayAnswers.length; i++) {
      for (let j = i + 1; j < displayAnswers.length; j++) {
        const a = displayAnswers[i];
        const b = displayAnswers[j];
        const sim = calculateLexicalSimilarity(a.answer, b.answer);
        list.push({ a, b, sim });
      }
    }
    // Sort descending
    list.sort((x, y) => y.sim - x.sim);
    return list;
  }, [displayAnswers]);

  // Threshold stats
  const aboveThresholdCount = matrixData.filter(p => p.sim >= dupThreshold).length;

  return (
    <div className="space-y-6">
      {/* Header & Threshold Calibrator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              <span>Similarity Matrix &amp; DUP_SIM Calibration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              &ldquo;DUP_SIM = 0.85 is a guess. The labels will tell you where the threshold should be.&rdquo;
            </p>
          </div>

          {/* Slider */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center gap-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-medium text-slate-300">
                <span>Duplicate Threshold (DUP_SIM):</span>
                <span className="font-mono text-indigo-400 font-bold ml-2">
                  {Math.round(dupThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.25"
                max="0.85"
                step="0.05"
                value={dupThreshold}
                onChange={(e) => setDupThreshold(parseFloat(e.target.value))}
                className="w-48 accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-[11px] text-slate-500 block">Flagged Pairs:</span>
              <span className={`text-base font-mono font-bold ${
                aboveThresholdCount > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}>
                {aboveThresholdCount} of {matrixData.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Cell Inspector */}
      {selectedCell && (
        <div className="p-4 bg-slate-900 border border-indigo-500/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-300">
              Comparing Pair: <span className="font-mono">{selectedCell.a.id}</span> vs <span className="font-mono">{selectedCell.b.id}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-200">
                Similarity: {Math.round(selectedCell.sim * 100)}%
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                selectedCell.sim >= dupThreshold
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              }`}>
                {selectedCell.sim >= dupThreshold ? 'Flagged as Duplicate' : 'Accepted Distinct'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <span className="font-bold text-slate-300 block mb-1">
                {selectedCell.a.id} [{selectedCell.a.angleExplored || 'Lens'}]:
              </span>
              <p className="text-slate-300 font-serif leading-relaxed">{selectedCell.a.answer}</p>
            </div>
            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <span className="font-bold text-slate-300 block mb-1">
                {selectedCell.b.id} [{selectedCell.b.angleExplored || 'Lens'}]:
              </span>
              <p className="text-slate-300 font-serif leading-relaxed">{selectedCell.b.answer}</p>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Grid */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-semibold text-slate-200">Pairwise Similarity Heatmap</h3>
          <span className="text-slate-500">Click any cell to compare answers</span>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid gap-1" style={{ gridTemplateColumns: `48px repeat(${displayAnswers.length}, 36px)` }}>
              {/* Header row */}
              <div className="text-[10px] text-slate-500 font-mono flex items-center justify-center"></div>
              {displayAnswers.map((a) => (
                <div key={a.id} className="text-[10px] text-slate-400 font-mono text-center truncate">
                  {a.id.replace('a-', '')}
                </div>
              ))}

              {/* Rows */}
              {displayAnswers.map((rowItem) => (
                <React.Fragment key={rowItem.id}>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center font-semibold">
                    {rowItem.id}
                  </div>
                  {displayAnswers.map((colItem) => {
                    if (rowItem.id === colItem.id) {
                      return (
                        <div
                          key={colItem.id}
                          className="h-9 rounded bg-slate-800/40 border border-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-600"
                        >
                          -
                        </div>
                      );
                    }
                    const sim = calculateLexicalSimilarity(rowItem.answer, colItem.answer);
                    const isDup = sim >= dupThreshold;
                    const opacity = Math.max(0.1, sim);

                    return (
                      <button
                        key={colItem.id}
                        onClick={() => setSelectedCell({ a: rowItem, b: colItem, sim })}
                        className={`h-9 rounded transition-transform hover:scale-110 flex items-center justify-center text-[10px] font-mono cursor-pointer border ${
                          isDup
                            ? 'bg-rose-600/80 text-white border-rose-500 shadow-sm'
                            : sim > 0.35
                            ? 'bg-amber-600/50 text-amber-200 border-amber-500/40'
                            : 'bg-indigo-950/40 text-slate-300 border-indigo-900/30'
                        }`}
                        title={`${rowItem.id} vs ${colItem.id}: ${Math.round(sim * 100)}%`}
                      >
                        {Math.round(sim * 100)}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Most Similar Pairs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Top 5 Most Similar Candidate Pairs (Borderline Checks)
        </h3>
        <div className="space-y-2">
          {matrixData.slice(0, 5).map((p, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-indigo-400 font-semibold">{p.a.id}</span>
                  <span className="text-slate-500">vs</span>
                  <span className="font-mono text-indigo-400 font-semibold">{p.b.id}</span>
                  <span className="text-slate-400">
                    ({p.a.angleExplored || 'Angle A'} &bull; {p.b.angleExplored || 'Angle B'})
                  </span>
                </div>
                <p className="text-slate-300 font-serif line-clamp-1">
                  {p.a.answer}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold text-slate-200">
                  {Math.round(p.sim * 100)}% sim
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  p.sim >= dupThreshold
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {p.sim >= dupThreshold ? 'Flagged Duplicate' : 'Borderline Distinct'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
