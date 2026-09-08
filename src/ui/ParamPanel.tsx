/**
 * 파라미터 패널: 슬라이더 + 숫자 입력 (한국어 라벨), 초기값 복원, 링크 복사. (규칙 경고는 App 이 패널 최상단에 표시)
 */
import { useEffect, useState } from "react";
import {
  BOOLEAN_PARAM_SPECS,
  NUMERIC_PARAM_SPECS,
  type BooleanParamKey,
  type NumericParamKey,
  type NumericParamSpec,
  type PistonParams,
} from "../cad/params";

export interface ParamPanelProps {
  params: PistonParams;
  /** 도면에서 가리키고 있는 파라미터 */
  highlightParam?: NumericParamKey | null;
  /** 피처 트리에서 고른 단계가 쓰는 파라미터들 */
  featureParams?: NumericParamKey[] | null;
  onHoverParam?: (key: NumericParamKey | null) => void;
  onNumberChange: (key: NumericParamKey, value: number) => void;
  onBooleanChange: (key: BooleanParamKey, value: boolean) => void;
  onReset: () => void;
  onCopyLink: () => void;
  copied: boolean;
  isDefault: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 숫자 입력: 타이핑 중간 상태를 허용하고, 유효한 값일 때만 커밋 · blur 시 범위로 자름 */
function NumberField({ spec, value, onCommit }: { spec: NumericParamSpec; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string, clampNow: boolean) => {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) {
      if (clampNow) setText(String(value));
      return;
    }
    if (clampNow) {
      const c = clamp(n, spec.min, spec.max);
      setText(String(c));
      if (c !== value) onCommit(c);
      return;
    }
    if (n >= spec.min && n <= spec.max && n !== value) onCommit(n);
  };

  return (
    <input
      className="num"
      type="number"
      inputMode="decimal"
      min={spec.min}
      max={spec.max}
      step={spec.step}
      value={text}
      aria-label={`${spec.label} 숫자 입력`}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value, false);
      }}
      onBlur={(e) => commit(e.target.value, true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit((e.target as HTMLInputElement).value, true);
      }}
    />
  );
}

export default function ParamPanel({ params, highlightParam = null, featureParams = null, onHoverParam, onNumberChange, onBooleanChange, onReset, onCopyLink, copied, isDefault }: ParamPanelProps) {
  return (
    <div className="param-panel">
      <div className="panel-actions">
        <button className="btn" type="button" onClick={onCopyLink} data-testid="copy-link">
          {copied ? "복사됨 ✓" : "링크 복사"}
        </button>
        <button className="btn" type="button" onClick={onReset} disabled={isDefault} data-testid="reset">
          초기값 복원
        </button>
      </div>
      <div className="param-list">
        {NUMERIC_PARAM_SPECS.map((spec) => {
          const v = params[spec.key];
          const hot = highlightParam === spec.key;
          const inFeature = featureParams !== null && featureParams.includes(spec.key);
          const dim = featureParams !== null && !inFeature;
          return (
            <div
              className={`param-row${hot ? " param-row-hot" : ""}${inFeature ? " param-row-feature" : ""}${dim ? " param-row-dim" : ""}`}
              key={spec.key}
              onMouseEnter={() => onHoverParam?.(spec.key)}
              onMouseLeave={() => onHoverParam?.(null)}
            >
              <label className="param-label" htmlFor={`slider-${spec.key}`}>
                <span>{spec.label}</span>
                <span className="param-key">{spec.key}</span>
              </label>
              <input
                id={`slider-${spec.key}`}
                className="slider"
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={v}
                onChange={(e) => onNumberChange(spec.key, Number(e.target.value))}
              />
              <NumberField spec={spec} value={v} onCommit={(n) => onNumberChange(spec.key, n)} />
              <span className="unit">{spec.unit}</span>
            </div>
          );
        })}
        {BOOLEAN_PARAM_SPECS.map((spec) => (
          <div className="param-row param-row-bool" key={spec.key}>
            <label className="param-label" htmlFor={`check-${spec.key}`}>
              <span>{spec.label}</span>
              <span className="param-key">{spec.key}</span>
            </label>
            <input
              id={`check-${spec.key}`}
              type="checkbox"
              checked={params[spec.key]}
              onChange={(e) => onBooleanChange(spec.key, e.target.checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
