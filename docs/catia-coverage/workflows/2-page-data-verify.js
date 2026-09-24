export const meta = {
  name: 'catia-page-data-verified',
  description: 'Rebuild the CATIA-coverage page data strictly from the 87 confirmed claims, then loop 3 independent checkers (traceability, consistency, reader) until all pass',
  phases: [
    { title: 'Rebuild', detail: 'one high-effort agent builds structured page data with claim ids on every number' },
    { title: 'Verify', detail: '3 checkers per round; fixer applies blocking issues; up to 4 rounds' },
  ],
}

const DIR = '/tmp/claude-0/-home-user-piston-webcad-demo/d3b6b75d-e37c-54cf-808a-4ec885fd80b5/scratchpad'
const MAX_ROUNDS = 4

const S = { type: 'string' }
const N = { type: 'number' }
const B = { type: 'boolean' }
const IDS = { type: 'array', items: { type: 'string' } }
const CONF = { type: 'string', enum: ['high', 'medium', 'low'] }
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props) })
const arr = (items) => ({ type: 'array', items })

const PAGE = obj({
  hundred: obj({ verdict: S, probability: S, short: S, reasons: arr(obj({ title: S, plain: S })), claimIds: IDS }),
  rulers: arr(obj({
    key: { type: 'string', enum: ['whole', 'core', 'piston', 'seats'] },
    title: S, question: S, plain: S,
    points: arr(obj({ who: S, value: N, lo: N, hi: N, label: S, note: S, isNow: B, isGoal: B })),
    footnote: S, claimIds: IDS,
  })),
  oneLine: S,
  daily: obj({ count: N, names: arr(S), share: N, lo: N, hi: N, plain: S, claimIds: IDS }),
  kernel: obj({ catiaLo: N, catiaHi: N, kernelLo: N, kernelHi: N, rawShare: N, share: N, lo: N, hi: N, plain: S, claimIds: IDS }),
  workbenches: arr(obj({
    name: S, plain: S,
    todayKnown: B, today: N, todayLo: N, todayHi: N, todayNote: S,
    mature: N, matureLo: N, matureHi: N,
    weight: N,
    mode: { type: 'string', enum: ['숫자만 바꾸기', '새로 그리기', '보기·검사', '불가'] },
    blocker: S, months: S, monthsLo: N, monthsHi: N, confidence: CONF, claimIds: IDS,
  })),
  buildAll: obj({ monthsLo: N, monthsHi: N, yearsFor5Lo: N, yearsFor5Hi: N, weightedMature: N, plain: S }),
  walls: arr(obj({ name: S, analogy: S, verdict: { type: 'string', enum: ['고칠 수 있음', '어렵지만 가능', '불확실', '구조적 벽'] }, detail: S, months: S, claimIds: IDS })),
  seats: obj({
    groups: arr(obj({ type: S, plain: S, share: N, lo: N, hi: N, replace: N, replaceLo: N, replaceHi: N, note: S, claimIds: IDS })),
    workShare: obj({ value: N, lo: N, hi: N, plain: S }),
    wholeSeats: obj({ value: N, lo: N, hi: N, plain: S }),
    afterOem: obj({ value: N, lo: N, hi: N, plain: S }),
    plain: S, claimIds: IDS,
  }),
  prices: arr(obj({ name: S, kind: { type: 'string', enum: ['catia', 'rival', 'free', 'ours'] }, lo: N, hi: N, mid: N, note: S, claimIds: IDS })),
  money: arr(obj({ group: { type: 'string', enum: ['고객 쪽', '만드는 쪽', '사업 쪽'] }, item: S, short: S, range: S, plain: S, confidence: CONF, claimIds: IDS })),
  business: obj({ savedPerSeat: N, revenuePerSeat: N, capture: N, captureLo: N, captureHi: N, yearlyCost: N, seatsNeeded: N, seatsLo: N, seatsHi: N, customers: S, odds: N, oddsLo: N, oddsHi: N, runway: S, plain: S, claimIds: IDS }),
  precedents: arr(obj({ name: S, years: S, team: S, outcome: S, lesson: S, claimIds: IDS })),
  verdicts: arr(obj({ q: S, short: S, detail: S, robust: S, claimIds: IDS })),
  plan: arr(obj({ when: S, what: S })),
  glossary: arr(obj({ term: S, plain: S })),
  trust: obj({ tiers: arr(obj({ what: S, conf: S, lo: N, hi: N })), overall: S, plain: S, claimIds: IDS }),
})

