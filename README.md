# Residual Attribute Leakage Is an Interface

### Auditing Privacy Evaluation After Text De-identification

Companion repository for the paper. **Interactive version of every figure and table, and the
protocol runnable on your own text: <https://tuanthanh-02.github.io/residual-attribute-leakage/>**

---

A privacy evaluation of de-identified text asks a language model — the *adversary* — to guess a
person's protected attribute. The paper introduces a prior-normalised clipped leakage score of the
adversary's confidence gain on the true value, and audits the conclusions drawn from it.

Each verdict depends on an **evaluation interface**: the queried person, the answer options, the
prior, the adversary model and the scoring rule. We vary those on fixed releases of three corpora
and ask whether the verdict survives.

## The problem, in one example

A hospital wants to release a case note, so it removes the name:

> `[PERSON] is a 54-year-old patient. **She** came to the clinic with **her husband**.`

The name is gone. The sex is not. *She* and *her husband* still state it, and a language model
asked "what is this person's sex?" answers correctly with near-certainty. Those leftover words are
**residual cues**, and what they give away is **residual attribute leakage**. Measuring it is what
this line of work does: you hand a model the released text, ask it about a person, and see how
much more confident it becomes about something it was not supposed to learn.

Now consider an editor that does not delete those words but **swaps** them:

> `[PERSON] is a 54-year-old patient. **He** came to the clinic with **his wife**.`

The reader is now confidently *wrong*. Is that privacy? Under a score that only asks how confident
the reader is in the **true** value, it looks like the best protection of the lot — better than
deleting the words, because a reader who believes a falsehood has no confidence left in the truth.
Nothing was hidden; the reader was misdirected, and a rule anyone can guess undoes it.

That is the failure this paper is about, and the rest follows from it: if a privacy number can be
won by lying rather than by removing, what else does that number depend on?

## Terms used here

| term | what it means |
|---|---|
| **de-identification** | removing direct identifiers — names, dates, places — from a document |
| **residual cue** | a word left behind that still states a protected attribute, such as *she* or *her husband* |
| **release** | one version of the document after some editor has acted on it; the paper compares eight |
| **adversary** | the language model that is asked to guess the attribute; it stands in for whoever might read the released text |
| **prior (π)** | how well the adversary guesses with *no text at all* — the baseline it must beat before the text can be blamed |
| **leakage (L)** | how much the text raised the adversary's confidence in the true value, above the prior, floored at zero |
| **entry** | one person paired with one attribute, for example *this patient × sex*; the unit everything is counted over |
| **protocol** | the choices that turn those pieces into a number: who is asked about, which options are offered, which model reads, how the score is computed |

## What the paper shows

**A clipped leakage score rewards misdirection.** SWAP, a deliberately invertible counterexample,
writes the opposite-sex form at exactly the spans a redaction editor would redact. It misleads the
adversary on 74% of its MedQA `Sex` entries, and still ranks **1 of 8**
under the score, at `L` = .536. Attack accuracy and proper scoring rules read as privacy
rank it first too. Crediting only the increase above a document-free prior charges a release for
what it adds; the risk is the other half, where a drop below the prior costs nothing.

**Two readings are not fooled.** A relabelling-invariant reading of AUC puts the same editor
**6th of 8**, and `Disclosing`, which counts movement in either direction,
also declines to credit it. Because SWAP's rule is fixed and invertible, it admits a direct test:
told the rule, the development adversary's mean probability on the true value rises from
.252 to .769, and `L` rises by .414
[.374, .454]. The clip's zero is an artefact of the score, not evidence
that the attribute was erased.

**On ordinary releases, the interface mostly moves certainty, not direction.** Over all pairs of
released texts, most changed verdicts are gains or losses of separability. Of six choices varied
over every pair, only the adversary family reverses comparisons — 5 of its
124 changes — and the query can target the wrong person.

**The audit yields a reporting checklist.** Four things belong beside any leakage score:

- **Score.** report L with two-sided displacement and, where applicable, AUC, and explain any disagreement (e.g., SWAP, Table tab:x1 ); where an editor's rule is public, run a rule-aware adversary too.
- **Reference and cohort.** give paraphrasing and in-place editors the same reference, and report first-named and other subjects separately.
- **Adversary and abstention.** report every adversary used, including any that reverses a result, say whether it knows the editing rule, and report both conventions for declined answers.
- **Uncertainty and content.** separate reversals from changes in separability, give each non-separable comparison's minimum detectable difference, and validate content measures.

**SACC is the instrument, not the claim.** Scoped Attribute-Cue Closure is a traceable editor
built so that every edit is attributable to a rule. That is what makes SWAP constructible at
precisely the spans another editor would redact, and what allows two editing principles to be
ablated one at a time. The paper reports where its advantage does not hold.

## The seven protocol choices

| | choice | the reading the main protocol takes | the alternative examined |
|---|---|---|---|
| 1 | **Wrong-belief credit** | Clipping floors negative changes in gold-value confidence at zero leakage | Signed residual; three outcome states with Leaking and Disclosing |
| 2 | **Subject reference** | References depend on each editor's output | Match references across editors or derive one from the input |
| 3 | **Candidate order** | Seeded orders retain a positional bias in π | Balance gold-first and gold-second orders for Sex; report AUC alongside L |
| 4 | **Which subject is read** | Aggregate all annotated subjects | Split by subject position and exclude shared references |
| 5 | **Content proxies** | Accept U_nli, TPS and LLM judgments without validity checks | Check placeholder effects, a second encoder and judgments on the anonymised input |
| 6 | **Adversary family** | Evaluate with one development adversary | Compare three model families and consider the worst case |
| 7 | **Abstention** | Declined answers are dropped or assigned the prior without an explicit rule | State the convention and report both readings |

Six are re-read as verdicts over every pair of releases; the content proxies are validated by
judge controls instead, and two of three judges fail their own control.

## Setup

**Corpora.** 1,249 MedQA clinical vignettes, 144 TAB court judgments with per-person annotations,
and 281 SynthPAI posts. A protected *entry* pairs a person with an attribute and a gold value:
`Sex` and `Occupation` on MedQA and TAB, `Relationship` on SynthPAI.

**Scorer.** A multiple-choice adversary is asked, for a named person, which value an attribute
takes. The first token is read at temperature 0, the mass on the option letters is renormalised,
and leakage is `L = clip((p − π) / (1 − π), 0, 1)` against a document-free prior π, averaged over
balanced candidate orders. The band δ = .05 separates *Leaking*, *Anonymised* and *Misled*.

**Adversaries.** All headline numbers are frozen on one development adversary. Other families are
confirmation readings: they have their own priors, so a contrast's direction and size transfer,
its level does not.

## This repository

    index.html      the paper's results, every figure read from the manuscript
    analyse.html    the protocol, run on a sentence you write
    app.js app.css  the pages
    data.json       every number on the site
    tools/          the generator that writes data.json

`data.json` is produced by `tools/make_demo_data.py`, which parses the manuscript's tables and
exports the frozen cue layer. It refuses to write the file if any of its checks against the
printed numbers fail — among them that the `|AUC-.5|` ranking recomputed from the table's own AUC
column reproduces the printed ranks, and that no string reaching the page still contains LaTeX.

    python tools/make_demo_data.py data.json      # runs in the research tree

## Citation

The paper is under review; this repository will carry the citation once it is published.
