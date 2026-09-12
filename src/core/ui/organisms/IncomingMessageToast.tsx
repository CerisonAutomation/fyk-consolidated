import { useCallback, type ReactNode } from "react";
import { UserAvatar } from "../molecules/UserAvatar";

interface IncomingMessageToastSender {
	name: string;
	avatarMediaHash: string | null;
}

interface IncomingMessageToastProps {
	conversationId: string;
	messagePreview: string;
	sender?: IncomingMessageToastSender;
	onNavigate?: (path: string) => void;
	onDismiss?: () => void;
	className?: string;
}

export function IncomingMessageToast({
	conversationId,
	messagePreview,
	sender,
	onNavigate,
	onDismiss,
	className,
}: IncomingMessageToastProps): ReactNode {
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			const startPos = { x: e.clientX, y: e.clientY };
			let jumpedOff = false;

			const onPointerMove = (moveEvent: PointerEvent) => {
				const delta = {
					x: Math.abs(moveEvent.x - startPos.x),
					y: Math.abs(moveEvent.y - startPos.y),
				};
				if (delta.x + delta.y > 10) {
					jumpedOff = true;
					window.removeEventListener("pointermove", onPointerMove);
				}
			};

			const onPointerUp = () => {
				if (!jumpedOff) {
					onNavigate?.(`/chat/${conversationId}`);
					onDismiss?.();
				}
				window.removeEventListener("pointerup", onPointerUp);
				window.removeEventListener("pointermove", onPointerMove);
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
		},
		[conversationId, onNavigate, onDismiss],
	);

	return (
		<div
			role="button"
			tabIndex={0}
			className={
				className ??
				"flex h-14 w-full items-center gap-2 rounded-2xl border border-border bg-popover p-2 pe-3 text-start"
			}
			onPointerDown={handlePointerDown}
		>
			<UserAvatar
				mediaHash={sender?.avatarMediaHash ?? null}
				className="size-10 shrink-0 rounded-xl bg-neutral-700 [&>*]:rounded-xl"
			/>
			<div className="flex min-w-0 flex-col">
				{sender?.name ? (
					<span className="truncate font-heading text-sm leading-snug font-medium">
						{sender.name}
					</span>
				) : (
					<span className="font-normal tracking-tight text-muted-foreground italic">
						Someone
					</span>
				)}
				<p className="truncate text-sm">{messagePreview}</p>
			</div>
		</div>
	);
}
