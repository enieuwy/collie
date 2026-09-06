import { Check, Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { useActionEcho } from "@/hooks/use-action-echo";
import { usePinSide } from "@/hooks/use-pin-side";
import { t as translate } from "@/lib/i18n";
import { keyLabel } from "@/lib/key-queue";
import { keysSendable } from "@/lib/mux-capability";

// The fixed key rail: Termius's single quick-picker row, one tap, no dock open. Esc, Tab, ⇧Tab,
// the four arrows, ^C — the keys a phone keyboard cannot send — plus a pinned pad tab that
// toggles the full Keys dock (it carries `aria-expanded`, and shares the Keys toggle's old
// dictionary string so nothing gains a key). The rail replaced the Controls row outright, so the
// Quick/Display docks have no entry — nothing here is derived from the screen or from the
// command catalog. (The Agent palette's entry is the agents row's /Agents pin, above.)
//
// Backspace rides along ONLY while direct typing is armed: in Reply mode it would sit one row
// above a textarea where it means the opposite (delete-draft), so it stays off. Enter and Space
// are always on: they fire one-shot keys into the terminal, never touching the draft, so there is
// nothing to confuse them with.
// Every key passes `keysSendable` and greys in place when the multiplexer refuses it, exactly
// like the dock's own rail. One-shot fires go through the composer's `pressKeys`, so the dialog
// refusal and the echo accounting are the same path the dock uses.
const RAIL_KEYS = ["Escape", "Tab", "shift+Tab", "Up", "Down", "Left", "Right", "ctrl+c", "Enter", "Space"] as const;
const DIRECT_KEYS = ["Backspace"] as const;

// Glyph caps for the arrows and Space: text names would eat the row. Plain symbols need no
// dictionary entry (key caps are excluded), and the aria-label keeps the wire name for readers
// and tests.
const GLYPHS: Record<string, string> = { Up: "↑", Down: "↓", Left: "←", Right: "→", Space: "␣" };

interface KeyRailProps {
  /** Resolves true when the bridge accepted the keys — drives the ✓ echo. */
  onSend: (keys: string[]) => Promise<boolean>;
  unsupportedKeys: readonly string[];
  /** Direct typing armed: Enter + Backspace join the row. */
  directActive: boolean;
  /** Toggles the Keys dock through the composer's drawer choke (guarded like the ✕). */
  onOpenPad: () => void;
  /** Whether the Keys dock is open — the pad is its toggle, so it carries `aria-expanded`. */
  padOpen: boolean;
  disabled?: boolean;
}
export function KeyRail({ onSend, unsupportedKeys, directActive, onOpenPad, padOpen, disabled }: KeyRailProps) {
  useLocale();
  const { side } = usePinSide();
  const echo = useActionEcho();

  const keys = directActive ? [...RAIL_KEYS, ...DIRECT_KEYS] : RAIL_KEYS;

  // The pad tab, built once and slotted on the configured edge — the agents row's /Agents pin
  // twin. Bleed, round cap and glyph padding trade sides together with it.
  const pad = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onOpenPad}
      aria-label={translate("composer.controls.keys")}
      aria-expanded={padOpen}
      aria-controls="dock-keys"
      className={
        side === "left"
          ? "-ml-3 h-8 shrink-0 touch-manipulation rounded-r-full rounded-l-none bg-muted pl-3 pr-2.5 text-muted-foreground select-none"
          : "-mr-3 h-8 shrink-0 touch-manipulation rounded-l-full rounded-r-none bg-muted pl-2.5 pr-3 text-muted-foreground select-none"
      }
    >
      <Keyboard className="size-4" />
    </Button>
  );

  return (
    <div
      data-slot="key-rail"
      className={side === "left" ? "-ml-3 mb-2 flex items-center gap-1.5" : "-mr-3 mb-2 flex items-center gap-1.5"}
    >
      {side === "left" && pad}
      <div
        className={
          side === "left"
            ? "flex flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_left,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {keys.map((k) => {
          const phase = echo.phaseOf(k);
          // Greyed rather than removed: the rail order is fixed muscle memory, and pulling a key
          // out would move every key after it — the same call the dock's rail makes.
          const refused = !keysSendable([k], unsupportedKeys);
          const glyph = GLYPHS[k];
          return (
            <Button
              key={k}
              type="button"
              variant={phase === "idle" ? "ghost" : "default"}
              size="sm"
              disabled={disabled || refused}
              onClick={() => void echo.run(k, () => onSend([k]))}
              aria-label={glyph ? k : undefined}
              className="h-8 shrink-0 touch-manipulation px-2.5 font-mono text-xs text-muted-foreground select-none"
            >
              {phase === "done" ? <Check className="size-4" /> : (glyph ?? keyLabel(k))}
            </Button>
          );
        })}
      </div>
      {side === "right" && pad}
    </div>
  );
}
