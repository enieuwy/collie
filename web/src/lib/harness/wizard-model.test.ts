import { describe, expect, it } from "vitest";

import { wizardsEqual } from "./wizard-model";
import type { WizardModel } from "./wizard-model";

function question(): Extract<WizardModel, { phase: "question" }> {
  return {
    phase: "question",
    signature: "same-region",
    steps: [{ label: "Focus area", answered: false, current: true }],
    question: "What should change?",
    options: [{ label: "Tests", keys: ["1"], chosen: false, escape: false }],
  };
}

function review(): Extract<WizardModel, { phase: "review" }> {
  return {
    phase: "review",
    signature: "same-region",
    steps: [{ label: "Focus area", answered: true, current: false }],
    answers: [{ question: "What should change?", answer: "Tests" }],
    incomplete: false,
  };
}

describe("wizardsEqual — field identity even when region signatures match", () => {
  it("accepts independent derivations of the same question and review", () => {
    expect(wizardsEqual(question(), question())).toBe(true);
    expect(wizardsEqual(review(), review())).toBe(true);
  });

  it.each([
    ["number of steps", []],
    ["step label", [{ label: "Scope", answered: false, current: true }]],
    ["answered state", [{ label: "Focus area", answered: true, current: true }]],
    ["current step", [{ label: "Focus area", answered: false, current: false }]],
  ] as const)("rejects a changed %s", (_label, steps) => {
    const original = question();
    const changed = { ...question(), steps: steps.map((step) => ({ ...step })) };
    expect(wizardsEqual(original, changed)).toBe(false);
    expect(wizardsEqual(changed, original)).toBe(false);
  });

  it("rejects a phase change even with the same stepper and signature", () => {
    const original = question();
    const changed = { ...review(), steps: original.steps };
    expect(wizardsEqual(original, changed)).toBe(false);
    expect(wizardsEqual(changed, original)).toBe(false);
  });

  it.each([
    ["number of answers", []],
    ["question text", [{ question: "Which scope?", answer: "Tests" }]],
    ["answer text", [{ question: "What should change?", answer: "Docs" }]],
  ] as const)("rejects a changed review %s", (_label, answers) => {
    const original = review();
    const changed = { ...review(), answers: answers.map((answer) => ({ ...answer })) };
    expect(wizardsEqual(original, changed)).toBe(false);
    expect(wizardsEqual(changed, original)).toBe(false);
  });

  it("rejects a review that becomes incomplete without changing its echoed answers", () => {
    expect(wizardsEqual(review(), { ...review(), incomplete: true })).toBe(false);
  });
});
