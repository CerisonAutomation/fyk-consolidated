import type { ReactNode } from "react";
import { Terminal } from "lucide-react";
import { Kbd } from "../atoms/Kbd";

interface CommandCenterTriggerProps {
	onClick?: () => void;
	/** Whether the current platform is mobile (hides the keyboard shortcut) */
	isMobile?: boolean;
	/** The modifier key label for the current platform (Cmd on Mac, Ctrl on others) */
	modifierKey?: string;
	className?: string;
}

export function CommandCenterTrigger({
	onClick,
	isMobile = false,
	modifierKey = "Cmd",
	className,
}: CommandCenterTriggerProps): ReactNode {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted ${isMobile ? "" : "pe-1.5"} ${className ?? ""}`}
		>
			<Terminal className="size-4" />
			{!isMobile && <Kbd>{modifierKey} + K</Kbd>}
		</button>
	);
}
