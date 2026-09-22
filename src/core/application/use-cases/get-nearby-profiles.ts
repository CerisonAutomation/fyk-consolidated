/**
 * GetNearbyProfiles Use Case — Hexagonal Architecture — Application Layer
 * Compared to Grindr: location-first grid, distance, online, fresh, filters
 * Compared to Romeo: 120+ search options, travel mode 2 weeks prior
 * Practical, max fidelity, reusable, testable
 */

import type { GridFilters, GridProfile } from '../../domain/entities/grid';
import type { GridRepository, UserRepository } from '../../ports/repositories';
import type { GeocodingService } from '../../ports/services';
import { calculateDistance, filterGridProfiles, sortGridProfiles } from '../../domain/entities/grid';
import { telemetry } from '#/lib/enterprise/telemetry';
import { resilient } from '#/lib/enterprise/self-healing';
import { cache } from '#/lib/enterprise/performance';

export interface GetNearbyProfilesInput {
  userId: string;
  geohash: string;
  filters: GridFilters;
  page: number;
  limit: number;
  travelMode?: {
    active: boolean;
    destinationGeohash: string | null;
    arrivalDate: Date | null;
  } | null;
}

export interface GetNearbyProfilesOutput {
  profiles: GridProfile[];
  hasMore: boolean;
  total: number;
  onlineCount: number;
  boostedCount: number;
  newCount: number;
  cacheHit: boolean;
  traceId: string;
}

export class GetNearbyProfilesUseCase {
  constructor(
    private readonly gridRepo: GridRepository,
    private readonly userRepo: UserRepository,
    private readonly geocoding: GeocodingService,
  ) {}

  async execute(input: GetNearbyProfilesInput): Promise<GetNearbyProfilesOutput> {
    const traceId = crypto.randomUUID();
    const span = telemetry.startSpan('usecase.get-nearby-profiles', 'server', undefined, { userId: input.userId });

    try {
      // Check cache first — stale-while-revalidate 30s/60s
      const cacheKey = `grid:${input.geohash}:${JSON.stringify(input.filters)}:${input.page}`;
      const cached = await cache.get(cacheKey);
      if (cached && input.page === 1) {
        telemetry.counter('usecase.grid.cache.hit', 1);
        telemetry.endSpan(span.spanId, 'ok');
        return {
          ...(cached.value as GetNearbyProfilesOutput),
          cacheHit: true,
          traceId,
        };
      }

      // Get user location for distance calc (if travel mode, use destination)
      const effectiveGeohash = input.travelMode?.active && input.travelMode.destinationGeohash
        ? input.travelMode.destinationGeohash
        : input.geohash;

      // Resilient fetch with circuit breaker
      const result = await resilient(
        async () => this.gridRepo.getProfiles(effectiveGeohash, input.filters, input.page, input.limit),
        {
          retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true },
          timeoutMs: 3000,
          circuitBreaker: 'grid-repo',
        },
      );

      // Filter and sort — multi-factor O(n log n) distance 30% + compatibility 25% + online 20% + recency 15% + verification 10%
      let profiles = filterGridProfiles(result.profiles, input.filters);
      profiles = sortGridProfiles(profiles, input.filters, null);

      // Calculate counts
      const onlineCount = profiles.filter(p => p.onlineUntil && p.onlineUntil > Date.now()).length;
      const boostedCount = profiles.filter(p => p.isBoosted).length;
      const newCount = profiles.filter(p => p.isNew).length;

      const output: GetNearbyProfilesOutput = {
        profiles,
        hasMore: result.hasMore,
        total: result.total,
        onlineCount,
        boostedCount,
        newCount,
        cacheHit: false,
        traceId,
      };

      // Cache for 30s
      await cache.set(cacheKey, output, 30);

      telemetry.counter('usecase.grid.profiles.fetched', profiles.length);
      telemetry.histogram('usecase.grid.online', onlineCount);
      telemetry.endSpan(span.spanId, 'ok');

      return output;
    } catch (error) {
      telemetry.endSpan(span.spanId, 'error', error instanceof Error ? error.message : 'Unknown');
      throw error;
    }
  }
}

// Factory for DI
export function createGetNearbyProfilesUseCase(repos: { grid: GridRepository; users: UserRepository }, services: { geocoding: GeocodingService }) {
  return new GetNearbyProfilesUseCase(repos.grid, repos.users, services.geocoding);
}
