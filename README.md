# Residual Attribute Leakage Is an Interface

Interactive companion to the paper

> **Residual Attribute Leakage Is an Interface: Auditing Privacy Evaluation After Text
> De-identification**

**Demo: <https://tuanthanh-02.github.io/residual-attribute-leakage/>**

A privacy verdict for a fixed de-identified text changes with how it is scored, who the scorer
asks about, and which adversary reads it. This repository holds a two-page site that shows that
on the paper's own numbers, and then lets you run the same protocol on a sentence of your own.

The point it is built around: an editor that writes the **opposite-sex form at exactly the spans a
redaction editor would redact** misleads the adversary about most people, yet ranks *first* among
eight releases under a clipped leakage score. A reading that scores only the answer about the true
value cannot tell information removal from confident misdirection.

| page | what it holds |
|---|---|
| `index.html` | **Results** — eight readings over one fixed release set, the same releases on a second corpus, the seven protocol choices, who the scorer asks about, what each editing principle contributes, and the reporting checklist |
| `analyse.html` | **Demo app** — the whole protocol run on a sentence you write: inference, five releases, the adversary's prior and posterior, the per-order split, an opt-in rule-aware pass, and the cue layer on its own |

No build step, no dependencies, no backend. An API key is needed only if you choose to run the
adversary yourself, and nothing is sent until you press Run.

## Run it locally

    python3 -m http.server 8000

Then open <http://localhost:8000/>. Opening `index.html` from disk will not work: the browser
blocks the `fetch` of `data.json` on `file://`, and the page says so if that happens.

## What is in the repository

    index.html      the results page
    analyse.html    the end-to-end demo app
    app.js          both pages; the protocol, the cue layer and the inference
    app.css         one stylesheet
    data.json       every number on the site, generated from the manuscript
    tools/          the generator that writes data.json
    .nojekyll       so GitHub Pages serves the files as they are

## Where the numbers come from

`data.json` is written by `tools/make_demo_data.py`, which parses the manuscript's own tables and
exports the cue layer (lexicons, the rewrite table, the 17-form flip map, the keep-list) from the
frozen editor code, because the page has to run it on text the paper never saw.

The generator refuses to write the file if any of its checks fail, so the site cannot drift away
from the paper. Among them: the `|AUC-.5|` ranking recomputed from the table's own AUC column must
reproduce the printed ranks; the misdirecting release must still hold the lowest MedQA `L`; only
the adversary row may contain reversals; closure must remain the largest ablation gain; the
editor must still edit the fewest characters on the unseen corpora; two of three judges must still
fail their own control; and no string reaching the page may still contain LaTeX.

It reads the paper source and the frozen method package, so it runs in the research tree rather
than in a clone of this repository; it takes the output path as its first argument and is included
here for provenance:

    python make_demo_data.py /path/to/this/repo/data.json

## The seven protocol choices

The paper's evaluation contribution stated as a list: the choices an attribute-inference
evaluation has to make. The releases are held fixed and re-read under the alternative.

| | choice | the reading the main protocol takes | effect |
|---|---|---|---|
| 1 | Wrong-belief credit | Clipping floors negative changes in gold-value confidence at zero leakage | 11/84 verdicts changed |
| 2 | Subject reference | References depend on each editor's output | 3/45 verdicts changed |
| 3 | Candidate order | Seeded orders retain a positional bias in π | 13/252 verdicts changed |
| 4 | Which subject is read | Aggregate all annotated subjects | 4/28 verdicts changed |
| 5 | Content proxies | Accept U_nli, TPS and LLM judgments without validity checks | validated, not swept |
| 6 | Adversary family | Evaluate with one development adversary | 124/504 verdicts changed |
| 7 | Abstention | Declined answers are dropped or assigned the prior without an explicit rule | 6/75 verdicts changed |

Six are re-read as verdicts over every pair of releases. The seventh is validated by judge
controls instead, and its row says so rather than borrowing a number from a neighbour.

## Which adversary, and what a run costs

Capability decides this list and price only orders it: a model that will not return
log-probabilities cannot run the protocol at any price. Every model here was measured, and the
rates are the constants this project's own cost estimators use.

| model | USD per 1M in / out | transport | option letters it can score | evidence |
|---|---|---|---|---|
| `gpt-4o-mini` **(recommended)** | 0.15 / 0.60 | frozen | 8 | a full pass |
| `gpt-4.1-mini` | 0.40 / 1.60 | frozen | 8 | smoke test |
| `gpt-5.4-nano` | 0.20 / 1.25 | top-5 | 2 | a full pass |
| `gpt-5.1` | 1.25 / 10.00 | top-5 | 2 | smoke test |
| `gpt-5.2` | 1.75 / 14.00 | top-5 | 2 | smoke test |

Of the 41 model IDs probed once each, 16 refuse log-probabilities
outright, 8 answer only on another endpoint, 9 are
deprecated and 5 were rejected by our own `top_logprobs: 20` and never retried
at 5 — reported as untested rather than unusable, because that is all the measurement supports.

The 5-series needs a different payload and returns mass for fewer letters, so the app refuses to
score an attribute with more candidate values than the model can carry, rather than returning a
probability that is an artefact of a truncated list. A run of the five releases costs a small
fraction of a cent; the call count and both cost estimates are shown before anything is sent.

Only the recommended model is the paper's: the published figures are frozen on it. A reading from
another family has its own priors and confirms or fails to confirm a claim rather than reproducing
a number.

## The sample passages

The four starting passages are the length of a real record. Each was run against the development
adversary before it was put in the page, and on all four the misdirecting release takes the best
clipped `L` while writing the opposite-sex form. They were chosen by measurement, and the
candidates that did not reproduce it were dropped — which is why a demo is an illustration and not
evidence.

## Using your own key

The key stays in the page, in memory, and goes only to the provider's endpoint; the page writes
nothing to storage. A key typed into any web page is readable by that page, so use a restricted
key and revoke it afterwards. Your text is sent to the provider, so do not paste real personal or
patient data. *Show requests* renders everything that would be sent without sending it.

Whether a browser may call the provider directly depends on that provider's cross-origin policy;
if it refuses, the page says so, and the released code runs the same protocol offline.

## Scope, and what this is not

The browser runs the cue layer and a surface agreement pass. The released editor adds a binder
that reads a dependency parse to decide whom each cue describes, and repairs agreement from that
parse; neither can run in a browser, so the arms here are *global* ones and the non-person rule is
the closest scope arm available. SACC's own releases are on the results page.

De-identification in the page stands in for the tagger the released pipeline uses, and the
occupation candidates are a demo set rather than the annotation strata. The misdirecting release
is an evaluation construct, distributed as evaluation code and not as an anonymiser.
