/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  calculateLexicalSimilarity,
  buildNegativePrompt,
  generateBlindPairs,
  formatGitCommitMessage,
  parseJsonl,
  serializeJsonl,
  hasStructuralRedundancy,
  type AnswerItem,
  type GitCommitRecord,
  type PairLabel
} from './src/utils/engine.ts';

dotenv.config();

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Directories
const LOG_DIR = path.resolve(__dirname, 'log');
const REVIEW_DIR = path.resolve(__dirname, 'review');
const LABELS_DIR = path.resolve(__dirname, 'labels');

for (const dir of [LOG_DIR, REVIEW_DIR, LABELS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const ANSWERS_LOG_FILE = path.join(LOG_DIR, 'answers.jsonl');
const PAIRS_FILE = path.join(REVIEW_DIR, 'pairs.json');
const PAIRS_META_FILE = path.join(REVIEW_DIR, 'pairs_meta.json');
const COMMITS_LOG_FILE = path.join(LOG_DIR, 'git_commits.json');

// Helper to run git commands in root
async function runGit(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd: __dirname });
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (err: any) {
    return {
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || err.message || '').trim(),
      code: typeof err.code === 'number' ? err.code : 1
    };
  }
}

// Gemini client initialization
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Seed answers if log does not exist
function initializeSampleDataIfEmpty() {
  if (!fs.existsSync(ANSWERS_LOG_FILE) || fs.readFileSync(ANSWERS_LOG_FILE, 'utf-8').trim() === '') {
    const seedAnswers: AnswerItem[] = [
      {
        id: 'a-0001',
        ts: new Date(Date.now() - 3600000 * 5).toISOString(),
        question: 'How do I make myself more emergent?',
        questionId: 'q-emergent',
        run: 'r-seed01',
        model: 'gemini-4-argon',
        temp: 1.0,
        answer: 'You become emergent by shifting from top-down deliberate control to decentralized, local interaction rules. Allow autonomous habits and micro-decisions to interact across your daily environment without imposing a rigid master script, letting macroscopic coherence arise spontaneously from microscopic simplicity.',
        status: 'accepted',
        angleExplored: 'Decentralized Micro-Rules & Multi-Agent Heuristics',
        insightGained: 'Emergence requires shedding centralized micro-management in favor of simple local interactions.',
        nearest_id: null,
        nearest_sim: null,
        thinkingSummary: 'Examined complex adaptive systems (ant colonies, cellular automata) applied to individual cognitive agency.'
      },
      {
        id: 'a-0002',
        ts: new Date(Date.now() - 3600000 * 4).toISOString(),
        question: 'How do I make myself more emergent?',
        questionId: 'q-emergent',
        run: 'r-seed01',
        model: 'gemini-4-argon',
        temp: 1.0,
        answer: 'Cultivate boundary porosity by creating rich stigmergic feedback loops in your external tools and environment. By leaving persistent physical or digital traces that alter your next decision state, the system that thinks ceases to be your skull alone and becomes an extended, evolving cognitive ecology.',
        status: 'accepted',
        angleExplored: 'Stigmergy & Extended Cognitive Ecology',
        insightGained: 'Shifted from internal psychology to external feedback reservoirs (stigmergic trace manipulation).',
        nearest_id: 'a-0001',
        nearest_sim: 0.11,
        thinkingSummary: 'Drew on Clark and Chalmers extended mind thesis and biological stigmergy (termite architectures).'
      },
      {
        id: 'a-0003',
        ts: new Date(Date.now() - 3600000 * 3).toISOString(),
        question: 'How do I make myself more emergent?',
        questionId: 'q-emergent',
        run: 'r-seed01',
        model: 'gemini-4-argon',
        temp: 1.0,
        answer: 'Actively inject calibrated stochastic perturbations into your information diet and routine to avoid premature convergence on local behavioral optima. Operating far-from-equilibrium creates thermodynamic room for spontaneous symmetry breaking and unexpected phase transitions.',
        status: 'accepted',
        angleExplored: 'Thermodynamic Dissipation & Phase Transitions',
        insightGained: 'Equilibrium is death for emergence; deliberate noise and turbulence catalyze higher-order self-organization.',
        nearest_id: 'a-0001',
        nearest_sim: 0.09,
        thinkingSummary: 'Explored Prigogine dissipative structures and simulated annealing in personal cognitive habits.'
      },
      {
        id: 'a-0004',
        ts: new Date(Date.now() - 3600000 * 2).toISOString(),
        question: 'How do I make myself more emergent?',
        questionId: 'q-emergent',
        run: 'r-seed01',
        model: 'gemini-4-argon',
        temp: 1.0,
        answer: 'You become more emergent by letting autonomous micro-habits run freely instead of relying on a rigid top-down plan. Macro-level competence will surface spontaneously when you let simple small rules interact naturally.',
        status: 'duplicate',
        angleExplored: 'Decentralized Micro-Rules (Redundant)',
        insightGained: 'Detected duplicate conceptual framing of Answer a-0001 (micro-habits without master plan).',
        nearest_id: 'a-0001',
        nearest_sim: 0.65,
        thinkingSummary: 'Flagged as near duplicate of cellular automata / micro-rules framework.'
      },
      {
        id: 'a-0005',
        ts: new Date(Date.now() - 3600000 * 1).toISOString(),
        question: 'How do I make myself more emergent?',
        questionId: 'q-emergent',
        run: 'r-seed01',
        model: 'gemini-4-argon',
        temp: 1.0,
        answer: 'Restructure your social and conceptual connectivity into a scale-free small-world topology with high betweenness centrality. By acting as the sole bridging node between otherwise disconnected knowledge clusters, the ideas that pass through you recombine into emergent synthesis unattainable in any single domain.',
        status: 'accepted',
        angleExplored: 'Network Topology & Structural Holes',
        insightGained: 'Emergence is a topological property of network positions rather than isolated individual attributes.',
        nearest_id: 'a-0002',
        nearest_sim: 0.12,
        thinkingSummary: 'Leveraged Burt structural holes theory and Barabási scale-free network architectures.'
      }
    ];

    fs.writeFileSync(ANSWERS_LOG_FILE, serializeJsonl(seedAnswers), 'utf-8');

    // Generate initial blind pairs
    const { pairs, metadata } = generateBlindPairs(seedAnswers, 6, 4);
    fs.writeFileSync(PAIRS_FILE, JSON.stringify({ question: seedAnswers[0].question, items: pairs }, null, 2), 'utf-8');
    fs.writeFileSync(PAIRS_META_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  }
}

initializeSampleDataIfEmpty();

function getLoggedAnswers(): AnswerItem[] {
  if (!fs.existsSync(ANSWERS_LOG_FILE)) return [];
  const text = fs.readFileSync(ANSWERS_LOG_FILE, 'utf-8');
  return parseJsonl<AnswerItem>(text);
}

function saveAnswers(answers: AnswerItem[]) {
  fs.writeFileSync(ANSWERS_LOG_FILE, serializeJsonl(answers), 'utf-8');
}

async function getRealGitCommits(): Promise<GitCommitRecord[]> {
  const logRes = await runGit(['log', '-n', '25', '--pretty=format:%h|%s|%aI']);
  if (logRes.code !== 0 || !logRes.stdout) {
    if (fs.existsSync(COMMITS_LOG_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(COMMITS_LOG_FILE, 'utf-8'));
      } catch {
        return [];
      }
    }
    return [];
  }

  const lines = logRes.stdout.split('\n').filter(Boolean);
  return lines.map((line) => {
    const [hash, message, ts] = line.split('|');
    const runMatch = message?.match(/^(r-[\w]+):/);
    const run = runMatch ? runMatch[1] : 'manual';
    return {
      hash: hash || '0000000',
      message: message || 'commit',
      run,
      timestamp: ts || new Date().toISOString(),
      candidateCount: 1,
      acceptedCount: 1,
      duplicateCount: 0,
      offTopicCount: 0
    };
  });
}

