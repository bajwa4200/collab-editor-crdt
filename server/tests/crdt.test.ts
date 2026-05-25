import { describe, expect, it } from "vitest";
import {
  applyRemote,
  between,
  createState,
  localDelete,
  localInsert,
  merge,
  toText,
  type CrdtOp,
} from "../src/crdt.js";

describe("LWW text CRDT", () => {
  it("inserts characters in order", () => {
    const a = createState("a");
    localInsert(a, 0, "H");
    localInsert(a, 1, "i");
    expect(toText(a)).toBe("Hi");
  });

  it("merges concurrent inserts from two sites", () => {
    const siteA = createState("A");
    const siteB = createState("B");

    const opA = localInsert(siteA, 0, "A");
    const opB = localInsert(siteB, 0, "B");

    merge(siteA, [opB]);
    merge(siteB, [opA]);

    expect(toText(siteA)).toBe(toText(siteB));
    expect(toText(siteA).length).toBe(2);
  });

  it("delete tombstones converge", () => {
    const a = createState("a");
    const ins = localInsert(a, 0, "x");
    const b = createState("b");
    merge(b, [ins]);

    const del = localDelete(a, 0)!;
    merge(b, [del]);

    expect(toText(a)).toBe("");
    expect(toText(b)).toBe("");
  });

  it("LWW resolves duplicate position inserts", () => {
    const pos = between("", "");
    const early: CrdtOp = {
      type: "insert",
      pos,
      char: "1",
      time: [1, "a"],
    };
    const late: CrdtOp = {
      type: "insert",
      pos,
      char: "2",
      time: [2, "b"],
    };

    const s1 = createState("x");
    const s2 = createState("y");
    applyRemote(s1, early);
    applyRemote(s1, late);
    applyRemote(s2, late);
    applyRemote(s2, early);

    expect(toText(s1)).toBe(toText(s2));
    expect(toText(s1)).toBe("2");
  });
});
