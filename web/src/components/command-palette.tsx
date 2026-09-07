import { useEffect, useState } from "react";
import { CornerDownLeft, Pencil, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/sheet";
import { AgentIcon } from "@/components/agent-icon";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import { commandsFor, type AgentCommand } from "@/lib/agent-commands";
import { quickRepliesFor, quickReplyGroupTitle } from "@/lib/quick-replies";
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

// One row shape for commands and replies alike — a reply is a no-arg submit with a group name
// for a description, so it rides the same pick. Module-level so it is not a fresh component
// type each render (which would remount the list).
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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
        isPending ? "bg-destructive/10" : "hover:bg-accent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              c.dangerous ? "text-destructive" : "text-foreground",
            )}
          >
            {c.command}
          </span>
          {c.takesArg && (
            <span className="font-mono text-[11px] text-muted-foreground">{c.argHint}</span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{c.description}</p>
      </div>
      {isPending ? (
        <span className="shrink-0 text-xs font-medium text-destructive">{t("commands.confirm")}</span>
      ) : c.takesArg ? (
        <Pencil className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
      )}
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
  const all = commandsFor(agent, mine);
  const [query, setQuery] = useState("");
  const { pending, confirm, reset } = usePendingConfirm();

  // Reset transient state whenever the sheet (re)opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      reset();
    }
  }, [open, reset]);

  const q = query.trim().toLowerCase();
  const list = q
    ? all.filter(
        (c) =>
          c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      )
    : all.filter((c) => c.common);

  // The old Quick dock's one-tap replies, as palette rows: a reply IS a no-arg submit, so the
  // same pick() below sends it. Shipped as groups (confirm/common); the operator's own groups
  // replace them per pane under the same rule as commands (ADR 0018).
  const replyRows: readonly AgentCommand[] = quickRepliesFor(agent, isShell, mineReplies ?? []).flatMap(
    (g) =>
      g.items
        .filter((item) => !q || item.toLowerCase().includes(q))
        .map((item): AgentCommand => ({
          command: item,
          description: quickReplyGroupTitle(g.title),
          takesArg: false,
          argHint: "",
          common: true,
          dangerous: false,
        })),
  );

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
      {agent && (
        <div className="mb-3 flex items-center gap-2">
          <AgentIcon agent={agent} className="size-6" />
          <span className="text-sm font-medium">{agent}</span>
        </div>
      )}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("commands.search.placeholder", { count: all.length })}
          className="h-11 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </div>

      {!q && (
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("commands.common.hint", { count: all.length })}
        </p>
      )}

      {replyRows.length > 0 && (
        <>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("commands.quickReplies.title")}
          </p>
          <div className="mb-3 flex flex-col gap-1">
            {replyRows.map((c) => (
              <PaletteRow
                key={`reply:${c.command}`}
                c={c}
                isPending={pending === c.command}
                onPick={pick}
              />
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        {list.length === 0 && replyRows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("commands.empty", { query })}
          </p>
        )}
        {list.map((c) => (
          <PaletteRow key={c.command} c={c} isPending={pending === c.command} onPick={pick} />
        ))}
      </div>
    </BottomSheet>
  );
}
