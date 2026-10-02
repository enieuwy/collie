import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, open, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadTail, MAX_TRANSCRIPT_BYTES, statFile } from "./files.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "collie-journal-files-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("journal filesystem reads", () => {
  test("statFile reports metadata and returns null after a file disappears", async () => {
    const path = join(dir, "session.jsonl");
    await writeFile(path, "older\nnewer\n");
    await utimes(path, 1_700_000_000, 1_700_000_000);
    expect(await statFile(path)).toEqual({ size: 12, mtimeMs: 1_700_000_000_000 });
    await rm(path);
    expect(await statFile(path)).toBeNull();
    await expect(loadTail(path)).rejects.toThrow();
  });

  test("a small log keeps all text and reports a complete read", async () => {
    const path = join(dir, "session.jsonl");
    const text = '{"turn":"older"}\n{"turn":"newer"}\n';
    await writeFile(path, text);
    const result = await loadTail(path);
    expect(result.text).toBe(text);
    expect(result.size).toBe(Buffer.byteLength(text));
    expect(result.complete).toBe(true);
  });

  test("the byte-cap boundary stays complete, but an oversized log keeps only the newest end", async () => {
    const path = join(dir, "large.jsonl");
    const file = await open(path, "w");
    try {
      await file.truncate(MAX_TRANSCRIPT_BYTES);
      await file.write("oldest\n", 0);
      const exact = await loadTail(path);
      expect(exact.complete).toBe(true);
      expect(exact.text.startsWith("oldest\n")).toBe(true);
      expect(Buffer.byteLength(exact.text)).toBe(MAX_TRANSCRIPT_BYTES);

      const size = MAX_TRANSCRIPT_BYTES + 100;
      await file.truncate(size);
      await file.write("newest\n", size - 7);
      const clipped = await loadTail(path);
      expect(clipped.complete).toBe(false);
      expect(clipped.size).toBe(size);
      expect(Buffer.byteLength(clipped.text)).toBe(MAX_TRANSCRIPT_BYTES);
      expect(clipped.text.includes("oldest\n")).toBe(false);
      expect(clipped.text.endsWith("newest\n")).toBe(true);
    } finally {
      await file.close();
    }
  });
});
