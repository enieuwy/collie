import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
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
}

export function SpaceAgentsRow({ agents, currentPaneId, onSelect, onOpenSwitcher }: SpaceAgentsRowProps) {
  useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the current session on screen: after a switch (the list is stable, so this only runs
  // when the pane actually changes) centre its chip. Manual scroll arithmetic rather than
  // scrollIntoView: the sums are zeros in jsdom, a harmless no-op, where scrollIntoView throws
  // "not implemented".
  useEffect(() => {
    const box = scrollRef.current;
    const current = box?.querySelector("[aria-current]") as HTMLElement | null;
    if (box && current) {
      box.scrollLeft = current.offsetLeft - box.clientWidth / 2 + current.clientWidth / 2;
    }
  }, [currentPaneId]);

  return (
    <div data-slot="space-agents" className="flex h-7 items-center gap-1.5">
      {/* The cravat: a tab on the row's leading edge, the switcher's only entry. Half-pill —
          flat against the chrome it hangs off, round on the side the thumb meets, with a left
          chevron pointing back at the sheet it opens — and the sheet's own accessible name, so
          it stays findable by the string the handle answered to. */}
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
        {agents.map((a) => {
          const current = a.paneId === currentPaneId;
          return (
            <button
              key={a.paneId}
              type="button"
              onClick={() => onSelect(a.paneId)}
              aria-current={current ? "true" : undefined}
              title={paneDisplayName(a)}
              className={cn(
                "h-6 max-w-44 shrink-0 truncate rounded-md px-2 text-[13px] font-medium whitespace-nowrap transition-colors select-none active:scale-95",
                current
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {paneDisplayName(a)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
