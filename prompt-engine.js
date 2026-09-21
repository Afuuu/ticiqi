(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.PromptEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_DURATION_SECONDS = 0.1;

  function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function calculateScrollMetrics(contentHeight, durationSeconds) {
    const safeContentHeight = Math.max(0, toFiniteNumber(contentHeight));
    const safeDuration = Math.max(
      MIN_DURATION_SECONDS,
      toFiniteNumber(durationSeconds, MIN_DURATION_SECONDS),
    );
    const distance = safeContentHeight;

    return {
      distance,
      speed: distance / safeDuration,
    };
  }

  function createPlaybackController({ distance, durationSeconds }) {
    const safeDistance = Math.max(0, toFiniteNumber(distance));
    const safeDuration = Math.max(
      MIN_DURATION_SECONDS,
      toFiniteNumber(durationSeconds, MIN_DURATION_SECONDS),
    );
    const speed = safeDistance / safeDuration;

    let state = "idle";
    let elapsedSeconds = 0;

    function snapshot() {
      return {
        state,
        elapsedSeconds,
        offset: Math.min(safeDistance, speed * elapsedSeconds),
      };
    }

    return {
      play() {
        if (state === "idle" || state === "paused") {
          state = safeDistance === 0 ? "finished" : "playing";
        }
        return snapshot();
      },

      pause() {
        if (state === "playing") {
          state = "paused";
        }
        return snapshot();
      },

      tick(deltaMs) {
        if (state !== "playing") {
          return snapshot();
        }

        elapsedSeconds += Math.max(0, toFiniteNumber(deltaMs)) / 1000;
        if (speed * elapsedSeconds >= safeDistance) {
          state = "finished";
        }
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

  return {
    calculateScrollMetrics,
    createPlaybackController,
  };
});
