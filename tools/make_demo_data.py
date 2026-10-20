#!/usr/bin/env python
"""Build demo/data.json for the static demo, from the two authoritative sources.

Numbers come from the manuscript, `sacc_eval.tex`: it is what was submitted, and the run
artifacts have not been re-emitted since, so the paper is the only source that cannot disagree
with itself. The cue layer (lexicons, the rewrite map, SWAP's flip table) comes from the frozen
code, because the demo has to RUN it on pasted text, and the paper prints the same patterns
verbatim in its lexicon figure.

Cross-checks before writing: the |AUC-.5| ranking is recomputed from the table's own AUC column
and must reproduce its printed Rk; SWAP must hold the lowest MedQA L; and only the adversary row
may carry reversals, which is what the abstract claims.

    $SPIA_PY scripts/make_demo_data.py
Writes the site's data.json (by default into the published repository, or to the path
given as the first argument).  CPU only, 0 USD.
"""
import json
import os
import re
import sys

SP = "/data_x/thanh/tam/spia"
os.chdir(SP); sys.path.insert(0, SP)
TEX = "/data_x/thanh/tam/sacc_eval.tex"
# where the generated file goes; the default is the working copy of the site, and the
# published repository passes its own path as the first argument
OUT = (sys.argv[1] if len(sys.argv) > 1 else
       "/data_x/thanh/tam/residual-attribute-leakage/site/data.json")


def tex():
    return open(TEX, encoding="utf-8").read()


def plain(x):
    """A LaTeX row label to plain display text.

    The paper marks one arm with a dagger footnote (the family whose run failed) and writes a
    contrast with math-mode minus. Neither mark means anything on a page that carries neither the
    footnote nor the column, so the dagger goes and the minus becomes a real minus sign.
    """
    # Order matters: the marks that are written in math mode have to go before the dollars do,
    # or stripping $ leaves the caret behind and the label reads "Adaptive^".
    x = re.sub(r"\$\^\{?\\dagger\}?\$|\\dagger", "", x)       # the failed-family footnote
    x = x.replace("$-$", "\u2212").replace("$--$", "\u2212")
    # the paper's own macros, expanded from their \newcommand definitions, not guessed
    for a, b in (("\\sacc{}", "SACC"), ("\\leakE{}", "Leaking"), ("\\discE{}", "Disclosing"),
                 ("\\misB{}", "Misled"), ("\\anonE{}", "Anonymised"),
                 ("\\unli{}", "U_nli"), ("\\unli", "U_nli"), ("\\prior", "\u03c0"),
                 ("$L$", "L"), ("\\,", " ")):
        x = x.replace(a, b)
    x = re.sub(r"\\attr\{([^}]*)\}", r"\1", x)
    x = re.sub(r"\\textsc\{([^}]*)\}", r"\1", x)
    x = x.replace("$\u03c0$", "\u03c0").replace("$", "")
    x = re.sub(r"\\textbf\{([^}]*)\}", r"\1", x)
    x = x.replace("\\,", " ").replace("~", " ").replace("\\%", "%")
    return re.sub(r"\s+", " ", x).strip()


def clean(x):
    """a LaTeX cell to a number or a string"""
    x = x.replace("\\textbf{", "").replace("}", "").replace("$-$", "-").replace("$", "")
    x = x.replace("\\phantom{+", "").replace("+", "").replace("\\,", " ").strip()
    try:
        return float(x)
    except ValueError:
        return x.strip()


def block(s, label, start_after="\\midrule"):
    i = s.index(label)
    body = s[:i]
    return body[body.rindex("\\begin{tab"):]


