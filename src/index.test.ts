import { describe, expect, it } from "vitest";
import * as components from "./components";
import EmptyState from "./components/EmptyState/EmptyState.vue";
import InlineFeedback from "./components/InlineFeedback/InlineFeedback.vue";
import { EmptyState as RootEmptyState, InlineFeedback as RootInlineFeedback, VERSION } from "./index";
import pkg from "../package.json";

describe("index", () => {
  it("exports the package version", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("exports our own Vue components (PLAN §16.11)", () => {
    expect(RootInlineFeedback).toBe(InlineFeedback);
    expect(RootEmptyState).toBe(EmptyState);
  });
});

describe("@erplora/ui/components", () => {
  it("is a package entry point", () => {
    expect(pkg.exports["./components"]).toBe("./src/components/index.ts");
  });

  it("carries InlineFeedback and EmptyState", () => {
    expect(components.InlineFeedback).toBe(InlineFeedback);
    expect(components.EmptyState).toBe(EmptyState);
  });
});
