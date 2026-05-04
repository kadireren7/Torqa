/**
 * Tiny RFC6902-lite engine for the Fix Engine.
 *
 * Supports `add`, `replace`, `remove` against a deep-cloned object tree.
 * Paths are JSON pointers (e.g. `/parameters/rejectUnauthorized`).
 *
 * Numeric segments target arrays; string segments target object properties.
 * A trailing `/-` means "append to array" for `add`.
 *
 * The engine is intentionally pure: it never mutates the input, never
 * reaches into prototypes, and never auto-creates intermediate paths.
 */

import type { JsonPatchOp } from "@/lib/governance/types";

export class JsonPatchError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = "JsonPatchError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v);
  }
  return out as unknown as T;
}

function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parsePath(path: string): string[] {
  if (path === "" || path === "/") return [];
  if (!path.startsWith("/")) {
    throw new JsonPatchError("JSON pointer must start with '/'", path);
  }
  return path.slice(1).split("/").map(decodeSegment);
}

function isProtoKey(key: string): boolean {
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

type Container = Record<string, unknown> | unknown[];

function navigateParent(
  root: Container,
  segments: string[]
): { parent: Container; key: string } {
  if (segments.length === 0) {
    throw new JsonPatchError("Cannot operate on root with empty pointer", "");
  }
  let current: unknown = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
        throw new JsonPatchError(`Array index out of range at /${segments.slice(0, i + 1).join("/")}`, "/" + segments.join("/"));
      }
      current = current[idx];
    } else if (isObject(current)) {
      if (isProtoKey(seg)) {
        throw new JsonPatchError("Refusing to traverse prototype key", "/" + segments.join("/"));
      }
      if (!Object.prototype.hasOwnProperty.call(current, seg)) {
        throw new JsonPatchError(`Path does not exist at /${segments.slice(0, i + 1).join("/")}`, "/" + segments.join("/"));
      }
      current = (current as Record<string, unknown>)[seg];
    } else {
      throw new JsonPatchError(
        `Cannot descend into non-container at /${segments.slice(0, i + 1).join("/")}`,
        "/" + segments.join("/")
      );
    }
  }
  if (!Array.isArray(current) && !isObject(current)) {
    throw new JsonPatchError("Final container is not an object/array", "/" + segments.join("/"));
  }
  return { parent: current as Container, key: segments[segments.length - 1] };
}

function applyOp(root: Container, op: JsonPatchOp): void {
  const segments = parsePath(op.path);
  const { parent, key } = navigateParent(root, segments);

  if (Array.isArray(parent)) {
    const idx = key === "-" ? parent.length : Number(key);
    if (op.op === "add") {
      if (key === "-" || idx === parent.length) {
        parent.push(op.value);
      } else if (Number.isInteger(idx) && idx >= 0 && idx <= parent.length) {
        parent.splice(idx, 0, op.value);
      } else {
        throw new JsonPatchError("Array index out of range for add", op.path);
      }
      return;
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new JsonPatchError("Array index out of range", op.path);
    }
    if (op.op === "replace") {
      parent[idx] = op.value;
      return;
    }
    if (op.op === "remove") {
      parent.splice(idx, 1);
      return;
    }
    return;
  }

  if (isProtoKey(key)) {
    throw new JsonPatchError("Refusing to mutate prototype key", op.path);
  }

  if (op.op === "add") {
    parent[key] = op.value;
    return;
  }
  if (op.op === "replace") {
    if (!Object.prototype.hasOwnProperty.call(parent, key)) {
      throw new JsonPatchError("Cannot replace missing key", op.path);
    }
    parent[key] = op.value;
    return;
  }
  if (op.op === "remove") {
    if (!Object.prototype.hasOwnProperty.call(parent, key)) {
      throw new JsonPatchError("Cannot remove missing key", op.path);
    }
    delete parent[key];
    return;
  }
}

/**
 * Apply ops onto a deep clone of `document`. Returns the new document
 * unchanged if `ops` is empty. Throws on any invalid op so callers can
 * surface the error and refuse to commit.
 */
export function applyJsonPatch<T extends object>(document: T, ops: JsonPatchOp[]): T {
  if (!ops.length) return deepClone(document);
  const clone = deepClone(document) as unknown as Container;
  for (const op of ops) {
    applyOp(clone, op);
  }
  return clone as unknown as T;
}

/**
 * Read the value at `path` in `document`, or `undefined` if missing.
 * Used to compute `before` snapshots for fix-preview UIs without throwing.
 */
export function readJsonPointer(document: unknown, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = document;
  for (const seg of segments) {
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) return undefined;
      current = current[idx];
      continue;
    }
    if (isObject(current)) {
      if (isProtoKey(seg)) return undefined;
      if (!Object.prototype.hasOwnProperty.call(current, seg)) return undefined;
      current = (current as Record<string, unknown>)[seg];
      continue;
    }
    return undefined;
  }
  return current;
}

/** Encode an arbitrary key as a single JSON pointer segment (handles '/' and '~'). */
export function encodePointerSegment(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}