def parse_x1(s):
    i = s.index("\\label{tab:x1}")
    body = s[s.rindex("\\begin{tabular}", 0, i):i]
    rows, tabrows = [], []
    for m in re.finditer(r"\n\n([A-Za-z\\][^&\n]*?)\n& ([^\\]+?)\\\\", body):
        name = plain(m.group(1))
        cells = [clean(c) for c in m.group(2).split("&")]
        if len(cells) != 8:
            continue
        if name.startswith("SWAP \u2212"):
            continue
        rows.append({"system": name, "L": cells[0], "leak": cells[1], "disc": cells[2],
                     "auc": cells[3], "rk": int(cells[4])})
        tabrows.append({"system": name, "L": cells[5], "leak": cells[6], "disc": cells[7]})
    assert len(rows) == 8, [r["system"] for r in rows]
    # gate: the printed Rk must be the ranking of |AUC-.5| computed from the printed AUC
    order = sorted(rows, key=lambda r: abs(r["auc"] - .5))
    rank, prev, pr = {}, None, 0
    for k, r in enumerate(order, 1):
        d = round(abs(r["auc"] - .5), 3)
        pr = pr if d == prev else k
        prev = d
        rank[r["system"]] = pr
    bad = [(r["system"], r["rk"], rank[r["system"]]) for r in rows if r["rk"] != rank[r["system"]]]
    assert not bad, f"Rk column does not match its own AUC column: {bad}"
    assert min(r["L"] for r in rows) == [r for r in rows if r["system"].startswith("SWAP")][0]["L"], \
        "SWAP no longer holds the lowest MedQA L"
    return rows, tabrows


def parse_readings(s):
    i = s.index("\\label{tab:metricfamily}")
    body = s[s.rindex("Reading & Prior", 0, i):i]
    out = []
    for line in body.split("\n"):
        m = re.match(r"(.+?) & (yes|no) & ([^&]+) & ([^&]+) & (\d+) / (\d+)", line.strip())
        if not m:
            continue
        name = m.group(1)
        up = "uparrow" in name
        # the macro names must be expanded before the strip below, or Leaking and Disclosing
        # both collapse to the fallback "L"
        name = (name.replace("\\leakE{}", "Leaking").replace("\\discE{}", "Disclosing")
                    .replace("|\\mathrm{AUC}-.5|", "|AUC-.5|"))
        name = re.sub(r"\$?\\\\?[a-zA-Z]+\{?\}?|\$|\\|downarrow|uparrow", "", name)
        name = name.replace("mathrm", "").replace("{", "").replace("}", "").strip()
        out.append({"reading": name or "L", "uses_prior": m.group(2) == "yes",
                    "better_when": "higher" if up else "lower",
                    "swap": clean(m.group(3)), "saccmask": clean(m.group(4)),
                    "rank_medqa": int(m.group(5)), "rank_tab": int(m.group(6))})
    assert len(out) == 8, out
    return out


def parse_choices(s):
    out = []
    for m in re.finditer(r"\\effectrow\{[\d.]+\}\s*\n\s*\{(.+?)\}\s*\n"
                         r"\s*\{(\d+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}\{([^}]*)\}", s):
        lab = re.sub(r"\\textbf\{|\}|\$\^\*\$", "", m.group(1)).strip()
        med = m.group(7).replace("\\text{---}", "").replace("---", "")
        out.append({"choice": lab, "reversals": int(m.group(2)), "gained": int(m.group(3)),
                    "lost": int(m.group(4)), "n": int(m.group(5)), "changed": int(m.group(6)),
                    "median_abs_dL": float(med) if med.startswith(".") else None})
    assert len(out) == 6, [o["choice"] for o in out]
    rev = [o for o in out if o["reversals"]]
    assert len(rev) == 1 and rev[0]["choice"].startswith("Adversary") and rev[0]["reversals"] == 5, \
        f"the abstract says only the adversary reverses, 5 of 124: {rev}"
    return out


def parse_example(s):
    i = s.index("\\label{tab:example-medqa}")
    body = s[s.rindex("\\begin{tabular}", 0, i):i]
    out = []
    for m in re.finditer(r"\n([A-Za-z\\][^&\n]*?) & (A [^&]*?) \\\\", body, re.S):
        name = m.group(1).replace("\\rowcolor{oursrow}", "").replace("\\sacc{}", "SACC").strip()
        txt = m.group(2)
        out.append({"system": name,
                    "html": re.sub(r"\\textbf\{(.+?)\}", r"<mark>\1</mark>", txt).replace("\n", " ")})
    assert len(out) == 6, [o["system"] for o in out]
    return out


