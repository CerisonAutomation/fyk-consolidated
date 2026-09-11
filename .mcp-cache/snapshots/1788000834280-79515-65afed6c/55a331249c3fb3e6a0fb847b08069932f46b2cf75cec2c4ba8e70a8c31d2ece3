import { useState, useMemo, useEffect, type ReactNode } from "react";
import { FilterBoolean } from "./FilterBoolean";

interface Gender {
  genderId: number;
  gender: string;
  genderPlural?: string;
  sortFilter?: number;
  displayGroup: number;
  excludeOnFilterSelection?: number[];
}

interface GendersFilterProps {
  checked: boolean;
  onChangeChecked: (checked: boolean) => void;
  value: number[];
  onChangeValue: (value: number[]) => void;
  /** Function to fetch genders - should return a Promise resolving to Gender[] */
  fetchGenders?: () => Promise<Gender[]>;
}

export function GendersFilter({
  checked,
  onChangeChecked,
  value,
  onChangeValue,
  fetchGenders,
}: GendersFilterProps): ReactNode {
  const [genders, setGenders] = useState<Gender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!fetchGenders) {
      setLoading(false);
      return;
    }
    fetchGenders()
      .then((g) => {
        setGenders(
          g
            .filter((gen) => gen.displayGroup > 0)
            .sort((a, b) => (a.sortFilter ?? 1) - (b.sortFilter ?? 1)),
        );
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [fetchGenders]);

  const selectedValues = useMemo(() => value.map(String), [value]);

  const handleToggleItem = (genderId: number) => {
    const strId = String(genderId);
    const isSelected = selectedValues.includes(strId);
    let newValues: string[];
    if (isSelected) {
      newValues = selectedValues.filter((v) => v !== strId);
    } else {
      newValues = [...selectedValues, strId];
    }
    const numValues = newValues.map(Number);
    onChangeChecked(numValues.length > 0);
    onChangeValue(numValues);
  };

  if (error) {
    return (
      <div className="text-sm text-destructive">Failed to load genders</div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FilterBoolean
        id="gender"
        checked={checked}
        onChangeChecked={onChangeChecked}
      >
        Gender
      </FilterBoolean>
      <div className="ps-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {genders.map((gender) => {
              const excludeList = gender.excludeOnFilterSelection;
              const render =
                !excludeList ||
                (!value.some((v) => excludeList.includes(v)) &&
                  (expanded || gender.displayGroup === 1));

              if (!render) return null;

              const strId = String(gender.genderId);
              const isSelected = selectedValues.includes(strId);

              return (
                <button
                  key={gender.genderId}
                  type="button"
                  onClick={() => handleToggleItem(gender.genderId)}
                  className={`inline-flex items-center rounded-md border px-3 py-1 text-xs transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {gender.genderPlural ?? gender.gender}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleToggleItem(-1)}
              className={`inline-flex items-center rounded-md border px-3 py-1 text-xs transition-colors ${
                selectedValues.includes("-1")
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              Not specified
            </button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center rounded-md border border-secondary bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
            >
              {expanded ? "Less" : "More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
