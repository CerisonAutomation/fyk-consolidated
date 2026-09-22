import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { hydratePreferences, getPreferencesSnapshot, setPreferences } from "#/domains/settings/preferences";
import { initGridSearchFilters } from "#/domains/grid/filters-store";
import { useGridStore } from "#/domains/grid/store";

export const Route = createFileRoute("/grid/")({
  component: lazyRouteComponent(() => import("../../components/grid/grid-client").then((m) => ({ default: m.GridPage }))),
  loader: async () => {
    hydratePreferences();
    await initGridSearchFilters();
    let geohash = getPreferencesSnapshot().geohash;
    if (!geohash) {
      geohash = "dr5ru";
      await setPreferences({ geohash });
    }
    if (geohash) {
      await useGridStore.getState().load(geohash);
    }
  },
});