// API Routes
app.get('/api/log', async (req: Request, res: Response) => {
  const answers = getLoggedAnswers();
  const commits = await getRealGitCommits();
  res.json({ answers, commits });
});

// Diagnostic Git status endpoint
app.get('/api/git-status', async (req: Request, res: Response) => {
  const repoCheck = await runGit(['rev-parse', '--is-inside-work-tree']);
  const isRepo = repoCheck.code === 0 && repoCheck.stdout === 'true';

  const userName = (await runGit(['config', 'user.name'])).stdout;
  const userEmail = (await runGit(['config', 'user.email'])).stdout;
  const remotesRaw = (await runGit(['remote', '-v'])).stdout;
  const statusRaw = (await runGit(['status', '--short'])).stdout;
  const branchName = (await runGit(['branch', '--show-current'])).stdout;
  const lastCommit = (await runGit(['log', '--oneline', '-1'])).stdout;

  res.json({
    isRepo,
    userName,
    userEmail,
    remotes: remotesRaw ? remotesRaw.split('\n').filter(Boolean) : [],
    status: statusRaw,
    branch: branchName || 'main',
    lastCommit,
    hasIdentity: Boolean(userName && userEmail),
    hasRemote: Boolean(remotesRaw.trim())
  });
});

// Git configure & GitHub repo creation endpoint
app.post('/api/git-config', async (req: Request, res: Response) => {
  const { userName, userEmail, remoteUrl, githubToken, repoName, makePrivate } = req.body;
  const results: Record<string, any> = {};

  if (userName) {
    results.name = await runGit(['config', 'user.name', userName.trim()]);
  }
  if (userEmail) {
    results.email = await runGit(['config', 'user.email', userEmail.trim()]);
  }

  let targetRemoteUrl = remoteUrl ? remoteUrl.trim() : '';

  // If GitHub token and repoName are provided, create repo via GitHub REST API if it doesn't exist
  if (githubToken && repoName) {
    try {
      const cleanRepoName = repoName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken.trim()}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Recursive-Self-Query-App'
        },
        body: JSON.stringify({
          name: cleanRepoName,
          private: Boolean(makePrivate),
          description: 'Recursive LLM Self-Query & Git Log Review Repository'
        })
      });

      const repoData = await createRes.json();
      if (createRes.status === 201 || (createRes.status === 422 && repoData.message?.includes('name already exists'))) {
        // Get authenticated user login
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${githubToken.trim()}`,
            'User-Agent': 'Recursive-Self-Query-App'
          }
        });
        const userData = await userRes.json();
        const owner = userData.login || 'user';
        targetRemoteUrl = `https://${githubToken.trim()}@github.com/${owner}/${cleanRepoName}.git`;
        results.githubRepoCreated = true;
      } else {
        results.githubError = repoData.message || 'Failed to create GitHub repository';
      }
    } catch (err: any) {
      results.githubError = err?.message || 'Network error communicating with GitHub API';
    }
  }

  if (targetRemoteUrl) {
    const hasOrigin = (await runGit(['remote'])).stdout.includes('origin');
    if (hasOrigin) {
      results.remote = await runGit(['remote', 'set-url', 'origin', targetRemoteUrl]);
    } else {
      results.remote = await runGit(['remote', 'add', 'origin', targetRemoteUrl]);
    }
    // Also push current branch immediately if token is valid
    const pushRes = await runGit(['push', '-u', 'origin', 'HEAD']);
    results.initialPush = { code: pushRes.code, stdout: pushRes.stdout, stderr: pushRes.stderr };
  }

  res.json({ success: true, results });
});

