export type MetricUnit = "ms" | "kb" | "count" | "score" | "percent";
export type MetricStatus = "pass" | "warn" | "fail";

export type PerfMetric = {
  name: string;
  value: number;
  unit: MetricUnit;
  target: number;
  max: number;
  status: MetricStatus;
  timestamp: number;
};

export type BenchmarkReport = {
  metrics: PerfMetric[];
  overallScore: number;
  timestamp: number;
  recommendations: string[];
};

const TARGETS = {
  typecheck: { target: 0, max: 0, unit: "count" as MetricUnit },
  tests: { target: 242, max: 240, unit: "count" as MetricUnit },
  bundleRouter: { target: 300, max: 500, unit: "kb" as MetricUnit },
  routeTreeLines: { target: 3000, max: 4000, unit: "count" as MetricUnit },
  p50: { target: 100, max: 200, unit: "ms" as MetricUnit },
  p95: { target: 200, max: 400, unit: "ms" as MetricUnit },
  p99: { target: 400, max: 800, unit: "ms" as MetricUnit },
  duplicationScore: { target: 95, max: 90, unit: "score" as MetricUnit },
  codeLinesPerRoute: { target: 50, max: 100, unit: "count" as MetricUnit },
  lighthousePerformance: { target: 90, max: 80, unit: "score" as MetricUnit },
  lighthouseAccessibility: { target: 95, max: 90, unit: "score" as MetricUnit },
} as const;

type TargetKey = keyof typeof TARGETS;

function evaluate(name: TargetKey, value: number): MetricStatus {
  const { target, max } = TARGETS[name];
  const lowerIsBetter = ["bundleRouter", "routeTreeLines", "p50", "p95", "p99", "codeLinesPerRoute", "typecheck"].includes(name);
  if (lowerIsBetter) {
    if (value > max) return "fail";
    if (value > target) return "warn";
    return "pass";
  }
  if (value < max) return "fail";
  if (value < target) return "warn";
  return "pass";
}

export function checkMetric(name: TargetKey, value: number): PerfMetric {
  const cfg = TARGETS[name];
  return {
    name,
    value,
    unit: cfg.unit,
    target: cfg.target,
    max: cfg.max,
    status: evaluate(name, value),
    timestamp: Date.now(),
  };
}

export function generateBenchmarkReport(current: Partial<Record<TargetKey, number>>): BenchmarkReport {
  const metrics: PerfMetric[] = (Object.keys(TARGETS) as TargetKey[]).map((name) => {
    const value = current[name] ?? 0;
    return checkMetric(name, value);
  });

  const passCount = metrics.filter((m) => m.status === "pass").length;
  const overallScore = Math.round((passCount / metrics.length) * 100);

  const recommendations: string[] = [];
  for (const m of metrics) {
    if (m.status === "fail") {
      switch (m.name) {
        case "bundleRouter":
          recommendations.push(`Router bundle ${m.value}KB exceeds max ${m.max}KB — split 70% lazy via React.lazy + TanStack lazyRouteComponent`);
          break;
        case "routeTreeLines":
          recommendations.push(`Route tree ${m.value} lines exceeds max ${m.max} — group lazy routes`);
          break;
        case "p50":
          recommendations.push(`p50 ${m.value}ms exceeds max ${m.max}ms — add caching and CDN`);
          break;
        case "typecheck":
          recommendations.push(`Type errors ${m.value} — fix all TS errors`);
          break;
        case "duplicationScore":
          recommendations.push(`Duplication score ${m.value}% below min ${m.max}% — apply crud factory`);
          break;
        default:
          recommendations.push(`${m.name} ${m.value}${m.unit} fails target ${m.target}${m.unit}`);
      }
    } else if (m.status === "warn") {
      recommendations.push(`${m.name} ${m.value}${m.unit} near limit target ${m.target}${m.unit} max ${m.max}${m.unit}`);
    }
  }

  return { metrics, overallScore, timestamp: Date.now(), recommendations };
}

export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  record(name: string, value: number): void {
    const arr = this.metrics.get(name) ?? [];
    arr.push(value);
    if (arr.length > 1000) arr.shift();
    this.metrics.set(name, arr);
  }

  percentile(name: string, p: number): number {
    const arr = this.metrics.get(name);
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * p)] ?? 0;
  }

  p50(name: string): number {
    return this.percentile(name, 0.5);
  }
  p95(name: string): number {
    return this.percentile(name, 0.95);
  }
  p99(name: string): number {
    return this.percentile(name, 0.99);
  }

  report(): Record<string, { p50: number; p95: number; p99: number; count: number }> {
    const out: Record<string, { p50: number; p95: number; p99: number; count: number }> = {};
    for (const [name] of this.metrics) {
      out[name] = {
        p50: this.p50(name),
        p95: this.p95(name),
        p99: this.p99(name),
        count: this.metrics.get(name)?.length ?? 0,
      };
    }
    return out;
  }
}

export const perfMonitor = new PerformanceMonitor();

export function analyzeBundleSize(currentKb: number, targetKb = 300) {
  const criticalKb = Math.round(currentKb * 0.3);
  const lazyKb = Math.round(currentKb * 0.5);
  const ultraLazyKb = Math.round(currentKb * 0.2);
  const savings = currentKb - criticalKb;
  return {
    currentKb,
    targetKb,
    criticalKb,
    lazyKb,
    ultraLazyKb,
    initialKb: criticalKb,
    savings,
    savingsPercent: Math.round((savings / currentKb) * 100),
    meetsTarget: criticalKb <= targetKb,
  };
}