const CHECK = obj({
  pass: B,
  issues: arr(obj({ path: S, problem: S, fix: S, severity: { type: 'string', enum: ['blocking', 'minor'] } })),
  summary: S,
})

const SOURCES = `SOURCE FILES (read them with Bash + python3/jq; they are large, so query by id or lens instead of printing everything at once):
- ${DIR}/claims-slim.json: the 87 CONFIRMED claims (each passed 2-of-3 independent adversarial checkers). Fields: id, topic, headline, value, range, unit, confidence, evidence, plain. These are the ONLY allowed source of numbers.
- ${DIR}/claims-full.json: the same 87 claims plus each confirming checker's notes (key "confirmed"), the 1 UNCONFIRMED claim with its checker notes (key "unconfirmed"), and the verification stats (key "stats": 88 claims, 87 confirmed = 98.9%, 3 rounds: 29 / +41 / +17).
- ${DIR}/final-v1.json: an earlier synthesis of the same claims. It is known to have problems (listed below). Reuse its good Korean wording where it is correct.`

const AUDIENCE = `AUDIENCE AND QUESTION. The reader is a Korean mechanical engineer who designs pistons and engine components and uses CATIA V5 daily. They asked: "How much of CATIA can a web CAD implement? Could it be 100%? CATIA licences are expensive; if a web CAD saved that cost it could be a big business." They want the answer shown so that a middle-school student (14 years old) can follow it. All user-facing strings are Korean (해요체 is fine), short sentences, one idea each, everyday analogies, no unexplained jargon; every technical term used in a 'plain', 'short', 'title', 'question' or 'analogy' field must appear in 'glossary' with a one-sentence plain explanation. 'detail', 'blocker', 'evidence-like' fields may be more technical.`

