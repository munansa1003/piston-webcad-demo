export const meta = {
  name: 'catia-coverage-verified',
  description: 'How much of CATIA can a browser CAD replace, and is it a business? Claims are adversarially verified in rounds until ≥90% are confirmed by 2-of-3 independent checkers',
  phases: [
    { title: 'Inventory', detail: 'five lenses produce numeric claims with plain-language explanations' },
    { title: 'Verify', detail: '3 independent checkers per claim; loop with revision until ≥90% confirmed' },
    { title: 'Synthesize', detail: 'final page data with per-claim confidence' },
  ],
}

const REPO = '/home/user/piston-webcad-demo'
const TARGET = 0.9
const MAX_ROUNDS = 4

const FACTS = `MEASURED FACTS from this project (all reproduced by at least two independent agents against the real OpenCascade WASM build in ${REPO}; treat as ground truth, cite them, do not contradict them without running code):
- One-part parametric piston, 24 params, rebuild 0.5-1.4 s; STEP AP242 export 234 KB with PRODUCT/NAME/COLOUR; STL; 2D section+plan drawings derived as pure math; click-a-dimension-to-edit; 8-step feature tree; projected views with hidden-line removal via drawProjection in ~380 ms.
- Twisted NACA airfoil fan blade: 9 sections lofted in 30-95 ms into ONE valid solid with BSPLINE_SURFACE faces. With default curve fitting the surface is only C0 (degree-1 polyline in disguise); with {tolerance:1e-6, degMax:5} or {degMin:3} it is genuinely C2 (curvature-continuous). Blade meshing costs 150 ms (coarse) to 4 s (fine, 141k triangles).
- Blade ROOT FILLET onto a hub FAILS in this build at every radius tried (throws after 1-11 s, or hangs >110 s). Fillets on the finished prismatic piston DO work.
- Assembly: replicad's exportSTEP([many shapes]) writes a FLAT file (3 PRODUCT, 0 NEXT_ASSEMBLY_USAGE_OCCURRENCE) - no instances/occurrences. BUT raw XCAF (XCAFDoc_ShapeTool AddComponent/SetLocation, STEPCAFControl_Writer) IS bound in this WASM and a verifier built a real occurrence-based AP242 assembly ("Compressor.1"/"Compressor 2.1") in ~50 lines. STEP IMPORT of structure/placement also works. STEPCAFControl_Reader is NOT bound (colors on import are lost).
- Clash/interference via boolean intersect: 5,296 mm3 in 77 ms. Mass/volume/centre-of-mass: yes. Moment of inertia via raw OC: partly (MatrixOfInertia/PrincipalProperties blocked by unbound types).
- NO constraint solver of any kind exists in this build: 172 replicad exports + 501 OC symbols, zero matching /Gcc|Constraint|Solver|PlateAPI/. A usable 2D sketch solver would be a port of planegcs (FreeCAD) or SolveSpace: ~6-18 person-months.
- G2 filling patch BRepOffsetAPI_MakeFilling works (C0/tangent/curvature patches built). Guide-curve sweep via raw MakePipeShell works. Curvature analysis (Gauss/mean over a 61x61 grid) in 91 ms works.
- Scale: 200 simple parts clone+place+mesh in 622 ms; a jet engine is 10,000+ parts; wasm32 4 GB heap is a hard ceiling; rough limit ~700-1,500 unique B-rep part definitions per worker.
- PLM (ENOVIA) is a separate server product; this architecture is 100% static by rule.
- Prior adversarial review of 117 CATIA sketcher/part-design/parametric/drafting/UI features: Path A (template parametric) full 59 / partial 47 / none 11; Path B (free sketch) full 60 / partial 48 / none 9. The 11 Path-A gaps: free-hand profile drawing, sketch on a face, constraint inference, drag-to-solve, feature reorder, face-face/tritangent fillet, IGES, PMI, PLM, CATIA native formats, and the solver+history core itself.
- Prior scale review: CATIA V5 lineage 1977, V5 shipped 1998, ~100 workbenches sold as ~150 products; honest V5 effort ~5,000-15,000 person-years (NOT 25-30k: that multiplied today's headcount over 28 years). OpenCascade (in node_modules for free) is ~1.5-2M lines, ~1,500-4,500 person-years of its own, and the geometric modeler is the single hardest subsystem of any CAD. Onshape: ~7 years, 100+ engineers, reached SOLIDWORKS-class not CATIA-class, did not write a kernel.`

