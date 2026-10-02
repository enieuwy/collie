import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { ClaudeTranscriptSource } from "./claude.ts";
import { CodexTranscriptSource } from "./codex.ts";
import { GrokTranscriptSource } from "./grok.ts";
import { PiTranscriptSource } from "./pi.ts";

const SID = "019f4665-7df0-7540-a64f-7068335f21af";
const sources = [
  {
    agent: "claude",
    source: ClaudeTranscriptSource,
    relativePath: join("project", `${SID}.jsonl`),
  },
  {
    agent: "codex",
    source: CodexTranscriptSource,
    relativePath: join("2026", "08", "11", `rollout-2026-08-11T10-00-00-${SID}.jsonl`),
  },
  {
    agent: "pi",
    source: PiTranscriptSource,
    relativePath: join("--repo--", `2026-08-11T10-00-00-000Z_${SID}.jsonl`),
  },
  {
    agent: "grok",
    source: GrokTranscriptSource,
    relativePath: join("project", SID, "chat_history.jsonl"),
  },
];

describe("journal resolution cache containment", () => {
  for (const { agent, source: Source, relativePath } of sources) {
    test(`${agent}: a cached path cannot leave the root that resolved it`, async () => {
      const base = await realpath(await mkdtemp(join(tmpdir(), "collie-journal-cache-")));
      try {
        const first = join(base, "first");
        const second = join(base, "second");
        const firstLog = join(first, relativePath);
        const secondLog = join(second, relativePath);
        await mkdir(dirname(firstLog), { recursive: true });
        await mkdir(dirname(secondLog), { recursive: true });
        await writeFile(firstLog, "{}\n");
        await writeFile(secondLog, "{}\n");
        const src = new Source([first, second]);
        const ref = { kind: "id", value: SID } as const;
        expect(await src.resolve(ref)).toBe(firstLog);

        // A sibling configured root does not widen the first root's containment boundary.
        await rm(firstLog);
        await symlink(secondLog, firstLog);
        expect(await src.resolve(ref)).toBe(secondLog);
      } finally {
        await rm(base, { recursive: true, force: true });
      }
    });
  }
});
