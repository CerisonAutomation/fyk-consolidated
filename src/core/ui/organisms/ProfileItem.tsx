import { useMemo, type ReactNode, type MouseEvent } from "react";
import { cn } from "../cn";
import { DisplayName } from "../atoms/DisplayName";
import { ProfileStatusIndicator } from "../atoms/ProfileStatusIndicator";
import { UserAvatar } from "../molecules/UserAvatar";

interface ProfileItemAvatar {
	mediaHash: string | null;
	overlay?: ReactNode;
	link?: string;
}

interface ProfileItemTitle {
	value: string | null;
	fallback?: string;
	badge?: ReactNode;
}

interface ProfileItemProps {
	avatar: ProfileItemAvatar;
	title: ProfileItemTitle;
	onlineUntil?: number | null;
	active?: boolean;
	selected?: boolean;
	link: string;
	description?: ReactNode;
	actions?: ReactNode;
	control?: ReactNode;
	onToggleSelected?: () => void;
	onLongPress?: () => void;
	className?: string;
}

export function ProfileItem({
	avatar,
	title,
	onlineUntil = null,
	active = false,
	selected = false,
	link,
	description,
	actions,
	control,
	onToggleSelected,
	onLongPress,
	className,
}: ProfileItemProps): ReactNode {
	const accessibleName = title.value ?? title.fallback ?? "Someone";
	const linkTabindex = onToggleSelected ? -1 : undefined;

	// Long press support
	const longPressHandlers = useMemo(() => {
		if (!onLongPress) return {};
		let pressTimer: ReturnType<typeof setTimeout> | null = null;
		let startX = 0;
		let startY = 0;

		return {
			onPointerDown: (e: React.PointerEvent) => {
				startX = e.clientX;
				startY = e.clientY;
				pressTimer = setTimeout(() => {
					onLongPress();
				}, 500);
			},
			onPointerMove: (e: React.PointerEvent) => {
				const dx = Math.abs(e.clientX - startX);
				const dy = Math.abs(e.clientY - startY);
				if (dx + dy > 10 && pressTimer) {
					clearTimeout(pressTimer);
					pressTimer = null;
				}
			},
			onPointerUp: () => {
				if (pressTimer) {
					clearTimeout(pressTimer);
					pressTimer = null;
				}
			},
			onPointerCancel: () => {
				if (pressTimer) {
					clearTimeout(pressTimer);
					pressTimer = null;
				}
			},
		};
	}, [onLongPress]);

	const avatarNode = (
		<div className="relative flex items-center justify-center rounded-2xl p-2">
			<div className="relative size-20 after:rounded-xl">
				<UserAvatar
					mediaHash={avatar.mediaHash}
					className="size-20 rounded-xl bg-neutral-700 [&>*]:rounded-xl"
				/>
			</div>
			{avatar.overlay}
		</div>
	);

	const contentNode = (
		<>
			<div className="min-w-0 flex-1">
				<div
					className={cn(
						"flex w-auto min-w-0 items-center gap-1 truncate",
						!title.value && "text-muted-foreground",
					)}
				>
					{title.badge}
					<ProfileStatusIndicator onlineUntil={onlineUntil} />
					<DisplayName
						name={title.value}
						fallback={title.fallback}
						className="truncate"
					/>
				</div>
				{description}
			</div>
			{actions}
		</>
	);

	const handleToggleClick = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onToggleSelected?.();
	};

	return (
		<div
			className={cn(
				"@container relative flex min-w-24 flex-nowrap items-stretch gap-0 rounded-xl border p-0",
				active ? "bg-muted" : "border-border",
				selected &&
					"border-primary outline-2 -outline-offset-2 outline-primary outline-solid",
				onLongPress &&
					"[-webkit-touch-callout:none] **:[-webkit-touch-callout:none]",
				className,
			)}
			{...longPressHandlers}
		>
			{avatar.link ? (
				<>
					<a
						href={avatar.link}
						aria-label={`${accessibleName}'s profile`}
						className="rounded-l-2xl max-row:hidden"
						tabIndex={linkTabindex}
					>
						{avatarNode}
					</a>
					<a
						href={link}
						className="flex min-w-0 flex-1 items-center self-stretch gap-0.5 rounded-r-2xl p-4 ps-2 max-row:hidden"
						tabIndex={linkTabindex}
					>
						{contentNode}
					</a>
					<a
						href={link}
						aria-label={accessibleName}
						className="min-w-24 rounded-2xl row:hidden"
						tabIndex={linkTabindex}
					>
						{avatarNode}
					</a>
				</>
			) : (
				<a
					href={link}
					className="flex min-w-0 flex-1 items-center self-stretch gap-2.5 overflow-clip rounded-2xl pe-4"
				>
					{avatarNode}
					{contentNode}
				</a>
			)}

			{control && (
				<div className="flex shrink-0 items-center ps-3 pe-4">{control}</div>
			)}

			{selected && (
				<div className="pointer-events-none absolute -inset-px z-1 rounded-[inherit] bg-primary/20" />
			)}

			{onToggleSelected && (
				<button
					type="button"
					className="absolute inset-0 z-2 rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					aria-pressed={selected}
					aria-label={accessibleName}
					onClick={handleToggleClick}
				/>
			)}
		</div>
	);
}
