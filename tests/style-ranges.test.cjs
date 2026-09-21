const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyStyleRange,
  clearStyleRange,
  findTextEdit,
  getStyleAt,
  normalizeStyleRanges,
  transformStyleRanges,
} = require("../style-ranges.js");

test("applies color and font size to a selected range", () => {
  const ranges = applyStyleRange([], 3, 9, {
    color: "#ff0000",
    fontSize: 72,
  });

  assert.deepEqual(ranges, [
    { start: 3, end: 9, color: "#ff0000", fontSize: 72 },
  ]);
});

test("splits existing ranges and preserves their other style properties", () => {
  const ranges = normalizeStyleRanges([
    { start: 0, end: 5, color: "#ff0000" },
    { start: 10, end: 15, color: "#0000ff" },
  ]);

  const styled = applyStyleRange(ranges, 3, 12, { fontSize: 80 });

  assert.deepEqual(styled, [
    { start: 0, end: 3, color: "#ff0000" },
    { start: 3, end: 5, color: "#ff0000", fontSize: 80 },
    { start: 5, end: 10, fontSize: 80 },
    { start: 10, end: 12, color: "#0000ff", fontSize: 80 },
    { start: 12, end: 15, color: "#0000ff" },
  ]);
});

test("clears selected styling and keeps styles outside the selection", () => {
  const ranges = normalizeStyleRanges([
    { start: 0, end: 10, color: "#ff0000", fontSize: 72 },
  ]);

  assert.deepEqual(clearStyleRange(ranges, 3, 7), [
    { start: 0, end: 3, color: "#ff0000", fontSize: 72 },
    { start: 7, end: 10, color: "#ff0000", fontSize: 72 },
  ]);
});

test("shifts ranges after non-overlapping edits", () => {
  const ranges = [{ start: 10, end: 15, color: "#ff0000" }];
  const transformed = transformStyleRanges(ranges, {
    start: 2,
    end: 4,
    insertedLength: 5,
  });

  assert.deepEqual(transformed, [
    { start: 13, end: 18, color: "#ff0000" },
  ]);
});

test("shrinks and removes ranges across deleted text", () => {
  const ranges = [
    { start: 2, end: 6, color: "#ff0000" },
    { start: 10, end: 16, color: "#0000ff" },
  ];
  const transformed = transformStyleRanges(ranges, {
    start: 4,
    end: 12,
    insertedLength: 0,
  });

  assert.deepEqual(transformed, [
    { start: 2, end: 4, color: "#ff0000" },
    { start: 4, end: 8, color: "#0000ff" },
  ]);
});

test("expands a styled range when text is inserted inside it", () => {
  const ranges = [{ start: 4, end: 8, color: "#ff0000" }];
  const transformed = transformStyleRanges(ranges, {
    start: 6,
    end: 6,
    insertedLength: 3,
  });

  assert.deepEqual(transformed, [
    { start: 4, end: 11, color: "#ff0000" },
  ]);
});

test("returns the style at a character position", () => {
  const ranges = normalizeStyleRanges([
    { start: 2, end: 5, color: "#ff0000" },
    { start: 5, end: 8, fontSize: 64 },
  ]);

  assert.deepEqual(getStyleAt(ranges, 3), { color: "#ff0000" });
  assert.deepEqual(getStyleAt(ranges, 6), { fontSize: 64 });
  assert.deepEqual(getStyleAt(ranges, 1), {});
});

test("finds the replaced text span from old and new values", () => {
  assert.deepEqual(findTextEdit("abcdef", "abXYef"), {
    start: 2,
    end: 4,
    insertedLength: 2,
  });
});