const RULES = `HARD RULES FOR THE PAGE DATA.
1. Every number on the page must come from a confirmed claim (put its id in the nearest claimIds) or be simple arithmetic on confirmed numbers; arithmetic results must say so in the text (e.g. "확인된 숫자를 더한 값"). Never invent a number. Never use a number that only appears in the UNCONFIRMED claim workbench-map-21 (the 20-workbench simple average 37%); you may mention it only as "미확정".
2. Ranges: lo <= value <= hi, same unit as value. Money in prices[] is 만원 per seat per year. business.savedPerSeat and revenuePerSeat are 만원 per seat per year; business.yearlyCost is 억원 per year.
3. Keep denominators separate. There are four rulers, each with ONE denominator:
   - key 'whole': "CATIA 전체 (작업실=워크벤치 약 100개)". Use hundred-percent-2 (5-person team 4-7 years: about 3%, 2-4%, computed as coverage x 5/100), hundred-percent-3 (100-person team 10-15 years: about 35%, 20-50%), precedent-4 (Onshape: about 15% by area count, 10-25%, about 10% when depth-weighted; say which one you use and why it is comparable), and CATIA itself = 100. KNOWN PITFALL: precedent-16 says the demo today "touches 5-10 workbenches partially, 3-5% by count". That is a different counting method from hundred-percent-2's 3%, so do NOT put it on the same axis as a point (it would read as "today 5%, after 5 years 3%"). Put it in 'footnote' or a point note explaining the difference, or leave the 'now' point off this ruler.
   - key 'core': "CATIA 핵심 기능 117개 (스케치·부품·도면·파라미터·UI)". Points: demo today about 5% (3-8, hundred-percent-12: 6-9 of 117 features run today), 5-person team 4-7 years 55-60% (45-70, hundred-percent-2), 100-person team 10-15 years about 85% (75-92, hundred-percent-3). You may add 2-6 person or 5-10 person 3-year points from usage-and-seats-19 only if they do not contradict the 5-person 4-7-year point; if they would confuse, leave them out.
   - key 'piston': "피스톤 설계자의 하루 일 (작업 시간)". Points: 5-person team 4-7 years about 40% (30-50, hundred-percent-2) and "모든 작업실을 각자 끝까지 만들었을 때" about 60%. KNOWN PITFALL: workbench-map-22's 61% (52-68) was computed with EARLIER workbench scores (Part Design 80, Sketcher 55, DMU 70, Knowledgeware 75). Recompute it with the claim's own weights and the FINAL mature scores you put in workbenches[] and report the recomputed number in buildAll.weightedMature; if it stays inside 52-68, present the point as about 60 with lo 52 hi 68 and say in the note that it was recomputed. There is no confirmed 'today' number on this ruler: leave the today point out.
   - key 'seats': "실제로 없앨 수 있는 CATIA 좌석". Points: demo as-is 0-5% (precedent-14), productized measured capability about 10% (0-30, licence-economics-9), with solver and free sketching about 15% (5-30, precedent-14); mention OEM-native-delivery suppliers 0-5% and the 50-seat example (about 6 seats, 4-9; usage-and-seats-12/13) in notes.
   Use the SAME team scenarios across rulers wherever the claims allow ("지금 데모", "5명 팀 × 4~7년", "100명 팀 × 10~15년"), so the reader can compare rows. isNow marks the demo-today point, isGoal marks the CATIA=100 or 'everything' reference point. 'label' is the display text for the point (e.g. "55~60%").
4. workbenches[]: one row per workbench in final-v1 (20 rows). 'mature' = the per-workbench ceiling from its workbench-map claim (a mature build of THAT workbench), with matureLo/matureHi from the claim's range. 'today' only when a confirmed claim states a today value for the app (Sketcher about 20, Part Design about 30, Assembly about 30, Drafting about 35, Sheetmetal about 5, DMU 0-5 on the app screen, GSD and WSD 0 on the app screen because nothing is exposed in the UI although the kernel can do it); otherwise todayKnown=false, today=0, todayLo=0, todayHi=0 and todayNote says "오늘 값은 따로 재지 않았어요" or what is known. 'weight' = the share of a piston designer's day from workbench-map-22's weights (Part Design 30, Sketcher 20, Drafting 12, Assembly 10, GSD 6, DMU 5, Knowledgeware 4, native files 4, STEP/IGES/JT 3, PLM 3, FEA 1, WSD 1, Kinematics 1, all others 0). monthsLo/monthsHi = person-months (인월) to reach the mature score as numbers taken from the claim (0 and 0 when impossible or out of scope, e.g. PLM under the static-site rule, native CATPart); the 'months' string keeps the human-readable version.
5. buildAll: add up monthsLo and monthsHi over all workbenches that have them (state in 'plain' what you excluded, e.g. WSD if it is shared with GSD, PLM, native files) and convert to years for a 5-person team (months / 5 / 12). Say plainly that the mature scores are per-workbench ceilings and that reaching all of them takes that long, which is why the 5-person 4-7-year figures on the rulers are lower. This arithmetic must be exact.
6. seats.groups: the five seat types. share values come from usage-and-seats-1..5 (note: usage-and-seats-2 was revised to 25%, so the five shares sum to 95; say in seats.plain that about 5% of seats is unclassified). replace/replaceLo/replaceHi are numbers from usage-and-seats-6..10. workShare = usage-and-seats-11 (49, 35-60), and note that re-multiplying the final per-type rates gives about 42-44 (arithmetic, say so). wholeSeats = usage-and-seats-12 (12 of 50, 8-17). afterOem = usage-and-seats-13 (about 6 of 50, 4-9).
7. walls: 4-6 walls with verdict enum: '고칠 수 있음' (solver, memory/leak), '어렵지만 가능' (feature history/topological naming), '불확실' (freeform fillet kernel quality), '구조적 벽' (native CATPart with history, OEM product-name mandates).
8. prices[]: per-seat-per-year chart rows in 만원 with lo/mid/hi: CATIA 3DEXPERIENCE subscription (licence-economics-3), CATIA V5 perpetual averaged over 5 years (hundred-percent-13: 500-1,250), CATIA V5 maintenance only (licence-economics-2), SOLIDWORKS, Onshape, Dassault 3D Creator, Fusion (licence-economics-5), FreeCAD 0, and 'ours' = realistic web-CAD price 70-200, mid 100 (licence-economics-11). kind marks which is which.
9. money[]: 8-12 tiles, each with a SHORT headline value (<= 16 characters, e.g. "약 16억 원") in 'short', the range in 'range', and one plain sentence or two. Group them as '고객 쪽' (what CATIA costs the customer, what they could save), '만드는 쪽' (what it costs to build: 10.8억 people-only, 7.0억 with AI help, templates), '사업 쪽' (revenue capture, seats needed, break-even, odds).
10. business: numbers from licence-economics-8/10/11/12 and hundred-percent-14 (savedPerSeat 540 is the assumption used in licence-economics-8/10; revenuePerSeat 100; capture 20 with 5-62; yearlyCost 8.64; seatsNeeded 860 with 432-1,235; customers "약 215~430곳"; odds 20 with 8-40; runway "약 6억~23억 원").
11. verdicts: exactly 4 items, in this order: "100% 가능한가?", "라이선스 값으로 CATIA를 이길 수 있나?", "라이선스 절감으로 큰 사업이 되나?", "그럼 무엇을 하면 되나?". 'short' is at most 2 short sentences and starts with the answer word (e.g. "아니오." / "값만 보면 예, 사업으로는 거의 아니오."). 'detail' may be longer. 'robust' states, with numbers, whether the answer still holds at the most optimistic end of every relevant range (e.g. even with the best-case capture 62% and 30% of seats, ...). For the 4th verdict, 'robust' says what would change the recommendation.
12. plan: 3-4 steps (when, what) taken from final-v1's recommendation.
13. trust: tiers from usage-and-seats-21 and hundred-percent-15 (measured facts about 95%, symbol presence about 99%, one-off probes 85-95%, extrapolated limits 60-75%, 'does not work' verdicts 75-85%, public list prices 80-90%, CATIA street prices and seat mix 55-70%, effort and market estimates 40-60%), overall about 75% (65-85) from hundred-percent-15. 'plain' must explain honestly, for a 14-year-old, the difference between (a) the verification pass rate 98.9% (87 of 88 claims were accepted by at least 2 of 3 independent checkers; the target was 90%) and (b) how certain each kind of number is; and that the main conclusions hold even at the optimistic ends of the ranges.
14. hundred.reasons: exactly 3 (amount of work, native files with feature history only made inside CATIA, OEMs name the CAD product) with numbers. oneLine: one sentence that answers the whole question.
15. daily: count 5 (Part Design, Sketcher, Drafting, Assembly, DMU), share 80 (70-92, usage-and-seats-16, an estimate not a log measurement - say so). kernel: CATIA V5 5,000-15,000 person-years, OpenCascade 1,500-4,500, rawShare 30 (the simple median ratio), share 20 (10-40, hundred-percent-10, discounted for weaker robustness, missing solver and missing bindings) - explain the discount plainly.`

