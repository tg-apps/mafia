import type { LivePlayerData } from "#db/schema";

import { shuffle } from "./shuffle";

export type PlayerRole = LivePlayerData["role"];

export function getRoles(playerCount: number): PlayerRole[] {
  const roles = Array<PlayerRole>(1)
    .fill("mafia")
    .concat(Array(playerCount - 1).fill("villager"));

  return shuffle(roles);
}
