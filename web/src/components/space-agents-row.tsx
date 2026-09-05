import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import { useLongPress } from "@/hooks/use-long-press";
import { useSwipeUp } from "@/hooks/use-swipe";
import { t as translate } from "@/lib/i18n";
import { paneDisplayName, type AgentView } from "@/lib/types";
import { cn } from "@/lib/utils";

// The row that replaced the tab strip, the pane strip and the switcher handle: a left-edge
// cravat that opens the full switcher sheet, and beside it every agent working in this space —
// a horizontally scrollable run of session titles. Tapping a title switches straight to that
// pane; the open one reads as current. Titles come from `paneDisplayName` (operator label, then
// the agent's own session name, then the agent kind), the same precedence the old pane pills
// used, so the row and the sheet never disagree about what a session is called.
interface SpaceAgentsRowProps {
  /** This workspace's agents, in stable order. */
  agents: readonly AgentView[];
  currentPaneId: string;
  onSelect: (paneId: string) => void;
  /** Opens the switcher sheet — the handle's old job, kept on the cravat. */
  onOpenSwitcher: () => void;
  /** A hold on a chip opens that pane's options (rename, close) — the pane pill's old sheet. */
  onHoldPane: (pane: AgentView) => void;
}

export function SpaceAgentsRow({
  agents,
  currentPaneId,
  onSelect,
  onOpenSwitcher,
  onHoldPane,
}: SpaceAgentsRowProps) {
  useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the current session on screen: after a switch (the list is stable, so this only runs
  // when the pane actually changes) centre its chip. Manual scroll arithmetic rather than
  // scrollIntoView: the sums are zeros in jsdom, a harmless no-op, where scrollIntoView throws
  // "not implemented".
  useEffect(() => {
    const box = scrollRef.current;
    // SAFETY: the only [aria-current] descendants here are the chips, which are <button>s.
    const current = box?.querySelector("[aria-current]") as HTMLElement | null;
    if (box && current) {
      box.scrollLeft = current.offsetLeft - box.clientWidth / 2 + current.clientWidth / 2;
    }
  }, [currentPaneId]);
  // Dragging UP anywhere on the row opens the quick switcher — the same sheet as the cravat,
  // for the thumb that starts on a chip rather than the edge. Touch-only and read-only: it
  // never preventDefaults, so the row's horizontal scroll and every chip tap pass through.
  const swipe = useSwipeUp(onOpenSwitcher);

  return (
    <div data-slot="space-agents" className="flex h-7 items-center gap-1.5" {...swipe}>
      {/* The cravat: a tab on the row's leading edge, opening the switcher sheet — one of two
          doors, the other being a swipe up anywhere on the row. Half-pill, flat against the
          chrome it hangs off, round on the side the thumb meets, with a left chevron pointing
          back at the sheet it opens — and the sheet's own accessible name, so it stays findable
          by the string the handle answered to. */}
      <button
        type="button"
        onClick={onOpenSwitcher}
        aria-label={translate("chat.switcher.aria")}
        aria-haspopup="dialog"
        className="flex h-7 w-9 shrink-0 touch-manipulation items-center justify-center rounded-r-full bg-muted/60 text-muted-foreground transition-colors select-none hover:bg-muted active:scale-95"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1 pr-3 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {agents.map((a) => (
          <AgentChip
            key={a.paneId}
            agent={a}
            current={a.paneId === currentPaneId}
            onSelect={onSelect}
            onHoldPane={onHoldPane}
          />
        ))}
      </div>
    </div>
  );
}

// One chip, split out so the hold gets its own hook instance — hooks in the map above would
// change count with the session list. The pane pill's old shape (pane-strip.tsx): tap selects,
// hold opens that pane's options, and the hook eats the click after a fired hold so a hold
// never switches panes on release.
function AgentChip({
  agent,
  current,
  onSelect,
  onHoldPane,
}: {
  agent: AgentView;
  current: boolean;
  onSelect: (paneId: string) => void;
  onHoldPane: (pane: AgentView) => void;
}) {
  const hold = useLongPress(() => onHoldPane(agent));
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.paneId)}
      {...hold}
      aria-current={current ? "true" : undefined}
      title={paneDisplayName(agent)}
      className={cn(
        // [-webkit-touch-callout:none] joins the select-none the chip already had: without it
        // iOS Safari's native hold gesture fires pointercancel and kills the timer (ui/chip.tsx).
        "h-6 max-w-44 shrink-0 truncate rounded-md px-2 text-[13px] font-medium whitespace-nowrap transition-colors select-none active:scale-95 [-webkit-touch-callout:none]",
        current
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/60",
      )}
    >
      {paneDisplayName(agent)}
    </button>
  );
}
