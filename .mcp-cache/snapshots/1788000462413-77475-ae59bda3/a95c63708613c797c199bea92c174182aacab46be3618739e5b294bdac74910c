import { useId, useMemo, type ReactNode } from "react";
import { FilterField } from "./FilterField";

const AGE_MIN = 18;
const AGE_MAX = 80;

interface AgeFilterProps {
  checked: boolean;
  onChangeChecked: (checked: boolean) => void;
  value: number[];
  onChangeValue: (value: number[]) => void;
}

function ageRangeLabel(value: number[]): string {
  if (!value || value.length < 2) return `${AGE_MIN} - ${AGE_MAX}`;
  const [min, max] = value;
  if (min === AGE_MIN && max === AGE_MAX) return `${AGE_MIN} - ${AGE_MAX}`;
  if (min === AGE_MIN) return `Any - ${max}`;
  if (max === AGE_MAX) return `${min}+`;
  return `${min} - ${max}`;
}

export function AgeFilter({
  checked,
  onChangeChecked,
  value,
  onChangeValue,
}: AgeFilterProps): ReactNode {
  const uid = useId();
  const label = useMemo(() => ageRangeLabel(value), [value]);

  const min = value?.[0] ?? AGE_MIN;
  const max = value?.[1] ?? AGE_MAX;

  const handleChange = (newMin: number, newMax: number) => {
    onChangeChecked(true);
    onChangeValue([newMin, newMax]);
  };

  return (
    <div className="inline-block w-full space-y-3">
      <FilterField>
        <input
          type="checkbox"
          id={`filters-age-${uid}`}
          checked={checked}
          onChange={(e) => onChangeChecked(e.target.checked)}
          className="size-4 rounded border-gray-300 accent-primary"
        />
        <label htmlFor={`filters-age-${uid}`} className="text-sm">
          Age
        </label>
        <span className="ml-auto min-w-0 truncate text-sm">{label}</span>
      </FilterField>
      <div className="ps-7">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{AGE_MIN}</span>
          <input
            type="range"
            min={AGE_MIN}
            max={AGE_MAX}
            value={min}
            onChange={(e) => handleChange(Number(e.target.value), max)}
            className="flex-1 accent-primary"
            aria-label="Minimum age"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="range"
            min={AGE_MIN}
            max={AGE_MAX}
            value={max}
            onChange={(e) => handleChange(min, Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Maximum age"
          />
          <span className="text-xs text-muted-foreground">{AGE_MAX}</span>
        </div>
      </div>
    </div>
  );
}
