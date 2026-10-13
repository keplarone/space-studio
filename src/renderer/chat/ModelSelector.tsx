import { useRef, useState } from "react";
import { Disclosure, Icon, ModelSwitchIcon, Popover } from "../ui";
import type { ModelId, ModelView } from "../lib/types";

const SPEED_LABEL: Record<ModelView["speed"], string> = { fastest: "Fastest", fast: "Fast", steady: "Steady", thorough: "Thorough" };
const PLAN_LABEL: Record<ModelView["minPlan"], string> = { free: "Free", plus: "Plus", pro: "Pro" };

export function ModelSelector({ models, value, onChange, offline = false }: { models: ModelView[]; value: ModelId; onChange: (m: ModelId) => void; offline?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const current = models.find((m) => m.id === value);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="model-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ModelSwitchIcon spinKey={value} />
        <span className="model-pill__name">{current?.name ?? "Choose model"}</span>
        <Icon name="chevronDown" size={14} className="icon-chevron-down" data-open={open ? "true" : "false"} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Choose a model" prefer="top" width={400}>
        <div className="model-list" role="radiogroup" aria-label="Models">
          {models.map((m) => {
            const selected = m.id === value;
            return (
              <div key={m.id} className="model-card" data-selected={selected ? "true" : "false"} data-available={m.available ? "true" : "false"}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!m.available}
                  className="model-card__pick"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                    anchor.current?.focus();
                  }}
                >
                  <span className="model-card__top">
                    <span className="model-card__name">{m.name}</span>
                    <span className="chip">{SPEED_LABEL[m.speed] ?? m.speed}</span>
                    {offline ? <span className="chip">Availability unknown — not connected</span> : !m.available && <span className="chip chip--warn">Requires {PLAN_LABEL[m.minPlan] ?? m.minPlan}+</span>}
                    {selected && <Icon name="check" size={16} className="model-card__check" />}
                  </span>
                  <span className="model-card__tagline">{m.tagline}</span>
                  {m.strengths.length > 0 && (
                    <span className="model-card__row"><strong>Strengths:</strong> {m.strengths.join(" · ")}</span>
                  )}
                  {m.capabilities.length > 0 && (
                    <span className="model-card__row"><strong>Can:</strong> {m.capabilities.join(" · ")}</span>
                  )}
                  <span className="model-card__row model-card__credit">{m.creditNote}</span>
                </button>
                <Disclosure summary="Technical details">
                  <dl className="kv">
                    <dt>Provider</dt><dd>{m.provider}</dd>
                    <dt>Underlying model</dt><dd>{m.underlyingModel}</dd>
                    <dt>Customization</dt><dd>Specialized configuration on Claude — not fine-tuned</dd>
                  </dl>
                </Disclosure>
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
