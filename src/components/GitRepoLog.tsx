/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  Search, 
  Filter, 
  FileText,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import type { AnswerItem, GitCommitRecord } from '../utils/engine.ts';

interface GitStatusData {
  isRepo: boolean;
  userName: string;
  userEmail: string;
  remotes: string[];
  status: string;
  branch: string;
  lastCommit: string;
  hasIdentity: boolean;
  hasRemote: boolean;
}

interface GitRepoLogProps {
  answers: AnswerItem[];
  commits: GitCommitRecord[];
}

export const GitRepoLog: React.FC<GitRepoLogProps> = ({ answers, commits }) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'accepted' | 'duplicate'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedDiag, setCopiedDiag] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'answers' | 'commits' | 'health' | 'terminal'>('answers');

  // Git diagnostic status
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [newRemoteUrl, setNewRemoteUrl] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [repoName, setRepoName] = useState<string>('recursive-self-query-log');
  const [makePrivate, setMakePrivate] = useState<boolean>(true);
  const [savingRemote, setSavingRemote] = useState<boolean>(false);

  const fetchGitStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/git-status');
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch git status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchGitStatus();
  }, []);

  const handleSaveRemote = async () => {
    if (!newRemoteUrl.trim()) return;
    setSavingRemote(true);
    try {
      const res = await fetch('/api/git-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteUrl: newRemoteUrl.trim() })
      });
      if (res.ok) {
        setNewRemoteUrl('');
        await fetchGitStatus();
      }
    } catch (err) {
      console.error('Failed to save remote:', err);
    } finally {
      setSavingRemote(false);
    }
  };

  const filteredAnswers = answers.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.answer.toLowerCase().includes(q) ||
        (item.angleExplored && item.angleExplored.toLowerCase().includes(q)) ||
        (item.insightGained && item.insightGained.toLowerCase().includes(q)) ||
        item.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const gitBashScript = `# Clone / Initialize Git Repository for Answer Pair Review
mkdir -p answer-review-repo/log
cd answer-review-repo
git init
cat << 'EOF' > .gitignore
cache/
.env
EOF

# Fetch answers.jsonl
curl -s "${window.location.origin}/api/export/answers.jsonl" > log/answers.jsonl
git add log/answers.jsonl .gitignore
git commit -m "sync: ${answers.length} recursive answers from log"

echo "Repo ready with log/answers.jsonl!"`;

  const diagnosticScript = `# Diagnostic Commands (Run in repo root)
git rev-parse --show-toplevel          # Check if inside repo
git config user.name; git config user.email   # Check git identity
git remote -v                          # Check if remote exists
git status --short log/                # Check uncommitted rows
git log --oneline -3                   # Check recent commits`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(gitBashScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyDiag = () => {
    navigator.clipboard.writeText(diagnosticScript);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2000);
  };

  const handleDownloadJsonl = () => {
    window.location.href = '/api/export/answers.jsonl';
  };

  const handleDownloadScript = () => {
    window.location.href = '/api/export/git-script';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Git Status & Exports */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-100">
                  Git Repository Log &bull; answers.jsonl
                </h2>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  branch: {gitStatus?.branch || 'main'}
                </span>
                {gitStatus?.isRepo && gitStatus?.hasIdentity ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Git Active</span>
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Config Needed</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                All candidates logged directly to disk at <code className="font-mono text-indigo-300">log/answers.jsonl</code> with live git commits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadJsonl}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download answers.jsonl</span>
            </button>

            <button
              onClick={handleDownloadScript}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3.5 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download Git Script (.sh)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('answers')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'answers'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Raw Answers Log ({answers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('commits')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'commits'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>Git Commits ({commits.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('health')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'health'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Preflight &amp; Remote Health</span>
        </button>

        <button
          onClick={() => setActiveSubTab('terminal')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'terminal'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Sync &amp; Diagnostic Scripts</span>
        </button>
      </div>

      {/* SubTab 1: Raw Answers Log */}
      {activeSubTab === 'answers' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search answers, angles, insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-full sm:w-64 placeholder:text-slate-600"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto justify-end">
              <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
              {(['all', 'accepted', 'duplicate'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded capitalize font-medium cursor-pointer transition-colors ${
                    filterStatus === st
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* JSONL Table / Card Stream */}
          <div className="space-y-2">
            {filteredAnswers.length > 0 ? (
              filteredAnswers.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        {item.id}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                        item.status === 'accepted'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      }`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        [{item.angleExplored || 'Novel Angle'}]
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>run: {item.run}</span>
                      <span>{new Date(item.ts).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-serif">
                    {item.answer}
                  </p>

                  {(item.insightGained || item.nearest_id) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      {item.insightGained && (
                        <div className="truncate max-w-xl">
                          <strong className="text-amber-400 mr-1">Insight:</strong>
                          <span>{item.insightGained}</span>
                        </div>
                      )}
                      {item.nearest_id && (
                        <div className="font-mono text-slate-400">
                          Nearest: <strong className="text-slate-300">{item.nearest_id}</strong> (sim: {Math.round((item.nearest_sim || 0) * 100)}%)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 text-xs">
                No answers match your search filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SubTab 2: Git Commits History */}
      {activeSubTab === 'commits' && (
        <div className="space-y-3">
          {commits.length > 0 ? (
            commits.map((commit, idx) => (
              <div
                key={commit.hash + idx}
                className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <GitCommit className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                        {commit.hash}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        run: {commit.run}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 mt-1 font-mono font-medium">
                      {commit.message}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 sm:justify-end">
                    <Calendar className="w-3 h-3" />
                    {new Date(commit.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 text-xs">
              No Git commits found. Run a recursive generation cycle or python3 generate.py to commit.
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Git Preflight & Health Inspector */}
      {activeSubTab === 'health' && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Live Git Environment Preflight</span>
              </h3>
              <button
                onClick={fetchGitStatus}
                disabled={loadingStatus}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {/* Check 1: Repository */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1 font-medium">1. Git Work Tree</span>
                {gitStatus?.isRepo ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Initialized (.git found)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Not inside git repo</span>
                  </div>
                )}
              </div>

              {/* Check 2: Git Identity */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1 font-medium">2. Git Author Identity</span>
                {gitStatus?.hasIdentity ? (
                  <div className="text-emerald-400 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{gitStatus.userName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                      &lt;{gitStatus.userEmail}&gt;
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Missing name/email</span>
                  </div>
                )}
              </div>

              {/* Check 3: Remote Push Target */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1 font-medium">3. Git Remote (GitHub)</span>
                {gitStatus?.hasRemote ? (
                  <div className="text-emerald-400 font-semibold truncate">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Remote Configured</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5 truncate">
                      {gitStatus.remotes[0]}
                    </span>
                  </div>
                ) : (
                  <div className="text-amber-400 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>No remote (local-only)</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Add remote below to push
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Remote & GitHub Auto-Creation Form */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <h4 className="text-xs font-semibold text-slate-200">
                Connect GitHub &amp; Auto-Create Repository (Push All Answers)
              </h4>
              <p className="text-[11px] text-slate-400">
                Provide a GitHub Personal Access Token (PAT) with <code className="text-indigo-300">repo</code> scope. If the repository does not exist on your GitHub account, the app will create it automatically and push all logs and commits.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">GitHub Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">Repository Name</label>
                  <input
                    type="text"
                    placeholder="recursive-self-query-log"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makePrivate}
                    onChange={(e) => setMakePrivate(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span>Create as Private Repository</span>
                </label>

                <button
                  onClick={async () => {
                    if (!githubToken.trim() || !repoName.trim()) {
                      alert('Please provide both GitHub Token and Repository Name.');
                      return;
                    }
                    setSavingRemote(true);
                    try {
                      const res = await fetch('/api/git-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          githubToken: githubToken.trim(),
                          repoName: repoName.trim(),
                          makePrivate
                        })
                      });
                      const data = await res.json();
                      if (data.success && !data.results.githubError) {
                        alert('GitHub repository successfully connected, created if needed, and pushed!');
                        setGithubToken('');
                        await fetchGitStatus();
                      } else {
                        alert('Error: ' + (data.results.githubError || 'Failed to configure GitHub repository'));
                      }
                    } catch (err: any) {
                      alert('Error: ' + err?.message);
                    } finally {
                      setSavingRemote(false);
                    }
                  }}
                  disabled={savingRemote || !githubToken.trim() || !repoName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  {savingRemote ? 'Creating & Pushing...' : 'Create & Push to GitHub'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 4: Terminal Sync Command & Diagnostic script */}
      {activeSubTab === 'terminal' && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>Diagnostic Commands (Run to check your repo status)</span>
              </span>
              <button
                onClick={handleCopyDiag}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedDiag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDiag ? 'Copied!' : 'Copy Diagnostics'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-300 overflow-x-auto leading-relaxed">
              {diagnosticScript}
            </pre>
          </div>

          <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Clone &amp; Mirror Script (Sync to a clean local repo)</span>
              </span>
              <button
                onClick={handleCopyScript}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {gitBashScript}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
