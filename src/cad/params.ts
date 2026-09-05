/**
 * 피스톤 파라미터 정의 · 기본값 · 범위 · 유도값 · 규칙 검사
 * 순수 함수만 있음 (CAD 커널 무관, Node/브라우저 어디서나 실행 가능)
 */

export interface PistonParams {
  D: number; // 피스톤 외경
  TH: number; // 전체 높이
  CH: number; // 압축고 (핀 중심 ~ 크라운)
  pinD: number; // 핀 지름
  crownT: number; // 크라운 두께
  beltWall: number; // 링 벨트 벽 두께
  skirtWall: number; // 스커트 벽 두께
  topLand: number; // 톱 랜드 (크라운 ~ 1번 홈)
  ringW: number; // 압축링 홈 폭 (1·2번 공통)
  ringDepth: number; // 압축링 홈 깊이
  land2: number; // 1번 홈 ~ 2번 홈 랜드
  land3: number; // 2번 홈 ~ 오일 홈 랜드
  oilW: number; // 오일링 홈 폭
  oilDepth: number; // 오일링 홈 깊이
  beltBelowOil: number; // 오일 홈 아래 벨트 여유
  bossWall: number; // 핀 보스 벽 (핀 반경 바깥 살)
  bossBelow: number; // 핀 아래 보스 살
  rodGap: number; // 보스 안쪽 간격 (로드 자리)
  bossRecess: number; // 보스 끝면이 외경에서 들어간 양
  panelAngle: number; // 스커트 판 각도 (deg)
  reliefBelowBelt: number; // 벨트 아래 스커트 시작 여유
  valvePockets: boolean; // 밸브 포켓 4개
  drainHoles: boolean; // 오일 배유 구멍 4개
  density: number; // 밀도 g/cm³
}

export type NumericParamKey = {
  [K in keyof PistonParams]: PistonParams[K] extends number ? K : never;
}[keyof PistonParams];

export type BooleanParamKey = {
  [K in keyof PistonParams]: PistonParams[K] extends boolean ? K : never;
}[keyof PistonParams];

export interface NumericParamSpec {
  key: NumericParamKey;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: "mm" | "deg" | "g/cm³";
}

export interface BooleanParamSpec {
  key: BooleanParamKey;
  label: string;
  defaultValue: boolean;
}

