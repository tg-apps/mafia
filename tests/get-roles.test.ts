import { describe, it, expect } from "bun:test";

import { getRoles } from "#utils/get-roles";

describe("getRoles", () => {
  it("4 players", () => {
    const roles = getRoles(4).toSorted();
    expect(roles).toBeArrayOfSize(4);
    expect(roles).toEqual(["mafia", "villager", "villager", "villager"]);
  });
});
