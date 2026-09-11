import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../cn";
import { AgeFilter } from "./AgeFilter";
import { HeightFilter } from "./HeightFilter";
import { WeightFilter } from "./WeightFilter";
import { GendersFilter } from "./GendersFilter";
import { PositionFilter } from "./PositionFilter";
import { PhotosFilter } from "./PhotosFilter";
import { TagsFilter } from "./TagsFilter";

export interface GridFiltersState {
  ageChecked: boolean;
  ageValue: number[];
  heightChecked: boolean;
  heightValue: number[];
  weightChecked: boolean;
  weightValue: number[];
  genderChecked: boolean;
  genderValue: number[];
  positionChecked: boolean;
  positionValue: number[];
  photosChecked: boolean;
  photosValue: string[];
  tagsChecked: boolean;
  tagsValue: string[];
}

interface GridFiltersProps {
  open: boolean;
  onClose: () => void;
  filters: GridFiltersState;
  onFiltersChange: (filters: GridFiltersState) => void;
  className?: string;
}

export function GridFilters({
  open,
  onClose,
  filters,
  onFiltersChange,
  className,
}: GridFiltersProps): ReactNode {
  if (!open) return null;

  const update = (partial: Partial<GridFiltersState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center sm:items-center",
        className,
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative z-10 flex w-full max-w-lg max-h-[80vh] flex-col rounded-t-2xl border border-border bg-background shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close filters"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Filter list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <AgeFilter
            checked={filters.ageChecked}
            onChangeChecked={(v) => update({ ageChecked: v })}
            value={filters.ageValue}
            onChangeValue={(v) => update({ ageValue: v })}
          />

          <HeightFilter
            checked={filters.heightChecked}
            onChangeChecked={(v) => update({ heightChecked: v })}
            value={filters.heightValue}
            onChangeValue={(v) => update({ heightValue: v })}
          />

          <WeightFilter
            checked={filters.weightChecked}
            onChangeChecked={(v) => update({ weightChecked: v })}
            value={filters.weightValue}
            onChangeValue={(v) => update({ weightValue: v })}
          />

          <GendersFilter
            checked={filters.genderChecked}
            onChangeChecked={(v) => update({ genderChecked: v })}
            value={filters.genderValue}
            onChangeValue={(v) => update({ genderValue: v })}
          />

          <PositionFilter
            checked={filters.positionChecked}
            onChangeChecked={(v) => update({ positionChecked: v })}
            value={filters.positionValue as never[]}
            onChangeValue={(v) => update({ positionValue: v as never[] })}
          />

          <PhotosFilter
            checked={filters.photosChecked}
            onChangeChecked={(v) => update({ photosChecked: v })}
            value={filters.photosValue as never[]}
            onChangeValue={(v) => update({ photosValue: v as never[] })}
          />

          <TagsFilter
            checked={filters.tagsChecked}
            onChangeChecked={(v) => update({ tagsChecked: v })}
            value={filters.tagsValue}
            onChangeValue={(v) => update({ tagsValue: v })}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
