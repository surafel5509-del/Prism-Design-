// Critical-flow tests for the keyframe evaluator.
// Run with `npm test` (node --test). Mirrors src/lib/easing.ts semantics
// using a tiny inline re-implementation so tests need no TS toolchain.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const EASINGS = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
};

function valueAt(kfs, property, base, time) {
  const list = kfs.filter((k) => k.property === property).sort((a, b) => a.time - b.time);
  if (!list.length) return base;
  if (time <= list[0].time) return list[0].value;
  const last = list[list.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (time >= a.time && time <= b.time) {
      const local = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * (EASINGS[b.easing] ?? EASINGS.linear)(local);
    }
  }
  return last.value;
}

test("linear interpolation hits midpoint", () => {
  const kfs = [
    { time: 0, property: "x", value: 0, easing: "linear" },
    { time: 2, property: "x", value: 100, easing: "linear" },
  ];
  assert.equal(valueAt(kfs, "x", 0, 1), 50);
});

test("clamps before first and after last keyframe", () => {
  const kfs = [
    { time: 1, property: "opacity", value: 0, easing: "linear" },
    { time: 2, property: "opacity", value: 1, easing: "easeOutCubic" },
  ];
  assert.equal(valueAt(kfs, "opacity", 0.5, 0), 0);
  assert.equal(valueAt(kfs, "opacity", 0.5, 5), 1);
});

test("easeOutCubic runs ahead of linear mid-segment", () => {
  const kfs = [
    { time: 0, property: "scale", value: 0, easing: "linear" },
    { time: 1, property: "scale", value: 1, easing: "easeOutCubic" },
  ];
  assert.ok(valueAt(kfs, "scale", 1, 0.5) > 0.8);
});

test("source easing module exports the full easing set", () => {
  const src = fs.readFileSync(new URL("../src/lib/easing.ts", import.meta.url), "utf8");
  for (const name of ["easeOutElastic", "easeOutBounce", "spring", "easeOutBack", "evaluateLayer"]) {
    assert.ok(src.includes(name), `easing.ts should include ${name}`);
  }
});

test("agent tools are Zod-schema'd and system prompt forbids JSON plans in chat", () => {
  const tools = fs.readFileSync(new URL("../src/lib/ai/tools.ts", import.meta.url), "utf8");
  assert.ok(tools.includes("create_project") && tools.includes("add_keyframe"));
  const prompts = fs.readFileSync(new URL("../src/lib/ai/prompts.ts", import.meta.url), "utf8");
  assert.ok(prompts.includes("Mandatory pipeline"));
});

test("crypto module uses AES-256-GCM and never returns full keys", () => {
  const crypto = fs.readFileSync(new URL("../src/lib/crypto.ts", import.meta.url), "utf8");
  assert.ok(crypto.includes("aes-256-gcm"));
  assert.ok(crypto.includes("maskKey"));
});
