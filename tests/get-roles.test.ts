import { describe, it, expect } from "bun:test";

import { getRoles } from "#utils/get-roles";

describe("getRoles", () => {
  it("4 players", () => {
    const count = 4;
    const roles = getRoles(count).toSorted();
    expect(roles).toBeArrayOfSize(count);
    expect(roles).toEqual(["mafia", "villager", "villager", "villager"]);
  });

  it("5 players", () => {
    const count = 5;
    const roles = getRoles(count).toSorted();
    expect(roles).toBeArrayOfSize(count);
    expect(roles).toEqual([
      "mafia",
      "villager",
      "villager",
      "villager",
      "villager",
    ]);
  });
});