const CONTEXT = `THE QUESTION. A Korean mechanical engineer (piston / engine-component design, daily CATIA V5 user) asks: "How much of CATIA can a web CAD actually implement? Could it reach 100%? CATIA licences are expensive - if a web CAD saved that licence cost it could be a big business." They want a rigorous, adversarially verified answer, presented so a middle-schooler can follow it.

${FACTS}

RULES. Every claim must carry a number (a percentage, a month count, a won/dollar figure, a count) or an explicit yes/no, plus a range and an honest confidence. Prices you are not sure of: give a range and say "approximate, public reseller quotes vary". Write the 'plain' field as if explaining to a smart 14-year-old in Korean: short sentences, one idea each, a concrete analogy where it helps, no unexplained jargon. Cite the measured facts above wherever they bear on a claim. Be equally willing to say "reachable" and "not reachable"; the goal is accuracy, not a verdict either way.`

const CLAIMS = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          topic: { type: 'string' },
          headline: { type: 'string' },
          value: { type: 'string' },
          range: { type: 'string' },
          unit: { type: 'string' },
          evidence: { type: 'string' },
          plain: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'topic', 'headline', 'value', 'range', 'unit', 'evidence', 'plain', 'confidence'],
      },
    },
  },
  required: ['claims'],
}

const VERDICT = {
  type: 'object',
  properties: {
    accurate: { type: 'boolean' },
    correction: { type: 'string' },
    revisedValue: { type: 'string' },
    revisedRange: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['accurate', 'correction', 'revisedValue', 'revisedRange', 'confidence'],
}

const LENSES = [
  {
    key: 'workbench-map',
    prompt: `${CONTEXT}

LENS: WORKBENCH COVERAGE MAP. Produce one claim per major CATIA V5 workbench (aim for 16-18: Sketcher, Part Design, Assembly Design, Generative Shape Design, Drafting, Generative Sheetmetal, Wireframe & Surface, FreeStyle, DMU Navigator/Space Analysis (clash, sectioning, measure), DMU Kinematics, Knowledge Advisor/Knowledgeware (formulas, rules, design tables), Generative Structural Analysis (FEA), Prismatic/Surface Machining (NC), Composites, Piping/Tubing/Electrical, Mold Tooling, Photo Studio/Real Time Rendering, plus the file/data layer: CATPart/CATProduct native, STEP/IGES/JT exchange, ENOVIA/PLM). For each: what the workbench does in one plain sentence, the percentage of its day-to-day use that a browser tool on THIS stack could realistically cover at a mature build (define "mature" as 3-5 years, 3-6 people), the effort in person-months, the single blocker, and whether the coverage is "template-parametric only" (user edits numbers) or "free modelling" (user creates new geometry). Use the measured facts: e.g. Part Design coverage is high because booleans/holes/lofts/chamfers work; Sketcher coverage is capped by the absent solver; GSD coverage is capped by the root-fillet failure and MakeFilling limits; PLM is 0 by architecture. Add one final claim: the simple average coverage across workbenches, and a second final claim: coverage weighted by how often a piston/engine-component engineer actually opens each workbench (state your weights).`,
  },
  {
    key: 'usage-and-seats',
    prompt: `${CONTEXT}

LENS: WHO ACTUALLY USES WHAT. The honest business question is not "features" but "seats". Produce claims about: (1) at a typical Korean tier-1/tier-2 automotive or engine-component supplier with, say, 50 CATIA seats, the realistic split of seat types - full-time designers creating new geometry, engineers who mostly modify dimensions of existing part families, people who mainly view/measure/section/check interference, people who mainly make or read drawings, and people who only need STEP conversion or approval viewing; give a percentage per type with a range and state that it is an estimate from industry structure, not a survey. (2) For each seat type, whether a browser tool at the measured capability level (template parametric + 2D/3D + drawings + assembly-with-instances + clash, NO constraint solver) could replace that seat entirely, partly, or not at all. (3) The resulting "replaceable seat share" as one headline number with range. (4) Why "replaceable" is not the same as "will be replaced": OEM file-format mandates (Hyundai/Kia, Renault, Boeing, Airbus require native CATIA deliverables), certification, and the cost of running two tools. Quantify the discount you'd apply for that. (5) The Pareto point: what share of a design engineer's actual daily commands falls inside Part Design + Sketcher + Drafting + Assembly + DMU.`,
  },
  {
    key: 'licence-economics',
    prompt: `${CONTEXT}

LENS: MONEY. Produce claims with ranges for: (1) CATIA V5 licence cost per seat - perpetual list price by configuration (P1/P2/P3 or MD2/HD2 style packages), annual maintenance as a % of list, and 3DEXPERIENCE CATIA subscription per seat per year; mark each "approximate - public reseller quotes vary" and give USD and KRW (state the exchange rate you use). (2) Total 5-year cost of ownership for a 50-seat shop. (3) What Onshape, Fusion 360 and SolidWorks cost per seat per year for comparison, because a web CAD competes with THOSE, not with CATIA. (4) The cost to build the browser tool to the measured-capability level (template parametric + assembly with instances + clash + drawings) for a 2-4 person team over 24-36 months, using an all-in loaded cost of 1,200만원/month/person as the prior page did, and separately the cost with heavy AI assistance. (5) Break-even: how many replaced seats, for how many years, pay for that build. (6) Whether "big profit from saving licences" is realistic - be blunt: replacing a seat saves the customer money, but capturing that as YOUR revenue requires selling the tool, and the going rate for browser CAD seats (Onshape Standard/Pro) caps what you can charge. Produce a headline claim: realistic annual revenue per replaced seat and the number of seats needed for a sustainable 5-person business.`,
  },
  {
    key: 'precedent',
    prompt: `${CONTEXT}

LENS: WHAT HISTORY SAYS. Produce claims, each with a number and a confidence, about the real attempts to build or replace high-end CAD: (1) Onshape - founding year, funding raised, team size, years to production use, the acquisition by PTC (year and price), what it does not do vs CATIA. (2) Autodesk Fusion 360 - years of development, backed by a company with existing kernels, positioning below CATIA. (3) FreeCAD - open source since ~2002, still fighting the topological naming problem in the 1.0 era; what that says about feature-history difficulty. (4) SolidWorks - founded 1993 to be "CATIA for Windows at 1/5 the price", took how long to reach where, and note that Dassault BOUGHT it in 1997 rather than being displaced. (5) Any CATIA "clone" or low-cost replacement attempt and its outcome. (6) The OEM mandate reality: name OEMs known to require CATIA native deliverables and what that does to a replacement product's addressable market. (7) The lesson as one claim: the minimum credible team-years to reach each of SOLIDWORKS-class and CATIA-class, based on the record. Mark every figure approximate where you are not certain; never invent a precise number.`,
  },
  {
    key: 'hundred-percent',
    prompt: `${CONTEXT}

LENS: THE 100% QUESTION, explained simply. Produce claims that a 14-year-old can follow: (1) Is 100% possible? Give the number you actually believe is the ceiling for a browser CAD on this stack with unlimited time and a 5-person team, and separately the ceiling with unlimited money and a 100-person team. (2) Why the last part is the hardest - the "last 15%" - name the concrete pieces: constraint solver with diagnostics, topological naming for feature history, freeform fillets and surface healing, large-assembly memory, native file formats, PLM, industry certification. For each give a plain analogy (e.g. the kernel is the engine you got for free; the solver is the steering wheel that's missing). (3) The "kernel for free" fact expressed as a fraction: OpenCascade's ~1,500-4,500 person-years vs CATIA V5's ~5,000-15,000 - what share of the hard part is already in hand. (4) The part that is easier than people think, with the measured examples (blade in 95 ms, projected drawing in 380 ms, clash in 77 ms). (5) A one-sentence honest answer to "could this be a business that beats CATIA on licence cost" and a one-sentence answer to "could this be a business at all". Each claim's 'plain' field must be the simplest possible Korean.`,
  },
]

phase('Inventory')
const inventory = await parallel(LENSES.map((lens) => () =>
  agent(lens.prompt, { label: `inventory:${lens.key}`, phase: 'Inventory', schema: CLAIMS, effort: 'high' })
    .then((r) => ((r && r.claims) || []).map((c, i) => ({ ...c, id: `${lens.key}-${i + 1}`, lens: lens.key })))
))
let claims = inventory.filter(Boolean).flat()
log(`inventory: ${claims.length} claims from ${LENSES.length} lenses`)

const CHECKERS = [
  { key: 'facts', brief: 'You are a FACT checker. Check every named product, company, year, price, workbench name and behaviour against what you know. A wrong name, wrong year, or a price outside any plausible public range makes the claim inaccurate.' },
  { key: 'kernel', brief: `You are a KERNEL checker. Any claim about what this stack can or cannot do must agree with the MEASURED FACTS and with the actual type definitions at ${REPO}/node_modules/replicad/dist/replicad.d.ts and ${REPO}/node_modules/replicad-opencascadejs/dist/replicad_single.d.ts. You may run ONE scratch vitest file under /tmp/claude-0 to call an API and observe it (import "replicad" and load the wasm via require.resolve("replicad-opencascadejs/wasm")), but never create or modify any file inside ${REPO}. A claim that contradicts a measured fact is inaccurate; a claim that is more pessimistic OR more optimistic than the measurement is inaccurate.` },
  { key: 'realism', brief: 'You are a BUSINESS and EFFORT realism checker. Is the number defensible for a 2-6 person team? Does the business claim account for how customers actually buy CAD (OEM mandates, switching cost, two-tool overhead, per-seat price ceilings set by Onshape/Fusion)? A claim that ignores a load-bearing cost or a well-known market fact is inaccurate. Also judge the plain-language explanation: if it would mislead a 14-year-old, say so.' },
]

const BATCH_VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          accurate: { type: 'boolean' },
          correction: { type: 'string' },
          revisedValue: { type: 'string' },
          revisedRange: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'accurate', 'correction', 'revisedValue', 'revisedRange', 'confidence'],
      },
    },
  },
  required: ['verdicts'],
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function verifyBatchPrompt(batch, checker) {
  return `${CONTEXT}

${checker.brief}

Adversarially check EACH of the ${batch.length} claims below and return one verdict per claim id (all ${batch.length} ids, in the same order). For each: accurate=true only if the value is within its stated range of what you believe is correct AND the evidence and plain explanation contain no false statement of fact. A clumsy phrasing that is not false does NOT make a claim inaccurate; a genuinely false statement does. Otherwise accurate=false with a concise correction (say exactly which words are wrong and what to write instead), and give the revisedValue and revisedRange you would put instead (repeat the originals if they stand). Be decisive; "unknowable" is not a verdict - give your best-supported number.

${batch.map((c, i) => `CLAIM ${i + 1} id=${c.id}
topic: ${c.topic}
headline: ${c.headline}
value: ${c.value} (range ${c.range}, unit ${c.unit})
evidence: ${c.evidence}
plain: ${c.plain}
author confidence: ${c.confidence}`).join('\n\n')}`
}

