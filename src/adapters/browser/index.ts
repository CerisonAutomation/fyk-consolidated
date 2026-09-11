/**
 * Browser adapters -- barrel export.
 *
 * These are the concrete implementations for the browser runtime.
 * Import from here instead of individual adapter files.
 */

export { browserGeoAdapter } from "./geo-adapter";
export {
  haversineKm,
  pairHash,
  jitterKm,
  snap,
  approximatePosition,
} from "./geo-adapter";

export { browserCryptoAdapter } from "./crypto-adapter";

export { browserGpuAdapter } from "./gpu-adapter";

export { browserPersistAdapter } from "./persist-adapter";
