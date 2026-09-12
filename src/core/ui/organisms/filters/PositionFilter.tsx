import { useMemo, type ReactNode } from "react";
import {
	ArrowUp,
	ArrowUpRight,
	ArrowDownUp,
	ArrowLeftRight,
	ArrowDown,
	ArrowDownRight,
	X,
} from "lucide-react";
import { FilterBoolean } from "./FilterBoolean";

export const FilterPosition = {
	Top: 1,
	VersTop: 2,
	Versatile: 3,
	VersBottom: 4,
	Bottom: 5,
	Side: 6,
	NotSpecified: 7,
} as const;

export type FilterPositionValue =
	(typeof FilterPosition)[keyof typeof FilterPosition];

interface PositionFilterProps {
	checked: boolean;
	onChangeChecked: (checked: boolean) => void;
	value: FilterPositionValue[];
	onChangeValue: (value: FilterPositionValue[]) => void;
}

const positionItems = [
	{ value: FilterPosition.Top, label: "Top", Icon: ArrowUp },
	{ value: FilterPosition.VersTop, label: "Vers Top", Icon: ArrowUpRight },
	{ value: FilterPosition.Versatile, label: "Versatile", Icon: ArrowDownUp },
	{
		value: FilterPosition.VersBottom,
		label: "Vers Bottom",
		Icon: ArrowDownRight,
	},
	{ value: FilterPosition.Bottom, label: "Bottom", Icon: ArrowDown },
	{ value: FilterPosition.Side, label: "Side", Icon: ArrowLeftRight },
	{ value: FilterPosition.NotSpecified, label: "Not specified", Icon: X },
] as const;

export function PositionFilter({
	checked,
	onChangeChecked,
	value,
	onChangeValue,
}: PositionFilterProps): ReactNode {
	const selectedValues = useMemo(() => value.map(String), [value]);

	const handleToggleItem = (posValue: FilterPositionValue) => {
		const strValue = String(posValue);
		const isSelected = selectedValues.includes(strValue);
		let newValues: string[];
		if (isSelected) {
			newValues = selectedValues.filter((v) => v !== strValue);
		} else {
			newValues = [...selectedValues, strValue];
		}
		const converted = newValues.map(Number) as FilterPositionValue[];
		onChangeChecked(converted.length > 0);
		onChangeValue(converted);
	};

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<FilterBoolean
				id="position"
				checked={checked}
				onChangeChecked={onChangeChecked}
			>
				Position
			</FilterBoolean>
			<div className="ps-6">
				<div className="flex flex-wrap gap-1">
					{positionItems.map(({ value: posValue, label, Icon }) => {
						const isSelected = selectedValues.includes(String(posValue));
						return (
							<button
								key={posValue}
								type="button"
								onClick={() => handleToggleItem(posValue)}
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
