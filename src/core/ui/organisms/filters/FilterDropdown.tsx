import {
	useState,
	useEffect,
	useCallback,
	useRef,
	type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../cn";
import { FilterBoolean } from "./FilterBoolean";

interface FilterDropdownProps {
	id: string;
	label: string;
	checked: boolean;
	onChangeChecked: (checked: boolean) => void;
	endLabel?: string;
	children?: ReactNode;
	contentClass?: string;
	className?: string;
}

export function FilterDropdown({
	id,
	label,
	checked,
	onChangeChecked,
	endLabel,
	children,
	contentClass,
	className,
}: FilterDropdownProps): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const [contentHeight, setContentHeight] = useState(0);

	useEffect(() => {
		if (checked) {
			setExpanded(true);
		}
	}, []);

	// Measure content height for animation
	useEffect(() => {
		if (contentRef.current) {
			setContentHeight(contentRef.current.scrollHeight);
		}
	}, [expanded, children]);

	const handleCheckedChange = useCallback(
		(newValue: boolean) => {
			if (expanded && !checked) {
				setExpanded(false);
			} else {
				setExpanded(newValue);
				onChangeChecked(newValue);
			}
		},
		[expanded, checked, onChangeChecked],
	);

	const endAdornmentNode = endLabel !== undefined ? endLabel : undefined;

	return (
		<div className={cn("flex min-w-0 shrink-0 flex-col", className)}>
			<FilterBoolean
				id={id}
				checked={checked}
				onChangeChecked={handleCheckedChange}
				endAdornment={endAdornmentNode}
			>
				<span className="inline-flex items-center gap-1">
					{label}
					<ChevronDown
						className={cn(
							"size-4 transition-transform duration-300",
							expanded && "-rotate-180",
						)}
					/>
				</span>
			</FilterBoolean>

			<div
				ref={contentRef}
				className={cn("shrink-0 overflow-clip ps-6 pt-2", contentClass)}
				style={{
					height: expanded ? `${contentHeight}px` : "0px",
					opacity: expanded ? 1 : 0,
					marginTop: expanded ? "0px" : "-8px",
					transition:
						"height 400ms ease-out, opacity 400ms ease-out, margin-top 400ms ease-out",
				}}
			>
				{children}
			</div>
		</div>
	);
}
