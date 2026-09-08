/**
 * 피처 트리 — piston.ts 의 형상 생성 8단계를 CATIA 의 스펙 트리처럼 보여준다.
 * 각 단계를 누르면 그 단계를 지배하는 파라미터가 도면과 패널에서 강조된다.
 */
import type { NumericParamKey } from "../cad/params";

export interface FeatureNode {
  step: number;
  name: string;
  kind: string;
  params: NumericParamKey[];
  /** off 로 끌 수 있는 단계 */
  toggle?: "valvePockets" | "drainHoles";
}

export const FEATURES: readonly FeatureNode[] = [
  { step: 1, name: "몸통 (패드)", kind: "회전 돌출 + 챔퍼", params: ["D", "TH"] },
  { step: 2, name: "속 파기 (포켓)", kind: "회전 컷 2단", params: ["skirtWall", "beltWall", "crownT"] },
  { step: 3, name: "슬리퍼 스커트", kind: "박스 컷 2개", params: ["panelAngle", "reliefBelowBelt"] },
  { step: 4, name: "핀 보스", kind: "패드 + 로드 자리 컷", params: ["bossWall", "bossBelow", "rodGap", "bossRecess"] },
  { step: 5, name: "핀 구멍", kind: "가로 방향 홀", params: ["pinD", "CH"] },
  { step: 6, name: "링 홈 3개", kind: "홈 (그루브)", params: ["topLand", "ringW", "ringDepth", "land2", "land3", "oilW", "oilDepth", "beltBelowOil"] },
  { step: 7, name: "밸브 포켓 4개", kind: "포켓 패턴", params: ["D"], toggle: "valvePockets" },
  { step: 8, name: "오일 배유 구멍 4개", kind: "원형 패턴 홀", params: ["beltWall"], toggle: "drainHoles" },
];

export interface FeatureTreeProps {
  /** 켜짐/꺼짐 상태 */
  valvePockets: boolean;
  drainHoles: boolean;
  /** 마지막 생성이 실패한 단계 번호 (오류 메시지에서 뽑음) */
  failedStep: number | null;
  chamferApplied: boolean;
  selected: number | null;
  onSelect: (step: number | null) => void;
  onToggle: (key: "valvePockets" | "drainHoles", value: boolean) => void;
}

export default function FeatureTree({
  valvePockets,
  drainHoles,
  failedStep,
  chamferApplied,
  selected,
  onSelect,
  onToggle,
}: FeatureTreeProps) {
  const isOn = (f: FeatureNode): boolean =>
    f.toggle === "valvePockets" ? valvePockets : f.toggle === "drainHoles" ? drainHoles : true;

  return (
    <div className="tree" aria-label="피처 트리">
      <div className="tree-root">피스톤 · 파라메트릭 바디</div>
      <ul className="tree-list">
        {FEATURES.map((f) => {
          const on = isOn(f);
          const failed = failedStep === f.step;
          const after = failedStep !== null && f.step > failedStep;
          return (
            <li key={f.step}>
              <button
                type="button"
                className={`tree-node${selected === f.step ? " tree-node-sel" : ""}${on ? "" : " tree-node-off"}${failed ? " tree-node-fail" : ""}${after ? " tree-node-after" : ""}`}
                onClick={() => onSelect(selected === f.step ? null : f.step)}
                aria-pressed={selected === f.step}
              >
                <span className="tree-idx">{f.step}</span>
                <span className="tree-name">{f.name}</span>
                <span className="tree-kind">{f.kind}</span>
                {failed && <span className="tree-badge tree-badge-fail">실패</span>}
                {!on && <span className="tree-badge">꺼짐</span>}
              </button>
              {f.toggle && (
                <label className="tree-toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => onToggle(f.toggle as "valvePockets" | "drainHoles", e.target.checked)}
                  />
                  <span>이 피처 사용</span>
                </label>
              )}
              {selected === f.step && (
                <div className="tree-detail">
                  구동 파라미터: {f.params.join(", ")}
                  {f.step === 1 && !chamferApplied && <div className="tree-detail-warn">크라운 챔퍼는 이 형상에서 생략됨</div>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="tree-note">
        순서는 불리언 실패를 피하려고 고정돼 있습니다. 값을 바꾸면 1번부터 다시 만듭니다.
      </p>
    </div>
  );
}

/** "[단계 3: 슬리퍼 스커트] ..." 형태의 오류에서 단계 번호를 뽑는다 */
export function parseFailedStep(message: string | null): number | null {
  if (!message) return null;
  const m = /\[단계\s*(\d+)/.exec(message);
  return m && m[1] ? Number(m[1]) : null;
}