def cue_layer():
    from src.relaware import profiles
    from src.relaware.method import edits
    import dev_eval_review2 as X
    from src.relaware.method import edits_v11
    import importlib
    bind = importlib.import_module("dev_phase10_binding")
    lex = {k: v if isinstance(v, str) else v.pattern
           for k, v in profiles.PROFILES["medqa"].lex.items()}
    inst = sorted(bind.INSTITUTION)
    keep = edits_v11.NO_TRUE_SUPERORDINATE.pattern
    # the paper names both of these: 26 institution nouns behind the non-person rule, and a
    # keep-list that EVERY editor leaves in place, including the global ones
    assert len(inst) == 26, f"the paper says 26 institution nouns, found {len(inst)}"
    assert "patient" in keep and "the court" in keep, keep
    # Pricing: the project's own figures, not retyped from a vendor page. The per-token rates are
    # the ones its cost estimator uses, and the measured rate is from the SWAP scoring pass, whose
    # cost and request count the paper reports -- an empirical price for exactly this kind of
    # single-token call.
    src = open("scripts/dev_eval_review2.py").read()
    assert "0.15e-6" in src and "0.60e-6" in src, "the per-token rates moved"
    m = re.search(r"cost ([\d.]+) USD for ([\d,]+) MedQA requests", src)
    assert m, "the measured SWAP rate is no longer recorded"
    price = {"usd_per_prompt_token": 0.15e-6, "usd_per_completion_token": 0.60e-6,
             "measured_usd": float(m.group(1)),
             "measured_requests": int(m.group(2).replace(",", "")),
             "note": "the project's own rates for the development adversary; check them against "
                     "the provider's current price list before trusting the total"}
    return {"lexicon": lex, "institution": inst, "keep": keep, "pricing": price,
            "pronoun_map": edits.PRONOUN_MAP,
            "titles": sorted(edits.TITLES), "swap": X.SWAP,
            "kin_neutral": edits._KIN_NEUTRAL,
            # the published rule for the one form that is both objective and possessive
            "her_objective_next": sorted(edits._HER_OBJECTIVE_NEXT),
            "note": "These are the frozen MedQA lexicons and the rewrite and flip tables the "
                    "paper prints. Two steps are missing on purpose: the binder, which decides "
                    "whom a cue describes from a dependency parse, and the agreement repair, the "
                    "method's one tuned setting, which also needs the parse -- so a verb after a "
                    "rewritten pronoun is left unrepaired here"}


