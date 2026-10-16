/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  GitBranch, 
  Sparkles, 
  CheckSquare, 
  Layers, 
  HelpCircle, 
  SlidersHorizontal,
  BrainCircuit
} from 'lucide-react';

export type TabKey = 'generator' | 'review' | 'gitlog' | 'matrix' | 'guide';

interface NavbarProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  totalAnswers: number;
  acceptedCount: number;
  duplicateCount: number;
  commitCount: number;
  model: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalAnswers,
  acceptedCount,
  duplicateCount,
  commitCount,
  model,
}) => {
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'generator', label: 'Recursive Generator', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'review', label: 'Pair Review & Kappa', icon: <CheckSquare className="w-4 h-4" /> },
    { key: 'gitlog', label: 'Git Repo Log', icon: <GitBranch className="w-4 h-4" /> },
    { key: 'matrix', label: 'Similarity Matrix', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { key: 'guide', label: 'How It Works', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BrainCircuit className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-semibold text-slate-100 text-base leading-tight">
                  Recursive LLM Self-Query &amp; Git Review
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  High Thinking
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Self-answering loop without repeats &bull; Logged to Git repo for blind duplicate review
              </p>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <div className="px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700/60 text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Answers: <strong className="text-slate-100">{totalAnswers}</strong></span>
              <span className="text-slate-500">({acceptedCount} accepted, {duplicateCount} dups)</span>
            </div>
            <div className="px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700/60 text-slate-300 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              <span>Commits: <strong className="text-indigo-200">{commitCount}</strong></span>
            </div>
            <div className="px-2.5 py-1 bg-indigo-950/40 rounded border border-indigo-800/50 text-indigo-300 font-mono text-[11px]">
              {model}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 mt-3 pt-2 border-t border-slate-800/70 overflow-x-auto scrollbar-none" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
