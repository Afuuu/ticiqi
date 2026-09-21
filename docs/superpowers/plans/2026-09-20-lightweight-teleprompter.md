# Lightweight Teleprompter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free browser teleprompter whose text starts in the vertical center and scrolls at a constant speed for a configured duration.

**Architecture:** Keep timing and geometry in a DOM-free engine, then bind DOM rendering and persistence in `app.js`. Use `requestAnimationFrame` for updates and CSS `translate3d` for rendering.

**Tech Stack:** HTML, CSS, browser JavaScript modules, Node.js built-in test runner.

---

### Task 1: Core scrolling calculations

**Files:**
- Create: `prompt-engine.js`
- Test: `tests/prompt-engine.test.cjs`

- [ ] **Step 1: Write the failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { calculateScrollMetrics } from "../prompt-engine.js";

test("calculates distance from first-line center to last-line center", () => {
  assert.deepEqual(calculateScrollMetrics(1000, 100), {
    distance: 1000,
    speed: 10,
  });
});

test("supports content shorter than the viewport", () => {
  assert.deepEqual(calculateScrollMetrics(100, 10), {
    distance: 100,
    speed: 10,
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test tests/prompt-engine.test.cjs`
Expected: module export error for `calculateScrollMetrics`.

- [ ] **Step 3: Implement minimal metrics**

```js
export function calculateScrollMetrics(contentHeight, durationSeconds) {
  const safeDuration = Math.max(0.1, Number(durationSeconds) || 0.1);
  const distance = Math.max(0, contentHeight);
  return { distance, speed: distance / safeDuration };
}
```

- [ ] **Step 4: Run tests to verify green**

Run: `node --test tests/prompt-engine.test.cjs`
Expected: 2 passing tests.

### Task 2: Playback state machine

**Files:**
- Modify: `prompt-engine.js`
- Modify: `tests/prompt-engine.test.cjs`

- [ ] **Step 1: Add failing behavior tests**

```js
import { createPlaybackController } from "../prompt-engine.js";

test("pause preserves offset and play resumes", () => {
  const playback = createPlaybackController({ distance: 1000, durationSeconds: 100 });
  playback.play();
  playback.tick(10_000);
  const pausedAt = playback.snapshot();
  playback.pause();
  playback.tick(5_000);
  assert.equal(playback.snapshot().offset, pausedAt.offset);
  playback.play();
  playback.tick(5_000);
  assert.equal(playback.snapshot().offset, 150);
});

test("finishes at the calculated distance and reset clears elapsed", () => {
  const playback = createPlaybackController({ distance: 100, durationSeconds: 10 });
  playback.play();
  playback.tick(20_000);
  assert.equal(playback.snapshot().state, "finished");
  assert.equal(playback.snapshot().offset, 100);
  playback.reset();
  assert.deepEqual(playback.snapshot(), {
    state: "idle",
    elapsedSeconds: 0,
    offset: 0,
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test tests/prompt-engine.test.cjs`
Expected: missing `createPlaybackController` export.

- [ ] **Step 3: Implement the state machine**

```js
export function createPlaybackController({ distance, durationSeconds }) {
  const safeDistance = Math.max(0, Number(distance) || 0);
  const safeDuration = Math.max(0.1, Number(durationSeconds) || 0.1);
  let state = "idle";
  let elapsedSeconds = 0;

  const snapshot = () => ({
    state,
    elapsedSeconds,
    offset: Math.min(safeDistance, (safeDistance / safeDuration) * elapsedSeconds),
  });

  return {
    play() {
      if (state !== "finished") state = "playing";
    },
    pause() {
      if (state === "playing") state = "paused";
    },
    tick(deltaMs) {
      if (state !== "playing") return snapshot();
      elapsedSeconds += Math.max(0, Number(deltaMs) || 0) / 1000;
      const next = snapshot();
      if (next.offset >= safeDistance) state = "finished";
      return snapshot();
    },
    reset() {
      state = "idle";
      elapsedSeconds = 0;
      return snapshot();
    },
    snapshot,
  };
}
```

- [ ] **Step 4: Run tests to verify green**

Run: `node --test tests/prompt-engine.test.cjs`
Expected: all tests pass.

### Task 3: Page structure and control styling

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `package.json`

- [ ] **Step 1: Create the semantic page and controls**

Build the two-column workspace, textarea, clear button, range input, color inputs, duration input, preview stage, status, and start/pause/reset/fullscreen buttons. Link `styles.css`, `prompt-engine.js`, and `app.js` as module assets.

- [ ] **Step 2: Add responsive and fullscreen styling**

Use a compact utility layout, stable control dimensions, dark preview defaults, and a stacked layout below 900px. Add fullscreen styles for the preview shell.

- [ ] **Step 3: Add the test script**

```json
{
  "name": "ticiqi",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.cjs",
    "serve": "node server.mjs"
  }
}
```

### Task 4: DOM integration, persistence, and fullscreen

**Files:**
- Create: `app.js`

- [ ] **Step 1: Bind all controls to a single application state**

Load persisted values, restore the editor and styles, and wire input events. Text, font-size, and background changes must call `measureAndReset()`.

- [ ] **Step 2: Implement the animation loop**

Measure viewport and content height, compute scroll metrics, apply `translate3d`, and update elapsed/status text from the engine snapshot. Clamp frame deltas and stop at completion.

- [ ] **Step 3: Implement controls and fullscreen**

Wire start/continue, pause, reset, clear, duration changes, and Fullscreen API handling. Disable start when the text is empty.

- [ ] **Step 4: Persist changes**

Write valid configuration to `localStorage` after each change and guard storage failures.

### Task 5: Verification

**Files:**
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `prompt-engine.js`
- Verify: `app.js`
- Verify: `tests/prompt-engine.test.cjs`

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all tests pass with zero failures.

- [ ] **Step 2: Run in a browser**

Start `npm run serve`, open the app, and verify initial centering, scrolling, pause/continue, reset, live styles, fullscreen, persistence, and a 5000-character script.

- [ ] **Step 3: Inspect desktop and narrow viewport screenshots**

Confirm text and controls do not overlap, preview begins at the vertical center, and no horizontal overflow exists.