const KNOWN = `KNOWN PROBLEMS IN final-v1.json that you must fix: (a) its ceilingPercent note puts "지금 데모 약 5%" next to "워크벤치 개수로 세기 3%" as if on one scale; (b) it headlines 61% without saying that it needs every workbench built to its ceiling (far beyond a 5-person team) and without recomputing it with the final scores; (c) seat 'replaceable' values are free text, walls' fixability is free text; (d) verdicts and money values are paragraphs, too long for cards; (e) nothing tells the reader that per-workbench scores are ceilings, not what a small team reaches.`

phase('Rebuild')
let page = await agent(`${AUDIENCE}

You are building the DATA for a visual one-page report. A renderer will draw it: four rulers (ladder charts), a 100-dot workbench grid, a kernel bar, workbench rows with a 'today' bar and a 'mature ceiling' bar, walls, a 50-seat waffle, a price range chart, money tiles, a revenue-capture picture, a precedent timeline, four verdict cards, a plan, a glossary and a trust section.

${SOURCES}

${RULES}

${KNOWN}

Work carefully: read every confirmed claim you cite, do the arithmetic yourself (python3 is available), and put claim ids on every block. Return the complete page data.`, { label: 'rebuild', phase: 'Rebuild', schema: PAGE, effort: 'high' })

if (!page) throw new Error('rebuild agent returned nothing')

