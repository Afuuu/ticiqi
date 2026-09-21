const { calculateScrollMetrics, createPlaybackController } = window.PromptEngine;
const {
  applyStyleRange,
  clearStyleRange,
  findTextEdit,
  getStyleAt,
  normalizeStyleRanges,
  transformStyleRanges,
} = window.StyleRanges;

const STORAGE_KEY = "ticiqi.settings.v1";
const DEFAULT_SETTINGS = Object.freeze({
  script: "",
  fontSize: 56,
  textColor: "#ffffff",
  backgroundColor: "#0e1116",
  duration: 180,
  styleRanges: [],
});

const elements = {
  scriptInput: document.querySelector("#scriptInput"),
  characterCount: document.querySelector("#characterCount"),
  clearButton: document.querySelector("#clearButton"),
  fontSizeInput: document.querySelector("#fontSizeInput"),
  fontSizeValue: document.querySelector("#fontSizeValue"),
  textColorInput: document.querySelector("#textColorInput"),
  textColorValue: document.querySelector("#textColorValue"),
  backgroundColorInput: document.querySelector("#backgroundColorInput"),
  backgroundColorValue: document.querySelector("#backgroundColorValue"),
  selectionSummary: document.querySelector("#selectionSummary"),
  selectionColorInput: document.querySelector("#selectionColorInput"),
  selectionColorValue: document.querySelector("#selectionColorValue"),
  selectionFontSizeInput: document.querySelector("#selectionFontSizeInput"),
  selectionFontSizeValue: document.querySelector("#selectionFontSizeValue"),
  selectAllButton: document.querySelector("#selectAllButton"),
  clearSelectionStyleButton: document.querySelector(
    "#clearSelectionStyleButton",
  ),
  durationInput: document.querySelector("#durationInput"),
  saveStatus: document.querySelector("#saveStatus"),
  stagePanel: document.querySelector("#stagePanel"),
  previewStage: document.querySelector("#previewStage"),
  previewShell: document.querySelector("#previewShell"),
  promptTrack: document.querySelector("#promptTrack"),
  promptContent: document.querySelector("#promptContent"),
  emptyState: document.querySelector("#emptyState"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  playbackState: document.querySelector("#playbackState"),
  statusText: document.querySelector("#statusText"),
  elapsedTime: document.querySelector("#elapsedTime"),
  totalTime: document.querySelector("#totalTime"),
  progressTrack: document.querySelector("#progressTrack"),
  progressBar: document.querySelector("#progressBar"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resetButton: document.querySelector("#resetButton"),
};

const state = {
  settings: loadSettings(),
  playback: null,
  metrics: { distance: 0, speed: 0 },
  contentHeight: 0,
  firstLineHeight: 0,
  animationFrameId: null,
  frameStartTime: null,
  isRunning: false,
  saveTimer: null,
  selection: { start: 0, end: 0 },
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value.toLowerCase() : fallback;
}

function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const fontSize = Number(source.fontSize);
  const duration = Number(source.duration);
  const script =
    typeof source.script === "string" ? source.script : DEFAULT_SETTINGS.script;

  return {
    script,
    fontSize: clamp(Number.isFinite(fontSize) ? fontSize : DEFAULT_SETTINGS.fontSize, 24, 120),
    textColor: normalizeColor(source.textColor, DEFAULT_SETTINGS.textColor),
    backgroundColor: normalizeColor(
      source.backgroundColor,
      DEFAULT_SETTINGS.backgroundColor,
    ),
    duration: clamp(
      Number.isFinite(duration) ? Math.round(duration) : DEFAULT_SETTINGS.duration,
      1,
      9999,
    ),
    styleRanges: normalizeStyleRanges(source.styleRanges, script.length),
  };
}

function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings() {
  window.clearTimeout(state.saveTimer);
  elements.saveStatus.textContent = "保存中";

  state.saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
      elements.saveStatus.textContent = "已保存";
    } catch {
      elements.saveStatus.textContent = "无法保存";
    }
  }, 160);
}

function getDurationSeconds() {
  return clamp(Math.round(Number(state.settings.duration) || 1), 1, 9999);
}

function formatTime(totalSeconds) {
  const rounded = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const parts = [minutes, seconds].map((part) => String(part).padStart(2, "0"));

  if (hours > 0) {
    parts.unshift(String(hours).padStart(2, "0"));
  }

  return parts.join(":");
}

