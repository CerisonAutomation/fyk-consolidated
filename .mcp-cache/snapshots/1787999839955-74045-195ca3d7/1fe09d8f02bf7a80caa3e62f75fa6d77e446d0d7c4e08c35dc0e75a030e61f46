import { useMemo, type ReactNode } from "react";
import { FilterDropdown } from "./FilterDropdown";

const WEIGHT_KG_MIN = 40;
const WEIGHT_KG_MAX = 150;

interface WeightFilterProps {
  checked: boolean;
  onChangeChecked: (checked: boolean) => void;
  value: number[];
  onChangeValue: (value: number[]) => void;
  units?: "metric" | "imperial";
}

function formatWeight(kg: number, units: "metric" | "imperial"): string {
  if (units === "imperial") {
    const lbs = Math.round(kg * 2.20462);
    return `${lbs} lbs`;
  }
  return `${kg} kg`;
}

export function WeightFilter({
  checked,
  onChangeChecked,
  value,
  onChangeValue,
  units = "metric",
}: WeightFilterProps): ReactNode {
  const min = value?.[0] ?? WEIGHT_KG_MIN;
  const max = value?.[1] ?? WEIGHT_KG_MAX;

  const endLabel = useMemo(() => {
    const minLabel =
      min === WEIGHT_KG_MIN ? "No min" : formatWeight(min, units);
    const maxLabel =
      max === WEIGHT_KG_MAX ? "No max" : formatWeight(max, units);
    return `${minLabel} - ${maxLabel}`;
  }, [min, max, units]);

  const handleChange = (newMin: number, newMax: number) => {
    onChangeChecked(true);
    onChangeValue([newMin, newMax]);
  };

  return (
    <div className="block w-full space-y-3">
      <FilterDropdown
        id="weight"
        label="Weight"
        checked={checked}
        onChangeChecked={onChangeChecked}
        endLabel={endLabel}
        contentClass="ps-7 h-5"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {formatWeight(WEIGHT_KG_MIN, units)}
          </span>
          <input
            type="range"
            min={WEIGHT_KG_MIN}
            max={WEIGHT_KG_MAX}
            value={min}
            onChange={(e) => handleChange(Number(e.target.value), max)}
            className="flex-1 accent-primary"
            aria-label="Minimum weight"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="range"
            min={WEIGHT_KG_MIN}
            max={WEIGHT_KG_MAX}
            value={max}
            onChange={(e) => handleChange(min, Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Maximum weight"
          />
          <span className="text-xs text-muted-foreground">
            {formatWeight(WEIGHT_KG_MAX, units)}
          </span>
        </div>
      </FilterDropdown>
    </div>
  );
}
