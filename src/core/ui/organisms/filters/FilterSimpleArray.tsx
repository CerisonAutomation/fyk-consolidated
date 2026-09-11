import { useMemo, type ReactNode } from "react";
import { FilterDropdown } from "./FilterDropdown";

interface FilterSimpleArrayItem<T> {
	value: T;
	label: string;
}

interface FilterSimpleArrayProps<T> {
	checked: boolean;
	onChangeChecked: (checked: boolean) => void;
	value: T[];
	onChangeValue: (value: T[]) => void;
	id: string;
	label: string;
	items: FilterSimpleArrayItem<T>[];
	convert: (v: string) => T;
	notSpecified?: boolean;
}

export function FilterSimpleArray<T extends string | number>({
	checked,
	onChangeChecked,
	value,
	onChangeValue,
	id,
	label,
	items,
	convert,
	notSpecified = false,
}: FilterSimpleArrayProps<T>): ReactNode {
	const allItems = useMemo(
		() =>
			notSpecified
				? [...items, { value: convert("-1") as T, label: "Not specified" }]
				: items,
		[items, convert, notSpecified],
	);

	const selectedValues = useMemo(() => value.map(String), [value]);

	const handleToggleItem = (itemValue: string) => {
		const isSelected = selectedValues.includes(itemValue);
		let newValues: string[];
		if (isSelected) {
			newValues = selectedValues.filter((v) => v !== itemValue);
		} else {
			newValues = [...selectedValues, itemValue];
		}
		const converted = newValues.map(convert) as T[];
		onChangeChecked(converted.length > 0);
		onChangeValue(converted);
	};

	return (
		<FilterDropdown
			id={id}
			label={label}
			checked={checked}
			onChangeChecked={onChangeChecked}
		>
			<div className="flex flex-wrap gap-1">
				{allItems.map((item) => {
					const strValue = String(item.value);
					const isSelected = selectedValues.includes(strValue);
					return (
						<button
							key={strValue}
							type="button"
							onClick={() => handleToggleItem(strValue)}
							className={`inline-flex items-center rounded-md border px-3 py-1 text-xs transition-colors ${
								isSelected
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-background text-foreground hover:bg-muted"
							}`}
						>
							{item.label}
						</button>
					);
				})}
			</div>
		</FilterDropdown>
	);
}