const CHECKERS = [
  {
    key: 'trace',
    brief: `You are the TRACEABILITY checker. For EVERY number and every factual statement in the page data, find the confirmed claim that supports it (use the cited claimIds first, then search). Flag as blocking: a number with no confirmed source; a number that differs from its source beyond rounding; a lo/hi that does not match the source range; a number used from the unconfirmed claim workbench-map-21; arithmetic (sums, recomputed weighted averages, year conversions, per-type seat products) that is wrong - recompute it with python3; a claimIds list that cites an id that does not support the text. Flag as minor: a missing claim id where the source is obvious.`,
  },
  {
    key: 'consistency',
    brief: `You are the CONSISTENCY checker. Flag as blocking: two places on the page that give different numbers for the same thing; a ruler that mixes denominators or places points so that a later/bigger team scores lower than an earlier/smaller one on the same axis without an explanation; a workbench whose today > mature, or whose value lies outside [lo, hi]; seat shares or replace rates that disagree with the seat tiles; money tiles that disagree with prices[] or business; a verdict whose 'short' disagrees with its 'detail' or with the rulers; a 'robust' statement whose optimistic-end numbers are not the range ends actually on the page; units that are wrong (만원 vs 억원, % vs seats, 인월 vs 인년). Flag as minor: ordering or labelling that could be clearer.`,
  },
  {
    key: 'reader',
    brief: `You are the READER checker: read it as (1) a smart 14-year-old and (2) the piston engineer who asked the question. Flag as blocking: a jargon word in a plain/short/title/question/analogy field that is not in the glossary; a sentence that would mislead (e.g. implies certainty the trust section denies, implies the per-workbench ceilings are near-term, implies saved licence money becomes the builder's revenue); a verdict 'short' longer than 2 sentences or not starting with its answer; a money 'short' longer than 16 characters; the page failing to answer directly "how much of CATIA", "100%?", "big business from licence savings?"; a trust 'plain' that overstates or understates. Flag as minor: wording that is correct but clumsy. Write every fix in Korean.`,
  },
]

function checkPrompt(p, ch, round) {
  return `${AUDIENCE}

${ch.brief}

${SOURCES}

${RULES}

This is verification round ${round}. Check the PAGE DATA below. Set pass=true only if you find NO blocking issue. For each issue give the JSON path (e.g. "rulers[2].points[1].value"), the problem, and the exact fix (the replacement value or Korean text). Do not report the same problem twice. Keep minor issues to the ones that matter.

PAGE DATA:
${JSON.stringify(p, null, 1)}`
}

phase('Verify')
const history = []
let lastChecks = []
for (let round = 1; round <= MAX_ROUNDS; round++) {
  const checks = await parallel(CHECKERS.map((ch) => () =>
    agent(checkPrompt(page, ch, round), { label: `r${round}:${ch.key}`, phase: 'Verify', schema: CHECK, effort: 'high' })
      .then((r) => (r ? { ...r, checker: ch.key } : null))
  ))
  const valid = checks.filter(Boolean)
  lastChecks = valid
  const blocking = valid.flatMap((c) => c.issues.filter((i) => i.severity === 'blocking').map((i) => ({ ...i, checker: c.checker })))
  const minor = valid.flatMap((c) => c.issues.filter((i) => i.severity === 'minor').map((i) => ({ ...i, checker: c.checker })))
  const allPass = valid.length === CHECKERS.length && valid.every((c) => c.pass) && blocking.length === 0
  history.push({ round, checkers: valid.map((c) => ({ checker: c.checker, pass: c.pass, blocking: c.issues.filter((i) => i.severity === 'blocking').length, minor: c.issues.filter((i) => i.severity === 'minor').length, summary: c.summary })) })
  log(`round ${round}: ${valid.filter((c) => c.pass).length}/${CHECKERS.length} checkers pass, ${blocking.length} blocking, ${minor.length} minor`)
  if (allPass) break
  if (round === MAX_ROUNDS) break
  const fixed = await agent(`${AUDIENCE}

You are the FIXER. Apply every BLOCKING issue below to the page data (verify each against the sources first; if an issue is itself wrong, keep the original and do not change it). Also apply MINOR issues when they are clearly right and cheap. Do not change anything else. Keep the claimIds accurate. Return the complete corrected page data.

${SOURCES}

${RULES}

BLOCKING ISSUES:
${blocking.map((i, k) => `${k + 1}. [${i.checker}] ${i.path}: ${i.problem} -> FIX: ${i.fix}`).join('\n') || '(none)'}

MINOR ISSUES:
${minor.map((i, k) => `${k + 1}. [${i.checker}] ${i.path}: ${i.problem} -> FIX: ${i.fix}`).join('\n') || '(none)'}

CURRENT PAGE DATA:
${JSON.stringify(page, null, 1)}`, { label: `fix:r${round}`, phase: 'Verify', schema: PAGE, effort: 'high' })
  if (fixed) page = fixed
}

return { page, history, lastChecks }
