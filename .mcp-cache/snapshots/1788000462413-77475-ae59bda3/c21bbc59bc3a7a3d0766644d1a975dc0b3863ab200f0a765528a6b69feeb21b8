import { useMemo, type ReactNode } from "react";
import { Image, Smile, FolderLock } from "lucide-react";
import { FilterBoolean } from "./FilterBoolean";

export type PhotoFilterValue = "has-photos" | "has-face-pics" | "has-albums";

interface PhotosFilterProps {
  checked: boolean;
  onChangeChecked: (checked: boolean) => void;
  value: PhotoFilterValue[];
  onChangeValue: (value: PhotoFilterValue[]) => void;
}

const photoOptions = [
  { value: "has-photos" as const, label: "Has Photos", Icon: Image },
  { value: "has-face-pics" as const, label: "Has Face Pics", Icon: Smile },
  { value: "has-albums" as const, label: "Has Album(s)", Icon: FolderLock },
] as const;

export function PhotosFilter({
  checked,
  onChangeChecked,
  value,
  onChangeValue,
}: PhotosFilterProps): ReactNode {
  const selectedValues = useMemo(() => new Set(value), [value]);

  const handleToggleItem = (itemValue: PhotoFilterValue) => {
    const newSet = new Set(selectedValues);
    if (newSet.has(itemValue)) {
      newSet.delete(itemValue);
    } else {
      newSet.add(itemValue);
    }
    const newValues = Array.from(newSet);
    onChangeChecked(newValues.length > 0);
    onChangeValue(newValues);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FilterBoolean
        id="photos"
        checked={checked}
        onChangeChecked={onChangeChecked}
      >
        Photos
      </FilterBoolean>
      <div className="ps-6">
        <div className="flex flex-wrap gap-1">
          {photoOptions.map(({ value: itemValue, label, Icon }) => {
            const isSelected = selectedValues.has(itemValue);
            return (
              <button
                key={itemValue}
                type="button"
                onClick={() => handleToggleItem(itemValue)}
                className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