const BATCH = 8
phase('Verify')
const history = []
let confirmed = []
let pending = claims
for (let round = 1; round <= MAX_ROUNDS; round++) {
  const batches = chunk(pending, BATCH)
  // each checker judges each batch; verdicts are then regrouped per claim
  const perChecker = await parallel(CHECKERS.map((ch) => () =>
    parallel(batches.map((batch, bi) => () =>
      agent(verifyBatchPrompt(batch, ch), { label: `r${round}:${ch.key}:b${bi + 1}`, phase: 'Verify', schema: BATCH_VERDICTS })
        .then((r) => ((r && r.verdicts) || []).map((v) => ({ ...v, checker: ch.key })))
    )).then((rs) => rs.filter(Boolean).flat())
  ))
  const byId = new Map()
  for (const list of perChecker.filter(Boolean)) for (const v of list) {
    if (!byId.has(v.id)) byId.set(v.id, [])
    byId.get(v.id).push(v)
  }
  const judged = pending.map((c) => {
    const valid = byId.get(c.id) || []
    const yes = valid.filter((v) => v.accurate).length
    return { ...c, round, verdicts: valid, agree: yes, ok: valid.length >= 2 && yes >= 2 }
  })
  const good = judged.filter((j) => j.ok)
  const bad = judged.filter((j) => !j.ok)
  confirmed = confirmed.concat(good)
  const ratio = confirmed.length / claims.length
  history.push({ round, checked: judged.length, confirmed: good.length, rejected: bad.length, cumulativeRatio: ratio })
  log(`round ${round}: ${good.length} confirmed, ${bad.length} rejected → cumulative ${(ratio * 100).toFixed(1)}%`)
  if (ratio >= TARGET || bad.length === 0 || round === MAX_ROUNDS) {
    pending = bad
    break
  }
  // revise rejected claims in batches of 4 using the checkers' corrections, then re-verify next round
  const revised = await parallel(chunk(bad, 4).map((group, gi) => () =>
    agent(`${CONTEXT}

You are REVISING ${group.length} claims that failed adversarial review. For each, rewrite it so that it is TRUE, keeping the same id and topic. Fix the value/range to what the corrections support (if checkers disagree, pick the best-evidenced and widen the range to cover honest uncertainty). Remove or fix every statement the checkers called false in 'evidence' and 'plain'. Keep 'plain' simple enough for a 14-year-old (Korean). Return exactly ${group.length} claims with these ids in this order: ${group.map((b) => b.id).join(', ')}.

${group.map((b) => `CLAIM id=${b.id}
topic: ${b.topic}
headline: ${b.headline}
value: ${b.value}; range: ${b.range}; unit: ${b.unit}
evidence: ${b.evidence}
plain: ${b.plain}
checkers said:
${b.verdicts.map((v) => `  - [${v.checker}] accurate=${v.accurate}; correction: ${v.correction}; revisedValue: ${v.revisedValue}; revisedRange: ${v.revisedRange}`).join('\n')}`).join('\n\n')}`,
      { label: `revise:r${round}:g${gi + 1}`, phase: 'Verify', schema: CLAIMS })
      .then((r) => ((r && r.claims) || []).map((c) => {
        const orig = group.find((b) => b.id === c.id) || group[0]
        return { ...c, id: orig.id, lens: orig.lens, revisedFrom: orig.value }
      }))
  ))
  const revisedList = revised.filter(Boolean).flat()
  // any claim the reviser dropped keeps its previous text and is re-checked as-is
  const seen = new Set(revisedList.map((c) => c.id))
  pending = revisedList.concat(bad.filter((b) => !seen.has(b.id)).map(({ verdicts, agree, ok, ...rest }) => rest))
}

