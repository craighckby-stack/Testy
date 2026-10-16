/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AnswerItem {
  id: string;
  ts: string;
  question: string;
  questionId: string;
  run: string;
  model: string;
  temp: number;
  answer: string;
  status: 'accepted' | 'duplicate' | 'off_topic';
  insightGained?: string;
  angleExplored?: string;
  nearest_id?: string | null;
  nearest_sim?: number | null;
  thinkingSummary?: string;
}

export interface ReviewPair {
  pair: string;
  a: { id: string; text: string; angle?: string };
  b: { id: string; text: string; angle?: string };
  stratum?: 'top' | 'random';
  sim?: number; // kept hidden during blind review
}

export interface PairLabel {
  pair: string;
  a: string;
  b: string;
  label: 'same' | 'related' | 'distinct' | 'skip';
  labeler: string;
  ts: string;
}

export interface GitCommitRecord {
  hash: string;
  message: string;
  run: string;
  timestamp: string;
  candidateCount: number;
  acceptedCount: number;
  duplicateCount: number;
  offTopicCount: number;
}

/**
 * Tokenizes text into lowercase word tokens (removes punctuation)
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * Computes Jaccard / N-gram token overlap similarity between two texts [0, 1]
 */
export function calculateLexicalSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return Math.round((intersection / union) * 10000) / 10000;
}

/**
 * Simple deterministic SHA1-like 8-char hex string hash
 */
export function simpleHash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const num = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return Math.abs(num).toString(16).padStart(8, '0').slice(0, 8);
}

/**
 * Extracts the core structural opening phrase (first 3 words) to catch template families like "Stop," or "Cease,"
 */
export function getStructuralOpening(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 3).join(' ');
}

/**
 * Checks if an answer's structural opening matches any opening used in the last N accepted answers
 */
export function hasStructuralRedundancy(newAnswer: string, acceptedAnswers: AnswerItem[], lookback = 20): boolean {
  const targetOpening = getStructuralOpening(newAnswer);
  if (!targetOpening) return false;
  
  const recent = acceptedAnswers.slice(-lookback);
  for (const acc of recent) {
    if (getStructuralOpening(acc.answer) === targetOpening) {
      return true;
    }
  }
  return false;
}

/**
 * Constructs prompt with negative taboo constraints for recursive self-answering
 */
export function buildNegativePrompt(
  question: string,
  acceptedAnswers: AnswerItem[],
  latestInsight?: string
): string {
  const avoidList = acceptedAnswers
    .slice(-30)
    .map((item, idx) => `[Answer ${idx + 1}]: "${item.answer.replace(/\n+/g, ' ')}" (Core Claim: ${item.insightGained || item.angleExplored || 'Generic'})`)
    .join('\n');

  const insightSection = latestInsight
    ? `\nMETALOGICAL INSIGHT FROM PREVIOUS ANSWERS:\n"${latestInsight}"\n`
    : '';

  return `${question}

CRITICAL CONSTRAINTS:
1. Answer in 2 to 4 concise, impactful sentences.
2. STRICT BAN: DO NOT start your answer with "Stop", "Cease", "True emergence", or any variation of command phrasing used previously. Vary your grammatical and structural openings entirely.
3. DO NOT repeat, paraphrase, or rely on the philosophical premises, vacuum bubble metaphors, or acoustic release tropes of earlier answers.
${avoidList ? `\nPREVIOUSLY EXPLORED ANSWERS (TABOO LIST - DO NOT REUSE):\n${avoidList}\n` : ''}${insightSection}
4. APPROACH: You must find a completely unrepresented conceptual framework or angle (e.g. thermodynamics, relational ethics, quantum causality, experiential phenomenology, informational symmetry, evolutionary biology, or stoic aesthetics).
5. Identify the specific conceptual angle and provide a one-sentence core claim.`;
}

/**
 * Generates blind pairs for human review: top similar pairs + random control pairs
 */