def models():
    """The adversary menu, built from measurement, not from a vendor page.

    Capability comes from this project's own smoke census over 41 GPT-5-line IDs plus
    gpt-5.6-luna (`runs/dev/luna_smoke/`), and from the production runs for the two 4-series
    models. Prices are the constants this project's own cost estimators use. A model is listed
    only when BOTH are present; everything else is reported as a census count with its reason,
    so the menu never implies a capability or a price we have not got.

    The two transports are not interchangeable. The frozen payload (`max_tokens: 1`,
    `top_logprobs: 20`) is the one the paper scores with. The 5-series refuses it and needs
    `max_completion_tokens` with `top_logprobs: 5`, which returns mass for fewer letters -- so an
    8-option attribute is not measurable there. That is a capability limit, not a price.
    """
    smoke = json.load(open("runs/dev/luna_smoke/smoke_gpt5line.json"))
    top5 = json.load(open("runs/dev/luna_smoke/smoke_gpt51_gpt52_gpt54nano.json"))
    luna = json.load(open("runs/dev/luna_smoke/smoke.json"))
    g5 = json.load(open("runs/dev/sacc_gpt5line/score_log_gpt-5.4-nano.json"))

    # prices: read the constants, never retyped here
    src5 = open("scripts/dev_gpt5line_sex.py").read()
    m = re.search(r"PRICES = \{([^}]*)\}", src5)
    assert m, "the 5-series price table moved"
    P5 = {k: (float(a), float(b)) for k, a, b in
          re.findall(r'"([^"]+)": \(([\d.]+)e-6, ([\d.]+)e-6\)', m.group(1))}
    assert set(P5) == {"gpt-5.4-nano", "gpt-5.1", "gpt-5.2"}, sorted(P5)
    src4 = open("scripts/dev_sacc_binder_audit.py").read()
    m = re.search(r'"gpt-4\.1-mini": \(([\d.]+)e-6, ([\d.]+)e-6\)', src4)
    assert m, "the gpt-4.1-mini rate moved"
    P41 = (float(m.group(1)), float(m.group(2)))

    # the cache-free gate block is the only place completion tokens per CALL can be read: the
    # run-level stats count a cache hit as a request but bill it no tokens, so dividing there
    # would understate the output side.
    gate = json.load(open("runs/dev/sacc_gpt5line/gate_gpt-5.4-nano.json"))
    blocks = [b["stats"] for b in gate["payload_variants"] if b.get("stats")]
    out_per_call = max(b["completion_tokens"] / b["requests"] for b in blocks)
    assert 1 < out_per_call <= 64, out_per_call

    sw = open("scripts/dev_eval_review2.py").read()
    mm = re.search(r"cost ([\d.]+) USD for ([\d,]+) MedQA requests", sw)
    assert mm, "the measured gpt-4o-mini rate is no longer recorded"
    MEAS4O = (float(mm.group(1)), int(mm.group(2).replace(",", "")))

    SM = "runs/dev/luna_smoke/"
    ml = [
        {"id": "gpt-4o-mini", "tag": "recommended",
         "role": "the paper's development adversary",
         "in": 0.15, "out": 0.60, "price_src": "scripts/dev_eval_review2.py",
         "transport": "frozen", "top_logprobs": 20, "out_per_call": 1, "max_options": 8,
         "measured_usd": MEAS4O[0], "measured_requests": MEAS4O[1],
         "cap_src": SM + "smoke_gpt5line.json (control_works)",
         "cap": "the frozen payload works as it stands"},
        {"id": "gpt-4.1-mini", "tag": "",
         "role": "a confirmation adversary in the paper",
         "in": P41[0], "out": P41[1], "price_src": "scripts/dev_sacc_binder_audit.py",
         "transport": "frozen", "top_logprobs": 20, "out_per_call": 1, "max_options": 8,
         "measured_usd": None,
         "cap_src": "runs/dev/sacc_family4/, runs/dev/sacc_reasoning/",
         "cap": "the frozen payload works as it stands"},
        {"id": "gpt-5.4-nano", "tag": "",
         "role": "the cheapest that can drive the protocol",
         "in": P5["gpt-5.4-nano"][0], "out": P5["gpt-5.4-nano"][1],
         "price_src": "scripts/dev_gpt5line_sex.py",
         "transport": "top5", "top_logprobs": 5, "out_per_call": out_per_call, "max_options": 2,
         "measured_usd": g5["usd"], "measured_requests": g5["requests"],
         "one_letter_rate": g5["one_letter_rate"],
         "cap_src": SM + "smoke_gpt51_gpt52_gpt54nano.json; runs/dev/sacc_gpt5line/",
         "cap": "needs its own payload; a full pass has been run on it"},
        {"id": "gpt-5.1", "tag": "",
         "role": "usable, %.0f\u00d7 the output rate" % (P5["gpt-5.1"][1] / 0.60),
         "in": P5["gpt-5.1"][0], "out": P5["gpt-5.1"][1],
         "price_src": "scripts/dev_gpt5line_sex.py",
         "transport": "top5", "top_logprobs": 5, "out_per_call": out_per_call, "max_options": 2,
         "measured_usd": None, "cap_src": SM + "smoke_gpt51_gpt52_gpt54nano.json",
         "cap": "needs its own payload; smoke-tested only"},
        {"id": "gpt-5.2", "tag": "",
         "role": "the dearest here, %.0f\u00d7 the output rate" % (P5["gpt-5.2"][1] / 0.60),
         "in": P5["gpt-5.2"][0], "out": P5["gpt-5.2"][1],
         "price_src": "scripts/dev_gpt5line_sex.py",
         "transport": "top5", "top_logprobs": 5, "out_per_call": out_per_call, "max_options": 2,
         "measured_usd": None, "cap_src": SM + "smoke_gpt51_gpt52_gpt54nano.json",
         "cap": "needs its own payload; smoke-tested only"},
    ]
    assert ml[0]["id"] == "gpt-4o-mini" and ml[0]["tag"] == "recommended", \
        "the development adversary must head the menu"

    # the census of what is NOT offered, by the reason the service itself gave
    def why(res, mid):
        return " | ".join(sorted({(r.get("error_message") or "") for r in res
                                  if r["model"] == mid and not r["ok"]}))
    cls = {}
    for mid, v in smoke["verdict"].items():
        j = why(smoke["results"], mid)
        cls[mid] = ("deprecated" if "has been deprecated" in j else
                    "wrong_api" if ("not a chat model" in j
                                    or "only supported in v1/responses" in j) else
                    "untested" if "must be less than or equal" in j else
                    "no_logprobs")
    for mid, v in top5["verdict"].items():
        cls[mid] = "usable" if v.get("usable") else cls.get(mid, "no_logprobs")
    assert cls.get("gpt-5.6-luna") == "no_logprobs", cls.get("gpt-5.6-luna")
    assert len(cls) == 41, len(cls)
    assert sum(c == "usable" for c in cls.values()) == 3, cls
    # the trap worth printing: 8 IDs read as "no logprobs" under our own top_logprobs: 20, and
    # three of them turned out to be usable at 5. The other five were never retried.
    assert sum(c == "untested" for c in cls.values()) == 5, cls

    counts = {}
    for c in cls.values():
        counts[c] = counts.get(c, 0) + 1
    census = {"n_ids": len(cls), "counts": counts,
              "untested": sorted(m for m, c in cls.items() if c == "untested"),
              "src": SM,
              "note": "41 model IDs, the GPT-5 line and the 5.6 tiers, probed once each for less than "
                      "0.01 USD. Reasoning-first models refuse log-probabilities outright; the "
                      "pro tiers answer only on a different endpoint. Five IDs are listed as "
                      "untested because they were rejected by our own top_logprobs: 20 and never "
                      "retried at 5 -- the same mistake that first hid three usable models."}
    return {"list": ml, "census": census,
            "note": "Prices are the constants this project's estimators use, in USD per million "
                    "tokens; check them against the provider's current price list before "
                    "trusting a total. Capability is measured, and it decides the menu: a model "
                    "that will not return log-probabilities cannot run this protocol at any "
                    "price."}


