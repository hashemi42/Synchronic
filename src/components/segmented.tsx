"use client";

import { useId } from "react";

type Props<T extends string> = {
  legend: string;
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
};

/** A radio group drawn as a segmented control. Selection is solid ink, never colour alone (A-3). */
export function Segmented<T extends string>({ legend, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="flex rounded-full border border-edge p-0.5">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex h-8 cursor-pointer items-center rounded-full px-3 text-sm font-medium text-ink-2 hover:bg-fill has-checked:bg-ink has-checked:text-white has-disabled:cursor-not-allowed has-disabled:text-edge has-disabled:hover:bg-transparent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
