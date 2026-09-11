import { useId, type ReactNode } from "react";
import { FilterField } from "./FilterField";

interface FilterBooleanProps {
  id: string;
  checked: boolean;
  onChangeChecked: (checked: boolean) => void;
  children?: ReactNode;
  endAdornment?: ReactNode;
}

export function FilterBoolean({
  id,
  checked,
  onChangeChecked,
  children,
  endAdornment,
}: FilterBooleanProps): ReactNode {
  const uid = useId();
  const inputId = `filters-${id}-${uid}`;

  return (
    <FilterField>
      <input
        type="checkbox"
        id={inputId}
        checked={checked}
        onChange={(e) => onChangeChecked(e.target.checked)}
        className="size-4 rounded border-gray-300 accent-primary"
      />
      <label htmlFor={inputId} className="min-h-5 text-sm">
        {children}
      </label>
      {endAdornment && (
        <span className="ml-auto min-w-0 truncate">{endAdornment}</span>
      )}
    </FilterField>
  );
}
