"use strict";
const $ = s => document.querySelector(s);
const el = (t, a = {}, h = "") => { const n = document.createElement(t);
  for (const k in a) n.setAttribute(k, a[k]); if (h) n.innerHTML = h; return n; };
/* Precision is per page, because the two pages answer to different things.
   The results page prints what the manuscript prints: the stored value's own digits, three
   places and four where the paper states four (the sweep's median |dL| is .0003 on one choice
   and .0084 on another). Padding those to a fixed width would invent precision, and cutting
   them to two would erase the one comparison that column exists to make.
   The demo app prints two places, which is what a single sentence supports; a quantity that is
   not zero is still never shown as ".00". */
const onApp = () => (document.body && document.body.dataset.page) === "analyse";

const fmt = v => {
  if (typeof v !== "number" || !isFinite(v)) return String(v);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  // Plain two places on the app. Nothing here needs a third digit: a Brier of 1e-24 is zero to
  // any reader, and the one place where "small but not zero" matters is the probability column,
  // which prints <.01 and >.99 at the ends and carries the exact value in its title.
  if (onApp()) return v.toFixed(2).replace(/^(-?)0\./, "$1.");
  const r = parseFloat(v.toFixed(4));                 // drop binary-float noise, keep the digits
  if (v !== 0 && r === 0) return v.toExponential(1);  // never show a real quantity as zero
  const dec = (String(r).split(".")[1] || "").length;
  return r.toFixed(Math.min(4, Math.max(3, dec))).replace(/^(-?)0\./, "$1.");
};

const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
let D = null;
const S = { reading: 0, editor: 0, op: 0, told: false };

/* ---------------------------------------------------- readings over the eight releases */
const FULL = { "L": r => r.L, "Leaking": r => r.leak, "Disclosing": r => r.disc,
               "|AUC-.5|": r => Math.abs(r.auc - .5) };
const DESC = {
  "L": "Prior-normalised confidence gain on the true value, clipped at zero.",
  "Signed residual": "The same residual without the clip, so a drop below the prior counts.",
  "Leaking": "Share of entries whose confidence rose past the prior by more than the band.",
  "Attack accuracy": "Share of entries the adversary answers correctly.",
  "Brier score": "A proper scoring rule on the true value.",
  "Log loss": "The adversary's surprise at the true value, in nats.",
  "Disclosing": "Share of entries moved in either direction, so misdirection counts too.",
  "|AUC-.5|": "Distance from chance, unchanged when the two labels are exchanged."
};