export const NUMERIC_PARAM_SPECS: readonly NumericParamSpec[] = [
  { key: "D", label: "피스톤 외경", defaultValue: 81.95, min: 60, max: 110, step: 0.05, unit: "mm" },
  { key: "TH", label: "전체 높이", defaultValue: 52.0, min: 35, max: 80, step: 0.1, unit: "mm" },
  { key: "CH", label: "압축고 (핀 중심~크라운)", defaultValue: 30.0, min: 20, max: 50, step: 0.1, unit: "mm" },
  { key: "pinD", label: "핀 지름", defaultValue: 21.0, min: 14, max: 30, step: 0.1, unit: "mm" },
  { key: "crownT", label: "크라운 두께", defaultValue: 6.5, min: 4, max: 12, step: 0.1, unit: "mm" },
  { key: "beltWall", label: "링 벨트 벽 두께", defaultValue: 6.0, min: 4, max: 10, step: 0.1, unit: "mm" },
  { key: "skirtWall", label: "스커트 벽 두께", defaultValue: 2.6, min: 2, max: 5, step: 0.1, unit: "mm" },
  { key: "topLand", label: "톱 랜드 (크라운~1번 홈)", defaultValue: 4.5, min: 3, max: 8, step: 0.1, unit: "mm" },
  { key: "ringW", label: "압축링 홈 폭 (1·2번 공통)", defaultValue: 1.2, min: 1.0, max: 2.0, step: 0.05, unit: "mm" },
  { key: "ringDepth", label: "압축링 홈 깊이", defaultValue: 3.6, min: 2.5, max: 5, step: 0.1, unit: "mm" },
  { key: "land2", label: "1번 홈~2번 홈 랜드", defaultValue: 3.2, min: 2, max: 5, step: 0.1, unit: "mm" },
  { key: "land3", label: "2번 홈~오일 홈 랜드", defaultValue: 3.0, min: 2, max: 5, step: 0.1, unit: "mm" },
  { key: "oilW", label: "오일링 홈 폭", defaultValue: 2.0, min: 1.5, max: 3.5, step: 0.05, unit: "mm" },
  { key: "oilDepth", label: "오일링 홈 깊이", defaultValue: 3.2, min: 2.5, max: 5, step: 0.1, unit: "mm" },
  { key: "beltBelowOil", label: "오일 홈 아래 벨트 여유", defaultValue: 1.5, min: 1, max: 3, step: 0.1, unit: "mm" },
  { key: "bossWall", label: "핀 보스 벽 (핀 반경 바깥 살)", defaultValue: 6.0, min: 4, max: 10, step: 0.1, unit: "mm" },
  { key: "bossBelow", label: "핀 아래 보스 살", defaultValue: 5.0, min: 3, max: 8, step: 0.1, unit: "mm" },
  { key: "rodGap", label: "보스 안쪽 간격 (로드 자리)", defaultValue: 24.0, min: 16, max: 36, step: 0.1, unit: "mm" },
  { key: "bossRecess", label: "보스 끝면이 외경에서 들어간 양", defaultValue: 4.0, min: 2, max: 8, step: 0.1, unit: "mm" },
  { key: "panelAngle", label: "스커트 판 각도 (슬리퍼)", defaultValue: 110, min: 80, max: 140, step: 1, unit: "deg" },
  { key: "reliefBelowBelt", label: "벨트 아래 스커트 시작 여유", defaultValue: 1.0, min: 0.5, max: 2, step: 0.1, unit: "mm" },
  { key: "density", label: "밀도", defaultValue: 2.7, min: 2.5, max: 3.0, step: 0.01, unit: "g/cm³" },
];

export const BOOLEAN_PARAM_SPECS: readonly BooleanParamSpec[] = [
  { key: "valvePockets", label: "밸브 포켓 4개", defaultValue: true },
  { key: "drainHoles", label: "오일 배유 구멍 4개", defaultValue: true },
];

function buildDefaults(): PistonParams {
  const p: Record<string, number | boolean> = {};
  for (const s of NUMERIC_PARAM_SPECS) p[s.key] = s.defaultValue;
  for (const s of BOOLEAN_PARAM_SPECS) p[s.key] = s.defaultValue;
  return p as unknown as PistonParams;
}

export const DEFAULT_PARAMS: Readonly<PistonParams> = Object.freeze(buildDefaults());

/** 숫자 파라미터를 범위 안으로 자르고, 불리언은 그대로 둔다. */
export function clampParams(p: PistonParams): PistonParams {
  const out: PistonParams = { ...p };
  for (const s of NUMERIC_PARAM_SPECS) {
    const v = out[s.key];
    if (!Number.isFinite(v)) out[s.key] = s.defaultValue;
    else out[s.key] = Math.min(s.max, Math.max(s.min, v));
  }
  return out;
}

/** 5절 형상 생성에서 쓰는 유도값 (좌표계: Z 위, 바닥 z=0, 핀 축 = X, 스커트 판 = ±Y) */
export interface DerivedValues {
  R: number;
  pinR: number;
  zPin: number;
  g1Top: number;
  g1Bot: number;
  g2Top: number;
  g2Bot: number;
  oilTop: number;
  oilBot: number;
  zBeltBottom: number;
  zSkirtTop: number;
  xc: number;
  bossX: number;
  bossY: number;
  bossZ0: number;
  bossTop: number;
  /** 밸브 포켓 4개 (흡기 2 + 배기 2): 중심 x, y · 지름 · 깊이 */
  valvePockets: { x: number; y: number; diameter: number; depth: number; kind: "intake" | "exhaust" }[];
  /** 배유 구멍: 지름 1.8, 오일 홈 중앙 높이, 반경 방향 각도 */
  drainHoles: { angleDeg: number; z: number; diameter: number }[];
}

