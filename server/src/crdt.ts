/**
 * Last-Write-Wins (LWW) text CRDT.
 * Each character position is keyed by a fractional index string; inserts and deletes
 * carry logical timestamps so concurrent edits converge.
 */

export type OpType = "insert" | "delete";

export interface CrdtOp {
  type: OpType;
  /** Fractional position key (lexicographic order). */
  pos: string;
  char?: string;
  /** Logical time: [lamport, siteId] */
  time: [number, string];
}

export interface CrdtChar {
  pos: string;
  char: string;
  time: [number, string];
  deleted: boolean;
}

export interface CrdtState {
  chars: Map<string, CrdtChar>;
  lamport: number;
  siteId: string;
}

export function createState(siteId: string): CrdtState {
  return { chars: new Map(), lamport: 0, siteId };
}

function compareTime(a: [number, string], b: [number, string]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
}

function bump(state: CrdtState, remote: [number, string]): [number, string] {
  state.lamport = Math.max(state.lamport, remote[0]) + 1;
  return [state.lamport, state.siteId];
}

/** Generate a key strictly between two fractional indices (may be empty). */
export function between(left: string, right: string): string {
  if (left >= right && right !== "") {
    throw new Error("left must be < right");
  }
  if (left === "" && right === "") return "a";
  if (left === "") return right.slice(0, 1) > "a" ? "a" : "a" + between("", right);
  if (right === "") return left + "a";

  let i = 0;
  while (i < left.length && i < right.length && left[i] === right[i]) i++;
  const lc = left[i] ?? "";
  const rc = right[i] ?? "";
  if (lc && (!rc || lc < String.fromCharCode(rc.charCodeAt(0) - 1))) {
    return left.slice(0, i) + String.fromCharCode(lc.charCodeAt(0) + 1);
  }
  return left + "a";
}

function sortedVisible(state: CrdtState): CrdtChar[] {
  return [...state.chars.values()]
    .filter((c) => !c.deleted)
    .sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
}

export function toText(state: CrdtState): string {
  return sortedVisible(state).map((c) => c.char).join("");
}

export function localInsert(state: CrdtState, index: number, char: string): CrdtOp {
  const visible = sortedVisible(state);
  const left = index > 0 ? visible[index - 1]!.pos : "";
  const right = index < visible.length ? visible[index]!.pos : "";
  const pos =
    left === "" && right === ""
      ? `a${state.siteId}`
      : between(left, right);
  const time = bump(state, [state.lamport, state.siteId]);
  applyRemote(state, { type: "insert", pos, char, time });
  return { type: "insert", pos, char, time };
}

export function localDelete(state: CrdtState, index: number): CrdtOp | null {
  const visible = sortedVisible(state);
  const target = visible[index];
  if (!target) return null;
  const time = bump(state, [state.lamport, state.siteId]);
  applyRemote(state, { type: "delete", pos: target.pos, time });
  return { type: "delete", pos: target.pos, time };
}

export function applyRemote(state: CrdtState, op: CrdtOp): void {
  state.lamport = Math.max(state.lamport, op.time[0]);
  const existing = state.chars.get(op.pos);

  if (op.type === "insert") {
    if (!op.char) return;
    if (!existing || compareTime(op.time, existing.time) > 0) {
      state.chars.set(op.pos, {
        pos: op.pos,
        char: op.char,
        time: op.time,
        deleted: false,
      });
    }
    return;
  }

  if (op.type === "delete") {
    if (!existing) {
      state.chars.set(op.pos, {
        pos: op.pos,
        char: op.char ?? "",
        time: op.time,
        deleted: true,
      });
      return;
    }
    if (compareTime(op.time, existing.time) > 0) {
      existing.deleted = true;
      existing.time = op.time;
    }
  }
}

export function merge(state: CrdtState, ops: CrdtOp[]): CrdtState {
  for (const op of ops) applyRemote(state, op);
  return state;
}
