#!/usr/bin/env python3
"""Fail if any run of N consecutive words from the given transcripts appears in source files.
Usage: python3 -I check_no_transcript_leak.py --transcript a.txt --transcript b.txt --src app/src --skip-dir fixtures [--n 6]
Exit 0 clean, 1 leak found. No network."""
import argparse, os, re, sys

def toks(s):
    return re.findall(r"[a-z0-9']+", s.lower().replace("’", "'"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcript", action="append", required=True)
    ap.add_argument("--src", action="append", required=True)
    ap.add_argument("--skip-dir", action="append", default=["node_modules", ".git", "dist", "build"])
    ap.add_argument("--n", type=int, default=6)
    a = ap.parse_args()
    shingles = {}
    for t in a.transcript:
        w = toks(open(t, encoding="utf-8", errors="ignore").read())
        for i in range(len(w) - a.n + 1):
            shingles.setdefault(" ".join(w[i:i + a.n]), os.path.basename(t))
    exts = (".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".sql", ".py", ".html")
    hits = []
    for root_dir in a.src:
        for dp, dns, fns in os.walk(root_dir):
            dns[:] = [d for d in dns if d not in a.skip_dir]
            for fn in fns:
                if not fn.endswith(exts): continue
                p = os.path.join(dp, fn)
                w = toks(open(p, encoding="utf-8", errors="ignore").read())
                for i in range(len(w) - a.n + 1):
                    s = " ".join(w[i:i + a.n])
                    if s in shingles:
                        hits.append((p, s, shingles[s])); break
    for p, s, t in hits:
        print(f"LEAK {p}: '{s}' (from {t})")
    print(f"{len(hits)} file(s) with leaked {a.n}-word runs")
    sys.exit(1 if hits else 0)

main()
