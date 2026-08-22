import { Button } from "@/components/ui/button";
import { useLaunchers } from "@/lib/bridge-config";
import { useSpaceActions } from "@/hooks/use-spaces";

// A one-tap row of operator-declared launcher buttons for the dashboard. Each tap creates a
// throwaway space and types the command verbatim — herdr deletes the space when its last pane
// closes, so quit → gone with nothing to clean up. Uses the same "fresh pane" navigation the
// tab/space creates use, so you land in the new shell immediately.
//
// Renders nothing when the launcher list is empty, so an operator who never set
// `COLLIE_LAUNCHERS` sees today's dashboard byte for byte — no heading, no chrome, no layout
// shift. The neighbouring Spaces section carries its own "Spaces" heading; a second heading here
// would be noise, and the button labels themselves say what these do.
export function LaunchStrip() {
  const launchers = useLaunchers();
  const { launch } = useSpaceActions();

  // Nothing configured → no affordance at all. Commented because an empty return that looks like
  // "forgot to handle the empty case" is really the intended default for every install without
  // the var.
  if (launchers.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 px-3 py-3" aria-label="Launchers">
      <div className="flex flex-wrap gap-2">
        {launchers.map((launcher) => (
          // size="lg" is h-11 — the same 44px touch target as every other primary phone action
          // (the new-space sheet's Create button, the quick-action rows), and `outline` keeps a
          // launcher from competing with the triage list above it for attention.
          <Button
            key={launcher.command}
            type="button"
            variant="outline"
            size="lg"
            onClick={() => void launch(launcher.command)}
          >
            {launcher.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
