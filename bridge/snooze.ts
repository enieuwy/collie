import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.ts";

// A global "do not disturb" for push. While a future deadline is set, the bridge sends no
// notifications (and the act of snoozing retracts the current one) — for when you're heads-down at
// the desk and the phone in your pocket doesn't need to buzz. Persisted to the state dir so a snooze
// survives the `systemctl restart` that backend changes require, and self-expiring. `now` is
// injected so `bun test` can drive expiry without real time.

export class Snooze {
  private mutedUntil: number | null = null;
  private readonly file: string;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly cfg: Config,
    private readonly now: () => number = Date.now,
  ) {
    this.file = join(cfg.stateDir, "snooze.json");
  }

  async load(): Promise<void> {
    try {
      const raw = (await Bun.file(this.file).json()) as { mutedUntil?: unknown };
      this.mutedUntil = typeof raw.mutedUntil === "number" ? raw.mutedUntil : null;
    } catch {
      /* none saved yet */
    }
  }

  /** The active snooze deadline (epoch ms), or null if not snoozed / already elapsed. */
  until(): number | null {
    if (this.mutedUntil !== null && this.now() >= this.mutedUntil) this.mutedUntil = null;
    return this.mutedUntil;
  }

  isMuted(): boolean {
    return this.until() !== null;
  }

  /** Snooze until `mutedUntil` (epoch ms); a past timestamp or null resumes immediately. */
  async set(mutedUntil: number | null): Promise<void> {
    this.mutedUntil = mutedUntil !== null && mutedUntil > this.now() ? mutedUntil : null;
    const snapshot = JSON.stringify({ mutedUntil: this.mutedUntil }, null, 2);
    const write = () => this.writeState(snapshot);
    const run = this.saveChain.then(write, write);
    this.saveChain = run.catch(() => {});
    await run;
  }

  /** Atomic, owner-only write, serialised with every earlier set. */
  private async writeState(data: string): Promise<void> {
    await mkdir(this.cfg.stateDir, { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, data, { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
