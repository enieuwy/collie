import { useEffect } from "react";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/sheet";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import { commandsFor, type AgentCommand } from "@/lib/agent-commands";
import { quickRepliesFor } from "@/lib/quick-replies";
import type { OperatorCommand, OperatorQuickReplyRow } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  agent: string | undefined | null;
  /** A bare shell gets y/n replies, never agent phrases (lib/quick-replies). */
  isShell: boolean;
  /** The operator's own rows (`commands.toml`); they replace the catalog on panes they address. */
  mine?: readonly OperatorCommand[];
  /** The operator's own reply groups (`quick-replies.toml`); same replace rule, same panes. */
  mineReplies?: readonly OperatorQuickReplyRow[];
  /** Insert "/cmd " into the composer for the user to complete (arg-taking commands). */
  onInsert: (text: string) => void;
  /** Send "/cmd" immediately and submit (no-arg commands). */
  onSubmit: (text: string) => void;
}

// One row shape for the command list. Module-level so it is not a fresh component type each
// render (which would remount the list).
function PaletteRow({
  c,
  isPending,
  onPick,
}: {
  c: AgentCommand;
  isPending: boolean;
  onPick: (c: AgentCommand) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors active:scale-[0.99]",
        isPending ? "bg-destructive/10" : "hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "shrink-0 font-mono text-sm font-semibold",
          c.dangerous ? "text-destructive" : "text-foreground",
        )}
      >
        {c.command}
      </span>
      {c.takesArg && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{c.argHint}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{c.description}</span>
      {isPending ? (
        <span className="shrink-0 text-xs font-medium text-destructive">{t("commands.confirm")}</span>
      ) : c.takesArg ? (
        <Pencil className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  );
}
export function CommandPalette({
  open,
  onClose,
  agent,
  isShell,
  mine,
  mineReplies,
  onInsert,
  onSubmit,
}: CommandPaletteProps) {
  useLocale();
  const { pending, confirm, reset } = usePendingConfirm();

  // Reset transient state whenever the sheet (re)opens.
  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  // No search, no filter: the catalogs lead with their common rows, so the full list reads
  // common-first and the sheet scrolls the rest. Fifty rows of scroll worst case (Claude).
  const list = commandsFor(agent, mine);

  // One-tap replies as chips above the commands — a reply carries no description worth a row,
  // so it gets a pill, not a PaletteRow. The operator's own groups replace the shipped ones
  // per pane under the same rule as commands (ADR 0018).
  const replies: readonly string[] = quickRepliesFor(agent, isShell, mineReplies ?? []).flatMap(
    (g) => g.items,
  );

  function pickReply(item: string) {
    // Replies never take args and are never dangerous — straight submit, like pick's fast path.
    onSubmit(item);
    onClose();
  }

  function pick(c: AgentCommand) {
    if (c.takesArg) {
      onInsert(`${c.command} `);
      onClose();
      return;
    }
    if (c.dangerous && !confirm(c.command)) return; // first tap arms the confirm
    reset();
    onSubmit(c.command);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("commands.title")} className="max-h-[85dvh]">
      {replies.length > 0 && (
        <>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("commands.quickReplies.title")}
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {replies.map((item, i) => (
              <button
                key={`reply:${i}`}
                type="button"
                onClick={() => pickReply(item)}
                className="h-11 shrink-0 rounded-lg bg-muted px-4 font-mono text-sm font-semibold text-foreground transition-transform active:scale-[0.97]"
              >
                {item}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        {list.map((c) => (
          <PaletteRow key={c.command} c={c} isPending={pending === c.command} onPick={pick} />
        ))}
      </div>
    </BottomSheet>
  );
}
