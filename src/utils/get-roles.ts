import type { LivePlayerData } from "#db/schema";

import { shuffle } from "./shuffle";

export type PlayerRole = LivePlayerData["role"];

export function getRoles(playerCount: number): PlayerRole[] {
  const mafiaCount = Math.max(1, Math.floor(playerCount / 3));

  const roles = shuffle(
    Array<PlayerRole>(mafiaCount)
      .fill("mafia")
      .concat(Array(playerCount - mafiaCount).fill("villager")),
  );

  return roles;
}