function getScriptCharacterCount() {
  return Array.from(state.settings.script.replace(/\s/g, "")).length;
}

function appendTextSegment(fragment, text, style) {
  if (!text) return;

  if (!style.color && !style.fontSize) {
    fragment.append(document.createTextNode(text));
    return;
  }

  const span = document.createElement("span");
  if (style.color) span.style.color = style.color;
  if (style.fontSize) span.style.fontSize = `${style.fontSize}px`;
  span.textContent = text;
  fragment.append(span);
}

function renderScript() {
  const fragment = document.createDocumentFragment();
  const ranges = normalizeStyleRanges(
    state.settings.styleRanges,
    state.settings.script.length,
  );
  let cursor = 0;

  state.settings.styleRanges = ranges;

  for (const range of ranges) {
    appendTextSegment(
      fragment,
      state.settings.script.slice(cursor, range.start),
      {},
    );
    appendTextSegment(
      fragment,
      state.settings.script.slice(range.start, range.end),
      range,
    );
    cursor = range.end;
  }

  appendTextSegment(fragment, state.settings.script.slice(cursor), {});
  elements.promptContent.replaceChildren(fragment);
  elements.characterCount.textContent = `${getScriptCharacterCount()} 字`;
  elements.emptyState.hidden = state.settings.script.trim().length > 0;
  syncSelectionControls();
}

function hasStyleInSelection() {
  const { start, end } = state.selection;
  return state.settings.styleRanges.some(
    (range) => range.start < end && range.end > start,
  );
}

function updateSelectionState() {
  const start = Math.min(
    elements.scriptInput.selectionStart ?? 0,
    elements.scriptInput.selectionEnd ?? 0,
  );
  const end = Math.max(
    elements.scriptInput.selectionStart ?? 0,
    elements.scriptInput.selectionEnd ?? 0,
  );

  state.selection = { start, end };
  syncSelectionControls();
}

function syncSelectionControls() {
  const { start, end } = state.selection;
  const hasSelection = end > start;
  const style = hasSelection
    ? getStyleAt(state.settings.styleRanges, start)
    : {};
  const color = style.color ?? state.settings.textColor;
  const fontSize = style.fontSize ?? state.settings.fontSize;

  elements.selectionSummary.textContent = hasSelection
    ? `${end - start} 字`
    : "未选择";
  elements.selectionSummary.dataset.active = String(hasSelection);
  elements.selectionColorInput.disabled = !hasSelection;
  elements.selectionFontSizeInput.disabled = !hasSelection;
  elements.clearSelectionStyleButton.disabled =
    !hasSelection || !hasStyleInSelection();
  elements.selectAllButton.disabled = state.settings.script.length === 0;
  elements.selectionColorInput.value = color;
  elements.selectionColorValue.textContent = hasSelection
    ? color.toUpperCase()
    : "--";
  elements.selectionFontSizeInput.value = String(fontSize);
  elements.selectionFontSizeValue.textContent = hasSelection
    ? `${fontSize} px`
    : "--";
}

function applyVisualSettings() {
  elements.fontSizeValue.textContent = `${state.settings.fontSize} px`;
  elements.textColorValue.textContent = state.settings.textColor.toUpperCase();
  elements.backgroundColorValue.textContent =
    state.settings.backgroundColor.toUpperCase();
  elements.fontSizeInput.value = String(state.settings.fontSize);
  elements.textColorInput.value = state.settings.textColor;
  elements.backgroundColorInput.value = state.settings.backgroundColor;
  elements.promptContent.style.setProperty(
    "--prompt-size",
    `${state.settings.fontSize}px`,
  );
  elements.previewStage.style.setProperty(
    "--prompt-color",
    state.settings.textColor,
  );
  elements.previewStage.style.setProperty(
    "--preview-bg",
    state.settings.backgroundColor,
  );
  syncSelectionControls();
}

function applyOffset(offset) {
  const verticalOffset = -(state.firstLineHeight / 2 + offset);
  elements.promptTrack.style.transform = `translate3d(0, ${verticalOffset}px, 0)`;
  elements.promptTrack.dataset.offset = String(offset);
}

