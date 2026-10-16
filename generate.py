#!/usr/bin/env python3
"""Ask Gemini one question, log every candidate, flag duplicates, commit with preflight checks."""
import datetime as dt
import json
import os
import subprocess
from pathlib import Path

try:
    import numpy as np
except ImportError:
    np = None

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

QID = "q-emergent"
QUESTION = "How do I make myself more emergent?"  # the one question

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
TOTAL_CYCLES = int(os.environ.get("CYCLES", os.environ.get("N", "100000")))  # cycles target
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "10"))  # commit batch size
TEMP = 1.0
DUP_SIM = float(os.environ.get("DUP_SIM", "0.80"))  # tune against duplicate labels

ROOT = Path(__file__).resolve().parent
LOG = ROOT / "log" / "answers.jsonl"
CACHE = ROOT / "cache" / "embeddings.json"   # gitignored


def run_git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)


def git(*args):
    r = run_git(*args)
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed:\n{(r.stderr or r.stdout).strip()}")
    return r.stdout.strip()


def preflight():
    if run_git("rev-parse", "--is-inside-work-tree").returncode != 0:
        raise SystemExit(f"{ROOT} is not inside a git repo. Run git init, or cd into the repo.")
    if not run_git("config", "user.name").stdout.strip() or \
       not run_git("config", "user.email").stdout.strip():
        raise SystemExit("git identity not set. Run: git config user.name 'Your Name' "
                         "&& git config user.email 'you@example.com'")


def git_commit(run, rows):
    if not rows:
        print("no new rows; nothing to commit")
        return
    counts = {s: sum(r.get("status") == s for r in rows)
              for s in ("accepted", "duplicate", "off_topic")}
    msg = f"{run}: {len(rows)} candidates " + " ".join(f"{k}={v}" for k, v in counts.items())
    git("add", str(LOG))
    if not git("status", "--porcelain", "--", str(LOG)):
        print("log unchanged; nothing to commit")
        return
    git("commit", "-m", msg)
    print("committed", git("rev-parse", "--short", "HEAD"))
    remotes = git("remote").split()
    if not remotes:
        print("WARNING: no git remote; commit is local only")
    elif os.environ.get("NO_PUSH") != "1":
        git("push", remotes[0], "HEAD")
        print("pushed to", remotes[0])


def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def embed(client, texts):
    res = client.models.embed_content(model=EMBED_MODEL, contents=texts)
    v = np.array([e.values for e in res.embeddings], dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def propose(client, accepted_texts):
    avoid = "\n".join(f"- {t}" for t in accepted_texts[-30:]) or "(none yet)"
    prompt = (f"{QUESTION}\n\nAnswer in 2 to 4 sentences. Be specific.\n"
              f"Do not repeat or paraphrase these earlier answers:\n{avoid}")
    r = client.models.generate_content(
        model=MODEL, contents=prompt,
        config=types.GenerateContentConfig(temperature=TEMP))
    return (r.text or "").strip()


JUDGE = ('Question: {q}\nAnswer: {a}\n\n'
         'Is the answer relevant to the question and coherent? '
         'Reply only with JSON: {{"relevant": true|false, "coherent": true|false}}')


def judge(client, answer):
    r = client.models.generate_content(
        model=MODEL, contents=JUDGE.format(q=QUESTION, a=answer),
        config=types.GenerateContentConfig(temperature=0,
                                           response_mime_type="application/json"))
    try:
        j = json.loads(r.text)
        return bool(j["relevant"]) and bool(j["coherent"])
    except (ValueError, KeyError, TypeError):
        return False


def main():
    preflight()  # First line before client or any API spending
    client = genai.Client()  # reads GEMINI_API_KEY
    rows = read_jsonl(LOG)
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    accepted = [r for r in rows if r.get("question") == QID and r.get("status") == "accepted"]

    missing = [r for r in accepted if r["id"] not in cache]
    if missing:
        for r, v in zip(missing, embed(client, [r["answer"] for r in missing])):
            cache[r["id"]] = v.tolist()
    acc_ids = [r["id"] for r in accepted]
    acc_mat = np.array([cache[i] for i in acc_ids], dtype=np.float32) if acc_ids else None

    run = "r-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
    next_n = len(rows) + 1
    batch = []
    total_logged = 0

    print(f"Starting recursive exploration of: '{QUESTION}'")
    print(f"Target cycles: {TOTAL_CYCLES} | Batch commit interval: {BATCH_SIZE} | DUP_SIM: {DUP_SIM}")

    try:
        for cycle in range(1, TOTAL_CYCLES + 1):
            ans = propose(client, [r["answer"] for r in accepted])
            if not ans:
                continue

            # Fallback embedding/similarity
            if np is not None and client:
                vec = embed(client, [ans])[0]
                nearest_id = nearest_sim = None
                if acc_mat is not None:
                    sims = acc_mat @ vec
                    j = int(np.argmax(sims))
                    nearest_id, nearest_sim = acc_ids[j], round(float(sims[j]), 4)
            else:
                # Pure python lexical token fallback
                vec = None
                tokens_ans = set(ans.lower().split())
                max_sim, nearest_id = 0.0, None
                for acc_row in accepted:
                    tokens_acc = set(acc_row["answer"].lower().split())
                    sim = len(tokens_ans & tokens_acc) / max(1, len(tokens_ans | tokens_acc))
                    if sim > max_sim:
                        max_sim = sim
                        nearest_id = acc_row["id"]
                nearest_sim = round(max_sim, 4)

            if nearest_sim is not None and nearest_sim >= DUP_SIM:
                status = "duplicate"
            elif not judge(client, ans):
                status = "off_topic"
            else:
                status = "accepted"

            row = {"id": f"a-{next_n:05d}",
                   "ts": dt.datetime.now(dt.timezone.utc).isoformat(),
                   "question": QID, "run": run, "model": MODEL, "temp": TEMP,
                   "answer": ans, "status": status,
                   "nearest_id": nearest_id, "nearest_sim": nearest_sim}
            next_n += 1
            batch.append(row)
            total_logged += 1

            if status == "accepted":
                accepted.append(row)
                if vec is not None:
                    cache[row["id"]] = vec.tolist()
                    acc_ids.append(row["id"])
                    acc_mat = vec[None, :] if acc_mat is None else np.vstack([acc_mat, vec])

            print(f"Cycle {cycle}/{TOTAL_CYCLES} [{row['id']}]: {status} (nearest: {nearest_sim})")

            # Commit periodically at batch boundaries
            if len(batch) >= BATCH_SIZE or cycle == TOTAL_CYCLES:
                LOG.parent.mkdir(parents=True, exist_ok=True)
                with LOG.open("a", encoding="utf-8") as f:
                    for r in batch:
                        f.write(json.dumps(r, ensure_ascii=False) + "\n")
                if vec is not None:
                    CACHE.parent.mkdir(parents=True, exist_ok=True)
                    CACHE.write_text(json.dumps(cache))
                git_commit(f"{run}-b{cycle // BATCH_SIZE}", batch)
                batch = []

    except KeyboardInterrupt:
        print(f"\nGracefully interrupted by user. Saved {total_logged} cycles.")
        if batch:
            with LOG.open("a", encoding="utf-8") as f:
                for r in batch:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            git_commit(f"{run}-interrupted", batch)


if __name__ == "__main__":
    main()