def protocol(s):
    """The seven protocol choices of `tab:choices`, each with the reading the main protocol takes
    and the alternative the paper examines.

    This table is the paper's evaluation contribution stated as a list, so the page shows all
    seven. Six of them also appear in the verdict sweep; the seventh, the content proxies, is
    checked by validity tests rather than by re-reading verdicts, and says so instead of
    borrowing a number from a neighbour.
    """
    i = s.index("\\label{tab:choices}")
    body = s[i:s.index("\\end{tabular*}", i)]
    out = []
    for cell in body.split("\\\\"):
        parts = [c.strip() for c in cell.split("&")]
        if len(parts) != 3:
            continue
        name = plain(re.sub(r"\\(midrule|toprule|addlinespace)(\[[^\]]*\])?", " ", parts[0]))
        if not name.startswith("\\textbf{") and "Protocol choice" in name:
            continue
        name = plain(name)
        if not name or name.startswith("Protocol choice"):
            continue
        out.append({"choice": name,
                    "reading": plain(parts[1]).rstrip("."),
                    "alternative": plain(parts[2]).rstrip(".")})
    assert len(out) == 7, [o["choice"] for o in out]
    # join to the verdict sweep: six choices are re-read as verdicts, the content proxies are
    # validated instead, so that row carries no sweep number and must say so
    eff = {c["choice"]: c for c in parse_choices(s)}
    for o in out:
        o["effect"] = eff.get(o["choice"])
    missing = [o["choice"] for o in out if o["effect"] is None]
    assert missing == ["Content proxies"], missing
    return out


def rows(s, label, ncols, stop=None):
    """the `name & c1 & ... & cn \\\\` rows of the tabular that ends at \\label{label}"""
    i = s.index("\\label{" + label + "}")
    body = s[s.rindex("\\begin{tabular}", 0, i):i]
    out = []
    for line in body.replace("\n", " ").split("\\\\"):
        parts = [c.strip() for c in line.split("&")]
        if len(parts) != ncols + 1:
            continue
        name = re.sub(r"\\(midrule|bottomrule|toprule|addlinespace)(\[[^\]]*\])?", " ", parts[0])
        name = re.sub(r"\\(rowcolor|multirow)\{[^}]*\}(\{[^}]*\})?|\\sacc\{\}|\\quad|\\textsc\{|\}",
                      lambda m: "SACC" if "sacc" in m.group(0) else "", name).strip()
        name = plain(name)
        if not name or name.startswith("\\") or "rule" == name:
            if not name:
                continue
        cells = [clean(re.sub(r"\\,\{?\\scriptsize\[[^\]]*\]\}?", "", c)) for c in parts[1:]]
        cells = [plain(c) if isinstance(c, str) else c for c in cells]
        if all(isinstance(c, str) and not c for c in cells):
            continue
        out.append([name] + cells)
    return out