const finalRatio = confirmed.length / claims.length
log(`verification done: ${confirmed.length}/${claims.length} confirmed (${(finalRatio * 100).toFixed(1)}%), ${pending.length} still unconfirmed`)

phase('Synthesize')
const FINAL = {
  type: 'object',
  properties: {
    ceilingPercent: { type: 'object', properties: { byWorkbenchCount: { type: 'number' }, byDailyUse: { type: 'number' }, bySeatsReplaceable: { type: 'number' }, note: { type: 'string' } }, required: ['byWorkbenchCount', 'byDailyUse', 'bySeatsReplaceable', 'note'] },
    workbenches: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, plain: { type: 'string' }, coverage: { type: 'number' }, mode: { type: 'string' }, blocker: { type: 'string' }, months: { type: 'string' }, confidence: { type: 'string' } }, required: ['name', 'plain', 'coverage', 'mode', 'blocker', 'months', 'confidence'] } },
    seats: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, plain: { type: 'string' }, share: { type: 'number' }, replaceable: { type: 'string' } }, required: ['type', 'plain', 'share', 'replaceable'] } },
    money: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, value: { type: 'string' }, range: { type: 'string' }, plain: { type: 'string' }, confidence: { type: 'string' } }, required: ['item', 'value', 'range', 'plain', 'confidence'] } },
    walls: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, analogy: { type: 'string' }, fixable: { type: 'string' }, months: { type: 'string' } }, required: ['name', 'analogy', 'fixable', 'months'] } },
    precedents: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, years: { type: 'string' }, team: { type: 'string' }, outcome: { type: 'string' }, lesson: { type: 'string' } }, required: ['name', 'years', 'team', 'outcome', 'lesson'] } },
    verdicts: { type: 'object', properties: { hundredPercent: { type: 'string' }, beatCatiaOnPrice: { type: 'string' }, businessAtAll: { type: 'string' }, recommendation: { type: 'string' } }, required: ['hundredPercent', 'beatCatiaOnPrice', 'businessAtAll', 'recommendation'] },
  },
  required: ['ceilingPercent', 'workbenches', 'seats', 'money', 'walls', 'precedents', 'verdicts'],
}
const final = await agent(`${CONTEXT}

You are the SYNTHESIZER. Below are ${confirmed.length} claims that survived 2-of-3 adversarial verification (${(finalRatio * 100).toFixed(1)}% of ${claims.length}), followed by ${pending.length} that did not. Build the final page data. Use ONLY confirmed claims for numbers; you may mention an unconfirmed topic only by labelling it "미확정". Every 'plain' field is Korean for a 14-year-old. Coverage percentages are integers 0-100. 'mode' is one of "숫자만 바꾸기" (template parametric), "새로 그리기" (free modelling), "보기·검사" (view/measure), or "불가". Keep each workbench 'plain' to one sentence with an everyday analogy. 'walls' are the 4-6 concrete blockers with an analogy each and whether they are fixable (and in how many months) or structural.

CONFIRMED CLAIMS:
${confirmed.map((c) => `[${c.id}] ${c.topic} | ${c.headline} | value ${c.value} (${c.range} ${c.unit}) | conf ${c.confidence} | evidence: ${c.evidence} | plain: ${c.plain}`).join('\n')}

UNCONFIRMED (do not use their numbers):
${pending.map((c) => `[${c.id}] ${c.topic} | ${c.headline} | value ${c.value}`).join('\n')}`,
  { label: 'synthesize', phase: 'Synthesize', schema: FINAL, effort: 'high' })

return { final, stats: { totalClaims: claims.length, confirmed: confirmed.length, ratio: finalRatio, rounds: history, unconfirmed: pending.map((c) => ({ id: c.id, topic: c.topic, value: c.value })) }, confirmedClaims: confirmed.map((c) => ({ id: c.id, lens: c.lens, topic: c.topic, headline: c.headline, value: c.value, range: c.range, unit: c.unit, confidence: c.confidence, agree: c.agree, round: c.round, plain: c.plain })) }