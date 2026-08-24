import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
// @ts-expect-error -- @floating-ui/dom needs to be installed separately
import { computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";

interface ContextMenuOpen {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContextMenuPosition {
  x: number;
  y: number;
  placement: Placement;
}

interface ContextMenuProps {
  contextMenuOpen: ContextMenuOpen | null;
  style?: string;
  content: (isPositioned: boolean) => ReactNode;
  onClose: () => void;
  isOut?: boolean;
  selectable?: boolean;
  children?: (placement: Placement) => ReactNode;
}

export function ContextMenu({
  contextMenuOpen,
  style,
  content,
  onClose,
  isOut = false,
  selectable = false,
  children,
}: ContextMenuProps): ReactNode {
  const preferredPlacement: Placement = isOut ? "left-start" : "right-start";
  const fallbackPlacements: Placement[] = isOut
    ? ["right-start", "bottom-end", "top-end"]
    : ["left-start", "bottom-start", "top-start"];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listPosition, setListPosition] = useState<ContextMenuPosition>({
    x: 0,
    y: 0,
    placement: "right-start",
  });

  // Position the menu using floating-ui
  useEffect(() => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list || !contextMenuOpen) return;

    let cancelled = false;
    computePosition(trigger, list, {
      placement: preferredPlacement,
      middleware: [
        offset(8),
        flip({ fallbackPlacements, fallbackStrategy: "bestFit" }),
        shift({ padding: 8 }),
      ],
      strategy: "fixed",
    })
      .then(({ x, y, placement }: { x: number; y: number; placement: Placement }) => {
        if (!cancelled) setListPosition({ x, y, placement });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [contextMenuOpen, preferredPlacement, fallbackPlacements]);

  // Show dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && contextMenuOpen) {
      dialog.showModal();
      dialog
        .querySelector<HTMLElement>("[data-slot='context-menu-trigger']")
        ?.focus();
    }
  }, [contextMenuOpen]);

  // Close on resize
  useEffect(() => {
    const handleResize = () => {
      if (contextMenuOpen) {
        dialogRef.current?.close();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [contextMenuOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (
        e.currentTarget === dialogRef.current &&
        e.currentTarget === e.target
      ) {
        dialogRef.current?.close();
      }
    },
    [],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!contextMenuOpen) return null;

  return (
    <dialog
      className="fixed top-0 left-0 z-[9999] size-full max-h-none max-w-none bg-transparent backdrop:bg-transparent backdrop:backdrop-blur-xl"
      ref={dialogRef}
      onMouseDown={handleBackdropClick}
      onClose={handleClose}
    >
      <div
        ref={triggerRef}
        className="absolute"
        style={{
          left: `${contextMenuOpen.x}px`,
          top: `${contextMenuOpen.y}px`,
          width: `${contextMenuOpen.width}px`,
          height: `${contextMenuOpen.height}px`,
        }}
        {...(style ? { className: style } : {})}
        inert={!selectable ? undefined : undefined}
      >
        {content(true)}
      </div>
      <div
        ref={listRef}
        className="fixed flex flex-col"
        style={{
          left: `${listPosition.x}px`,
          top: `${listPosition.y}px`,
        }}
      >
        {children?.(listPosition.placement)}
      </div>
    </dialog>
  );
}