export function generateBlindPairs(
  answers: AnswerItem[],
  topCount = 10,
  randomCount = 10,
  seed = 42
): { pairs: ReviewPair[]; metadata: Record<string, { sim: number; stratum: 'top' | 'random' }> } {
  if (answers.length < 2) {
    return { pairs: [], metadata: {} };
  }

  // Calculate pairwise similarities
  const scoredPairs: { a: AnswerItem; b: AnswerItem; sim: number }[] = [];
  for (let i = 0; i < answers.length; i++) {
    for (let j = i + 1; j < answers.length; j++) {
      const a = answers[i];
      const b = answers[j];
      const sim = calculateLexicalSimilarity(a.answer, b.answer);
      scoredPairs.push({ a, b, sim });
    }
  }

  // Sort descending by similarity
  scoredPairs.sort((x, y) => y.sim - x.sim);

  const top = scoredPairs.slice(0, Math.min(topCount, scoredPairs.length));
  const remaining = scoredPairs.slice(top.length);

  // Deterministic pseudo-random sample from remaining
  const sampleRandom: typeof scoredPairs = [];
  let currentSeed = seed;
  const pseudoRand = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  const pool = [...remaining];
  const targetRandom = Math.min(randomCount, pool.length);
  for (let k = 0; k < targetRandom; k++) {
    const idx = Math.floor(pseudoRand() * pool.length);
    sampleRandom.push(pool.splice(idx, 1)[0]);
  }

  const pairs: ReviewPair[] = [];
  const metadata: Record<string, { sim: number; stratum: 'top' | 'random' }> = {};

  const combine = [
    ...top.map(p => ({ ...p, stratum: 'top' as const })),
    ...sampleRandom.map(p => ({ ...p, stratum: 'random' as const }))
  ];

  for (const item of combine) {
    let a = item.a;
    let b = item.b;
    // Swap 50% of the time to prevent order bias
    if (pseudoRand() < 0.5) {
      const tmp = a;
      a = b;
      b = tmp;
    }
    const pid = simpleHash(`${a.id}|${b.id}`);
    metadata[pid] = {
      sim: item.sim,
      stratum: item.stratum
    };

    pairs.push({
      pair: pid,
      stratum: item.stratum,
      a: { id: a.id, text: a.answer, angle: a.angleExplored },
      b: { id: b.id, text: b.answer, angle: b.angleExplored }
    });
  }

  // Shuffle pairs
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(pseudoRand() * (i + 1));
    const temp = pairs[i];
    pairs[i] = pairs[j];
    pairs[j] = temp;
  }

  return { pairs, metadata };
}

/**
 * Computes Cohen's Kappa for inter-rater agreement between two labelers
 * Labels: 'same', 'related', 'distinct'
 */
export function calculateCohensKappa(
  rater1: Record<string, PairLabel>,
  rater2: Record<string, PairLabel>
): {
  kappa: number;
  percentAgreement: number;
  sharedCount: number;
  confusionMatrix: Record<string, Record<string, number>>;
} {
  const categories = ['same', 'related', 'distinct'];
  const sharedPairIds = Object.keys(rater1).filter(
    id => rater2[id] && rater1[id].label !== 'skip' && rater2[id].label !== 'skip'
  );

  const n = sharedPairIds.length;
  if (n === 0) {
    return {
      kappa: 0,
      percentAgreement: 0,
      sharedCount: 0,
      confusionMatrix: {}
    };
  }

  const matrix: Record<string, Record<string, number>> = {};
  for (const c1 of categories) {
    matrix[c1] = {};
    for (const c2 of categories) {
      matrix[c1][c2] = 0;
    }
  }

  let agreed = 0;
  for (const pid of sharedPairIds) {
    const l1 = rater1[pid].label;
    const l2 = rater2[pid].label;
    if (matrix[l1] && matrix[l1][l2] !== undefined) {
      matrix[l1][l2]++;
    }
    if (l1 === l2) {
      agreed++;
    }
  }

  const po = agreed / n;

  // Marginal distributions
  let pe = 0;
  for (const cat of categories) {
    const rowSum = categories.reduce((acc, c) => acc + (matrix[cat][c] || 0), 0);
    const colSum = categories.reduce((acc, c) => acc + (matrix[c][cat] || 0), 0);
    pe += (rowSum / n) * (colSum / n);
  }

  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);

  return {
    kappa: Math.round(kappa * 1000) / 1000,
    percentAgreement: Math.round(po * 1000) / 10,
    sharedCount: n,
    confusionMatrix: matrix
  };
}

/**
 * Formats standard Git commit message
 */
export function formatGitCommitMessage(
  runId: string,
  totalCount: number,
  counts: { accepted: number; duplicate: number; off_topic: number }
): string {
  return `${runId}: ${totalCount} candidates accepted=${counts.accepted} duplicate=${counts.duplicate} off_topic=${counts.off_topic}`;
}

/**
 * Parse JSONL string into array of records
 */
export function parseJsonl<T>(text: string): T[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as T);
}

/**
 * Serialize array of records into JSONL string
 */
export function serializeJsonl<T>(items: T[]): string {
  return items.map(item => JSON.stringify(item)).join('\n') + (items.length > 0 ? '\n' : '');
}
