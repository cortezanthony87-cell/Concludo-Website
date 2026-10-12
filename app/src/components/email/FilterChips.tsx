/**
 * A set of toggle filters.
 *
 * Built from real `<button aria-pressed>` elements rather than styled divs, so
 * keyboard operation, focus and the pressed state come from the platform
 * instead of being reimplemented and got slightly wrong.
 *
 * Each chip carries a description saying what it selects, because a label like
 * "Needs information" does not tell a new person what the module means by it.
 */
import React, { useId } from 'react';
import { Check } from 'lucide-react';

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  description?: string;
  /** Shown after the label. Omitted rather than shown as zero. */
  count?: number;
}

interface Props<K extends string> {
  legend: string;
  options: readonly ChipOption<K>[];
  active: readonly K[];
  onToggle: (key: K) => void;
  onClear?: () => void;
  /** Says how the chips combine, because two ticked boxes could mean either. */
  combineNote?: string;
}

export function FilterChips<K extends string>({
  legend,
  options,
  active,
  onToggle,
  onClear,
  combineNote = 'Choosing more than one narrows the list rather than widening it.',
}: Props<K>) {
  const id = useId();

  return (
    <fieldset className="ecc-chips">
      <legend className="ecc-chips-legend">{legend}</legend>
      <p className="ecc-chips-note" id={`${id}-note`}>
        {combineNote}
      </p>
      <div className="ecc-chip-row">
        {options.map((option) => {
          const on = active.includes(option.key);
          const descriptionId = option.description ? `${id}-${option.key}` : undefined;
          return (
            <span key={option.key} className="ecc-chip-wrap">
              <button
                type="button"
                className={`ecc-chip ${on ? 'ecc-chip-on' : ''}`}
                aria-pressed={on}
                aria-describedby={descriptionId}
                onClick={() => onToggle(option.key)}
              >
                {on ? <Check size={12} aria-hidden="true" /> : null}
                {option.label}
                {typeof option.count === 'number' ? (
                  <span className="ecc-chip-count">{option.count}</span>
                ) : null}
              </button>
              {option.description ? (
                <span id={descriptionId} className="ecc-visually-hidden">
                  {option.description}
                </span>
              ) : null}
            </span>
          );
        })}

        {onClear && active.length > 0 ? (
          <button type="button" className="ecc-text-button ecc-chip-clear" onClick={onClear}>
            Clear {active.length} {active.length === 1 ? 'filter' : 'filters'}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
