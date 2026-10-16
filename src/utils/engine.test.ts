/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  calculateLexicalSimilarity,
  simpleHash,
  buildNegativePrompt,
  generateBlindPairs,
  calculateCohensKappa,
  formatGitCommitMessage,
  parseJsonl,
  serializeJsonl,
  type AnswerItem,
  type PairLabel
} from './engine.ts';

test('tokenize extracts clean lowercase tokens', () => {
  const tokens = tokenize('What makes a life matter, if it only lasts a moment?!');
  assert.ok(tokens.includes('what'));
  assert.ok(tokens.includes('makes'));
  assert.ok(tokens.includes('life'));
  assert.ok(tokens.includes('matter'));
  assert.ok(tokens.includes('lasts'));
  assert.ok(tokens.includes('moment'));
  // Single/two-letter words filtered out
  assert.ok(!tokens.includes('a'));
  assert.ok(!tokens.includes('if'));
  assert.ok(!tokens.includes('it'));
});

test('calculateLexicalSimilarity returns 1 for identical and 0 for disjoint texts', () => {
  const text1 = 'A moment matters through conscious experience and subjective depth.';
  const text2 = 'A moment matters through conscious experience and subjective depth.';
  const text3 = 'Thermodynamic entropy increases inevitably across stellar galaxies.';

  assert.equal(calculateLexicalSimilarity(text1, text2), 1.0);
  assert.equal(calculateLexicalSimilarity(text1, text3), 0.0);
});

test('calculateLexicalSimilarity returns reasonable partial score for overlapping texts', () => {
  const tA = 'A flame burns brightest before dying in the cold night.';
  const tB = 'A flame burns gently in the dark cold night.';
  const sim = calculateLexicalSimilarity(tA, tB);
  assert.ok(sim > 0.3 && sim < 1.0, `Expected similarity between 0.3 and 1.0, got ${sim}`);
});

test('simpleHash generates stable 8-char hex string', () => {
  const h1 = simpleHash('item1|item2');
  const h2 = simpleHash('item1|item2');
  const h3 = simpleHash('item2|item1');
  assert.equal(h1.length, 8);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('buildNegativePrompt embeds taboo list and meta insight', () => {
  const dummyAnswers: AnswerItem[] = [
    {
      id: 'a-0001',
      ts: new Date().toISOString(),
      question: 'Why?',
      questionId: 'q-001',
      run: 'r-001',
      model: 'gemini-4-argon',
      temp: 1,
      answer: 'Beauty lies in the fleeting nature of sensation.',
      status: 'accepted',
      angleExplored: 'Aesthetics'
    }
  ];

  const prompt = buildNegativePrompt('Why?', dummyAnswers, 'Shift from individual experience to physical law');
  assert.ok(prompt.includes('PREVIOUSLY EXPLORED ANSWERS (TABOO LIST - DO NOT REUSE)'));
  assert.ok(prompt.includes('Beauty lies in the fleeting nature'));
  assert.ok(prompt.includes('METALOGICAL INSIGHT FROM PREVIOUS ANSWERS'));
  assert.ok(prompt.includes('Shift from individual experience'));
});

test('generateBlindPairs creates stratified pairs without leaking scores in output', () => {
  const answers: AnswerItem[] = [
    {
      id: 'a-0001',
      ts: '',
      question: '',
      questionId: 'q1',
      run: 'r1',
      model: 'm1',
      temp: 1,
      answer: 'The universe remembers every fleeting particle.',
      status: 'accepted'
    },
    {
      id: 'a-0002',
      ts: '',
      question: '',
      questionId: 'q1',
      run: 'r1',
      model: 'm1',
      temp: 1,
      answer: 'Every particle in the universe is remembered.',
      status: 'accepted'
    },
    {
      id: 'a-0003',
      ts: '',
      question: '',
      questionId: 'q1',
      run: 'r1',
      model: 'm1',
      temp: 1,
      answer: 'Love creates bonds between souls that transcend time.',
      status: 'accepted'
    },
    {
      id: 'a-0004',
      ts: '',
      question: '',
      questionId: 'q1',
      run: 'r1',
      model: 'm1',
      temp: 1,
      answer: 'Biological adaptation thrives on generational mortality.',
      status: 'accepted'
    }
  ];

  const { pairs, metadata } = generateBlindPairs(answers, 2, 2, 123);
  assert.ok(pairs.length > 0);
  for (const p of pairs) {
    assert.ok(p.pair);
    assert.ok(p.a.text);
    assert.ok(p.b.text);
    // Score is kept in metadata, not exposed in blind review pair
    assert.equal(p.sim, undefined);
    assert.ok(metadata[p.pair].sim !== undefined);
  }
});

test('calculateCohensKappa calculates agreement correctly', () => {
  const rater1: Record<string, PairLabel> = {
    p1: { pair: 'p1', a: '1', b: '2', label: 'same', labeler: 'Alice', ts: '' },
    p2: { pair: 'p2', a: '2', b: '3', label: 'distinct', labeler: 'Alice', ts: '' },
    p3: { pair: 'p3', a: '3', b: '4', label: 'related', labeler: 'Alice', ts: '' },
    p4: { pair: 'p4', a: '4', b: '5', label: 'same', labeler: 'Alice', ts: '' }
  };

  // Identical rater
  const raterIdentical: Record<string, PairLabel> = {
    p1: { pair: 'p1', a: '1', b: '2', label: 'same', labeler: 'Bob', ts: '' },
    p2: { pair: 'p2', a: '2', b: '3', label: 'distinct', labeler: 'Bob', ts: '' },
    p3: { pair: 'p3', a: '3', b: '4', label: 'related', labeler: 'Bob', ts: '' },
    p4: { pair: 'p4', a: '4', b: '5', label: 'same', labeler: 'Bob', ts: '' }
  };

  const res = calculateCohensKappa(rater1, raterIdentical);
  assert.equal(res.percentAgreement, 100);
  assert.equal(res.kappa, 1);
  assert.equal(res.sharedCount, 4);

  // Partial agreement
  const raterDivergent: Record<string, PairLabel> = {
    p1: { pair: 'p1', a: '1', b: '2', label: 'same', labeler: 'Charlie', ts: '' },
    p2: { pair: 'p2', a: '2', b: '3', label: 'distinct', labeler: 'Charlie', ts: '' },
    p3: { pair: 'p3', a: '3', b: '4', label: 'distinct', labeler: 'Charlie', ts: '' }, // disagreement
    p4: { pair: 'p4', a: '4', b: '5', label: 'related', labeler: 'Charlie', ts: '' }   // disagreement
  };

  const res2 = calculateCohensKappa(rater1, raterDivergent);
  assert.equal(res2.percentAgreement, 50);
  assert.ok(res2.kappa < 1);
});

test('formatGitCommitMessage creates standard git log summary', () => {
  const msg = formatGitCommitMessage('r-20261015180000', 10, {
    accepted: 8,
    duplicate: 1,
    off_topic: 1
  });
  assert.equal(msg, 'r-20261015180000: 10 candidates accepted=8 duplicate=1 off_topic=1');
});

test('parseJsonl and serializeJsonl work symmetrically', () => {
  const sample = [
    { id: 1, name: 'alpha' },
    { id: 2, name: 'beta' }
  ];
  const jsonl = serializeJsonl(sample);
  const parsed = parseJsonl(jsonl);
  assert.deepEqual(parsed, sample);
});