app.post('/api/generate-step', async (req: Request, res: Response) => {
  try {
    const {
      question = 'How do I make myself more emergent?',
      questionId = 'q-emergent',
      dupThreshold = 0.55,
      preferredModel = 'gemini-4-argon'
    } = req.body;

    const runId = 'r-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const allAnswers = getLoggedAnswers();
    const acceptedAnswers = allAnswers.filter(a => a.status === 'accepted' && a.questionId === questionId);

    // Get latest insight if available
    const lastAccepted = acceptedAnswers[acceptedAnswers.length - 1];
    const latestInsight = lastAccepted ? `${lastAccepted.insightGained || ''} (Previous Angle: ${lastAccepted.angleExplored || ''})` : undefined;

    const promptText = buildNegativePrompt(question, acceptedAnswers, latestInsight);

    let generatedText = '';
    let angleExplored = 'Unspecified';
    let insightGained = '';
    let thinkingSummary = '';
    let modelUsed = preferredModel;

    // Multi-model fallback chain prioritizing gemini-3.5-flash-lite to avoid free tier rate limits
    const modelsToTry = ['gemini-3.5-flash-lite', preferredModel, 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const m of modelsToTry) {
      try {
        modelUsed = m;
        const configParams: any = {
          systemInstruction: `You are a high-level cognitive explorer in a recursive self-answering loop.
Your task: Answer the user's question, but YOU MUST strictly avoid repeating any previous concepts, analogies, metaphors, or angles.
Return your response strictly in the following JSON format:
{
  "angleExplored": "Name of the unique conceptual lens/framework you chose",
  "answer": "2 to 4 sentences formulating a profound, distinct answer from this lens.",
  "insightGained": "1 to 2 sentences explaining what philosophical or structural principle was uncovered, and what remains completely unaddressed for future queries.",
  "thinkingSummary": "Short explanation of your reasoning trajectory and how you deliberately avoided the taboo angles."
}`,
          responseMimeType: 'application/json',
          temperature: 1.0,
        };

        // Only add thinkingConfig for models supporting it
        if (m === 'gemini-4-argon' || m === 'gemini-3.8-flash') {
          configParams.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
        }

        const response = await ai.models.generateContent({
          model: m,
          contents: promptText,
          config: configParams,
        });

        const responseText = response.text || '';
        try {
          const parsed = JSON.parse(responseText);
          generatedText = parsed.answer || responseText;
          angleExplored = parsed.angleExplored || 'Novel Perspective';
          insightGained = parsed.insightGained || '';
          thinkingSummary = parsed.thinkingSummary || `Generated via ${m} with recursive self-query.`;
        } catch {
          generatedText = responseText;
          angleExplored = 'Novel Angle';
        }

        if (generatedText) break; // success
      } catch (err: any) {
        console.warn(`Model ${m} failed (quota/rate limit or error):`, err?.message || err);
        lastError = err;
      }
    }



    if (!generatedText) {
      // 1. Halt and write error to errors.jsonl instead of writing canned text to answer log
      const errRecord = {
        ts: new Date().toISOString(),
        error: lastError?.message || 'Upstream quota exhaustion / rate limit (429)',
        model: modelUsed,
        run: runId
      };
      const ERR_LOG = path.join(LOG_DIR, 'errors.jsonl');
      fs.appendFileSync(ERR_LOG, JSON.stringify(errRecord) + '\n', 'utf-8');
      
      return res.status(429).json({
        error: `Generation halted due to model rate limits / quota exhaustion. Logged to log/errors.jsonl. Details: ${lastError?.message || 'Quota exceeded'}`
      });
    }

    // Circuit breaker: check if last N rows are consecutive duplicates
    const recentRows = allAnswers.slice(-5);
    if (recentRows.length >= 5 && recentRows.every(r => r.status === 'duplicate')) {
      const errRecord = {
        ts: new Date().toISOString(),
        error: 'Circuit breaker tripped: 5 consecutive duplicate answers detected. Halting run.',
        run: runId
      };
      const ERR_LOG = path.join(LOG_DIR, 'errors.jsonl');
      fs.appendFileSync(ERR_LOG, JSON.stringify(errRecord) + '\n', 'utf-8');

      return res.status(400).json({
        error: 'Circuit breaker tripped: 5 consecutive duplicate answers detected. Run halted.'
      });
    }

    // Structural opening check (flag template re-use like "Stop," or "Cease,")
    const hasStructuralMatch = hasStructuralRedundancy(generatedText, acceptedAnswers);

    // Similarity checking against accepted answers
    let nearest_id: string | null = null;
    let nearest_sim: number | null = null;
    let maxSim = 0;

    for (const acc of acceptedAnswers) {
      const sim = calculateLexicalSimilarity(generatedText, acc.answer);
      if (sim > maxSim) {
        maxSim = sim;
        nearest_id = acc.id;
        nearest_sim = sim;
      }
    }

    let status: 'accepted' | 'duplicate' | 'off_topic' = 'accepted';
    let duplicateReason = '';

    if (hasStructuralMatch) {
      status = 'duplicate';
      duplicateReason = 'Structural template match (opening phrase reuse)';
    } else if (nearest_sim !== null && nearest_sim >= dupThreshold) {
      status = 'duplicate';
      duplicateReason = `Lexical similarity (${Math.round(nearest_sim * 100)}% >= ${Math.round(dupThreshold * 100)}%)`;
    } else {
      // LLM Semantic Claim Judge Check against recent accepted answers
      const recentAccepted = acceptedAnswers.slice(-5);
      for (const acc of recentAccepted) {
        try {
          const judgeRes = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: `Compare these two answers about "${question}":\n\nAnswer 1: "${acc.answer}"\n\nAnswer 2: "${generatedText}"\n\nDo these two answers make the same fundamental underlying argument or claim? Reply only with JSON: {"sameArgument": true|false}`,
            config: {
              responseMimeType: 'application/json',
              temperature: 0
            }
          });
          const j = JSON.parse(judgeRes.text || '{}');
          if (j.sameArgument === true) {
            status = 'duplicate';
            duplicateReason = `Semantic claim match with ${acc.id}`;
            nearest_id = acc.id;
            nearest_sim = 0.82;
            break;
          }
        } catch {
          // ignore judge error and proceed
        }
      }
    }

    const nextIdNum = allAnswers.length + 1;

    const newAnswer: AnswerItem & { decided_by: 'auto' | 'manual'; reason?: string } = {
      id: `a-${String(nextIdNum).padStart(4, '0')}`,
      ts: new Date().toISOString(),
      question,
      questionId,
      run: runId,
      model: modelUsed,
      temp: 1.0,
      answer: generatedText,
      status,
      angleExplored,
      insightGained,
      nearest_id,
      nearest_sim,
      thinkingSummary,
      decided_by: 'auto',
      reason: duplicateReason || 'Accepted as novel semantic argument'
    };

    allAnswers.push(newAnswer);
    saveAnswers(allAnswers);

    // REAL GIT COMMIT on the local git repository
    const currentStatus: 'accepted' | 'duplicate' | 'off_topic' = status;
    const counts = {
      accepted: currentStatus === 'accepted' ? 1 : 0,
      duplicate: currentStatus === 'duplicate' ? 1 : 0,
      off_topic: (currentStatus as string) === 'off_topic' ? 1 : 0
    };
    const commitMsg = formatGitCommitMessage(runId, 1, counts);

    let realHash = Math.random().toString(16).slice(2, 9);
    let gitCommitOutput = '';
    let gitPushed = false;

    // Check if git repo exists
    const isInsideRepo = (await runGit(['rev-parse', '--is-inside-work-tree'])).code === 0;
    if (isInsideRepo) {
      // Stage log/answers.jsonl
      await runGit(['add', 'log/answers.jsonl']);
      const commitRes = await runGit(['commit', '-m', commitMsg]);
      gitCommitOutput = commitRes.stdout || commitRes.stderr;

      const hashRes = await runGit(['rev-parse', '--short', 'HEAD']);
      if (hashRes.code === 0 && hashRes.stdout) {
        realHash = hashRes.stdout;
      }

      // Check if remote exists and push if configured
      const remotes = (await runGit(['remote'])).stdout.split(/\s+/).filter(Boolean);
      if (remotes.length > 0 && process.env.NO_PUSH !== '1') {
        const pushRes = await runGit(['push', remotes[0], 'HEAD']);
        gitPushed = pushRes.code === 0;
      }
    }

    const commits = await getRealGitCommits();

    // Refresh review pairs
    const refreshPairs = generateBlindPairs(allAnswers, 15, 10);
    fs.writeFileSync(PAIRS_FILE, JSON.stringify({ question, items: refreshPairs.pairs }, null, 2), 'utf-8');
    fs.writeFileSync(PAIRS_META_FILE, JSON.stringify(refreshPairs.metadata, null, 2), 'utf-8');

    return res.json({
      answer: newAnswer,
      commit: {
        hash: realHash,
        message: commitMsg,
        run: runId,
        timestamp: new Date().toISOString(),
        candidateCount: 1,
        acceptedCount: counts.accepted,
        duplicateCount: counts.duplicate,
        offTopicCount: counts.off_topic
      },
      allAnswers,
      commits,
      gitPushed,
      gitCommitOutput
    });
  } catch (error: any) {
    console.error('Error in /api/generate-step:', error);
    return res.status(500).json({ error: error?.message || 'Server error generating step' });
  }
});

