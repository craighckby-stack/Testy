/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, type TabKey } from './components/Navbar.tsx';
import { SelfQueryLoop } from './components/SelfQueryLoop.tsx';
import { PairReview } from './components/PairReview.tsx';
import { GitRepoLog } from './components/GitRepoLog.tsx';
import { SimilarityMatrix } from './components/SimilarityMatrix.tsx';
import { DialecticGuide } from './components/DialecticGuide.tsx';
import type { AnswerItem, GitCommitRecord, ReviewPair, PairLabel } from './utils/engine.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('generator');
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  const [commits, setCommits] = useState<GitCommitRecord[]>([]);
  const [pairs, setPairs] = useState<ReviewPair[]>([]);
  const [allLabelersData, setAllLabelersData] = useState<Record<string, Record<string, PairLabel>>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [model, setModel] = useState<string>('gemini-4-argon');
  const [dupThreshold, setDupThreshold] = useState<number>(0.55);
  const [question, setQuestion] = useState<string>('How do I make myself more emergent?');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch log (answers + commits)
  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch('/api/log');
      if (res.ok) {
        const data = await res.json();
        setAnswers(data.answers || []);
        setCommits(data.commits || []);
        if (data.answers && data.answers.length > 0 && data.answers[0].question) {
          setQuestion(data.answers[0].question);
        }
      }
    } catch (err) {
      console.error('Failed to fetch log:', err);
    }
  }, []);

  // Fetch pairs
  const fetchPairs = useCallback(async () => {
    try {
      const res = await fetch('/api/pairs');
      if (res.ok) {
        const data = await res.json();
        setPairs(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch pairs:', err);
    }
  }, []);

  // Fetch labels
  const fetchLabels = useCallback(async () => {
    try {
      const res = await fetch('/api/labels');
      if (res.ok) {
        const data = await res.json();
        setAllLabelersData(data.labels || {});
      }
    } catch (err) {
      console.error('Failed to fetch labels:', err);
    }
  }, []);

  useEffect(() => {
    fetchLog();
    fetchPairs();
    fetchLabels();
  }, [fetchLog, fetchPairs, fetchLabels]);

  // Generate recursive step
  const handleGenerateStep = async (
    targetQuestion: string,
    targetModel: string,
    targetDupThreshold: number
  ) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/generate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: targetQuestion,
          questionId: 'q-001',
          preferredModel: targetModel,
          dupThreshold: targetDupThreshold
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setAnswers(data.allAnswers || []);
      setCommits(data.commits || []);
      // also refresh pairs
      fetchPairs();
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || 'Error executing recursive generation step');
    } finally {
      setIsGenerating(false);
    }
  };

  // Update answer status
  const handleUpdateStatus = async (id: string, newStatus: 'accepted' | 'duplicate') => {
    try {
      const res = await fetch('/api/answers/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnswers(data.allAnswers || []);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Regenerate blind pairs
  const handleRegeneratePairs = async () => {
    try {
      const res = await fetch('/api/pairs/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topCount: 15, randomCount: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        setPairs(data.items || []);
      }
    } catch (err) {
      console.error('Failed to regenerate pairs:', err);
    }
  };

  // Save pair label
  const handleSaveLabel = async (labelData: {
    labeler: string;
    pair: string;
    a: string;
    b: string;
    label: 'same' | 'related' | 'distinct' | 'skip';
  }) => {
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData),
      });
      if (res.ok) {
        // Update local labelers state
        setAllLabelersData(prev => {
          const userLabels = { ...(prev[labelData.labeler] || {}) };
          userLabels[labelData.pair] = {
            ...labelData,
            ts: new Date().toISOString()
          };
          return {
            ...prev,
            [labelData.labeler]: userLabels
          };
        });
      }
    } catch (err) {
      console.error('Failed to save label:', err);
    }
  };

  const acceptedCount = answers.filter(a => a.status === 'accepted').length;
  const duplicateCount = answers.filter(a => a.status === 'duplicate').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalAnswers={answers.length}
        acceptedCount={acceptedCount}
        duplicateCount={duplicateCount}
        commitCount={commits.length}
        model={model}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {errorMessage && (
          <div className="mb-4 p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-200 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-100 underline ml-3 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'generator' && (
          <SelfQueryLoop
            answers={answers}
            commits={commits}
            onGenerateStep={handleGenerateStep}
            onUpdateStatus={handleUpdateStatus}
            isGenerating={isGenerating}
            model={model}
            setModel={setModel}
            dupThreshold={dupThreshold}
            setDupThreshold={setDupThreshold}
            question={question}
            setQuestion={setQuestion}
          />
        )}

        {activeTab === 'review' && (
          <PairReview
            question={question}
            pairs={pairs}
            onRegeneratePairs={handleRegeneratePairs}
            onSaveLabel={handleSaveLabel}
            allLabelersData={allLabelersData}
            onReloadLabels={fetchLabels}
          />
        )}

        {activeTab === 'gitlog' && (
          <GitRepoLog
            answers={answers}
            commits={commits}
          />
        )}

        {activeTab === 'matrix' && (
          <SimilarityMatrix
            answers={answers}
            labels={allLabelersData[localStorage.getItem('review_labeler') || 'evaluator_1'] || {}}
            dupThreshold={dupThreshold}
            setDupThreshold={setDupThreshold}
          />
        )}

        {activeTab === 'guide' && (
          <DialecticGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          Recursive LLM Self-Query &bull; Persistent JSONL logging &bull; Gemini 4 Argon High Thinking &bull; Cohen&apos;s Kappa Reliability
        </p>
      </footer>
    </div>
  );
}
