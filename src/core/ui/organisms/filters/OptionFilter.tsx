import type { ReactNode } from "react";
import { FilterSimpleArray } from "./FilterSimpleArray";

interface OptionFilterDefinition {
	id: string;
	label: string;
	table: Map<number, string>;
}

interface OptionFilterProps {
	filter: OptionFilterDefinition;
	checked: boolean;
	onChangeChecked: (checked: boolean) => void;
	value: number[];
	onChangeValue: (value: number[]) => void;
}

export function OptionFilter({
	filter,
	checked,
	onChangeChecked,
	value,
	onChangeValue,
}: OptionFilterProps): ReactNode {
	const items = Array.from(filter.table.entries()).map(([val, label]) => ({
		value: val,
		label,
	}));

	return (
		<FilterSimpleArray
			checked={checked}
			onChangeChecked={onChangeChecked}
			value={value}
			onChangeValue={onChangeValue}
			id={filter.id}
			label={filter.label}
			items={items}
			convert={Number}
			notSpecified
		/>
	);
}
