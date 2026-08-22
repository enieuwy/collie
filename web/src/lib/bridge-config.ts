import { useEffect, useSyncExternalStore } from "react";

import { fetchConfig } from "@/lib/api";
import type { Launcher, OperatorCommand } from "@/lib/types";

// The operator's own config rows (`COLLIE_COMMANDS` + `COLLIE_LAUNCHERS`), read from /api/config
// and held in module state. Modelled on the lib/server-build.ts store idiom: plain module state +
// subscribe + a useSyncExternalStore hook, so the composer and the dashboard participate without
// prop-drilling through the route tree.
//
// THE CONTRACT: one SUCCESSFUL read is cached for the life of the page; a failed attempt is not
// cached, so a later mount tries again. Never polled, and deliberately not folded into the 1.5s
// snapshot: this is startup config on the bridge side (loadConfig() runs once, bridge/index.ts), so
// re-reading it every tick would spend bytes on a value that cannot change without a bridge
// restart. Which is also why changing it takes a bridge restart AND a page load, not just the
// restart — the same contract every other COLLIE_* var has, and what `.env.example` promises.
//
// A FAILED FETCH IS NOT AN ERROR STATE. With no rows, every pane falls back to its shipped catalog
// and the dashboard shows no extra buttons — which is exactly what a user without either var
// already sees. So a refusal (read-only device, auth lapse) or an offline start leaves empty lists
// and no status noise, and the single in-flight promise is cleared so a later MOUNT retries. Retry
// granularity is the reason the kick below lives in an effect and not in the render body: the
// composer re-renders on every 1.5s snapshot, so a render-phase kick would turn one refusal into a
// request per tick, forever.
//
// Launchers ride the SAME payload as operatorCommands — one endpoint, one store. A second store
// would mean a second GET /api/config, and two mounts (composer + dashboard) could race their
// fetches and flip who wins. Sharing the load keeps the request count at one for the life of the
// page, no matter how many call sites read it.

let operatorCommands: readonly OperatorCommand[] = [];
let launchers: readonly Launcher[] = [];
let inflight: Promise<void> | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Read the config once per page load. Concurrent callers share the one in-flight request. */
export function loadBridgeConfig(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;
  inflight = fetchConfig()
    .then((cfg) => {
      operatorCommands = cfg.operatorCommands ?? [];
      launchers = cfg.launchers ?? [];
      loaded = true;
      emit();
    })
    .catch(() => {
      // Additive feature — see the header. Leave the lists empty and allow a later retry.
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function getOperatorCommands(): readonly OperatorCommand[] {
  return operatorCommands;
}

export function getLaunchers(): readonly Launcher[] {
  return launchers;
}

export function subscribeBridgeConfig(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Reactive read of the operator palette rows. Kicks the one-shot fetch on mount, so the only
 * thing a call site has to do is read the value — there is no "load this somewhere at startup"
 * step to forget.
 */
export function useOperatorCommands(): readonly OperatorCommand[] {
  useEffect(() => {
    void loadBridgeConfig();
  }, []);
  return useSyncExternalStore(subscribeBridgeConfig, getOperatorCommands, getOperatorCommands);
}

/**
 * Reactive read of the launcher rows. Shares the one-shot /api/config fetch with
 * useOperatorCommands — whichever mounts first drives the request, the other joins the same
 * in-flight promise and re-renders when it lands. Same contract: one successful read cached;
 * a failed read not cached; retry on a later mount; not polled.
 */
export function useLaunchers(): readonly Launcher[] {
  useEffect(() => {
    void loadBridgeConfig();
  }, []);
  return useSyncExternalStore(subscribeBridgeConfig, getLaunchers, getLaunchers);
}

/** Test helper — reset module state between cases. */
export function __resetBridgeConfig(): void {
  operatorCommands = [];
  launchers = [];
  inflight = null;
  loaded = false;
  listeners.clear();
}
