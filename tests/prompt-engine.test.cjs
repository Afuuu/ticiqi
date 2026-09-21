const assert = require("node:assert/strict");
const test = require("node:test");

const {
  calculateScrollMetrics,
  createPlaybackController,
  getPreviewClickAction,
} = require("../prompt-engine.js");

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

test("uses a safe minimum duration for invalid values", () => {
  assert.deepEqual(calculateScrollMetrics(0, 0), {
    distance: 0,
    speed: 0,
  });
});

test("pause preserves offset and play resumes from that point", () => {
  const playback = createPlaybackController({
    distance: 1000,
    durationSeconds: 100,
  });

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
  const playback = createPlaybackController({
    distance: 100,
    durationSeconds: 10,
  });

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

test("finished playback is reset before it can start again", () => {
  const playback = createPlaybackController({
    distance: 50,
    durationSeconds: 10,
  });

  playback.play();
  playback.tick(10_000);
  playback.play();

  assert.equal(playback.snapshot().state, "finished");
});

test("zero-distance playback finishes immediately and stays stable", () => {
  const playback = createPlaybackController({
    distance: 0,
    durationSeconds: 10,
  });

  playback.play();
  playback.tick(1);

  assert.deepEqual(playback.snapshot(), {
    state: "finished",
    elapsedSeconds: 0,
    offset: 0,
  });
});

test("preview clicks map to the expected playback action", () => {
  assert.equal(getPreviewClickAction("idle", true), "start");
  assert.equal(getPreviewClickAction("paused", true), "start");
  assert.equal(getPreviewClickAction("playing", true), "pause");
  assert.equal(getPreviewClickAction("finished", true), "restart");
  assert.equal(getPreviewClickAction("idle", false), "none");
});