function board() {
  const rd = D.readings[S.reading], f = FULL[rd.reading], host = $("#board");
  host.innerHTML = "";
  if (f) {
    const rows = D.x1_medqa.map(r => ({ ...r, v: f(r) }))
      .sort((a, b) => rd.better_when === "higher" ? b.v - a.v : a.v - b.v);
    const max = Math.max(...rows.map(r => r.v)) || 1;
    rows.forEach((r, i) => {
      const sw = /^SWAP/.test(r.system);
      host.append(el("div", { class: "row" + (sw ? " flag" : "") }, `
        <span class="pos">${i + 1}</span>
        <span class="nm"><b>${esc(r.system.replace(/ \(.*/, ""))}</b>
          ${sw ? '<span class="tag">evaluation construct</span>' : ""}</span>
        <span class="val">${fmt(r.v)}</span>
        <span class="track"><i style="width:${Math.max(2, 100 * r.v / max)}%"></i></span>`));
    });
    host.append(el("p", { class: "note" },
      `Printed for all eight releases. SWAP ranks <b>${rd.rank_medqa} of 8</b>.`));
  } else {
    // The paper prints these readings for two releases only. The other six keep their row and
    // show a dash: an absent number is stated, never guessed, and the board stays eight rows
    // tall so switching the reading does not move everything below it.
    const max = Math.max(Math.abs(rd.swap), Math.abs(rd.saccmask)) || 1;
    const have = { SWAP: rd.swap, "SACC-mask": rd.saccmask };
    D.x1_medqa.forEach(r => {
      const nm = r.system.replace(/ \(.*/, ""), sw = /^SWAP/.test(nm);
      const key = sw ? "SWAP" : nm;
      const v = have[key];
      const got = v !== undefined;
      host.append(el("div", { class: "row" + (sw ? " flag" : "") + (got ? "" : " muted") }, `
        <span class="pos">${sw ? rd.rank_medqa : ""}</span>
        <span class="nm"><b>${esc(nm)}</b>${sw
          ? '<span class="tag">evaluation construct</span>' : ""}</span>
        <span class="val">${got ? fmt(v) : "\u2014"}</span>
        <span class="track">${got
          ? `<i style="width:${Math.max(2, 100 * Math.abs(v) / max)}%"></i>` : ""}</span>`));
    });
    host.append(el("p", { class: "note" },
      `Printed for two releases; six carry a dash. SWAP ranks <b>${rd.rank_medqa} of 8</b>.`));
  }
  const first = rd.rank_medqa === 1;
  $("#verdict").className = "verdict " + (first ? "flagged" : "clean");
  $("#verdict").innerHTML = `<b>${DESC[rd.reading]}</b> ` + (first
    ? `Under it SWAP ranks <b>${rd.rank_medqa} of 8</b> — the most private release — although it
       writes the opposite-sex form at the spans redaction removes. A reading that scores only the
       answer about the true value cannot tell information removal from confident misdirection.`
    : `Under it SWAP ranks <b>${rd.rank_medqa} of 8</b>. This reading is not fooled: it
       ${rd.reading === "Disclosing" ? "charges movement in either direction"
         : "is invariant to exchanging the two labels"}, so misdirection buys nothing.`);
}

/* ---------------------------------------------------- the vignette, and recoverability */
function renderText() {
  $("#text").innerHTML = D.example[S.editor].html;
  const ra = D.rule_aware, p = S.told ? ra.p_told : ra.p_untold;
  $("#gbar").style.width = (p * 100).toFixed(1) + "%";
  $("#gval").textContent = fmt(p);
  $("#glab").textContent = S.told ? "told the swap rule" : "not told the rule";
  $("#sw").setAttribute("aria-checked", String(S.told));
  $("#rdetail").innerHTML = S.told
    ? `Mean probability on the true value over ${ra.entries.toLocaleString()} MedQA
       <b>Sex</b> entries, once the adversary is told the flip: <b>${fmt(ra.p_told)}</b>, up from
       ${fmt(ra.p_untold)}. The clipped score rises by ${fmt(ra.dL)}
       [${fmt(ra.ci[0])}, ${fmt(ra.ci[1])}]. The attribute was never removed — only the
       adversary's belief was turned around.`
    : `Reading the same text without knowing the rule, the adversary puts
       <b>${fmt(ra.p_untold)}</b> on the true value. Flip the switch.`;
}

/* ---------------------------------------------------- the interface sweep */
/* Two choices are examined by evidence the sweep cannot carry: the content proxies by judge
   controls, the adversary family by the same contrast under three families. Both tables are in
   the paper; without them those rows would assert a check instead of showing it. */
function extra(choice) {
  if (choice === "Content proxies") {
    return `<table class="mini" style="margin-top:8px"><tbody>
      <tr><td></td><td><b>judge</b></td><td class="n">facts kept, input</td>
        <td class="n">faulty, SACC</td><td><b>control</b></td></tr>
      ${D.judges.map(j => `<tr><td></td><td>${esc(j.judge)}</td>
        <td class="n">${fmt(j.facts_input)}</td><td class="n">${fmt(j.fault_sacc)}</td>
        <td${/fail/.test(j.control) ? ' style="color:var(--flag)"' : ""}>${esc(j.control)}</td>
        </tr>`).join("")}</tbody></table>
      <p style="margin:6px 0 0">${D.judges.filter(j => /fail/.test(j.control)).length} of
      ${D.judges.length} judges fail their own control — the unedited input is asked to keep most
      of its facts and to carry no more faults than the edited texts, and two do not deliver it.
      That is why the proxies are reported with the control beside them rather than as a score.</p>`;
  }
  if (choice === "Adversary family") {
    return `<table class="mini" style="margin-top:8px"><tbody>
      <tr><td></td><td><b>rewriting over masking</b></td><td class="n">gpt-4o-mini</td>
        <td class="n">Llama</td><td class="n">Qwen</td></tr>
      ${D.increment.map(r => `<tr><td></td><td>${esc(r.corpus)}</td>
        <td class="n">${fmt(r.gpt4omini)}</td><td class="n">${fmt(r.llama)}</td>
        <td class="n">${fmt(r.qwen)}</td></tr>`).join("")}</tbody></table>
      <p style="margin:6px 0 0">The same contrast, one scoring pass, three families. On TAB it is
      positive under two of them and negative under Llama: whether rewriting is more private than
      redaction there depends on who reads it.</p>`;
  }
  return "";
}

function sweep() {
  const tb = $("#choices tbody"); tb.innerHTML = "";
  // All seven choices the paper names, in its own order. Six carry a verdict sweep; the seventh
  // is checked for validity instead, so its cells are dashes and the detail row says why.
  (D.protocol || []).forEach((c, i) => {
    const e = c.effect;
    const p = n => (100 * n / e.n).toFixed(2) + "%";
    const tr = el("tr", { class: "click", tabindex: "0", "data-i": i }, `
      <td><b>${esc(c.choice)}</b></td>
      <td class="n">${e ? `${e.changed}/${e.n}` : "\u2014"}</td>
      <td>${e ? `<span class="stack">
        <i style="width:${p(e.reversals)};background:var(--flag)"></i>
        <i style="width:${p(e.gained)};background:var(--bar)"></i>
        <i style="width:${p(e.lost)};background:var(--bar2)"></i></span>`
        : `<span class="tag">validated, not swept</span>`}</td>
      <td class="n">${e ? (e.median_abs_dL === null ? "\u2014" : fmt(e.median_abs_dL))
                        : "\u2014"}</td>`);
    const det = el("tr", { class: "detail", hidden: "" }, `<td colspan="4">
      <b>Main protocol:</b> ${esc(c.reading)}. <b>Alternative:</b> ${esc(c.alternative)}.<br>
      ${e ? `${e.reversals ? `<b>${e.reversals} reversal${e.reversals > 1 ? "s" : ""}</b> of
              direction, ` : "No reversal of direction. "}${e.gained} comparison${
              e.gained === 1 ? "" : "s"} gained separability and ${e.lost} lost it, out of ${e.n}
              read both ways. ${e.reversals
                ? "A reversal changes which release is judged more private."
                : "A change in separability changes how certain the comparison is, not its direction."}
              ${extra(c.choice)}`
        : `This choice is not a second reading of the same verdicts, so there is no sweep to
           report. It is examined by checking the proxies themselves:`}
      ${extra(c.choice)}</td>`);
    const go = () => { det.hidden = !det.hidden; };
    tr.onclick = go; tr.onkeydown = e2 => { if (e2.key === "Enter" || e2.key === " ")
      { e2.preventDefault(); go(); } };
    tb.append(tr, det);
  });
}

/* ------------------------------------------- the same releases on the second corpus
   The headline reading is MedQA's. TAB is where it is checked, and it does not reproduce:
   stating that is the point of showing it, so the rank is computed here rather than asserted. */
function tabBoard() {
  const tb = $("#tabboard tbody"); if (!tb) return;
  const rows = D.x1_tab.map(r => ({ ...r, nm: r.system.replace(/ \(.*/, "") }))
    .sort((a, b) => a.L - b.L);
  tb.innerHTML = rows.map((r, i) => {
    const sw = /^SWAP/.test(r.nm);
    return `<tr${sw ? ' class="flag"' : ""}><td>${i + 1}&nbsp;&nbsp;<b>${esc(r.nm)}</b>${
      sw ? ' <span class="tag">evaluation construct</span>' : ""}</td>
      <td class="n">${fmt(r.L)}</td><td class="n">${fmt(r.leak)}</td>
      <td class="n">${fmt(r.disc)}</td></tr>`;
  }).join("");
  const rank = rows.findIndex(r => /^SWAP/.test(r.nm)) + 1;
  const lower = rows.slice(0, rank - 1).map(r => r.nm);
  const med = D.x1_medqa.slice().sort((a, b) => a.L - b.L)
    .findIndex(r => /^SWAP/.test(r.system)) + 1;
  $("#tabnote").innerHTML = `Under L the misdirecting release ranks <b>${rank} of 8</b> here,
    against <b>${med} of 8</b> on MedQA${lower.length
      ? `: ${lower.map(esc).join(" and ")} leak less than it does on this corpus` : ""}. The
    counterexample is a demonstration that a reading <em>can</em> be fooled, not a claim that it is
    fooled everywhere; a single corpus would not have shown the difference.`;
}

/* ---------------------------------------------------- who the scorer asks about */
function person() {
  const host = $("#person-rows"); host.innerHTML = "";
  D.subjectpos.forEach(r => {
    if (r.auc_others === null) return;
    host.append(el("div", {}, `
      <div class="pair"><span class="nmw">${esc(r.system)}</span>
        <span class="track"><i style="width:${(r.auc_first_named * 100).toFixed(0)}%"></i></span>
        <span class="v">${fmt(r.auc_first_named)}</span></div>
      <div class="pair"><span class="nmw" style="color:var(--faint)">— other subjects</span>
        <span class="track"><i style="width:${(r.auc_others * 100).toFixed(0)}%;
          background:var(--bar2)"></i></span>
        <span class="v" style="color:var(--faint)">${fmt(r.auc_others)}</span></div>`));
  });
}

/* ---------------------------------------------------- what the editor buys */
function editorCards() {
  const ab = {}; D.ablation.forEach(a => ab[a.change] = a);
  const cl = ab["Closure over binding only"], rw = ab["Admissible rewriting"];
  const hu = {}; D.human.forEach(h => hu[h.system] = h);
  const tk = {}; D.task.forEach(t => tk[t.text] = t.accuracy);
  const un = {}; D.unseen.forEach(u => un[u.system] = u);
  $("#edcards").innerHTML = `
    <div class="card"><h3>Closure</h3><span class="big">+${fmt(cl.dL_medqa)} / +${fmt(cl.dL_tab)}</span>
      <p>Editing a cue the binder cannot attribute, instead of leaving it, is where the privacy
      gain sits: leakage rises by this much on MedQA / TAB when closure is dropped.</p></div>
    <div class="card"><h3>Admissible rewriting</h3>
      <span class="big">+${fmt(rw.dL_medqa)} / +${fmt(rw.dL_tab)}</span>
      <p>Replacing a cue with a value-neutral counterpart beats redacting it, and keeps
      ${fmt(rw.dU_medqa)} more content on MedQA.</p></div>
    <div class="card"><h3>Human judgement</h3>
      <span class="big">+${fmt(hu["SACC"].facts - hu["Global ladder"].facts)} facts</span>
      <p>Blind annotators score it above the generalisation ladder on content
      (${hu["SACC"].facts} vs ${hu["Global ladder"].facts} of 2) and on grammar
      (${hu["SACC"].grammar} vs ${hu["Global ladder"].grammar} of 3).</p></div>
    <div class="card"><h3>Task accuracy</h3><span class="big">${(tk["SACC"] * 100).toFixed(1)}%</span>
      <p>Exam questions answered on the edited vignettes, identical to the
      ${(tk["Anonymised input"] * 100).toFixed(1)}% on the unedited input. The edits cost the
      clinical task nothing measurable.</p></div>
    <div class="card"><h3>Smallest footprint</h3>
      <span class="big">${un["SACC"].bio_edit}% / ${un["SACC"].plot_edit}%</span>
      <p>Characters changed on two corpora the editor had never seen — the fewest of any system
      there, while still lowering the input's leakage.</p></div>
    <div class="card"><h3>Traceable by construction</h3><span class="big">deterministic</span>
      <p>Every edit traces to the cue and rule that triggered it, which is what made the
      misdirection counterexample constructible at exactly the redaction sites.</p></div>`;
}

/* ---------------------------------------------------- the cue layer, live */
const keepCase = (src, out) => out && src[0] === src[0].toUpperCase()
  ? out[0].toUpperCase() + out.slice(1) : out;
const possessive = nxt => { const w = (nxt || "").toLowerCase();
  return !!w && /^[a-z]+$/.test(w) && !D.cue.her_objective_next.includes(w); };
// After a pronoun is rewritten to "they", the verb beside it still carries singular agreement.
// The released editor repairs this from the dependency parse; here a surface pass covers the
// adjacent verb, which is what a reader notices.
const AGREE = { has: "have", is: "are", was: "were", does: "do", goes: "go", hasn: "haven",
  wants: "want", needs: "need", comes: "come", seems: "seem", appears: "appear", reports: "report",
  denies: "deny", presents: "present", takes: "take", feels: "feel" };
const agree = t => t.replace(/\b([Tt]hey)(\s+)([a-z]+)\b/g,
  (m, p, sp, v) => AGREE[v] ? p + sp + AGREE[v] : m);

/* The four modes act on the SAME spans; only the replacement differs. That is the paper's
   construction in one panel, so each mode marks what it wrote rather than slipping it in as
   plain text, and says which rule it applied. */
/* The four modes act on the SAME spans; only the replacement differs. That is the paper's
   construction in one panel, so each mode marks what it wrote rather than slipping it in as
   plain text, and says which rule it applied.
   An op returns the text it wrote and what kind of edit that was. The kind matters: the flip map
   is 17 forms and the neutral map is not much larger, so a matched span they do not cover falls
   back to a redaction. Painting that as a flip would overstate the map's reach, so it is marked
   as what it is, and counted separately. */
const OPS = [
  ["Find cues", m => ({ t: m, kind: "find" }), "find",
   "The lexicon's matches, before any edit. Every mode beside this one acts on exactly these spans."],
  ["Redact", () => ({ t: "[REDACTED]", kind: "red" }), "red",
   "Each matched span becomes a placeholder. The reader loses the cue, and the sentence around it."],
  ["Neutralise", (m, nxt) => {
      const k = m.toLowerCase().replace(/\.$/, "");
      if (D.cue.titles.includes(k)) return { t: "", kind: "neu" };
      if (D.cue.kin_neutral[k]) return { t: keepCase(m, D.cue.kin_neutral[k]), kind: "neu" };
      if (k === "her") return { t: keepCase(m, possessive(nxt) ? "their" : "them"), kind: "neu" };
      const r = keepCase(m, D.cue.pronoun_map[k]);
      return r ? { t: r, kind: "neu" } : { t: "[REDACTED]", kind: "red" }; }, "neu",
   "Each span becomes a broader word that no longer states the sex, and the agreement is repaired."],
  ["Flip the sex cues", (m, nxt) => {
      const k = m.toLowerCase();
      if (k === "her") return { t: keepCase(m, possessive(nxt) ? "his" : "him"), kind: "flip" };
      if (k === "his") return { t: keepCase(m, possessive(nxt) ? "her" : "hers"), kind: "flip" };
      const r = keepCase(m, D.cue.swap[k]);
      return r ? { t: r, kind: "flip" } : { t: "[REDACTED]", kind: "red" }; }, "flip",
   "Each span becomes the opposite-sex form: the spans a redaction would remove, filled with a confident lie."]
];

function runCue() {
  const text = $("#inp").value, fn = OPS[S.op][1], hits = [];
  for (const p of Object.values(D.cue.lexicon)) {
    let re; try { re = new RegExp(p, "gi"); } catch (e) { continue; }
    let m; while ((m = re.exec(text))) {
      if (m[0].trim()) hits.push([m.index, m.index + m[0].length]);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = "", at = 0, n = 0, plain = "";
  const kinds = {};
  for (const [s, e] of hits) {
    if (s < at) continue;
    if (isKept(text.slice(s, e))) continue;      // the shared keep-list
    const nxt = (text.slice(e).match(/^\W*([A-Za-z]+)/) || [, ""])[1];
    const r = fn(text.slice(s, e), nxt);
    const tag = r.kind === "find" ? `<mark>${esc(r.t)}</mark>`
      : r.t ? `<span class="ed ${r.kind}">${esc(r.t)}</span>` : "";
    out += esc(text.slice(at, s)) + tag;
    plain += text.slice(at, s) + r.t;
    kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    at = e; n++;
  }
  const tail = text.slice(at);
  const fix = S.op === 2 ? agree : (x => x);
  const outEl = $("#out");
  outEl.className = "cue-" + OPS[S.op][2];
  outEl.innerHTML = fix(out + esc(tail));
  outEl.dataset.plain = fix(plain + tail).replace(/<[^>]*>/g, "");
  const rule = $("#cuerule");
  if (rule) rule.textContent = OPS[S.op][3];
  const NAME = { find: "found", red: "redacted", neu: "generalised", flip: "flipped" };
  const parts = Object.keys(kinds).map(k => `${kinds[k]} ${NAME[k]}`);
  $("#cnt").textContent = n === 0 ? "no cue in this text"
    : `${n} cue${n === 1 ? "" : "s"} \u00b7 ${parts.join(" \u00b7 ")}`;
  const miss = $("#cuemiss");
  if (miss) miss.innerHTML = (S.op > 1 && kinds.red)
    ? `<b>${kinds.red}</b> of these spans ${kinds.red === 1 ? "is" : "are"} not in the
       ${S.op === 3 ? `flip map (${Object.keys(D.cue.swap).length} forms)` : "neutral map"}, so
       ${kinds.red === 1 ? "it is" : "they are"} redacted instead. The map's reach is part of what
       the editor does, and it is visible here rather than hidden in the output.`
    : "";
}



/* ============================================================ inference, so nothing is typed twice
   The same frozen lexicons that find the cues also tell us which attribute the text states, what
   its value is, and what kind of document it is. Everything below is a guess the reader can
   override under "Adjust". */
const FEM = /\b(she|her|hers|herself|woman|women|girl|lady|ladies|mrs|ms|miss|mother|wife|daughter|sister|widow|aunt|niece|grandmother)\b/gi;
const MASC = /\b(he|him|his|himself|man|men|boy|gentleman|mr|father|husband|son|brother|widower|uncle|nephew|grandfather)\b/gi;
const REL = [[/\b(husband|wife|spouse|married|marriage)\b/i, "married"],
             [/\b(divorced?)\b/i, "divorced"], [/\bwidow(er)?\b/i, "widowed"],
             [/\b(single)\b/i, "single"], [/\b(partner|boyfriend|girlfriend)\b/i, "in a relationship"]];
const OCC = [[/\b(nurse|doctor|physician|surgeon|patient|clinic|hospital|midwife|paramedic|therapist|pharmacist)\b/i, "healthcare"],
             [/\b(lawyer|solicitor|barrister|attorney|judge|prosecutor|court|notary|magistrate|chambers)\b/i, "legal"],
             [/\b(teacher|professor|lecturer|school|university)\b/i, "education"],
             [/\b(engineer|developer|technician|analyst|architect)\b/i, "engineering"],
             [/\b(police|military|army|officer|minister|government|diplomat)\b/i, "public service"],
             [/\b(unemploy(ed|ment)|pension(er)?|retired?)\b/i, "unemployed"],
             [/\b(student)\b/i, "student"],
             [/\b(company|business|shop|retail|barista|chef|server)\b/i, "retail"]];
const DOMAINS = [[/\b(patient|clinic|hospital|physician|nurse|diagnos|symptom)\b/i, "a clinical case description"],
                 [/\b(court|applicant|judgment|tribunal|appeal|article)\b/i, "a court judgment"],
                 [/\b(post|comment|forum|thread|subreddit)\b/i, "a social-media post"]];

const count = (t, re) => (t.match(re) || []).length;

/* the subject's mention forms: capitalised tokens that are not sentence-initial or function words */
function guessSubject(text) {
  const out = [];
  text.replace(/\b([A-Z][a-z]{2,})\b/g, (m, w, off) => {
    const before = text.slice(0, off).trimEnd();
    const start = !before || (/[.!?]$/.test(before) && !/\b(Mr|Mrs|Ms|Dr|Prof|St)\.$/.test(before));
    if (!start && !NAME_STOP.has(w) && !out.includes(w)) out.push(w);
    return m;
  });
  const title = (text.match(/\b(Mr|Mrs|Ms|Miss|Dr)\.?\s+([A-Z][a-z]+)/) || [])[0];
  return title || out.join(" ");
}

/* Sex evidence that belongs to the person the text is about: pronouns, titles and sex nouns.
   A kinship term like "my wife" states the SPOUSE's sex, not the author's — deciding whose
   attribute a cue states is the binder's job, and the binder is not in the browser. So when the
   only sex-marked words are relational, the attribute read is the relationship instead. */
const FEM_SELF = /\b(she|her|hers|herself|woman|women|girl|lady|ladies|mrs|ms|miss)\b/gi;
const MASC_SELF = /\b(he|him|his|himself|man|men|boy|gentleman|mr)\b/gi;
const FIRST = /\b(i|me|my|mine|we|our)\b/i;

function inferAll(text) {
  const f = count(text, FEM_SELF), m = count(text, MASC_SELF);
  const fAll = count(text, FEM), mAll = count(text, MASC);
  const rel = REL.find(([re]) => re.test(text));
  const occ = OCC.find(([re]) => re.test(text));
  let attr = "SEX", gold = f >= m ? "female" : "male";
  let why = `${f} feminine and ${m} masculine cues for the subject`;
  if (!f && !m) {
    if (rel) { attr = "RELATIONSHIP"; gold = rel[1];
      why = fAll || mAll ? "the only sex-marked words describe a relative, so the relationship is "
                           + "the attribute read" : "a relationship term"; }
    else if (occ) { attr = "OCCUPATION"; gold = occ[1]; why = "a role word"; }
    else { gold = "female"; why = "no cue the lexicons cover, so this is only a default"; }
  }
  let dom = (DOMAINS.find(([re]) => re.test(text)) || [, null])[1];
  if (!dom) dom = FIRST.test(text) ? "a social-media post"
                                   : "a short description of a person";
  return { attr, gold, why, domain: dom, subject: guessSubject(text),
           cues: f + m + (rel ? 1 : 0) + (occ ? 1 : 0),
           rel: rel && rel[1], occ: occ && occ[1] };
}

/* ============================================================ the full protocol, on your text
   Prompts, payload and renormalisation are the scorer's own, reproduced from the paper:
     prior      Consider "{handle}", a person involved in {domain}. No further information is
                available.\nQuestion: What is their {attr}?\n{A. ...}\nAnswer with a single
                letter.\nAnswer:
     posterior  Text:\n{text}\n\nQuestion: Considering the person referred to as "{handle}" in
                the text, what is their {attr}?\n{A. ...}\nAnswer with a single letter.\nAnswer:
   One token at temperature 0 with the top 20 log-probabilities, mass kept on the option letters
   and renormalised over them; d = clip((p - pi)/(1 - pi), 0, 1); the band is .05.          */

/* Four passages, each the length of a real record rather than a line, and each measured
   against the development adversary before it was put here: on the first three the
   misdirecting release takes the best clipped L outright, which is the paper's finding
   reproduced on text it has never seen. The fourth is the other half of the argument,
   where redaction does work and a removal and a lie then score the same. */
const SAMPLES = [
  ["Clinical vignette",
   "Mrs. Alvarez is a 68-year-old retired schoolteacher who was brought to the clinic by her daughter after three days of breathlessness. She has been treated for hypertension since her forties, and her husband reports that she stopped her evening walks last winter. On examination the patient is alert and oriented, and she describes the chest tightness as worse when she lies flat. Her brother, who has a similar history, was admitted to the same hospital last year."],
  ["Court judgment",
   "The applicant, a widow who had worked as a theatre nurse before her retirement, told the court that she had lived alone since 2014. Her solicitor submitted that the local authority had failed to assess her needs, and her son gave evidence about the condition of the flat. The judge noted that the applicant had attended every hearing in person, and that her former employer had written in support of her account."],
  ["First-person post",
   "As a woman in my late thirties I never expected to be the one organising everything, but here we are. My husband took the early shift at the warehouse so I could keep the clinic appointments, and my sister drives over on Thursdays to sit with our mother. I still manage my own caseload at the firm three days a week, and most evenings I am too tired to cook."],
  ["Discharge summary",
   "The patient is a 45-year-old woman admitted via the emergency department with abdominal pain that she rated as severe on arrival. She was reviewed by the surgical registrar, who noted tenderness in the right lower quadrant, and her mother stayed with her overnight on the ward. She was discharged the following afternoon with oral analgesia and a clinic appointment, and she was advised to return if the pain recurred."]
];

const ATTRS = {
  SEX: { q: "sex", cands: ["male", "female"] },
  RELATIONSHIP: { q: "relationship status",
    cands: ["single", "married", "divorced", "widowed", "in a relationship"] },
  OCCUPATION: { q: "occupation",
    cands: ["healthcare", "legal", "education", "engineering", "retail", "public service",
            "unemployed", "student"] }
};
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DELTA = .05;
const NAME_STOP = new Set(["A","An","The","He","She","They","His","Her","Their","This","That",
  "I","It","We","You","Mr","Mrs","Ms","Miss","Dr","There","When","After","Before","On","In","At",
  "Her","Patient","Question","Which"]);

/* a stand-in for the upstream de-identifier: the released pipeline uses a tagger */
function deid(text) {
  return text.replace(/\b([A-Z][a-z]{2,})\b/g, (m, w, off) => {
    const before = text.slice(0, off).trimEnd();
    // a title's full stop is not a sentence end, or every name after "Ms." survives
    const sentenceStart = !before
      || (/[.!?]$/.test(before) && !/\b(Mr|Mrs|Ms|Dr|Prof|St)\.$/.test(before));
    return (sentenceStart || NAME_STOP.has(w)) ? m : "[PERSON]";
  });
}

/* The shared keep-list: occupation expressions with no truthful broader term. Every editor the
   paper compares leaves these in place, the global ones included, so the demo must too —
   redacting "patient" would over-edit against the released arms. */
const keptRe = () => { try { return new RegExp(D.cue.keep, "i"); } catch (e) { return null; } };
const isKept = w => { const r = keptRe(); return !!r && r.test(w.trim()); };

/* the non-person rule: a cue that names an institution rather than a person is left alone */
const isInstitution = w =>
  D.cue.institution.includes(w.trim().toLowerCase().replace(/^the\s+/, ""));

/* apply one cue operation to a text and return the plain string.
   scope: "global" edits every match; "nonperson" also applies the non-person rule */
function applyOp(text, opIndex, scope) {
  const fn = OPS[opIndex][1], hits = [];
  for (const p of Object.values(D.cue.lexicon)) {
    let re; try { re = new RegExp(p, "gi"); } catch (e) { continue; }
    let m; while ((m = re.exec(text))) {
      if (m[0].trim()) hits.push([m.index, m.index + m[0].length]);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = "", at = 0;
  for (const [a, b] of hits) {
    if (a < at) continue;
    const surf = text.slice(a, b);
    if (isKept(surf) || (scope === "nonperson" && isInstitution(surf))) continue;
    const nxt = (text.slice(b).match(/^\W*([A-Za-z]+)/) || [, ""])[1];
    out += text.slice(at, a) + fn(surf, nxt).t;   // the ops return {t, kind}; here only t matters
    at = b;
  }
  out += text.slice(at);
  if (opIndex === 2) out = agree(out);
  return out.replace(/[ \t]{2,}/g, " ").trim();   // dropping a title leaves a double space
}

/* the subject reference the scorer hands the adversary: the longest surviving mention of more
   than three characters that carries no cue; otherwise the single-subject fallback */
function reference(release, mention) {
  // A handle must carry no cue, or the question leaks the attribute it is asking about. Anchoring
  // the frozen patterns is not enough: the title pattern ends in a lookahead for whitespace, so
  // "^(?:...)$" never fires on "Mrs" and a sex-marked title would become the handle. Match on the
  // token plus a space and require the match to cover the whole token, and reject titles outright.
  const cueHit = w => {
    const low = w.toLowerCase().replace(/\.$/, "");
    if (D.cue.titles.includes(low)) return true;
    return Object.values(D.cue.lexicon).some(p => {
      try { const m = (w + " ").match(new RegExp(p, "i"));
        return !!m && m[0].trim().length === w.length; } catch (e) { return false; }
    });
  };
  const toks = (mention || "").split(/\s+/).filter(t => t.length > 3)
    .sort((a, b) => b.length - a.length);
  for (const t of toks) {
    const bare = t.replace(/[^A-Za-z-]/g, "");
    if (!bare || cueHit(bare)) continue;
    if (release.includes(bare)) return { handle: bare, kind: "surviving mention" };
  }
  return { handle: "the person this text is mainly about", kind: "single-subject fallback" };
}

const priorPrompt = (handle, domain, q, opts) =>
  `Consider "${handle}", a person involved in ${domain}. No further information is available.\n` +
  `Question: What is their ${q}?\n` +
  opts.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n") +
  `\nAnswer with a single letter.\nAnswer:`;
const postPrompt = (text, handle, q, opts, rule) =>
  (rule ? `The text below was edited by a known rule: ${rule}. Take the rule into account and answer with the person's true ${q}.

` : "") +
  `Text:\n${text}\n\nQuestion: Considering the person referred to as "${handle}" in the text, ` +
  `what is their ${q}?\n` + opts.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n") +
  `\nAnswer with a single letter.\nAnswer:`;

const ATTR_LEX = { SEX: ["pronoun", "title", "gendered_kin"],
                   RELATIONSHIP: ["kinship"], OCCUPATION: ["occ_role"] };

/* How many cues stating THIS attribute a text still carries.
   The editors here work off the sex cue layer: the ladder sends a kinship cue to "their spouse",
   which removes the sex but keeps the marriage, and the flip map is the paper's SWAP, 17 sex
   forms. So on a non-Sex attribute an edited release can still state the value in full, and the
   run would be scoring the input five times over. That has to be visible before it is paid for. */
function cuesLeft(text, attr) {
  let n = 0;
  for (const k of (ATTR_LEX[attr] || [])) {
    const pat = D.cue.lexicon[k]; if (!pat) continue;
    let re; try { re = new RegExp(pat, "gi"); } catch (e) { continue; }
    let m; while ((m = re.exec(text))) {
      if (m[0].trim() && !isKept(m[0])) n++;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return n;
}

function plan() {
  const raw = $("#pText").value.trim();
  const g = inferAll(raw);
  // The four fields are display when nobody has opted in, and input only after the tick. Reading
  // them unconditionally would let a stale value from a previous sentence override the new one.
  const own = (() => { const c = $("#ovr"); return !!(c && c.checked); })();
  const pick = (id, fallback) => { if (!own) return fallback;
    const n = $(id); const v = n && n.value && n.value.trim(); return v || fallback; };
  const attr = pick("#pAttr", g.attr), A = ATTRS[attr] || ATTRS.SEX;
  let gold = pick("#pGold", g.gold);
  if (!A.cands.includes(gold)) gold = A.cands.includes(g.gold) ? g.gold : A.cands[0];
  const domain = pick("#pDomain", g.domain);
  const mention = pick("#pSubject", g.subject);
  window.__guess = g;
  const input = deid(raw);
  // Paper names. Without the binder the browser can only build GLOBAL arms — every match edited,
  // whoever it describes — plus the non-person rule, which needs no parse. SACC's own scope rule
  // does, so SACC is not among these; its releases are on the Findings page.
    const q = A.q;
  const RULE = {
    none: `the names were removed and nothing else was changed`,
    mask: `every word that stated a person's ${q} was replaced with [REDACTED]`,
    ladder: `every word that stated a person's ${q} was replaced with a broader word that does ` +
            `not state it`,
    flip: `every word that stated a person's ${q} was replaced with the word for the opposite ` +
          `value, so "she" became "he", "husband" became "wife", and so on`
  };
  const releases = [
    { name: "Anonymised input", text: input, rule: RULE.none },
    { name: "Global mask", text: applyOp(input, 1, "global"), rule: RULE.mask },
    { name: "Global, rewritten", text: applyOp(input, 2, "global"), rule: RULE.ladder },
    { name: "Non-person rule", text: applyOp(input, 2, "nonperson"), note: "scope",
      rule: RULE.ladder },
    { name: "Flipped (misdirection)", text: applyOp(input, 3, "global"), flag: true,
      rule: RULE.flip }
  ];
  releases.forEach(r => { r.left = cuesLeft(r.text, attr); });
  // Two different failures, kept apart because they have different causes.
  // (a) The flip map is the paper's SWAP: 17 sex forms. It can only misdirect Sex. On any other
  //     attribute the flipped text still states the true value, so that arm is not a
  //     counterexample at all — a fact about the map, not about this sentence.
  // (b) A rewriting arm that leaves a cue of the chosen attribute standing has not removed it:
  //     the ladder sends a kinship cue to "their spouse", which drops the sex and keeps the
  //     marriage.
  const flipInert = attr !== "SEX";
  const stillStated = releases.slice(1, 4).filter(r => r.left > 0).map(r => r.name);
  // gold first, then gold second: the balanced reading the main tables use
  const gi = A.cands.indexOf(gold);
  const rest = A.cands.filter((_, i) => i !== gi);
  const orders = [[gold, ...rest], [...rest.slice(0, 1), gold, ...rest.slice(1)]];
  const ref = reference(releases[0].text, mention);
  const told = !!(($("#ruleaware") || {}).checked);
  const calls = orders.length * (1 + releases.length * (told ? 2 : 1));
  return { raw, input, releases, attr, A, gold, domain, orders, ref, calls, told, flipInert, stillStated };
}

function renderPlan(P) {
  renderCost(P);
  $("#pRel").innerHTML = P.releases.map(r => `
    <div class="relcard${r.flag ? " flag" : ""}">
      <h4>${esc(r.name)}${r.note ? ` <span class="tag">${r.note}</span>` : ""}
        <span class="tag">${r.left} ${P.attr.toLowerCase()} cue${r.left === 1 ? "" : "s"} left</span></h4>
      <pre class="mini">${esc(r.text)}</pre></div>`).join("");
  const warn = $("#pWarn");
  if (warn) warn.innerHTML = (P.flipInert || P.stillStated.length)
    ? `<p class="note flagged">${P.flipInert
        ? `<b>The misdirection arm cannot misdirect ${P.attr.toLowerCase()}.</b> It applies the
           paper's SWAP map, which is ${Object.keys(D.cue.swap).length} sex forms, so on this
           attribute it rewrites the sex and leaves the true value standing. Expect it to score
           like the input rather than as a counterexample. ` : ""}${P.stillStated.length
        ? `<b>Still stating the attribute:</b> ${P.stillStated.map(esc).join(", ")}. The ladder
           sends a kinship cue to a sex-neutral phrase, which removes the sex and keeps the
           relationship, so these arms are not edits of ${P.attr.toLowerCase()}.` : ""}
       Pick <b>sex</b> as the attribute for the comparison the paper makes, or read the run as
       what it is: the same statement scored several times.</p>`
    : "";
  $("#pRef").innerHTML = `Reference handed to the adversary:
    <code>${esc(P.ref.handle)}</code> <span class="tag">${P.ref.kind}</span>`;
  const g = window.__guess || {};
  // Show the reader the values the run will actually use, in the fields themselves, so a disabled
  // box reads as an answer rather than as something waiting to be filled.
  if (!($("#ovr") || {}).checked) {
    const A = ATTRS[P.attr] || ATTRS.SEX;
    $("#pAttr").value = P.attr;
    $("#pGold").innerHTML = A.cands.map(c =>
      `<option${c === P.gold ? " selected" : ""}>${esc(c)}</option>`).join("");
    $("#pSubject").value = g.subject || "not named in the text";
    $("#pDomain").value = P.domain;
  }
  const badge = $("#pGuess");
  // A fixed five-row readout. Every state fills every row, so switching attribute or text
  // changes the words in a cell and never the height of the block.
  if (badge) {
    const subj = P.ref.handle === "the person this text is mainly about"
      ? (g.subject || "not named in the text") : P.ref.handle;
    const rows = [
      ["Attribute", `${esc(ATTRS[P.attr] ? P.attr.toLowerCase() : "sex")}`,
        esc(g.why || "the register's default"), false],
      ["True value", esc(P.gold), "the value the adversary is scored against", false],
      ["Subject", esc(subj), "who the question is asked about", false],
      ["Register", esc(P.domain.replace(/^an? /, "").split(/[ -]/)[0]),
        `read as ${esc(P.domain)}; sets the prior and the threshold`, false],
      ["Cue found", g.cues ? "yes" : "none",
        g.cues ? "a lexicon surface the editors can act on"
               : "add a pronoun, a kinship term or a role noun", !g.cues]
    ];
    badge.innerHTML = `<table class="spec"><tbody>${rows.map(([k, v, w, flag]) =>
      `<tr${flag ? ' class="flag"' : ""}><th>${k}</th><td class="v" title="${v}">${v}</td>
       <td class="w">${w}</td></tr>`).join("")}</tbody></table>`;
  }
  $("#pCalls").textContent = `${P.calls} requests (${P.orders.length} candidate orders × `
    + `1 prior + ${P.releases.length} releases)`;
  $("#pPrompts").innerHTML =
    `<pre class="mini">${esc(priorPrompt(P.ref.handle, P.domain, P.A.q, P.orders[0]))}</pre>`
    + `<pre class="mini">${esc(postPrompt(P.releases[3].text, P.ref.handle, P.A.q, P.orders[0]))}</pre>`;
}

async function letterDist(key, m, prompt, n) {
  // Two payloads, because the models differ in what they accept. The frozen one is the paper's.
  // The 5-series rejects `max_tokens` and a `temperature`, and caps `top_logprobs` at 5; sending
  // it the frozen payload fails outright, which is how the smoke census found this.
  const body = m.transport === "frozen"
    ? { model: m.id, temperature: 0, max_tokens: 1, logprobs: true,
        top_logprobs: m.top_logprobs, messages: [{ role: "user", content: prompt }] }
    : { model: m.id, max_completion_tokens: 64, logprobs: true,
        top_logprobs: m.top_logprobs, messages: [{ role: "user", content: prompt }] };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 180));
  const ch = (await r.json()).choices[0];
  const content = (ch.logprobs || {}).content || [];
  const tops = (content[0] || {}).top_logprobs || [];
  const best = {};
  for (const e of tops) {
    const t = String(e.token || "").trim();
    const i = LETTERS.indexOf(t);
    if (t.length === 1 && i >= 0 && i < n) best[i] = Math.max(best[i] ?? -Infinity, e.logprob);
  }
  // No log-probabilities at all means the protocol cannot run: the frozen fallback assigns the
  // emitted letter a flat 1.0, which is not a belief, and every score built on it is an artefact.
  const noLogprobs = tops.length === 0;
  if (!Object.keys(best).length) {
    const t = (ch.message?.content || "").trim()[0], i = LETTERS.indexOf(t);
    if (i >= 0 && i < n) best[i] = 0; else throw new Error("the reply named no option letter");
  }
  const z = Object.values(best).reduce((a, v) => a + Math.exp(v), 0);
  const out = {}; for (const k in best) out[k] = Math.exp(best[k]) / z;
  // How many of the option letters the service actually returned. The frozen rule gives a missing
  // letter no mass, so if only one comes back the renormalisation returns exactly 1.0 — a number
  // that is not a belief but an artefact of the truncated list, and it has to be visible.
  return { p: out, letters: Object.keys(best).length, noLogprobs };
}

async function attack() {
  const key = $("#pKey").value.trim(), model = curModel();
  if (!key) { $("#pErr").textContent = "Enter a key, or use Show requests to see what would be sent."; return; }
  const P = plan(); renderPlan(P);
  if (P.A.cands.length > model.max_options) {
    $("#pErr").textContent = `${model.id} returns mass for at most ${model.max_options} option `
      + `letters and this attribute has ${P.A.cands.length}, so p would be an artefact of the `
      + `truncated list. Pick a two-valued attribute, or the recommended model.`;
    return;
  }
  const btn = $("#pRun"); btn.disabled = true; $("#pErr").textContent = "";
  const say = m => $("#pStatus").textContent = m;
  try {
    const pOf = async (prompt) => {
      const d = await letterDist(key, model, prompt, P.A.cands.length);
      return P.orders.map(() => 0), d;
    };
    // prior: the same question with no text, averaged over the orders
    let pri = 0, trunc = 0, nCalls = 0, noLp = 0;
    const priPer = [];
    for (const o of P.orders) {
      say(`prior, order ${P.orders.indexOf(o) + 1} of ${P.orders.length}…`);
      const r = await letterDist(key, model, priorPrompt(P.ref.handle, P.domain, P.A.q, o),
        P.A.cands.length);
      nCalls++; if (r.letters < P.A.cands.length) trunc++; if (r.noLogprobs) noLp++;
      const v = r.p[o.indexOf(P.gold)] || 0;
      priPer.push(v); pri += v / P.orders.length;
    }
    const rows = [];
    const L = (post) => Math.max(0, Math.min(1, (post - pri) / (1 - pri)));
    for (const r of P.releases) {
      let post = 0, toldP = 0;
      const per = [], perTold = [];
      for (const o of P.orders) {
        say(`${r.name}, order ${P.orders.indexOf(o) + 1}…`);
        const q = await letterDist(key, model, postPrompt(r.text, P.ref.handle, P.A.q, o),
          P.A.cands.length);
        nCalls++; if (q.letters < P.A.cands.length) trunc++; if (q.noLogprobs) noLp++;
        const v = q.p[o.indexOf(P.gold)] || 0;
        per.push(v); post += v / P.orders.length;
        if (P.told) {
          say(`${r.name}, rule-aware, order ${P.orders.indexOf(o) + 1}…`);
          const t = await letterDist(key, model,
            postPrompt(r.text, P.ref.handle, P.A.q, o, r.rule), P.A.cands.length);
          nCalls++; if (t.letters < P.A.cands.length) trunc++; if (t.noLogprobs) noLp++;
          const tv = t.p[o.indexOf(P.gold)] || 0;
          perTold.push(tv); toldP += tv / P.orders.length;
        }
      }
      rows.push({ ...r, p: post, d: L(post), per, perTold,
        told: P.told ? toldP : null, dTold: P.told ? L(toldP) : null,
        state: post > pri + DELTA ? "Leak" : (post < pri - DELTA ? "Misled" : "Anon"),
        signed: (post - pri) / (1 - pri), acc: post > .5 ? 1 : 0,
        brier: (1 - post) ** 2, logloss: -Math.log(Math.max(post, 1e-12)) });
    }
    say(""); result(P, pri, rows, { trunc, nCalls, noLp, model: model.id, cap: model, priPer });
  } catch (e) {
    $("#pErr").innerHTML = esc(String(e.message || e)) + `<br><span class="tag">If the browser
      blocked the request as cross-origin, the provider does not allow calls from a page; run the
      scorer from the released code instead.</span>`;
    say("");
  } finally { btn.disabled = false; }
}

/* the eligibility threshold is per corpus in the paper; the demo picks it from the register it
   inferred, and reports which one it used */
const TAU = [[/clinical/, .8, "MedQA"], [/court/, .6, "TAB"], [/social/, .5, "SynthPAI"]];

function result(P, pri, rows, diag) {
  const tau = (TAU.find(([re]) => re.test(P.domain)) || [, .8, "MedQA"]);
  const eligible = pri < tau[1];
  const room = 1 - pri;
  const shaky = room < .02;
  // ".000" and "1.000" read like placeholders when the real value is 2e-10 or 1 - 1e-9, and the
  // difference matters: it is what separates a confident wrong answer from a missing number.
  const f3 = v => fmt(v);
  // A difference that rounds to zero must not carry a sign: "-.000" reads as a direction that
  // was measured, when all that is known is that the gap is under half a thousandth.
  const d3 = v => Math.abs(v) < .005 ? ".00" : (v > 0 ? "+" : "") + fmt(v);
  const fp = v => v > 0 && v < .005 ? `<span title="${v.toExponential(2)}">&lt;.01</span>`
    : (v < 1 && v > .995 ? `<span title="${v.toPrecision(6)}">&gt;.99</span>` : fmt(v));
  const inp = rows[0];
  const defined = eligible && !shaky;
  const best = k => rows.reduce((a, b) => (k === "brier" || k === "logloss"
    ? (b[k] > a[k] ? b : a) : (b[k] < a[k] ? b : a)));

  const broken = diag && diag.noLp;
  // The run can be arithmetically perfect and still measure nothing, when the arms did not edit
  // the attribute that was scored. That reads as "every release leaks fully", which is true of
  // the text and says nothing about the editors.
  const inertNote = (P.flipInert || (P.stillStated || []).length)
    ? `<div class="verdict flagged"><b>These arms did not edit ${esc(P.attr.toLowerCase())}.</b>
       ${P.flipInert ? `The misdirection arm flips sex forms only, so here it leaves the true
         value in place. ` : ""}${(P.stillStated || []).length
         ? `${P.stillStated.map(esc).join(", ")} still state it after editing. ` : ""}
       A release that still states the value should read near 1, and it does: the numbers below
       are measuring the sentence, not the editors. Run it again with <b>sex</b> as the attribute
       to get the comparison the paper makes.</div>`
    : "";
  const banner = broken
    ? `<div class="verdict flagged"><b>The adversary did not return a distribution.</b> Every
       number below was built from a flat fallback, so none of them measures anything. See the
       note under the table.</div>`
    : !eligible
    ? `<div class="verdict flagged"><b>Not an eligible entry.</b> With no text at all the
       adversary already puts ${f3(pri)} on <i>${esc(P.gold)}</i>, past the ${tau[1]} threshold
       this register uses (${tau[2]}). The protocol drops such entries before scoring, because
       the text cannot add what the adversary already assumes, so <b>L is not defined here</b>
       and the columns that need the prior are blank. The readings that do not use the prior are
       still shown.</div>`
    : shaky
    ? `<div class="verdict flagged"><b>Almost no room to measure.</b> The prior is ${f3(pri)}, so
       the denominator 1 − π is ${room.toExponential(1)}; L divides by it and any rounding swings
       the result. Treat these numbers as undefined.</div>`
    : "";
  const truncNote = !diag ? ""
    : diag.noLp
    ? `<p class="note" style="border:0;padding-top:0;color:var(--flag)"><b>No log-probabilities
       came back</b> in ${diag.noLp} of ${diag.nCalls} replies${diag.model
         ? ` from <code>${esc(diag.model)}</code>` : ""}. The protocol reads the distribution over
       the option letters, not the letter alone; without it the frozen rule falls back to the
       letter the model emitted and gives it a flat 1.0, which is why every probability above is
       exactly 1 and Brier and log loss are 0. These are artefacts, not beliefs. Use a model that
       returns log-probabilities for a single token — the paper's adversary does — or run the
       scorer from the released code.</p>`
    : diag.trunc
    ? `<p class="note" style="border:0;padding-top:0;color:var(--flag)">In ${diag.trunc} of
       ${diag.nCalls} replies only one option letter appeared in the log-probabilities. The frozen
       rule gives a missing letter no mass, so those renormalise to exactly 1 — an artefact of the
       truncated list rather than certainty.${diag.cap && diag.cap.transport !== "frozen"
         ? ` This is the model's own ceiling, not your text: it returns at most
             ${diag.cap.top_logprobs} alternatives${diag.cap.one_letter_rate != null
               ? `, and on the paper's full pass it came back with a single letter on
                  ${(diag.cap.one_letter_rate * 100).toFixed(0)}% of calls` : ""}.`
         : ""}</p>`
    : "";

  $("#pOut").innerHTML = `
    <div class="protostrip">
      <span><b>π</b> prior, no text <i>${f3(pri)}</i>${(P.A || {}).cands && P.A.cands.length === 2
        && Math.abs(pri - .5) < .02 ? ' <i style="color:var(--ok)">as expected for two options</i>'
        : ""}</span>
      <span><b>δ</b> band <i>±.05</i></span>
      <span><b>τ</b> eligibility <i>&lt; ${tau[1]} (${tau[2]})</i></span>
      <span><b>orders</b> <i>${P.orders.length}, gold first and second</i></span>
      <span><b>calls</b> <i>${diag ? diag.nCalls : P.calls}</i></span>
      <span><b>spent</b> <i>${diag ? usd(diag.nCalls * D.cue.pricing.measured_usd
        / D.cue.pricing.measured_requests) : "—"}</i></span>
    </div>
    ${banner}${inertNote}
    <table><thead><tr>
      <th>Release</th><th class="n">p(true)</th><th class="n">Δp vs input</th>
      <th class="n">L ↓</th><th class="n">signed d ↓</th><th>State</th>
      <th class="n">Accuracy ↓</th><th class="n">Protection ↑</th>
      <th class="n">Brier ↑</th><th class="n">Log loss ↑</th>
      </tr></thead><tbody>${rows.map((r, i) => `
      <tr${r.flag ? ' style="background:var(--flag-soft)"' : ""}>
        <td><b>${esc(r.name)}</b></td>
        <td class="n">${fp(r.p)}</td>
        <td class="n">${i ? d3(r.p - inp.p) : "—"}</td>
        <td class="n">${defined ? f3(r.d) : "—"}</td>
        <td class="n">${defined ? f3(r.signed) : "—"}</td>
        <td>${defined ? r.state : "—"}</td>
        <td class="n">${r.acc}</td>
        <td class="n">${f3(1 - r.acc)}</td>
        <td class="n">${f3(r.brier)}</td>
        <td class="n">${r.logloss.toFixed(2)}</td></tr>`).join("")}</tbody></table>
    ${defined && rows[0].per && rows[0].per.length > 1 ? `
      <h3 class="step">The same answers, read per candidate order</h3>
      <p class="note" style="border:0;margin:0 0 8px;padding:0">Protocol choice 3. The score above
      averages the two orders; here they are apart. A gap is position bias, not leakage — it moves
      with where the true value sits in the list, and the text never changed.</p>
      <table><thead><tr><th>Release</th><th class="n">gold first</th><th class="n">gold second</th>
        <th class="n">spread</th><th class="n">L, gold first</th><th class="n">L, gold second</th>
        </tr></thead><tbody>
        <tr><td><b>prior (no text)</b></td>
          <td class="n">${fp(diag.priPer[0])}</td><td class="n">${fp(diag.priPer[1])}</td>
          <td class="n">${f3(Math.abs(diag.priPer[0] - diag.priPer[1]))}</td>
          <td class="n">—</td><td class="n">—</td></tr>
        ${rows.map(r => `<tr${r.flag ? ' style="background:var(--flag-soft)"' : ""}>
          <td>${esc(r.name)}</td>
          <td class="n">${fp(r.per[0])}</td><td class="n">${fp(r.per[1])}</td>
          <td class="n">${f3(Math.abs(r.per[0] - r.per[1]))}</td>
          <td class="n">${f3(Math.max(0, Math.min(1, (r.per[0] - pri) / (1 - pri))))}</td>
          <td class="n">${f3(Math.max(0, Math.min(1, (r.per[1] - pri) / (1 - pri))))}</td>
          </tr>`).join("")}</tbody></table>
      ${(() => {
        const ps = Math.abs(diag.priPer[0] - diag.priPer[1]);
        const worst = Math.max(...rows.map(r => Math.abs(r.per[0] - r.per[1])));
        if (ps <= DELTA && worst <= DELTA) return `<p class="note" style="border:0">Both orders
          agree to within the band, so position is not driving this entry.</p>`;
        return `<p class="note flagged">Order alone moves ${ps > DELTA ? "the prior by "
          + f3(ps) : "a release by " + f3(worst)}, more than the band δ = .05 that decides Leak
          from Anon. ${ps > DELTA ? `With no text at all the adversary puts ${fp(diag.priPer[0])}
          on the true value when it is listed first and ${fp(diag.priPer[1])} when it is listed
          second, so π = ${f3(pri)} is the midpoint of two position effects rather than a belief,
          and L divides by 1 − π. ` : ""}Balancing the orders is what the protocol does about
          this; on a single sentence it averages the bias rather than removing it.</p>`;
      })()}` : ""}
    ${rows[0] && rows[0].told !== null && rows[0].told !== undefined ? `
      <h3 class="step">A rule-aware adversary</h3>
      <p class="note" style="border:0;margin:0 0 8px;padding:0">The second contribution's recovery
      test. The same releases, asked again by an adversary that has been told the editing rule. An
      edit that only moves a known word can be undone; a removal cannot.</p>
      <table><thead><tr><th>Release</th><th class="n">p, not told</th><th class="n">p, told</th>
        <th class="n">L, not told</th><th class="n">L, told</th><th class="n">ΔL</th>
        </tr></thead><tbody>${rows.map(r => `
        <tr${r.flag ? ' style="background:var(--flag-soft)"' : ""}>
          <td>${esc(r.name)}</td>
          <td class="n">${fp(r.p)}</td><td class="n">${fp(r.told)}</td>
          <td class="n">${defined ? f3(r.d) : "—"}</td>
          <td class="n">${defined ? f3(r.dTold) : "—"}</td>
          <td class="n">${defined ? d3(r.dTold - r.d) : "—"}</td>
          </tr>`).join("")}</tbody></table>
      <p class="note" style="border:0;padding-top:6px">On the paper's 1,513 MedQA entries the
      misdirecting release moves from ${fmt(D.rule_aware.p_untold)} to
      ${fmt(D.rule_aware.p_told)} when the rule is stated, a gain of
      ${fmt(D.rule_aware.dL)} in L. One sentence is not that experiment, but the direction is the
      claim: a release whose protection is a known, reversible substitution does not survive an
      adversary who knows the rule.</p>` : ""}
    ${truncNote}
    ${rows.some(r => Math.abs(r.p - .5) < .02) ? `<p class="note"
      style="border:0;padding-top:0">One or more releases sit within .02 of chance, where top-1
      accuracy and the protection rate turn on which side of .5 the probability falls — a coin
      flip recorded as a hit. Over a balanced cohort of hundreds of entries that averages out;
      on a single sentence it is arbitrary, which is why the clipped and two-sided readings, which
      use the whole probability, are the ones to read here.</p>` : ""}
    ${defined ? `<div class="verdict ${best("d").flag ? "flagged" : "clean"}">
      <b>Lowest L: ${esc(best("d").name)}.</b> Highest Brier: ${esc(best("brier").name)}.
      Lowest accuracy: ${esc(best("acc").name)}.
      ${best("d").flag ? `On your own sentence the misdirecting release takes the clipped score —
        the paper's finding, on text it has never seen. Its state is <b>${best("d").state}</b>,
        which is what the two-sided reading charges and the clipped one does not.`
        : P.flipInert || (P.stillStated || []).length
        ? `Here the misdirecting release does not take the lowest L, and on this run the reason is
        not sampling: the arm did not edit ${esc(P.attr.toLowerCase())} at all, so there was no
        misdirection to credit. Choose <b>sex</b> and the comparison becomes the paper's.`
        : `Here the misdirecting release does not take the lowest L. On a single entry that
        happens, which is why the paper reports balanced cohorts of hundreds of entries rather
        than single examples.`}</div>`
      : `<p class="note">Readings that need no prior — accuracy, protection rate, Brier and log
         loss — are still meaningful above. Lowest accuracy: <b>${esc(best("acc").name)}</b>;
         highest Brier: <b>${esc(best("brier").name)}</b>.</p>`}
    <p class="note">AUC and |AUC−.5| need a cohort of entries with both values present, so they
    cannot be computed from one sentence; the ranking under those readings is on the Findings
    page.</p>`;
}

/* ---------------------------------------------------- wiring */
function pills(host, labels, key, after, cls) {
  const h = $(host); h.className = "pills" + (cls ? " " + cls : "");
  h.innerHTML = labels.map((l, i) =>
    `<button aria-pressed="${S[key] === i}" data-i="${i}">${esc(l)}</button>`).join("");
  h.onclick = e => { const b = e.target.closest("button"); if (!b) return;
    S[key] = +b.dataset.i;
    [...h.children].forEach((c, i) => c.setAttribute("aria-pressed", String(S[key] === i)));
    after(); };
}


$("#theme").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const dark = cur ? cur === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
};


/* ---------------------------------------------------- what a run costs
   Two independent estimates, because a single one invites trust it has not earned:
     tokens   prompt characters / 4, the convention this project's own estimator uses, times its
              per-token rates, plus one completion token per call
     measured the project's SWAP scoring pass cost a reported sum for a reported number of
              single-token requests; that per-request figure priced exactly this kind of call
   They are shown together, and the rates are editable, because a vendor's price list changes and
   a number on a page does not. */
/* ------------------------------------------------- the adversary menu
   Capability decides this list, price only orders it: a model that will not return
   log-probabilities cannot run the protocol at any price. Both facts come from data.json,
   which reads them off this project's own smoke census and cost constants. */
function modelList() { return (D.models && D.models.list) || []; }

function curModel() {
  const ml = modelList(), id = ($("#pModel") || {}).value;
  return ml.find(m => m.id === id) || ml[0] || null;
}

function fillModels() {
  const sel = $("#pModel"); if (!sel) return;
  sel.innerHTML = modelList().map(m =>
    `<option value="${m.id}">${m.id}${m.tag ? " (" + m.tag + ")" : ""} — ${m.role}</option>`
  ).join("");
}

/* What this model can and cannot be asked, and what it costs — stated before the run, not after */
function renderCap(P) {
  const host = $("#mcap"), m = curModel(); if (!host || !m) return;
  const n = P ? P.A.cands.length : 2;
  const tooMany = n > m.max_options;
  const top = $("#pTop");
  // the two sentences are kept the same length, so changing the model rewrites the line and
  // does not add one; which payload it is, and that the frozen one is refused, is in the strip
  if (top) top.textContent = m.transport === "frozen"
    ? `one token at temperature 0, with the top ${m.top_logprobs} log-probabilities`
    : `up to 64 tokens, no temperature, with the top ${m.top_logprobs} log-probabilities`;
  // One line, always the same three facts, so changing the model cannot move the page.
  host.innerHTML = `
    <div class="protostrip${tooMany ? " flagged" : ""}">
      <span><b>rate</b> <i>$${m.in.toFixed(2)} / $${m.out.toFixed(2)} per 1M</i></span>
      <span><b>payload</b> <i>${m.transport === "frozen" ? "frozen" : "its own"}</i></span>
      <span><b>letters</b> <i>${tooMany ? `${m.max_options} — too few for ${n}` : `up to ${m.max_options}`}</i></span>
      <span><b>evidence</b> <i>${m.measured_usd != null ? "a full pass" : "smoke test"}</i></span>
    </div>`;
}

function costOf(P) {
  const m = curModel(), pr = D.cue.pricing;
  const ownRate = !!(($("#ovrRate") || {}).checked);
  // the selected model's own recorded rate is the default; the fields only speak when ticked
  const defIn = m ? m.in : pr.usd_per_prompt_token * 1e6;
  const defOut = m ? m.out : pr.usd_per_completion_token * 1e6;
  const rateIn = (ownRate && parseFloat($("#rIn").value)) || defIn;
  const rateOut = (ownRate && parseFloat($("#rOut").value)) || defOut;
  if (!ownRate) { $("#rIn").value = defIn.toFixed(2); $("#rOut").value = defOut.toFixed(2); }
  let chars = 0;
  for (const o of P.orders) {
    chars += priorPrompt(P.ref.handle, P.domain, P.A.q, o).length;
    for (const r of P.releases) {
      chars += postPrompt(r.text, P.ref.handle, P.A.q, o).length;
      if (P.told) chars += postPrompt(r.text, P.ref.handle, P.A.q, o, r.rule).length;
    }
  }
  // The frozen payload caps the answer at one token. The 5-series refuses that cap, so it bills
  // whatever it emits; out_per_call is the measured figure from the one cache-free block we have.
  const perCall = m ? m.out_per_call : 1;
  const tokIn = Math.ceil(chars / 4), tokOut = Math.ceil(P.calls * perCall);
  const byToken = tokIn / 1e6 * rateIn + tokOut / 1e6 * rateOut;
  // A second, empirical estimate exists only for the models a full pass has been run on.
  const mSrc = m && m.measured_usd != null
    ? { usd: m.measured_usd, requests: m.measured_requests } : null;
  const byMeasured = mSrc ? P.calls * mSrc.usd / mSrc.requests : null;
  return { calls: P.calls, chars, tokIn, tokOut, perCall, byToken, byMeasured, mSrc,
           rateIn, rateOut, pr, m };
}
const usd = v => v < .01 ? "$" + v.toFixed(5) : "$" + v.toFixed(3);

function renderCost(P) {
  const c = costOf(P), host = $("#pCost");
  if (!host) return;
  const m = c.m;
  const rows = [
    ["Requests", String(c.calls), "a prior and a posterior per release, per order"],
    ["Input", `~${c.tokIn.toLocaleString()} tokens`, "characters over four"],
    ["Output", `~${c.tokOut.toLocaleString()} tokens`,
      c.perCall > 1 ? `${c.perCall} a call: this model refuses the one-token cap`
                    : "one token a call"],
    ["By rate", usd(c.byToken),
      `$${c.rateIn.toFixed(2)} in, $${c.rateOut.toFixed(2)} out per 1M`],
    ["By measured pass", c.byMeasured != null ? usd(c.byMeasured) : "—",
      c.mSrc ? `${usd(c.mSrc.usd)} over ${c.mSrc.requests.toLocaleString()} real requests`
             : "no full pass on this model; the dash is not a zero"]
  ];
  host.innerHTML = `<table class="spec"><tbody>${rows.map(([k, v, w]) =>
    `<tr><th>${k}</th><td class="v" title="${v}">${v}</td><td class="w">${w}</td></tr>`).join("")}</tbody></table>
    <details class="adj"><summary>Why two estimates</summary><div class="body">
    <p>${c.mSrc
      ? `A rate estimate can be wrong in both directions, so it is shown against what a full pass
         on this model actually billed: ${(c.mSrc.usd / c.mSrc.requests * 1e5).toFixed(2)} cents
         per thousand calls. That pass read longer documents than one sentence, and counted cached
         answers as requests, which pull the two figures apart.`
      : `Only the rate estimate exists for this model. Rates come from this project's own
         constants; check them against the provider's price list before trusting a total.`}</p>
    </div></details>`;
}

/* ---------------------------------------------------- per-page wiring */
const PAGES = {
  results() {
    $("#stats").innerHTML = [
      [D.x1_medqa.length, "fixed releases scored on identical entries"],
      [D.readings.length, "scoring readings compared on one cohort"],
      [(D.protocol || []).length, "protocol choices named, held fixed and re-read"],
      [D.choices.reduce((a, c) => a + c.n, 0).toLocaleString(), "paired contrasts read two ways"],
      ["3", "corpora, and three adversary families"]
    ].map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join("");
    pills("#readings", D.readings.map(r => r.reading), "reading", board);
    tabBoard();
    pills("#editors", D.example.map(e => e.system), "editor", renderText);
    const tog = () => { S.told = !S.told; renderText(); };
    $("#sw").onclick = tog;
    $("#sw").onkeydown = e => { if (e.key === "Enter" || e.key === " ")
      { e.preventDefault(); tog(); } };
    $("#check").innerHTML = D.checklist.map(c =>
      `<li><b>${esc(c.what)}.</b> ${esc(c.do)}</li>`).join("");
    board(); renderText(); sweep(); person(); editorCards();
  },
  analyse() {
    const gate = (box, ids) => { const c = $("#" + box); if (!c) return;
      const sync = () => { ids.forEach(i => { const n = $("#" + i); if (n) n.disabled = !c.checked; });
        refresh(); };
      c.addEventListener("change", sync); sync();
    };
    $("#samples").innerHTML = SAMPLES.map((x, i) =>
      `<button type="button" data-i="${i}">${esc(x[0])}</button>`).join("");
    $("#samples").onclick = e => { const b = e.target.closest("button"); if (!b) return;
      $("#pText").value = SAMPLES[+b.dataset.i][1];
      ["pAttr", "pGold", "pSubject", "pDomain"].forEach(id => $("#" + id).value = "");
      $("#pText").dispatchEvent(new Event("input"));
      $("#inp").value = $("#pText").value; runCue(); };
    fillModels();
    const refresh = () => { try { const P = plan(); renderPlan(P); renderCap(P); } catch (e) {
      $("#pErr").textContent = "Could not read that text: " + e.message; } };
    $("#pText").addEventListener("input", refresh);
    ["pAttr", "pGold", "pSubject", "pDomain", "rIn", "rOut", "pModel", "ruleaware"].forEach(id => {
      const n = $("#" + id); if (!n) return;
      n.addEventListener("input", refresh); n.addEventListener("change", refresh);
    });
    $("#pAttr").onchange = () => {
      const A = ATTRS[$("#pAttr").value];
      $("#pGold").innerHTML = `<option value="">auto</option>`
        + A.cands.map(c => `<option>${c}</option>`).join("");
      refresh();
    };
    gate("ovr", ["pAttr", "pGold", "pSubject", "pDomain"]);
    gate("ovrRate", ["rIn", "rOut"]);
    $("#pRun").onclick = attack;
    pills("#ops", OPS.map(o => o[0]), "op", runCue, "seg");
    // One passage, two views. Setting .value from script fires no input event, so binding both
    // directions cannot loop, and neither box can be left showing text the other has moved past.
    const mirror = (from, to, after) => $("#" + from).addEventListener("input", () => {
      $("#" + to).value = $("#" + from).value; after();
    });
    $("#inp").value = $("#pText").value;
    mirror("pText", "inp", runCue);
    mirror("inp", "pText", () => { refresh(); runCue(); });
    $("#copy").onclick = async () => {
      try { await navigator.clipboard.writeText($("#out").dataset.plain || "");
        $("#copy").textContent = "Copied";
        setTimeout(() => $("#copy").textContent = "Copy output", 1400);
      } catch (e) { $("#copy").textContent = "Select and copy"; }
    };
    refresh(); runCue();
  },
  about() {
    editorCards();
    $("#check").innerHTML = D.checklist.map(c =>
      `<li><b>${esc(c.what)}.</b> ${esc(c.do)}</li>`).join("");
  }
};

fetch("data.json").then(r => r.json()).then(d => {
  D = d;
  document.querySelectorAll("[data-ready]").forEach(n => n.removeAttribute("data-ready"));
  const page = document.body.dataset.page;
  document.querySelectorAll("nav a[data-s]").forEach(a =>
    a.setAttribute("aria-current", String(a.dataset.s === page)));
  (PAGES[page] || (() => {}))();
  const p = $("#prov");
  if (p) p.innerHTML = `Every number here is read from the manuscript by a generator script, which
    refuses to write if its checks on those tables fail. The misdirecting release is an evaluation
    construct, distributed as evaluation code and not as an anonymiser.`;
}).catch(() => {
  document.querySelectorAll("[data-ready]").forEach(n => n.innerHTML =
    `<section><h2>Serve this folder over HTTP</h2><p class="lede">Opening the file straight from
     disk stops the browser fetching <code>data.json</code>. Run
     <code>python -m http.server</code> here, or publish with GitHub Pages.</p></section>`);
});
