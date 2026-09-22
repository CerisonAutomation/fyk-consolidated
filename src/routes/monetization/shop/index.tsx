import { createFileRoute } from "@tanstack/react-router";
import { ConsumablesPanel, PromoPanel } from "@/components/settings/SafetyGrowthPanel";

export const Route = createFileRoute("/monetization/shop/")({
  component: ShopPage,
});

function ShopPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Monetization Shop</h1>
      <p className="text-sm text-muted-foreground">Consumables like boost and spotlight, promo vouchers — ledger and idempotency for wallet transactions</p>
      <ConsumablesPanel />
      <PromoPanel />
    </div>
  );
}
