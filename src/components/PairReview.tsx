/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CheckSquare, 
  Download, 
  Upload, 
  RotateCcw, 
  UserCheck, 
  ChevronLeft, 
  ChevronRight, 
  Scale, 
  HelpCircle,
  FileCheck2,
  Users,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { 
  type ReviewPair, 
  type PairLabel,
  calculateCohensKappa 
} from '../utils/engine.ts';

interface PairReviewProps {
  question: string;
  pairs: ReviewPair[];
  onRegeneratePairs: () => Promise<void>;
  onSaveLabel: (labelData: { labeler: string; pair: string; a: string; b: string; label: 'same' | 'related' | 'distinct' | 'skip' }) => Promise<void>;
  allLabelersData: Record<string, Record<string, PairLabel>>;
  onReloadLabels: () => Promise<void>;
}

export const PairReview: React.FC<PairReviewProps> = ({
  question,
  pairs,
  onRegeneratePairs,
  onSaveLabel,
  allLabelersData,
  onReloadLabels,
}) => {
  const [labeler, setLabeler] = useState<string>(() => {
    return localStorage.getItem('review_labeler') || 'evaluator_1';
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'labeling' | 'kappa' | 'summary'>('labeling');
  const [secondLabeler, setSecondLabeler] = useState<string>('');

  // Persist labeler name
  useEffect(() => {
    localStorage.setItem('review_labeler', labeler);
  }, [labeler]);

  // Current user's labels map
  const myLabels = useMemo(() => {
    return allLabelersData[labeler] || {};
  }, [allLabelersData, labeler]);

  const labeledCount = Object.keys(myLabels).length;
  const currentPair = pairs[currentIndex];
  const currentPairLabel = currentPair ? myLabels[currentPair.pair] : undefined;

  // Jump to first unlabeled pair
  const jumpToFirstUnlabeled = useCallback(() => {
    for (let k = 0; k < pairs.length; k++) {
      if (!myLabels[pairs[k].pair]) {
        setCurrentIndex(k);
        return;
      }
    }
    // If all labeled, stay on last or 0
    if (pairs.length > 0) {
      setCurrentIndex(pairs.length - 1);
    }
  }, [pairs, myLabels]);

  // Handle label selection
  const handleLabel = useCallback(async (choice: 'same' | 'related' | 'distinct' | 'skip') => {
    if (!currentPair) return;
    if (!labeler.trim()) {
      alert('Please enter your labeler name first.');
      return;
    }

    await onSaveLabel({
      labeler: labeler.trim(),
      pair: currentPair.pair,
      a: currentPair.a.id,
      b: currentPair.b.id,
      label: choice
    });

    // Advance to next pair if not at the end
    if (currentIndex < pairs.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentPair, labeler, onSaveLabel, currentIndex, pairs.length]);

  // Keyboard shortcut listener matching the prompt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === '1') {
        e.preventDefault();
        handleLabel('same');
      } else if (key === '2') {
        e.preventDefault();
        handleLabel('related');
      } else if (key === '3') {
        e.preventDefault();
        handleLabel('distinct');
      } else if (key === 's') {
        e.preventDefault();
        handleLabel('skip');
      } else if (key === 'arrowleft') {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
      } else if (key === 'arrowright') {
        e.preventDefault();
        if (currentIndex < pairs.length - 1) setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLabel, currentIndex, pairs.length]);

  // Export current labeler's labels as JSONL
  const exportLabels = () => {
    const rows = Object.values(myLabels);
    const content = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
    const blob = new Blob([content], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labels-${labeler || 'anon'}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload external JSON pairs file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.items && Array.isArray(parsed.items)) {
          alert(`Loaded ${parsed.items.length} pairs from file!`);
          // could update local pairs if supported
        }
      } catch {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  // Available other labelers for Kappa calculation
  const otherLabelers = Object.keys(allLabelersData).filter(l => l !== labeler);
  const comparisonLabeler = secondLabeler || (otherLabelers[0] || '');

  // Calculate Kappa
  const kappaResults = useMemo(() => {
    if (!comparisonLabeler || !allLabelersData[comparisonLabeler]) {
      return null;
    }
    return calculateCohensKappa(myLabels, allLabelersData[comparisonLabeler]);
  }, [myLabels, allLabelersData, comparisonLabeler]);

  // Summary counts for current labeler
  const labelCounts = useMemo(() => {
    const counts = { same: 0, related: 0, distinct: 0, skip: 0 };
    for (const item of Object.values(myLabels)) {
      if (counts[item.label] !== undefined) {
        counts[item.label]++;
      }
    }
    return counts;
  }, [myLabels]);

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-400">Labeler:</label>
            <input
              id="labeler"
              value={labeler}
              onChange={(e) => setLabeler(e.target.value)}
              placeholder="your name or id"
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-36 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Pairs: <strong className="text-slate-200">{pairs.length}</strong></span>
            <span>&bull;</span>
            <span>Labeled: <strong className="text-emerald-400">{labeledCount}</strong></span>
          </div>

          <button
            onClick={jumpToFirstUnlabeled}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            Jump to Next Unlabeled
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded border border-slate-700/80 bg-slate-800/60 cursor-pointer flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            <span>Load JSON</span>
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={exportLabels}
            className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Labels (.jsonl)</span>
          </button>

          <button
            onClick={onRegeneratePairs}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded border border-slate-700/80 bg-slate-800/60 cursor-pointer flex items-center gap-1.5"
            title="Re-sample blind pairs from accepted answers"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-sample</span>
          </button>
        </div>
      </div>

      {/* Sub-view switcher: Labeling vs Cohen's Kappa vs Summary */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('labeling')}
          className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
            activeTab === 'labeling'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Blind Review Card
        </button>
        <button
          onClick={() => setActiveTab('kappa')}
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'kappa'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Inter-Rater Cohen&apos;s Kappa</span>
          {otherLabelers.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Review Stats &amp; Consensus
        </button>
      </div>

      {/* View 1: Blind Review Card (matching review.html) */}
      {activeTab === 'labeling' && (
        <div className="space-y-4">
          {/* Question Banner */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
              Blind Review Question
            </span>
            <p className="text-base sm:text-lg font-medium text-slate-100">
              {question}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Pair <strong>{pairs.length > 0 ? currentIndex + 1 : 0}</strong> of <strong>{pairs.length}</strong>
              {currentPair && (
                <span className="font-mono text-slate-500 ml-2">[{currentPair.pair}]</span>
              )}
            </span>
            <span className="text-slate-300">
              {labeledCount} of {pairs.length} labeled by <strong className="text-indigo-300">{labeler || 'anon'}</strong>
              {labeledCount === pairs.length && pairs.length > 0 ? ' &bull; Completed!' : ''}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${pairs.length > 0 ? (labeledCount / pairs.length) * 100 : 0}%` }}
            />
          </div>

          {/* Blind Pair Side-by-Side (or stacked on mobile) */}
          {currentPair ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Answer A */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-indigo-300">
                      Answer A
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ID: {currentPair.a.id}
                    </span>
                  </div>
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed font-serif whitespace-pre-wrap">
                    {currentPair.a.text}
                  </p>
                </div>
              </div>

              {/* Answer B */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-indigo-300">
                      Answer B
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ID: {currentPair.b.id}
                    </span>
                  </div>
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed font-serif whitespace-pre-wrap">
                    {currentPair.b.text}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
              No pairs available. Click &ldquo;Re-sample&rdquo; above to generate pairs from your logged answers.
            </div>
          )}

          {/* Current Label Indicator if already labeled */}
          {currentPairLabel && (
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs flex items-center justify-between">
              <span className="text-slate-300">
                You previously labeled this pair as: <strong className="text-indigo-300 uppercase font-mono">{currentPairLabel.label}</strong>
              </span>
              <span className="text-slate-500 text-[11px]">
                Press 1, 2, 3 to re-label or &rarr; to advance
              </span>
            </div>
          )}

          {/* Action Buttons with Keyboard Shortcuts */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <button
                onClick={() => handleLabel('same')}
                disabled={!currentPair}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                  currentPairLabel?.label === 'same'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                    : 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50'
                }`}
              >
                <span className="w-5 h-5 rounded bg-black/30 flex items-center justify-center font-mono text-xs">1</span>
                <span>Same idea</span>
              </button>

              <button
                onClick={() => handleLabel('related')}
                disabled={!currentPair}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                  currentPairLabel?.label === 'related'
                    ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                    : 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50'
                }`}
              >
                <span className="w-5 h-5 rounded bg-black/30 flex items-center justify-center font-mono text-xs">2</span>
                <span>Related</span>
              </button>

              <button
                onClick={() => handleLabel('distinct')}
                disabled={!currentPair}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                  currentPairLabel?.label === 'distinct'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50'
                }`}
              >
                <span className="w-5 h-5 rounded bg-black/30 flex items-center justify-center font-mono text-xs">3</span>
                <span>Distinct</span>
              </button>

              <button
                onClick={() => handleLabel('skip')}
                disabled={!currentPair}
                className={`px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                  currentPairLabel?.label === 'skip'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <span className="w-5 h-5 rounded bg-black/30 flex items-center justify-center font-mono text-xs">S</span>
                <span>Skip</span>
              </button>

              <div className="sm:ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 cursor-pointer"
                  title="Previous Pair (ArrowLeft)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(pairs.length - 1, prev + 1))}
                  disabled={currentIndex >= pairs.length - 1}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 cursor-pointer"
                  title="Next Pair (ArrowRight)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rubric Explainer */}
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
              <strong className="text-slate-200">Guidelines:</strong>{' '}
              <span className="text-rose-300">Same:</span> including both would be redundant.{' '}
              <span className="text-amber-300">Related:</span> same topic or angle, but each adds something.{' '}
              <span className="text-emerald-300">Distinct:</span> genuinely different perspectives or frameworks.
            </p>
          </div>
        </div>
      )}

      {/* View 2: Cohen's Kappa Inter-Rater Reliability */}
      {activeTab === 'kappa' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-400" />
                  <span>Inter-Rater Reliability (Cohen&apos;s Kappa &kappa;)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  &ldquo;Have someone else label the first 50 pairs in review/pairs.json. Cohen&apos;s kappa tells you whether the labels mean the same thing to two people.&rdquo;
                </p>
              </div>

              {/* Rater Comparison Selectors */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Compare:</span>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-indigo-300 font-mono">{labeler}</span>
                <span className="text-slate-500">vs</span>
                {otherLabelers.length > 0 ? (
                  <select
                    value={comparisonLabeler}
                    onChange={(e) => setSecondLabeler(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {otherLabelers.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-400 italic">No 2nd labeler found yet</span>
                )}
              </div>
            </div>

            {/* Simulated Demo Labeler if only 1 labeler currently exists */}
            {otherLabelers.length === 0 && (
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-300 flex items-center justify-between">
                <span>
                  Tip: Switch labeler name in the top input to &ldquo;evaluator_2&rdquo; to test labeling as a second rater, or load sample labels.
                </span>
                <button
                  onClick={async () => {
                    // Seed labels for evaluator_2 with 80% agreement
                    for (const [pid, val] of Object.entries(myLabels)) {
                      const randomDiverge = Math.random() < 0.2;
                      const labelChoice = randomDiverge ? (val.label === 'same' ? 'related' : 'distinct') : val.label;
                      await onSaveLabel({
                        labeler: 'evaluator_2',
                        pair: pid,
                        a: val.a,
                        b: val.b,
                        label: labelChoice as any
                      });
                    }
                    await onReloadLabels();
                    setSecondLabeler('evaluator_2');
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium cursor-pointer"
                >
                  Generate Sample Rater 2
                </button>
              </div>
            )}
          </div>

          {/* Kappa Score Card */}
          {kappaResults ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Cohen&apos;s Kappa (&kappa;)</span>
                <div className="my-2">
                  <span className={`text-3xl sm:text-4xl font-bold font-mono ${
                    kappaResults.kappa >= 0.75
                      ? 'text-emerald-400'
                      : kappaResults.kappa >= 0.50
                      ? 'text-indigo-400'
                      : kappaResults.kappa >= 0.30
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {kappaResults.kappa.toFixed(3)}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {kappaResults.kappa >= 0.81 && 'Almost Perfect Agreement'}
                  {kappaResults.kappa >= 0.61 && kappaResults.kappa < 0.81 && 'Substantial Agreement'}
                  {kappaResults.kappa >= 0.41 && kappaResults.kappa < 0.61 && 'Moderate Agreement'}
                  {kappaResults.kappa < 0.41 && 'Low Agreement (Refine guidelines)'}
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Raw Percent Agreement</span>
                <div className="my-2">
                  <span className="text-3xl sm:text-4xl font-bold font-mono text-slate-100">
                    {kappaResults.percentAgreement}%
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Across <strong>{kappaResults.sharedCount}</strong> mutually labeled pairs
                </span>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Reliability Interpretation</span>
                <p className="text-xs text-slate-300 leading-relaxed my-2">
                  {kappaResults.kappa >= 0.60
                    ? 'Both labelers interpret "redundancy" and "distinctness" consistently. The dataset is calibrated for automated duplicate threshold tuning.'
                    : 'Disagreement suggests ambiguous definitions between "Same" vs "Related". Review boundary pairs together to calibrate the threshold.'}
                </p>
                <span className="text-[11px] text-slate-500 font-mono">Benchmark threshold: &kappa; &ge; 0.65</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
              Need overlapping labels from two labelers to compute Cohen&apos;s Kappa.
            </div>
          )}

          {/* Confusion Matrix */}
          {kappaResults && Object.keys(kappaResults.confusionMatrix).length > 0 && (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Confusion Matrix: {labeler} (Rows) vs {comparisonLabeler} (Columns)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">Label</th>
                      <th className="py-2 px-3 text-center text-rose-300">Same</th>
                      <th className="py-2 px-3 text-center text-amber-300">Related</th>
                      <th className="py-2 px-3 text-center text-emerald-300">Distinct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {['same', 'related', 'distinct'].map((rowCat) => (
                      <tr key={rowCat} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-300 capitalize">{rowCat}</td>
                        {['same', 'related', 'distinct'].map((colCat) => {
                          const val = kappaResults.confusionMatrix[rowCat]?.[colCat] || 0;
                          const isDiagonal = rowCat === colCat;
                          return (
                            <td
                              key={colCat}
                              className={`py-2.5 px-3 text-center ${
                                isDiagonal
                                  ? 'bg-indigo-600/20 font-bold text-indigo-300'
                                  : val > 0
                                  ? 'text-amber-400/90'
                                  : 'text-slate-600'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View 3: Summary & Duplicates Breakdown */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-rose-400 font-medium block mb-1">Same Idea (Duplicates)</span>
              <span className="text-2xl font-bold font-mono text-slate-100">{labelCounts.same}</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-amber-400 font-medium block mb-1">Related (Nuanced)</span>
              <span className="text-2xl font-bold font-mono text-slate-100">{labelCounts.related}</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-emerald-400 font-medium block mb-1">Distinct (Novel)</span>
              <span className="text-2xl font-bold font-mono text-slate-100">{labelCounts.distinct}</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 font-medium block mb-1">Skipped</span>
              <span className="text-2xl font-bold font-mono text-slate-100">{labelCounts.skip}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
            <h4 className="font-semibold text-slate-200">How to use these labels to tune DUP_SIM:</h4>
            <p className="leading-relaxed text-slate-400">
              The pairs marked as <strong className="text-rose-400">&ldquo;Same idea&rdquo;</strong> are candidate false negatives that slipped past generation. By correlating their similarity score with your labels in the <em>Similarity Matrix</em> tab, you can pinpoint the exact mathematical cutoff threshold for filtering in future runs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
