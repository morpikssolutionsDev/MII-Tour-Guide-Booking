import { Armchair, Cookie, Crown, Gift, GlassWater, ShoppingBag, Sparkles, Ticket, type LucideIcon } from "lucide-react";

// 03 §3.3: the fixed set of facility icons.
export const FACILITY_ICONS = ["Cookie", "GlassWater", "Ticket", "ShoppingBag", "Armchair", "Crown", "Sparkles", "Gift"] as const;
export type FacilityIconName = (typeof FACILITY_ICONS)[number];

const ICONS: Record<FacilityIconName, LucideIcon> = { Cookie, GlassWater, Ticket, ShoppingBag, Armchair, Crown, Sparkles, Gift };

export function facilityIcon(name: string): LucideIcon {
  return ICONS[name as FacilityIconName] ?? Gift;
}
