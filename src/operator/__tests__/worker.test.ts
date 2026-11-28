import { describe, expect, it } from "vitest";
import { cleanRigName, rigName, workerName } from "../format";

describe("add worker names", () => {
  it("keeps rig names the mint can show", () => {
    expect(cleanRigName("  my bitaxe 2 ")).toBe("my-bitaxe-2");
    expect(cleanRigName("s19/xp#1")).toBe("s19xp1");
    expect(cleanRigName("..rack.a")).toBe("rack.a");
    expect(cleanRigName("x".repeat(80))).toHaveLength(64);
  });
  it("puts the prefix in front, once", () => {
    expect(workerName("acct", "bitaxe2")).toBe("acct.bitaxe2");
    expect(workerName("acct.", "bitaxe2")).toBe("acct.bitaxe2");
    expect(workerName(null, "bitaxe2")).toBe("bitaxe2");
    // The Rigs list shows what follows the first dot.
    expect(rigName(workerName("acct", "bitaxe2"))).toBe("bitaxe2");
  });
});