export function derive(p: PistonParams): DerivedValues {
  const R = p.D / 2;
  const pinR = p.pinD / 2;
  const zPin = p.TH - p.CH;
  const g1Top = p.TH - p.topLand;
  const g1Bot = g1Top - p.ringW;
  const g2Top = g1Bot - p.land2;
  const g2Bot = g2Top - p.ringW;
  const oilTop = g2Bot - p.land3;
  const oilBot = oilTop - p.oilW;
  const zBeltBottom = oilBot - p.beltBelowOil;
  const zSkirtTop = zBeltBottom - p.reliefBelowBelt;
  const xc = R * Math.cos(((p.panelAngle / 2) * Math.PI) / 180);
  const bossX = R - p.bossRecess;
  const bossY = pinR + p.bossWall;
  const bossZ0 = zPin - pinR - p.bossBelow;
  const bossTop = p.TH - p.crownT + 0.5;

  const D = p.D;
  const valvePockets: DerivedValues["valvePockets"] = [
    { x: +0.183 * D, y: +0.159 * D, diameter: 0.33 * D, depth: 1.0, kind: "intake" },
    { x: -0.183 * D, y: +0.159 * D, diameter: 0.33 * D, depth: 1.0, kind: "intake" },
    { x: +0.171 * D, y: -0.159 * D, diameter: 0.29 * D, depth: 0.7, kind: "exhaust" },
    { x: -0.171 * D, y: -0.159 * D, diameter: 0.29 * D, depth: 0.7, kind: "exhaust" },
  ];
  const oilMid = (oilTop + oilBot) / 2;
  const drainHoles: DerivedValues["drainHoles"] = [60, 120, 240, 300].map((angleDeg) => ({
    angleDeg,
    z: oilMid,
    diameter: 1.8,
  }));

  return {
    R,
    pinR,
    zPin,
    g1Top,
    g1Bot,
    g2Top,
    g2Bot,
    oilTop,
    oilBot,
    zBeltBottom,
    zSkirtTop,
    xc,
    bossX,
    bossY,
    bossZ0,
    bossTop,
    valvePockets,
    drainHoles,
  };
}

export interface RuleWarning {
  code:
    | "thin-belt-wall"
    | "boss-below-floor"
    | "ch-ratio-out-of-range"
    | "no-boss-width"
    | "belt-overlaps-pin";
  message: string;
}

/** 4절 규칙 검사. 경고가 있어도 생성은 계속한다. */
export function checkRules(p: PistonParams, d: DerivedValues = derive(p)): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  if (p.beltWall < Math.max(p.ringDepth, p.oilDepth) + 1.5) {
    warnings.push({ code: "thin-belt-wall", message: "링 홈 뒤 벽이 너무 얇음" });
  }
  if (d.bossZ0 < 2) {
    warnings.push({ code: "boss-below-floor", message: "핀 보스가 바닥 아래로 나감" });
  }
  const ratio = p.CH / p.D;
  if (ratio < 0.3 || ratio > 0.6) {
    warnings.push({ code: "ch-ratio-out-of-range", message: "압축고 비율이 일반 범위 밖" });
  }
  if (p.rodGap + 2 * p.bossWall >= 2 * d.bossX) {
    warnings.push({ code: "no-boss-width", message: "보스 폭이 남지 않음" });
  }
  if (d.zBeltBottom <= d.zPin + d.pinR) {
    warnings.push({ code: "belt-overlaps-pin", message: "링 벨트가 핀 구멍과 겹침" });
  }
  return warnings;
}

/** 다운로드 파일명: 주요 치수 포함 (예: piston_D82_CH30.step) */
export function exportFileName(p: PistonParams, ext: "step" | "stl"): string {
  const d = Math.round(p.D);
  const ch = Math.round(p.CH);
  return `piston_D${d}_CH${ch}.${ext}`;
}

/** 체적(mm³) → 질량(g). 1 cm³ = 1000 mm³ */
export function massFromVolume(volumeMm3: number, densityGcm3: number): number {
  return (volumeMm3 / 1000) * densityGcm3;
}