def ablation(s):
    r = rows(s, "tab:ablmain", 5)
    r = [x for x in r if isinstance(x[2], float)]
    out = [{"change": x[0], "at": x[1], "dL_medqa": x[2], "dU_medqa": x[3],
            "dL_tab": x[4], "dU_tab": x[5]} for x in r]
    assert len(out) == 5, [o["change"] for o in out]
    top = max(out, key=lambda o: o["dL_medqa"])
    assert top["change"].startswith("Closure over binding"), \
        f"the paper says the privacy gain sits in closure; largest is {top['change']}"
    assert max(abs(o["dL_medqa"]) for o in out if "person rule" in o["change"]) <= .011, \
        "the scope rules are claimed to move no measure"
    return out


def increment(s):
    r = rows(s, "tab:increment", 3)
    out = [{"corpus": x[0], "gpt4omini": x[1], "llama": x[2], "qwen": x[3]}
           for x in r if x[0] in ("MedQA", "TAB")]
    assert len(out) == 2, out
    tab = [o for o in out if o["corpus"] == "TAB"][0]
    assert tab["llama"] < 0 < tab["qwen"], \
        "the paper reports the rewriting gain reversing under Llama on TAB"
    return out


def unseen(s):
    r = [x for x in rows(s, "tab:unseen", 6) if isinstance(x[1], float)]
    out = [{"system": x[0], "bio_L": x[1], "bio_disc": x[2], "bio_edit": x[3],
            "plot_L": x[4], "plot_disc": x[5], "plot_edit": x[6]} for x in r]
    assert len(out) == 5, [o["system"] for o in out]
    g = {o["system"]: o for o in out}
    assert g["Global ladder"]["bio_L"] < g["SACC"]["bio_L"] and \
           g["Global ladder"]["plot_L"] < g["SACC"]["plot_L"], \
        "the paper reports the ladder leaking less on both unseen corpora"
    assert g["SACC"]["bio_edit"] == min(o["bio_edit"] for o in out if o["bio_edit"] > 0), \
        "SACC is reported as editing the fewest characters"
    return out


def human(s):
    r = [x for x in rows(s, "tab:human", 6) if isinstance(x[1], float)]
    out = [{"system": x[0], "facts": x[1], "grammar": x[4]} for x in r if "SACC" in x[0]
           or "ladder" in x[0]]
    assert len(out) >= 3, out
    g = {o["system"]: o for o in out}
    assert g["SACC"]["grammar"] < g["SACC-mask"]["grammar"], \
        "the paper reports SACC failing its grammar test against SACC-mask"
    assert g["SACC"]["facts"] > g["Global ladder"]["facts"]
    return out


def task(s):
    r = [x for x in rows(s, "tab:downstream", 4) if isinstance(x[1], float)]
    out = [{"text": x[0], "accuracy": x[1]} for x in r]
    g = {o["text"]: o["accuracy"] for o in out}
    assert g["SACC"] == g["Anonymised input"], \
        "the paper reports the exam accuracy unchanged by SACC"
    return out


def judges(s):
    r = rows(s, "tab:judgev2", 7)
    out = [{"judge": x[0], "facts_input": x[1], "facts_mask": x[2], "facts_sacc": x[3],
            "fault_input": x[4], "fault_mask": x[5], "fault_sacc": x[6],
            "control": x[7]} for x in r if isinstance(x[1], float)]
    assert len(out) == 3 and sum("fails" in o["control"] for o in out) == 2, out
    return out


def subjectpos(s):
    i = s.index("\\label{tab:subjectpos}")
    body = s[s.rindex("\\begin{tabular}", 0, i):i]
    out = []
    for line in body.replace("\n", " ").split("\\\\"):
        m = re.match(r"\s*(?:\\rowcolor\{oursrow\})?([A-Za-z\\][^&]*?)\s*&\s*"
                     r"\.(\d+)\\,\{\\scriptsize", line)
        if not m:
            continue
        name = re.sub(r"\\(midrule|bottomrule)", " ", m.group(1))
        name = name.replace("\\sacc{}", "SACC").strip()
        nums = re.findall(r"&\s*\.(\d{3})\s*(?=&)", line + " &")
        out.append({"system": name, "auc_first_named": float("." + m.group(2)),
                    "auc_others": float("." + nums[-2]) if len(nums) >= 2 else None})
    assert out and out[0]["auc_first_named"] > .95, out[:2]
    return out