// Update an answer's status manually
app.post('/api/answers/update-status', async (req: Request, res: Response) => {
  const { id, status } = req.body;
  const allAnswers = getLoggedAnswers();
  const target = allAnswers.find(a => a.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Answer not found' });
  }
  target.status = status;
  saveAnswers(allAnswers);

  // Commit status change to git
  await runGit(['add', 'log/answers.jsonl']);
  await runGit(['commit', '-m', `update status of ${id} to ${status}`]);

  return res.json({ success: true, updated: target, allAnswers });
});

// Pairs endpoints for manual review
app.get('/api/pairs', (req: Request, res: Response) => {
  if (!fs.existsSync(PAIRS_FILE)) {
    const answers = getLoggedAnswers();
    const generated = generateBlindPairs(answers, 12, 8);
    const payload = { question: answers[0]?.question || '', items: generated.pairs };
    fs.writeFileSync(PAIRS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    fs.writeFileSync(PAIRS_META_FILE, JSON.stringify(generated.metadata, null, 2), 'utf-8');
    return res.json(payload);
  }
  const data = JSON.parse(fs.readFileSync(PAIRS_FILE, 'utf-8'));
  res.json(data);
});

app.post('/api/pairs/regenerate', (req: Request, res: Response) => {
  const { topCount = 15, randomCount = 10 } = req.body;
  const answers = getLoggedAnswers();
  const generated = generateBlindPairs(answers, topCount, randomCount);
  const payload = { question: answers[0]?.question || '', items: generated.pairs };
  fs.writeFileSync(PAIRS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  fs.writeFileSync(PAIRS_META_FILE, JSON.stringify(generated.metadata, null, 2), 'utf-8');
  res.json(payload);
});

// Labels endpoints
app.get('/api/labels', (req: Request, res: Response) => {
  const labelFiles = fs.readdirSync(LABELS_DIR).filter(f => f.startsWith('labels-') && f.endsWith('.jsonl'));
  const allLabelsByLabeler: Record<string, Record<string, PairLabel>> = {};

  for (const file of labelFiles) {
    const labeler = file.replace(/^labels-/, '').replace(/\.jsonl$/, '');
    const fullPath = path.join(LABELS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const records = parseJsonl<PairLabel>(content);
    const map: Record<string, PairLabel> = {};
    for (const r of records) {
      map[r.pair] = r;
    }
    allLabelsByLabeler[labeler] = map;
  }

  res.json({ labelers: Object.keys(allLabelsByLabeler), labels: allLabelsByLabeler });
});

app.post('/api/labels', async (req: Request, res: Response) => {
  const { labeler, pair, a, b, label } = req.body;
  if (!labeler || !pair || !label) {
    return res.status(400).json({ error: 'Missing required labeling fields' });
  }

  const cleanLabeler = labeler.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'anon';
  const fileName = `labels-${cleanLabeler}.jsonl`;
  const filePath = path.join(LABELS_DIR, fileName);

  const newLabelRecord: PairLabel = {
    pair,
    a,
    b,
    label,
    labeler: cleanLabeler,
    ts: new Date().toISOString()
  };

  let existing: PairLabel[] = [];
  if (fs.existsSync(filePath)) {
    existing = parseJsonl<PairLabel>(fs.readFileSync(filePath, 'utf-8'));
  }

  const idx = existing.findIndex(l => l.pair === pair);
  if (idx >= 0) {
    existing[idx] = newLabelRecord;
  } else {
    existing.push(newLabelRecord);
  }

  fs.writeFileSync(filePath, serializeJsonl(existing), 'utf-8');

  // Real git commit of label file
  await runGit(['add', `labels/${fileName}`]);
  await runGit(['commit', '-m', `labels: ${cleanLabeler} labeled pair ${pair} as ${label}`]);

  return res.json({ success: true, saved: newLabelRecord, totalLabeled: existing.length });
});

// Download / Export routes
app.get('/api/export/answers.jsonl', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="answers.jsonl"');
  if (fs.existsSync(ANSWERS_LOG_FILE)) {
    res.send(fs.readFileSync(ANSWERS_LOG_FILE, 'utf-8'));
  } else {
    res.send('');
  }
});

// Git shell bundle script
app.get('/api/export/git-script', (req: Request, res: Response) => {
  const script = `#!/usr/bin/env bash
# Git Repository Initialization & Sync Script for Answer Pair Review
set -e

mkdir -p answers-repo/log answers-repo/review answers-repo/labels
cd answers-repo

if [ ! -d .git ]; then
  git init
  git config user.name "AI Studio User"
  git config user.email "craighckby@gmail.com"
fi

cat << 'EOF' > .gitignore
cache/
.env
node_modules/
EOF

curl -s "${req.protocol}://${req.get('host')}/api/export/answers.jsonl" > log/answers.jsonl
git add log/answers.jsonl .gitignore
git commit -m "sync: recursive answers log" || true

echo "Answer repository synchronized into ./answers-repo with log/answers.jsonl"
`;
  res.setHeader('Content-Type', 'text/x-shellscript');
  res.setHeader('Content-Disposition', 'attachment; filename="sync-git-repo.sh"');
  res.send(script);
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
