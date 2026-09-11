import { useMemo, type ReactNode } from "react";
import { FilterDropdown } from "./FilterDropdown";

const HEIGHT_CM_MIN = 140;
const HEIGHT_CM_MAX = 220;

interface HeightFilterProps {
  checked: boolean;
  onChangeChecked: (checked: boolean) => void;
  value: number[];
  onChangeValue: (value: number[]) => void;
  units?: "metric" | "imperial";
}

function formatHeight(cm: number, units: "metric" | "imperial"): string {
  if (units === "imperial") {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${cm} cm`;
}

export function HeightFilter({
  checked,
  onChangeChecked,
  value,
  onChangeValue,
  units = "metric",
}: HeightFilterProps): ReactNode {
  const min = value?.[0] ?? HEIGHT_CM_MIN;
  const max = value?.[1] ?? HEIGHT_CM_MAX;

  const endLabel = useMemo(() => {
    const minLabel =
      min === HEIGHT_CM_MIN ? "No min" : formatHeight(min, units);
    const maxLabel =
      max === HEIGHT_CM_MAX ? "No max" : formatHeight(max, units);
    return `${minLabel} - ${maxLabel}`;
  }, [min, max, units]);

  const handleChange = (newMin: number, newMax: number) => {
    onChangeChecked(true);
    onChangeValue([newMin, newMax]);
  };

  return (
    <div className="block w-full space-y-3">
      <FilterDropdown
        id="height"
        label="Height"
        checked={checked}
        onChangeChecked={onChangeChecked}
        endLabel={endLabel}
        contentClass="ps-7 h-5"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {formatHeight(HEIGHT_CM_MIN, units)}
          </span>
          <input
            type="range"
            min={HEIGHT_CM_MIN}
            max={HEIGHT_CM_MAX}
            value={min}
            onChange={(e) => handleChange(Number(e.target.value), max)}
            className="flex-1 accent-primary"
            aria-label="Minimum height"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="range"
            min={HEIGHT_CM_MIN}
            max={HEIGHT_CM_MAX}
            value={max}
            onChange={(e) => handleChange(min, Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Maximum height"
          />
          <span className="text-xs text-muted-foreground">
            {formatHeight(HEIGHT_CM_MAX, units)}
          </span>
        </div>
      </FilterDropdown>
    </div>
  );
}