def checklist(s):
    i = s.index("\\label{sec:recs}")
    body = s[i:s.index("\\section{Conclusion}")]
    items = re.findall(r"\\textbf\{([^}]+)\}: (.+?)(?=\s\\textbf\{|\Z)", body, re.S)
    out = [{"what": a, "do": " ".join(re.sub(r"\\[a-zA-Z]+\{?|\}|\$|~", " ", b).split())[:300]}
           for a, b in items]
    assert len(out) == 4, [o["what"] for o in out]
    return out


def main():
    sys.path.insert(0, f"{SP}/scripts")
    s = tex()
    ab = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", s, re.S).group(1)
    med, tb = parse_x1(s)
    ra = re.search(r"from \.252 to \.769.*?\$L\$ rises by \.414 \(\$\[\+\.374,\+\.454\]\$", s, re.S)
    data = {
        "source": "parsed from sacc_eval.tex; cue layer from the frozen editor code",
        "title": "Residual Attribute Leakage Is an Interface",
        "abstract_words": len(re.sub(r"\\[a-zA-Z]+\{?|\}|\$", "", ab).split()),
        "x1_medqa": med, "x1_tab": tb,
        "readings": parse_readings(s),
        "choices": parse_choices(s), "protocol": protocol(s),
        "example": parse_example(s),
        "rule_aware": {"entries": 1513, "p_untold": .252, "p_told": .769,
                       "dL": .414, "ci": [.374, .454], "found_in_tex": bool(ra)},
        "ablation": ablation(s), "increment": increment(s), "unseen": unseen(s),
        "human": human(s), "task": task(s), "judges": judges(s),
        "subjectpos": subjectpos(s), "checklist": checklist(s),
        "cue": cue_layer(), "models": models(),
    }
    assert data["rule_aware"]["found_in_tex"], "the rule-aware numbers are no longer in the paper"

    # Gate: nothing that reaches the page may still be LaTeX. A dagger footnote and a math-mode
    # minus reached it once, and on a page that carries neither the footnote nor the column they
    # read as a typesetting error. The cue layer is exempt: those strings are regexes by design.
    PATTERN_PATHS = (".cue.keep", ".cue.lexicon")
    # a lone caret or tilde is the residue of a stripped math-mode mark, and reads as a typo
    tex_re = re.compile(r"\\[a-zA-Z]+|\$|\^|~|\\textbf|\\dagger")
    leaks = []

    def walk(x, path=""):
        if isinstance(x, dict):
            for k, v in x.items():
                walk(v, f"{path}.{k}")
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk(v, f"{path}[{i}]")
        elif isinstance(x, str) and not path.startswith(PATTERN_PATHS) and tex_re.search(x):
            leaks.append((path, x[:80]))

    walk(data)
    assert not leaks, "LaTeX reached the page: " + "; ".join(f"{p} = {v}" for p, v in leaks)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT + ".tmp", "w"), indent=1)
    os.replace(OUT + ".tmp", OUT)
    print(f"written {OUT}  ({os.path.getsize(OUT)/1000:.1f} kB)")
    print(f"  abstract {data['abstract_words']} words; 8 releases, "
          f"{len(data['readings'])} readings, {len(data['protocol'])} protocol choices "
          f"({len(data['choices'])} with a verdict sweep), "
          f"{len(data['example'])} example texts")
    print("  gates passed: Rk reproduced from AUC; SWAP lowest MedQA L; only the adversary "
          "reverses;\n    closure is the largest ablation gain; the scope rules move nothing; "
          "the rewriting gain\n    reverses under Llama on TAB; the ladder leaks less on both "
          "unseen corpora; SACC edits the\n    fewest characters; SACC loses its grammar test; "
          "the exam accuracy is unchanged; 2 of 3\n    judges fail their control")
    for r in data["readings"]:
        print(f"    {r['reading']:22s} SWAP {r['swap']:>7} vs SACC-mask {r['saccmask']:>7} "
              f"-> SWAP ranks {r['rank_medqa']}/8")


if __name__ == "__main__":
    main()
