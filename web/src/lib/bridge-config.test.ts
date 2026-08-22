import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Spied at the api seam, not over the network: the invariant under test is how MANY times the
// store asks, and a mock records that synchronously — no waiting on a request that may never come.
vi.mock("@/lib/api", () => ({ fetchConfig: vi.fn() }));

import { fetchConfig } from "@/lib/api";
import type { BridgeConfig } from "@/lib/types";
import {
  __resetBridgeConfig,
  getLaunchers,
  getOperatorCommands,
  loadBridgeConfig,
  useLaunchers,
  useOperatorCommands,
} from "./bridge-config";

const asked = vi.mocked(fetchConfig);

const forkIn = {
  agent: "omp",
  command: "/fork-in-herdr",
  description: "Fork into a new herdr tab",
  takesArg: false,
  argHint: "",
};

const peek: BridgeConfig["launchers"] = [{ command: "rumen-peek", label: "Runs & quota" }];

const config = (
  operatorCommands?: BridgeConfig["operatorCommands"],
  launchers?: BridgeConfig["launchers"],
): BridgeConfig => ({
  push: false,
  vapidPublicKey: "",
  ...(operatorCommands ? { operatorCommands } : {}),
  ...(launchers ? { launchers } : {}),
});

beforeEach(() => asked.mockReset());
afterEach(() => __resetBridgeConfig());

describe("the operator's palette rows are read once, not polled", () => {
  it("fetches on the first mount and serves later mounts from module state", async () => {
    asked.mockResolvedValue(config([forkIn]));
    const first = renderHook(() => useOperatorCommands());
    await waitFor(() => expect(first.result.current).toEqual([forkIn]));
    first.unmount();
    const second = renderHook(() => useOperatorCommands());
    expect(second.result.current).toEqual([forkIn]); // no second round trip, no flash of empty
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it("does not re-request when the composer re-renders around it", async () => {
    asked.mockResolvedValue(config([forkIn]));
    const { result, rerender } = renderHook(() => useOperatorCommands());
    await waitFor(() => expect(result.current).toEqual([forkIn]));
    for (let i = 0; i < 20; i++) rerender();
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it("survives a refusal as an empty list, retried on a later mount, not on every render", async () => {
    // Extras are additive: with none, the palette is exactly what a user without the var sees. So a
    // read-only device or an auth lapse costs an empty list and nothing else — and, critically, the
    // composer re-renders on every 1.5s snapshot, so a kick in the render body would turn one
    // refusal into a request per tick, forever.
    asked.mockRejectedValue(new Error("403"));
    const { result, rerender } = renderHook(() => useOperatorCommands());
    await waitFor(() => expect(asked).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 20; i++) rerender();
    expect(result.current).toEqual([]);
    expect(asked).toHaveBeenCalledTimes(1); // the failure did not arm a request loop
    expect(getOperatorCommands()).toEqual([]);

    asked.mockResolvedValue(config([forkIn]));
    const retry = renderHook(() => useOperatorCommands()); // a later mount is the retry
    await waitFor(() => expect(retry.result.current).toEqual([forkIn]));
  });

  it("shares one in-flight request between concurrent callers", async () => {
    // All three land before the first response resolves, so the second and third must join the
    // promise already in flight rather than opening their own.
    asked.mockResolvedValue(config([forkIn]));
    const all = Promise.all([loadBridgeConfig(), loadBridgeConfig(), loadBridgeConfig()]);
    expect(asked).toHaveBeenCalledTimes(1);
    await all;
    expect(getOperatorCommands()).toEqual([forkIn]);
  });

  it("treats a bridge that sends no operatorCommands as no extras", async () => {
    asked.mockResolvedValue(config());
    await loadBridgeConfig();
    expect(getOperatorCommands()).toEqual([]);
  });
});

describe("launchers share the same one-shot fetch", () => {
  it("reads launchers from the same payload and caches them beside operatorCommands", async () => {
    asked.mockResolvedValue(config([forkIn], peek as any));
    const a = renderHook(() => useOperatorCommands());
    const b = renderHook(() => useLaunchers());
    await waitFor(() => expect(a.result.current).toEqual([forkIn]));
    await waitFor(() => expect(b.result.current).toEqual(peek));
    expect(asked).toHaveBeenCalledTimes(1);
    expect(getOperatorCommands()).toEqual([forkIn]);
    expect(getLaunchers()).toEqual(peek);
  });

  it("a launcher mount drives the same in-flight request as a command mount", async () => {
    asked.mockResolvedValue(config(undefined, peek as any));
    // Start both before the promise resolves — they must join one flight.
    const all = Promise.all([loadBridgeConfig(), loadBridgeConfig()]);
    // Also mount hooks concurrently
    const hook = renderHook(() => useLaunchers());
    expect(asked).toHaveBeenCalledTimes(1);
    await all;
    await waitFor(() => expect(hook.result.current).toEqual(peek));
    expect(getLaunchers()).toEqual(peek);
  });

  it("a failed fetch leaves launchers empty and retries on the next mount", async () => {
    asked.mockRejectedValue(new Error("403"));
    const { result, rerender } = renderHook(() => useLaunchers());
    await waitFor(() => expect(asked).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 20; i++) rerender();
    expect(result.current).toEqual([]);
    expect(getLaunchers()).toEqual([]);
    expect(asked).toHaveBeenCalledTimes(1);

    asked.mockResolvedValue(config(undefined, peek as any));
    const retry = renderHook(() => useLaunchers());
    await waitFor(() => expect(retry.result.current).toEqual(peek));
  });

  it("treats a bridge that sends no launchers as no extras", async () => {
    asked.mockResolvedValue(config());
    await loadBridgeConfig();
    expect(getLaunchers()).toEqual([]);
  });
});
