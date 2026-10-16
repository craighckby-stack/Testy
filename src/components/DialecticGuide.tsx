/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  HelpCircle, 
  BrainCircuit, 
  Sparkles, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowDown, 
  ArrowRight,
  Scale, 
  Lightbulb, 
  Cpu, 
  Compass,
  GitBranch
} from 'lucide-react';

export const DialecticGuide: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Question Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
              Theoretical Foundation
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 leading-snug">
              &ldquo;Is it possible for an LLM to ask a single question to itself, answer itself, gain insights from the question, and ask the same question again without using the same answer?&rdquo;
            </h2>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Yes — Fully Feasible and Implemented Here</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* The 4-Stage Cognitive Loop */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-indigo-400" />
          <span>The Recursive Self-Prompting Loop (How This App Works)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-mono text-xs flex items-center justify-center font-bold mb-2">
                1
              </span>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Ask the Question
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                The single unchanged seed question is presented to the LLM (e.g., &ldquo;What makes a life matter if it only lasts a moment?&rdquo;).
              </p>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 font-mono">Input Anchor</div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="w-6 h-6 rounded-full bg-rose-600/30 text-rose-300 font-mono text-xs flex items-center justify-center font-bold mb-2">
                2
              </span>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Inject Taboo History
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Every previous accepted answer and explored conceptual lens is banned. The model is forbidden from reusing earlier metaphors or premises.
              </p>
            </div>
            <div className="mt-3 text-[11px] text-rose-400/80 font-mono">Negative Constraint</div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="w-6 h-6 rounded-full bg-amber-600/30 text-amber-300 font-mono text-xs flex items-center justify-center font-bold mb-2">
                3
              </span>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                High Thinking Generation
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Powered by <code className="text-indigo-300">gemini-4-argon</code> with High Thinking mode, the LLM traverses distant conceptual space to formulate an orthogonal answer.
              </p>
            </div>
            <div className="mt-3 text-[11px] text-amber-400/80 font-mono">Orthogonal Leap</div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-300 font-mono text-xs flex items-center justify-center font-bold mb-2">
                4
              </span>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Synthesize Insight
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                The model reflects: &ldquo;What axiom did I just use? What unexplored dimensions remain?&rdquo; and feeds this insight into cycle #N+1.
              </p>
            </div>
            <div className="mt-3 text-[11px] text-emerald-400/80 font-mono">Meta-Reflection</div>
          </div>
        </div>
      </div>

      {/* Why High Thinking Mode is Crucial */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Cpu className="w-5 h-5" />
            <h4 className="font-semibold text-slate-100 text-sm">
              Why Superficial Negative Prompts Fail
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Without deep reasoning, standard LLMs merely rephrase the same thought using synonyms (e.g. changing &ldquo;a flash of lightning&rdquo; into &ldquo;a momentary spark in the dark&rdquo;). Both rely on the identical philosophical axiom: <em>subjective aesthetic intensity</em>. To a human reviewer, this is a redundant duplicate.
          </p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Compass className="w-5 h-5" />
            <h4 className="font-semibold text-slate-100 text-sm">
              How High Thinking Achieves Divergence
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            With High Thinking mode on Gemini 4 Argon, the model evaluates its own reasoning topology before emitting text. It explicitly discards aesthetic qualia and pivots into <strong>thermodynamic irreversibility</strong>, <strong>information theory</strong>, <strong>relational ethics</strong>, or <strong>evolutionary selection</strong>.
          </p>
        </div>
      </div>

      {/* Why the Git Log & Manual Review are Essential */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-slate-200">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          <h4 className="font-semibold text-sm">
            Why We Log to Git &amp; Calibrate with Blind Pairs (Cohen&apos;s Kappa)
          </h4>
        </div>
        <p className="text-slate-300 leading-relaxed">
          The user astutely noted: <em>&ldquo;The judge is the same model family as the generator, so it will be lenient. Your labels are the real check on it. Without Cohen&apos;s kappa on the first 50 pairs, the labels are just your opinion.&rdquo;</em>
        </p>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-slate-400">
          <div>&bull; <strong className="text-slate-200">Git commit per run:</strong> Creates an immutable, auditable log of accepted candidates and duplicates.</div>
          <div>&bull; <strong className="text-slate-200">Blind pair sampling:</strong> Extracts the 200 most similar pairs where filters are most prone to miss duplicates, plus random control pairs.</div>
          <div>&bull; <strong className="text-slate-200">Inter-rater agreement (&kappa;):</strong> Validates that two independent reviewers categorize redundancy consistently before committing to automated production thresholds.</div>
        </div>
      </div>
    </div>
  );
};
