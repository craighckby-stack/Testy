#!/usr/bin/env python3
"""Choose answer pairs for blind review. No scores in the output."""
import hashlib
import json
import random
from pathlib import Path

import numpy as np

QID = "q-emergent"
QUESTION = "How do I make myself more emergent?"

ROOT = Path(__file__).resolve().parent
LOG = ROOT / "log" / "answers.jsonl"
CACHE = ROOT / "cache" / "embeddings.json"
OUT = ROOT / "review" / "pairs.json"
META = ROOT / "cache" / "pair_meta.json"     # scores and strata, gitignored
TOP, RANDOM, SEED = 200, 100, 7


def main():
    if not LOG.exists():
        print(f"{LOG} does not exist yet. Run generate.py first.")
        return
    rows = [json.loads(l) for l in LOG.read_text(encoding="utf-8").splitlines() if l.strip()]
    acc = [r for r in rows if r.get("status") == "accepted"]
    if len(acc) < 2:
        print("Need at least 2 accepted answers to make pairs.")
        return

    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    ids = [r["id"] for r in acc if r["id"] in cache]
    if len(ids) < 2:
        # Fallback to lexical similarity if embeddings cache not present
        ids = [r["id"] for r in acc]
        text = {r["id"]: r["answer"] for r in acc}
        ranked = []
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                # simple token jaccard
                tokens_a = set(text[ids[i]].lower().split())
                tokens_b = set(text[ids[j]].lower().split())
                sim = len(tokens_a & tokens_b) / max(1, len(tokens_a | tokens_b))
                ranked.append((ids[i], ids[j], sim))
        ranked.sort(key=lambda x: -x[2])
        top = [(a, b) for a, b, _ in ranked[:TOP]]
        rand_pool = [(a, b) for a, b, _ in ranked[TOP:]]
        rng = random.Random(SEED)
        rand = rng.sample(rand_pool, min(RANDOM, len(rand_pool))) if rand_pool else []
        S_dict = {(a, b): sim for a, b, sim in ranked}
    else:
        idx = {i: k for k, i in enumerate(ids)}
        text = {r["id"]: r["answer"] for r in acc}
        M = np.array([cache[i] for i in ids], dtype=np.float32)
        S = M @ M.T

        iu, ju = np.triu_indices(len(ids), k=1)
        order = np.argsort(-S[iu, ju])
        ranked = [(ids[iu[k]], ids[ju[k]]) for k in order]

        rng = random.Random(SEED)
        top = ranked[:TOP]
        rand = rng.sample(ranked[TOP:], min(RANDOM, len(ranked) - TOP))
        S_dict = {(ids[iu[k]], ids[ju[k]]): round(float(S[iu[k], ju[k]]), 4) for k in range(len(order))}

    items, meta = [], {}
    for stratum, pairs in (("top", top), ("random", rand)):
        for a, b in pairs:
            if rng.random() < 0.5:
                a, b = b, a
            pid = hashlib.sha1(f"{a}|{b}".encode()).hexdigest()[:8]
            sim_val = S_dict.get((a, b), S_dict.get((b, a), 0.0))
            meta[pid] = {"a": a, "b": b, "stratum": stratum, "sim": sim_val}
            items.append({"pair": pid, "a": {"id": a, "text": text[a]},
                          "b": {"id": b, "text": text[b]}})
    rng.shuffle(items)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"question": QUESTION, "items": items},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    META.parent.mkdir(parents=True, exist_ok=True)
    META.write_text(json.dumps(meta, indent=1))
    print(f"{len(items)} pairs: {len(top)} most similar, {len(rand)} random")


if __name__ == "__main__":
    main()
