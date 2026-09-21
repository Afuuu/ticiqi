(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.StyleRanges = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value.toLowerCase() : undefined;
  }

  function normalizeFontSize(value) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(Math.round(number), 24, 120) : undefined;
  }

  function normalizeStyle(style) {
    const normalized = {};
    const color = normalizeColor(style?.color);
    const fontSize = normalizeFontSize(style?.fontSize);

    if (color) normalized.color = color;
    if (fontSize) normalized.fontSize = fontSize;

    return normalized;
  }

  function sameStyle(left, right) {
    return left.color === right.color && left.fontSize === right.fontSize;
  }

  function normalizeStyleRanges(ranges, textLength = Number.POSITIVE_INFINITY) {
    if (!Array.isArray(ranges)) return [];

    const normalized = [];

    for (const range of ranges) {
      const style = normalizeStyle(range);
      const start = clamp(Math.floor(Number(range?.start) || 0), 0, textLength);
      const end = clamp(Math.ceil(Number(range?.end) || 0), 0, textLength);

      if (end <= start || Object.keys(style).length === 0) continue;
      normalized.push({ start, end, ...style });
    }

    normalized.sort((left, right) => left.start - right.start || left.end - right.end);

    const merged = [];
    for (const range of normalized) {
      const previous = merged[merged.length - 1];

      if (
        previous &&
        previous.end >= range.start &&
        sameStyle(previous, range)
      ) {
        previous.end = Math.max(previous.end, range.end);
        continue;
      }

      merged.push({ ...range });
    }

    return merged;
  }

  function applyStyleRange(ranges, selectionStart, selectionEnd, stylePatch) {
    const start = Math.max(0, Math.floor(Number(selectionStart) || 0));
    const end = Math.max(start, Math.ceil(Number(selectionEnd) || 0));
    const patch = normalizeStyle(stylePatch);

    if (end === start || Object.keys(patch).length === 0) {
      return normalizeStyleRanges(ranges);
    }

    const source = normalizeStyleRanges(ranges);
    const boundaries = new Set([start, end]);

    for (const range of source) {
      boundaries.add(range.start);
      boundaries.add(range.end);
    }

    const orderedBoundaries = Array.from(boundaries).sort((left, right) => left - right);
    const next = [];

    for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
      const segmentStart = orderedBoundaries[index];
      const segmentEnd = orderedBoundaries[index + 1];

      if (segmentEnd <= segmentStart) continue;

      const style = {};

      for (const range of source) {
        if (range.start < segmentEnd && range.end > segmentStart) {
          if (range.color) style.color = range.color;
          if (range.fontSize) style.fontSize = range.fontSize;
        }
      }

      if (segmentStart >= start && segmentEnd <= end) {
        Object.assign(style, patch);
      }

      if (style.color || style.fontSize) {
        next.push({ start: segmentStart, end: segmentEnd, ...style });
      }
    }

    return normalizeStyleRanges(next);
  }

  function clearStyleRange(ranges, selectionStart, selectionEnd) {
    const start = Math.max(0, Math.floor(Number(selectionStart) || 0));
    const end = Math.max(start, Math.ceil(Number(selectionEnd) || 0));

    if (end === start) {
      return normalizeStyleRanges(ranges);
    }

    const next = [];

    for (const range of normalizeStyleRanges(ranges)) {
      if (range.end <= start || range.start >= end) {
        next.push(range);
        continue;
      }

      if (range.start < start) {
        next.push({ ...range, end: start });
      }

      if (range.end > end) {
        next.push({ ...range, start: end });
      }
    }

    return normalizeStyleRanges(next);
  }

  function findTextEdit(previousText, nextText) {
    const previous = String(previousText ?? "");
    const next = String(nextText ?? "");
    const maximumPrefix = Math.min(previous.length, next.length);
    let prefixLength = 0;

    while (
      prefixLength < maximumPrefix &&
      previous[prefixLength] === next[prefixLength]
    ) {
      prefixLength += 1;
    }

    let suffixLength = 0;
    while (
      suffixLength < previous.length - prefixLength &&
      suffixLength < next.length - prefixLength &&
      previous[previous.length - 1 - suffixLength] ===
        next[next.length - 1 - suffixLength]
    ) {
      suffixLength += 1;
    }

    return {
      start: prefixLength,
      end: previous.length - suffixLength,
      insertedLength: next.length - prefixLength - suffixLength,
    };
  }

  function transformStyleRanges(ranges, edit) {
    const start = Math.max(0, Math.floor(Number(edit?.start) || 0));
    const end = Math.max(start, Math.ceil(Number(edit?.end) || 0));
    const insertedLength = Math.max(0, Math.floor(Number(edit?.insertedLength) || 0));
    const delta = insertedLength - (end - start);

    function mapPosition(position) {
      if (position <= start) return position;
      if (position >= end) return position + delta;
      return start + Math.min(insertedLength, position - start);
    }

    const transformed = [];

    for (const range of normalizeStyleRanges(ranges)) {
      const nextStart = mapPosition(range.start);
      const nextEnd = mapPosition(range.end);

      if (nextEnd <= nextStart) continue;
      transformed.push({ ...range, start: nextStart, end: nextEnd });
    }

    return normalizeStyleRanges(transformed);
  }

  function getStyleAt(ranges, position) {
    const index = Math.max(0, Math.floor(Number(position) || 0));

    for (const range of normalizeStyleRanges(ranges)) {
      if (range.start <= index && index < range.end) {
        const style = {};
        if (range.color) style.color = range.color;
        if (range.fontSize) style.fontSize = range.fontSize;
        return style;
      }
    }

    return {};
  }

  return {
    applyStyleRange,
    clearStyleRange,
    findTextEdit,
    getStyleAt,
    normalizeStyleRanges,
    transformStyleRanges,
  };
});
