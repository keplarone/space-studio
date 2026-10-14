import { useRef, useState } from "react";
import { Disclosure, Popover } from "../ui";
import type { ModelId, ModelView } from "../lib/types";

const SPEED_LABEL: Record<ModelView["speed"], string> = { fastest: "Fastest", fast: "Fast", steady: "Steady", thorough: "Thorough" };
const PLAN_LABEL: Record<ModelView["minPlan"], string> = { free: "Free", plus: "Plus", pro: "Pro" };

function sentence(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function ModelSelector({ models, value, onChange, offline = false }: { models: ModelView[]; value: ModelId; onChange: (m: ModelId) => void; offline?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const current = models.find((m) => m.id === value);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="model-select"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Model: ${current?.name ?? "none selected"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="model-select__key" aria-hidden="true">Model</span>
        <span className="model-select__name">{current?.name ?? "Choose"}</span>
        <span className="caret caret--down" data-open={open ? "true" : "false"} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Choose a model" prefer="top" width={400}>
        <div className="model-list" role="radiogroup" aria-label="Models">
          {models.map((m) => {
            const selected = m.id === value;
            const availability = offline ? "Availability unknown while not connected" : !m.available ? `Requires ${PLAN_LABEL[m.minPlan] ?? m.minPlan} or above` : null;
            return (
              <div key={m.id} className="model-option" data-selected={selected ? "true" : "false"} data-available={m.available ? "true" : "false"}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!m.available}
                  className="model-option__pick"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                    anchor.current?.focus();
                  }}
                >
                  <span className="model-option__top">
                    <span className="model-option__name">{m.name}</span>
                    <span className="model-option__speed">{SPEED_LABEL[m.speed] ?? m.speed}</span>
                    {selected && <span className="model-option__selected">Selected</span>}
                  </span>
                  <span className="model-option__tagline">{m.tagline}</span>
                  {availability && <span className="model-option__row model-option__warn">{availability}</span>}
                  {m.strengths.length > 0 && (
                    <span className="model-option__row"><strong>Strengths:</strong> {m.strengths.join(", ")}</span>
                  )}
                  {m.capabilities.length > 0 && (
                    <span className="model-option__row"><strong>Can:</strong> {m.capabilities.join(", ")}</span>
                  )}
                  <span className="model-option__row">{m.creditNote}</span>
                </button>
                <Disclosure summary="Technical details">
                  <dl className="kv">
                    <dt>Customization</dt><dd>{m.customization ? sentence(m.customization) : "Configuration only, not fine-tuned"}</dd>
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
