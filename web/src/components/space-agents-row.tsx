import { useEffect, useRef } from "react";

import { useLocale } from "@/hooks/use-locale";
import { useLongPress } from "@/hooks/use-long-press";
import { useSwipeUp } from "@/hooks/use-swipe";
import { t as translate } from "@/lib/i18n";
import { paneDisplayName, type AgentView } from "@/lib/types";
import { cn } from "@/lib/utils";

// The row that replaced the tab strip, the pane strip and the switcher handle: every agent
// working in this space as a horizontally scrollable run of session titles, with a small
// up-pill centred against its top border that opens the full switcher sheet. Tapping a title
// switches straight to that pane; the open one reads as current. Titles come from
// `paneDisplayName` (operator label, then the agent's own session name, then the agent kind),
// the same precedence the old pane pills used, so the row and the sheet never disagree about
// what a session is called.
interface SpaceAgentsRowProps {
  /** This workspace's agents, in stable order. */
  agents: readonly AgentView[];
  currentPaneId: string;
  onSelect: (paneId: string) => void;
  /** Opens the switcher sheet — the handle's old job, kept on the up-pill beside the swipe. */
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
  // Dragging UP anywhere on the row opens the quick switcher — the same sheet as the pill,
  // for the thumb that starts on a chip rather than the handle. Touch-only and read-only: it
  // never preventDefaults, so the row's horizontal scroll and every chip tap pass through.
  const swipe = useSwipeUp(onOpenSwitcher);

  return (
    // The pill's own lane: 10px of top padding whose upper half the pill vacates — it rides
    // centred ON the chrome border above this row (half over the statusline, half in this
    // lane), never on the chips: the scroller centres the current chip, so anything lower
    // would cover exactly the title the eye is looking for. In-flow costs 10px of chrome;
    // the statusline lends the top half its bottom-centre 48px, the emptiest patch of that
    // strip.
    // `touch-pan-x`: vertical drags belong to the swipe-up, not the browser. Without it a
    // swipe-up starts a viewport rubber-band (and a pull-to-refresh where one exists) while
    // the gesture also fires — the whole page bounces under the thumb. pan-x keeps the
    // chips' horizontal scroll and hands everything vertical to the handlers, no
    // preventDefault needed. `overscroll-y-none` stops the chain below from joining in.
    <div
      data-slot="space-agents"
      className="relative touch-pan-x overscroll-y-none px-3 pt-2.5"
      {...swipe}
    >
      {/* The up-pill: the swipe-up's visible twin. A bare gesture has no affordance — nothing
          says UP opens the picker — so the handle sits mid-screen (an easier target than the
          old edge cravat it replaces) wearing the gesture's own arrow. Same sheet, same
          accessible name the handle always answered to. */}
      <button
        type="button"
        onClick={onOpenSwitcher}
        aria-label={translate("chat.switcher.aria")}
        aria-haspopup="dialog"
        // Tapered, not capped: a pointed hexagon, so the handle reads as a direction (up)
        // rather than a button among buttons. Drawn as SVG because neither a border (cut
        // by any clip) nor a silhouette shadow (too faint on dark chrome) survives at
        // this size — a real 1.2px stroke in the icon tone holds on the terminal above
        // and the chrome below in both themes. 12px tall, centred on the border: 6px
        // over the statusline, 6px in the lane below it.
        className="absolute -top-1.5 left-1/2 z-10 flex h-3 w-14 -translate-x-1/2 touch-manipulation items-center justify-center text-muted-foreground transition-all select-none hover:opacity-80 active:scale-95"
      >
        <svg width="56" height="12" viewBox="0 0 56 12" fill="none" aria-hidden="true" className="block">
          <path
            d="M1.5 6 L11 1.2 H45 L54.5 6 L45 10.8 H11 Z"
            fill="var(--color-muted)"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M24 8.2 L28 4.2 L32 8.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className="flex h-7 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain pr-3 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