function updateTransport(snapshot = state.playback?.snapshot()) {
  const playbackState = snapshot?.state ?? "idle";
  const duration = getDurationSeconds();
  const elapsed = Math.min(snapshot?.elapsedSeconds ?? 0, duration);
  const offset = snapshot?.offset ?? 0;
  const progress =
    state.metrics.distance > 0
      ? clamp((offset / state.metrics.distance) * 100, 0, 100)
      : 0;
  const hasScript = state.settings.script.trim().length > 0;

  const stateLabels = {
    idle: "待开始",
    playing: "播放中",
    paused: "已暂停",
    finished: "已完成",
  };
  const statusLabels = {
    idle: "等待开始",
    playing: "向上滚动",
    paused: "已暂停",
    finished: "播放完成",
  };

  elements.playbackState.textContent = stateLabels[playbackState];
  elements.playbackState.dataset.state = playbackState;
  elements.statusText.textContent = statusLabels[playbackState];
  elements.elapsedTime.textContent = formatTime(elapsed);
  elements.totalTime.textContent = formatTime(duration);
  elements.progressBar.style.width = `${progress.toFixed(2)}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(Math.round(progress)));

  elements.startButton.disabled = !hasScript || playbackState === "playing";
  elements.startButton.textContent =
    playbackState === "paused"
      ? "继续"
      : playbackState === "finished"
        ? "重新开始"
        : "开始";
  elements.pauseButton.disabled = playbackState !== "playing";
  elements.resetButton.disabled =
    playbackState === "idle" && Math.abs(offset) < 0.01;
  elements.clearButton.disabled = !hasScript;
}

function cancelAnimation() {
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  state.frameStartTime = null;
  state.isRunning = false;
}

function getFirstTextNode(root) {
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent.length > 0) {
      return child;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const nested = getFirstTextNode(child);
      if (nested) return nested;
    }
  }

  return null;
}

function measureFirstLineHeight(fallbackHeight) {
  const firstTextNode = getFirstTextNode(elements.promptContent);
  if (!firstTextNode) return fallbackHeight;

  const range = document.createRange();
  range.setStart(firstTextNode, 0);
  range.setEnd(firstTextNode, Math.min(1, firstTextNode.textContent.length));

  const firstRect = range.getClientRects()[0];
  return firstRect?.height || fallbackHeight;
}

function measureAndReset() {
  cancelAnimation();
  renderScript();

  const contentBounds = elements.promptContent.getBoundingClientRect();
  const contentStyles = getComputedStyle(elements.promptContent);
  const fontSize = Number.parseFloat(contentStyles.fontSize) || state.settings.fontSize;
  const lineHeight = Number.parseFloat(contentStyles.lineHeight);

  const fallbackLineHeight = Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.32;

  state.contentHeight = contentBounds.height;
  state.firstLineHeight = measureFirstLineHeight(fallbackLineHeight);
  state.metrics = calculateScrollMetrics(
    state.contentHeight,
    getDurationSeconds(),
  );
  state.playback = createPlaybackController({
    distance: state.metrics.distance,
    durationSeconds: getDurationSeconds(),
  });

  applyOffset(0);
  updateTransport();
}

function runAnimation(timestamp) {
  if (!state.isRunning || !state.playback) {
    return;
  }

  const delta = state.frameStartTime === null ? 0 : timestamp - state.frameStartTime;
  state.frameStartTime = timestamp;

  const snapshot = state.playback.tick(Math.min(Math.max(delta, 0), 50));
  applyOffset(snapshot.offset);
  updateTransport(snapshot);

  if (snapshot.state === "finished") {
    cancelAnimation();
    updateTransport(snapshot);
    return;
  }

  state.animationFrameId = requestAnimationFrame(runAnimation);
}

function startPlayback() {
  if (!state.settings.script.trim()) {
    elements.scriptInput.focus();
    return;
  }

  if (state.playback?.snapshot().state === "finished") {
    state.playback.reset();
    applyOffset(0);
  }

  const snapshot = state.playback.play();
  if (snapshot.state === "finished") {
    updateTransport(snapshot);
    return;
  }

  state.isRunning = true;
  state.frameStartTime = null;
  updateTransport(snapshot);
  state.animationFrameId = requestAnimationFrame(runAnimation);
}

function pausePlayback() {
  if (!state.playback) {
    return;
  }

  const snapshot = state.playback.pause();
  cancelAnimation();
  updateTransport(snapshot);
}

function resetPlayback() {
  measureAndReset();
}

function updateDurationFromInput() {
  const duration = Number(elements.durationInput.value);
  if (!Number.isFinite(duration) || duration < 1) {
    return;
  }

  state.settings.duration = clamp(Math.round(duration), 1, 9999);
  persistSettings();
  measureAndReset();
}

function updateSelectedStyle(stylePatch) {
  const { start, end } = state.selection;
  if (end <= start) return;

  state.settings.styleRanges = applyStyleRange(
    state.settings.styleRanges,
    start,
    end,
    stylePatch,
  );
  persistSettings();
  measureAndReset();
}

function clearSelectedStyle() {
  const { start, end } = state.selection;
  if (end <= start) return;

  state.settings.styleRanges = clearStyleRange(
    state.settings.styleRanges,
    start,
    end,
  );
  persistSettings();
  measureAndReset();
}

function isFullscreenActive() {
  return (
    Boolean(document.fullscreenElement) ||
    elements.stagePanel.matches(":fullscreen")
  );
}

async function toggleFullscreen() {
  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen();
    } else {
      await elements.stagePanel.requestFullscreen();
    }
  } catch {
    elements.statusText.textContent = "当前浏览器无法进入全屏";
  }
}

function syncFullscreenButton() {
  elements.fullscreenButton.textContent = isFullscreenActive() ? "退出全屏" : "全屏";
  requestAnimationFrame(measureAndReset);
}

elements.scriptInput.addEventListener("input", (event) => {
  const nextScript = event.target.value;
  const edit = findTextEdit(state.settings.script, nextScript);

  state.settings.styleRanges = transformStyleRanges(
    state.settings.styleRanges,
    edit,
  );
  state.settings.script = nextScript;
  updateSelectionState();
  persistSettings();
  measureAndReset();
});

elements.clearButton.addEventListener("click", () => {
  state.settings.script = "";
  state.settings.styleRanges = [];
  state.selection = { start: 0, end: 0 };
  elements.scriptInput.value = "";
  persistSettings();
  measureAndReset();
  elements.scriptInput.focus();
});

elements.scriptInput.addEventListener("select", updateSelectionState);
elements.scriptInput.addEventListener("keyup", updateSelectionState);
elements.scriptInput.addEventListener("mouseup", updateSelectionState);
elements.scriptInput.addEventListener("focus", updateSelectionState);

elements.fontSizeInput.addEventListener("input", (event) => {
  state.settings.fontSize = clamp(Number(event.target.value), 24, 120);
  applyVisualSettings();
  persistSettings();
  measureAndReset();
});

elements.textColorInput.addEventListener("input", (event) => {
  state.settings.textColor = normalizeColor(
    event.target.value,
    DEFAULT_SETTINGS.textColor,
  );
  applyVisualSettings();
  persistSettings();
});

elements.backgroundColorInput.addEventListener("input", (event) => {
  state.settings.backgroundColor = normalizeColor(
    event.target.value,
    DEFAULT_SETTINGS.backgroundColor,
  );
  applyVisualSettings();
  persistSettings();
});

elements.selectionColorInput.addEventListener("input", (event) => {
  updateSelectedStyle({
    color: normalizeColor(event.target.value, state.settings.textColor),
  });
});

elements.selectionFontSizeInput.addEventListener("input", (event) => {
  updateSelectedStyle({
    fontSize: clamp(Number(event.target.value), 24, 120),
  });
});

elements.selectAllButton.addEventListener("click", () => {
  elements.scriptInput.focus();
  elements.scriptInput.select();
  updateSelectionState();
});

elements.clearSelectionStyleButton.addEventListener("click", clearSelectedStyle);

elements.durationInput.addEventListener("input", updateDurationFromInput);
elements.durationInput.addEventListener("blur", () => {
  elements.durationInput.value = String(getDurationSeconds());
  updateTransport();
});

elements.startButton.addEventListener("click", startPlayback);
elements.pauseButton.addEventListener("click", pausePlayback);
elements.resetButton.addEventListener("click", resetPlayback);
elements.fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);

const resizeObserver = new ResizeObserver(() => {
  measureAndReset();
});
resizeObserver.observe(elements.previewStage);

elements.scriptInput.value = state.settings.script;
elements.durationInput.value = String(state.settings.duration);
applyVisualSettings();
renderScript();
measureAndReset();

if (document.fonts?.ready) {
  document.fonts.ready.then(measureAndReset);
}
