import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

export function Reveal({
	children,
	delay = 0,
	as: Tag = "div",
	className,
}: {
	children: ReactNode;
	delay?: number;
	as?: React.ElementType;
	className?: string;
}) {
	const ref = useRef<HTMLElement | null>(null);
	const [seen, setSeen] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el || seen) return;
		if (typeof IntersectionObserver === "undefined") {
			setSeen(true);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						setSeen(true);
						io.disconnect();
					}
				}
			},
			{ rootMargin: "0px 0px -8% 0px", threshold: 0.04 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [seen]);

	return (
		<Tag
			ref={ref}
			className={cn("reveal", seen && "is-in", className)}
			style={{ ["--d" as string]: `${delay}ms` }}
		>
			{children}
		</Tag>
	);
}
