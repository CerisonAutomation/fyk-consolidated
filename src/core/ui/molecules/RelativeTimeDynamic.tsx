import { useState, useEffect, type ReactNode } from "react";

interface RelativeTimeDynamicProps {
  date: number;
}

function formatTimeRelativeCustom(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 0) return "just now";
  if (diff < 60) return "just now";
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  }
  if (diff < 2592000) {
    const weeks = Math.floor(diff / 604800);
    return `${weeks}w ago`;
  }
  const months = Math.floor(diff / 2592000);
  return `${months}mo ago`;
}

export function RelativeTimeDynamic({
  date,
}: RelativeTimeDynamicProps): ReactNode {
  const [, setTick] = useState(0);

  // Re-render every 60 seconds to keep the relative time current
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  return <>{formatTimeRelativeCustom(date)}</>;
}
