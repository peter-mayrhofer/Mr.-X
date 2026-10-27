// Ein Icon-Set (Lucide, E-14). Namen für Daten (z. B. Regeln) → Komponente.
import type { LucideIcon } from "@lucide/svelte";
import { Building, Flag, Gavel, Hand, Map, Radar, Repeat, Shrink, Timer, TramFront, Trophy, Users } from "@lucide/svelte";

export type Icon = LucideIcon;

export const ICONS: Record<string, Icon> = {
  flag: Flag,
  timer: Timer,
  hand: Hand,
  repeat: Repeat,
  radar: Radar,
  users: Users,
  building: Building,
  tram: TramFront,
  map: Map,
  shrink: Shrink,
  gavel: Gavel,
  trophy: Trophy,
};
