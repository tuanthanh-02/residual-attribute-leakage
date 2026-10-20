#!/usr/bin/env python3
"""Assemble the Hugging Face Space from the published site.

The Space is the same two pages as the GitHub Pages site, so it is generated rather than kept as
a second copy: one source of truth in docs/, and nothing to drift. A static Space serves
`app_file` at the root and every other file beside it, so the whole of docs/ is copied flat and
only the README front matter is written here.

    python tools/build_space.py build/space
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "docs")
GITHUB = "https://github.com/tuanthanh-02/residual-attribute-leakage"
PAGES = "https://tuanthanh-02.github.io/residual-attribute-leakage/"

# Every field below is in the Spaces configuration reference; colours are from its allowed list.
FRONT = f"""---
title: Residual Attribute Leakage Is an Interface
emoji: 🔎
colorFrom: gray
colorTo: red
sdk: static
app_file: index.html
pinned: false
license: mit
short_description: A privacy verdict depends on how it is scored
tags:
  - privacy
  - anonymization
  - de-identification
  - evaluation
  - attribute-inference
---

# Residual Attribute Leakage Is an Interface

### Auditing Privacy Evaluation After Text De-identification

Companion to the paper. Two pages, no backend:

- **Results** — every figure and table of the paper, read from the manuscript.
- **Run the protocol** — the evaluation run on a sentence you write: which attribute the text
  states, five releases built from it, the adversary's prior and posterior, the leakage score and
  its band, the per-candidate-order split, and an optional rule-aware pass.

An editor that writes the **opposite-sex form at exactly the spans a redaction editor would
redact** misleads the adversary about most people, yet ranks *first* among eight releases under a
clipped leakage score. A reading that scores only the answer about the true value cannot tell
information removal from confident misdirection.

Running the adversary is optional and needs your own OpenAI key. It stays in the page, in memory,
and goes only to the provider; nothing is stored and nothing is sent until you press Run. A run
is a handful of single-token calls and costs a fraction of a cent.

Source and the paper's numbers: [{GITHUB.replace("https://", "")}]({GITHUB}) ·
the same site is also served from [GitHub Pages]({PAGES})
"""


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build", "space")
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    copied = []
    for name in sorted(os.listdir(SITE)):
        src = os.path.join(SITE, name)
        if not os.path.isfile(src) or name == ".nojekyll":   # Jekyll never runs on a Space
            continue
        shutil.copy2(src, os.path.join(out, name))
        copied.append(name)
    assert "index.html" in copied, "app_file must exist: " + str(copied)
    # the Hub caps this field at 60 characters and refuses the upload otherwise
    desc = [l for l in FRONT.split("\n") if l.startswith("short_description:")][0]
    desc = desc.split(":", 1)[1].strip()
    assert len(desc) <= 60, f"short_description is {len(desc)} characters, the Hub allows 60"
    with open(os.path.join(out, "README.md"), "w") as f:
        f.write(FRONT)
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print(f"written {out}")
    for n in copied + ["README.md"]:
        print(f"  {n:16s} {os.path.getsize(os.path.join(out, n)) / 1000:7.1f} kB")
    print(f"  {'total':16s} {total / 1000:7.1f} kB")


if __name__ == "__main__":
    main()
