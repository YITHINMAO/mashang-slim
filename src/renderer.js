const api = window.transcoder || null;
const bootStartedAt = performance.now();

const state = {
  environment: null,
  files: [],
  selectedId: null,
  outputDir: "",
  qualityMode: "preset",
  preset: "balanced",
  codec: "h265",
  outputFormat: "mp4",
  bitrateMbps: 8,
  maxConcurrent: 2,
  hardwareAcceleration: true,
  hardwareMode: "auto",
  language: localStorage.getItem("mashang-language") || "zh",
  queueRunning: false,
  queuePaused: false,
  pumping: false,
  batchStartedAt: 0,
  batchCompletedAt: 0,
  lastOutputPath: ""
};

const els = {
  splashScreen: document.querySelector("#splashScreen"),
  authorLink: document.querySelector("#authorLink"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  settingsButtonLabel: document.querySelector("#settingsButtonLabel"),
  settingsOverlay: document.querySelector("#settingsOverlay"),
  settingsBackdrop: document.querySelector("#settingsBackdrop"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
  settingsDrawerTitle: document.querySelector("#settingsDrawerTitle"),
  settingsDrawerSubtitle: document.querySelector("#settingsDrawerSubtitle"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  bitDepthGuard: document.querySelector("#bitDepthGuard"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  pickVideosButton: document.querySelector("#pickVideosButton"),
  pickFoldersButton: document.querySelector("#pickFoldersButton"),
  clearListButton: document.querySelector("#clearListButton"),
  fileList: document.querySelector("#fileList"),
  codecSelect: document.querySelector("#codecSelect"),
  outputFormatSelect: document.querySelector("#outputFormatSelect"),
  queueStatus: document.querySelector("#queueStatus"),
  concurrencyInput: document.querySelector("#concurrencyInput"),
  advancedSettingsTitle: document.querySelector("#advancedSettingsTitle"),
  hardwareStatus: document.querySelector("#hardwareStatus"),
  hardwareAcceleration: document.querySelector("#hardwareAcceleration"),
  hardwareAccelerationLabel: document.querySelector("#hardwareAccelerationLabel"),
  hardwareMode: document.querySelector("#hardwareMode"),
  languageSelect: document.querySelector("#languageSelect"),
  modePreset: document.querySelector("#modePreset"),
  modeCustom: document.querySelector("#modeCustom"),
  presetPanel: document.querySelector("#presetPanel"),
  presetButtons: [...document.querySelectorAll(".preset-button")],
  presetCompact: document.querySelector("#presetCompact"),
  presetBalanced: document.querySelector("#presetBalanced"),
  presetHigh: document.querySelector("#presetHigh"),
  presetMaster: document.querySelector("#presetMaster"),
  bitrateValue: document.querySelector("#bitrateValue"),
  recommendedText: document.querySelector("#recommendedText"),
  bitrateSlider: document.querySelector("#bitrateSlider"),
  bitrateInput: document.querySelector("#bitrateInput"),
  bitrateProtection: document.querySelector("#bitrateProtection"),
  bitrateProtectionLabel: document.querySelector("#bitrateProtectionLabel"),
  applyRecommendedButton: document.querySelector("#applyRecommendedButton"),
  encoderPreset: document.querySelector("#encoderPreset"),
  audioMode: document.querySelector("#audioMode"),
  outputDir: document.querySelector("#outputDir"),
  outputDirLabel: document.querySelector("#outputDirLabel"),
  chooseOutputButton: document.querySelector("#chooseOutputButton"),
  guardPanel: document.querySelector("#guardPanel"),
  guardTitle: document.querySelector("#guardTitle"),
  guardDescription: document.querySelector("#guardDescription"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  cancelButton: document.querySelector("#cancelButton"),
  revealButton: document.querySelector("#revealButton"),
  progressTitle: document.querySelector("#progressTitle"),
  progressMeta: document.querySelector("#progressMeta"),
  progressBar: document.querySelector("#progressBar"),
  resultsHint: document.querySelector("#resultsHint"),
  resultsList: document.querySelector("#resultsList")
};

const I18N = {
  zh: {
    appName: "码上瘦身",
    checkingRuntime: "正在检查本机转码环境...",
    desktopOnly: "请在桌面应用中运行。",
    cannotAccessDesktop: "无法访问桌面能力",
    electronMissing: "当前页面没有连接到 Electron 主进程。",
    runtimeFailed: "环境检查失败：{message}",
    runtimeReady: "{version}，离线队列转码就绪",
    runtimeMissing: "缺少 ffmpeg 或 ffprobe。",
    bitDepthStandby: "位深保护待命",
    addVideos: "添加视频",
    addFolders: "添加文件夹",
    clear: "清空",
    noVideos: "还没有选择视频。",
    queueTitle: "视频队列",
    outputCodec: "输出编码",
    outputFormat: "输出格式",
    outputMp4: "MP4（推荐，默认）",
    queueSettings: "队列设置",
    concurrencyLimit: "并发上限",
    tasksUnit: "个任务",
    concurrencyNote: "默认 2 个并发，比较稳，不会把机器一下跑满。",
    settingsButton: "设置",
    settingsTitle: "设置",
    settingsSubtitle: "低频选项集中放在这里，首页保持清爽。",
    closeSettings: "关闭设置",
    advancedSettings: "高级设置",
    hardwareEnabled: "启用硬件加速",
    hardwareMode: "硬件模式",
    hardwareAuto: "自动选择",
    hardwareSoftware: "仅软件编码",
    hardwareStatusAuto: "硬件加速：自动",
    hardwareStatusOff: "硬件加速：关闭",
    language: "语言",
    presetMode: "预设",
    customBitrate: "手动码率",
    qualityPreset: "质量预设",
    compact: "轻巧",
    balanced: "推荐",
    high: "高质量",
    master: "近源",
    bitrate: "码率",
    applyRecommended: "套用推荐",
    recommended: "推荐码率：{value}",
    conservativeMode: "保守模式：目标码率不低于源视频码率",
    encoderSpeed: "编码速度",
    speedSlow: "慢 / 更小",
    speedMedium: "均衡",
    speedFast: "快",
    speedVeryFast: "很快",
    audio: "音频",
    audioAuto: "自动兼容",
    audioCopy: "强制保留原轨",
    audioAac: "AAC 192k",
    outputFolder: "输出文件夹",
    choose: "选择",
    startQueue: "开始队列",
    pauseQueue: "暂停队列",
    resumeQueue: "继续队列",
    stopQueue: "停止队列",
    reveal: "显示文件",
    pending: "待开始",
    addToStart: "添加视频或文件夹后开始。",
    outputNotes: "输出标注",
    resultsHint: "完成后会在这里列出格式、路径、色深、分辨率和体积变化。",
    noResults: "暂无输出。",
    dropTitle: "拖入视频、多个视频或文件夹",
    dropSubtitle: "本地离线处理，自动排队，不上传文件",
    author: "开发者：懿新 · v{version} · {date}",
    waitingVideo: "等待视频",
    waitingVideoDescription: "选择视频后会显示源位深、分辨率、原始大小和预计输出大小。",
    unreadableVideo: "无法读取视频",
    waitUsableVideo: "等待可用视频",
    bitDepthBlocked: "当前编码不可保持位深",
    bitDepthGuardBlocked: "位深保护拦截",
    outputProtection: "输出保护开启",
    guardReady: "源视频 {source}，输出为 {choice}，使用 {pixFmt}，目标 {bitrate} Mbps，预计输出约 {size}，音频{audio}，{shrink}，完成后会再次验证。",
    shrinkConservative: "保守模式会抬高到源视频码率",
    shrinkNormal: "会按所选码率重新编码瘦身",
    keepBitDepth: "保持 {depth}-bit / {resolution}",
    envNotReady: "环境还没有准备好。",
    encoderCapsMissing: "未找到编码器能力。",
    unsupportedBitDepth: "{encoder} 不支持 {depth}-bit 的 {pixFmt} 输出。",
    status: {
      loading: "读取中",
      ready: "待处理",
      queued: "排队中",
      starting: "启动中",
      running: "转码中",
      paused: "已暂停",
      cancelling: "取消中",
      done: "已完成",
      error: "失败",
      cancelled: "已取消"
    },
    selected: "已选",
    select: "选择",
    sourceFile: "源文件 {size}",
    estimatedOutput: "预计输出 {size}",
    currentEta: "当前预计 {eta}",
    queueEta: "队列预计 {eta}",
    elapsed: "耗时 {time}",
    hardware: "硬件 {encoder}",
    decodeCuda: "CUDA 解码",
    decodeCpu: "CPU 解码",
    software: "软件编码",
    fallbackSoftware: "已回退软件编码",
    queueStatus: "{pending} 待处理 · {running} 运行 · {paused} 暂停 · {done} 完成",
    queuePausedTitle: "队列已暂停 {percent}%",
    queueRunningTitle: "队列处理中 {percent}%",
    queueRunningMeta: "并发上限 {limit} · {running} 运行 · {queued} 排队 · 当前 {currentEta} · 全部 {queueEta}",
    queueDone: "队列完成",
    completedOutputs: "完成 {count} 个输出",
    noAudio: "无音轨",
    audioKeep: "保留原轨",
    audioAutoAac: "自动转 AAC 192k",
    outputSummary: "格式 {format} ({codec}){target} · 路径已生成 · 色深 {inputDepth}-bit → {outputDepth}-bit · 分辨率 {resolution} · {engine} · 原始 {sourceSize} / 输出 {outputSize} / 减少 {saved}（{savedPercent}%）{elapsed}",
    target: " · 目标 {bitrate} Mbps",
    batchSummary: "本批 {count} 个：原始 {source} · 输出 {output} · 共减少 {saved}（{percent}%） · 总耗时 {elapsed}",
    incomplete: "转码没有完成。",
    taskCancelled: "任务已取消。"
  },
  en: {
    appName: "Mashang Slim",
    checkingRuntime: "Checking local transcoding runtime...",
    desktopOnly: "Please run this inside the desktop app.",
    cannotAccessDesktop: "Desktop features unavailable",
    electronMissing: "This page is not connected to the Electron main process.",
    runtimeFailed: "Runtime check failed: {message}",
    runtimeReady: "{version}, offline queue ready",
    runtimeMissing: "Missing ffmpeg or ffprobe.",
    bitDepthStandby: "Bit-depth guard ready",
    addVideos: "Add videos",
    addFolders: "Add folder",
    clear: "Clear",
    noVideos: "No videos selected.",
    queueTitle: "Video Queue",
    outputCodec: "Output codec",
    outputFormat: "Output format",
    outputMp4: "MP4 (recommended)",
    queueSettings: "Queue",
    concurrencyLimit: "Concurrency limit",
    tasksUnit: "tasks",
    concurrencyNote: "Default is 2 concurrent tasks, a steady setting for most machines.",
    settingsButton: "Settings",
    settingsTitle: "Settings",
    settingsSubtitle: "Less frequent options live here so the main screen stays focused.",
    closeSettings: "Close settings",
    advancedSettings: "Advanced",
    hardwareEnabled: "Enable hardware acceleration",
    hardwareMode: "Hardware mode",
    hardwareAuto: "Auto",
    hardwareSoftware: "Software only",
    hardwareStatusAuto: "Hardware: auto",
    hardwareStatusOff: "Hardware: off",
    language: "Language",
    presetMode: "Preset",
    customBitrate: "Manual bitrate",
    qualityPreset: "Quality preset",
    compact: "Compact",
    balanced: "Recommended",
    high: "High quality",
    master: "Near source",
    bitrate: "Bitrate",
    applyRecommended: "Use recommended",
    recommended: "Recommended bitrate: {value}",
    conservativeMode: "Conservative mode: target bitrate never below source",
    encoderSpeed: "Encoding speed",
    speedSlow: "Slow / smaller",
    speedMedium: "Balanced",
    speedFast: "Fast",
    speedVeryFast: "Very fast",
    audio: "Audio",
    audioAuto: "Auto compatible",
    audioCopy: "Force copy source",
    audioAac: "AAC 192k",
    outputFolder: "Output folder",
    choose: "Choose",
    startQueue: "Start queue",
    pauseQueue: "Pause queue",
    resumeQueue: "Resume queue",
    stopQueue: "Stop queue",
    reveal: "Reveal",
    pending: "Ready",
    addToStart: "Add videos or folders to begin.",
    outputNotes: "Output Notes",
    resultsHint: "Finished outputs will list format, path, bit depth, resolution, and size changes.",
    noResults: "No outputs yet.",
    dropTitle: "Drop videos, multiple videos, or folders",
    dropSubtitle: "Offline local processing, queued automatically, no uploads",
    author: "Developer: Yixin · v{version} · {date}",
    waitingVideo: "Waiting for video",
    waitingVideoDescription: "Select a video to show source bit depth, resolution, original size, and estimated output.",
    unreadableVideo: "Cannot read video",
    waitUsableVideo: "Waiting for a readable video",
    bitDepthBlocked: "This codec cannot preserve bit depth",
    bitDepthGuardBlocked: "Bit-depth guard blocked",
    outputProtection: "Output protection on",
    guardReady: "Source {source}, output {choice}, using {pixFmt}, target {bitrate} Mbps, estimated {size}, audio {audio}, {shrink}. Verification runs after export.",
    shrinkConservative: "conservative mode will raise bitrate to source level",
    shrinkNormal: "will re-encode at the selected bitrate",
    keepBitDepth: "Keep {depth}-bit / {resolution}",
    envNotReady: "Runtime is not ready yet.",
    encoderCapsMissing: "Encoder capability was not found.",
    unsupportedBitDepth: "{encoder} cannot preserve {depth}-bit {pixFmt} output.",
    status: {
      loading: "Reading",
      ready: "Ready",
      queued: "Queued",
      starting: "Starting",
      running: "Transcoding",
      paused: "Paused",
      cancelling: "Cancelling",
      done: "Done",
      error: "Failed",
      cancelled: "Cancelled"
    },
    selected: "Selected",
    select: "Select",
    sourceFile: "Source {size}",
    estimatedOutput: "Estimated {size}",
    currentEta: "Current ETA {eta}",
    queueEta: "Queue ETA {eta}",
    elapsed: "Elapsed {time}",
    hardware: "Hardware {encoder}",
    decodeCuda: "CUDA decode",
    decodeCpu: "CPU decode",
    software: "Software",
    fallbackSoftware: "Fell back to software",
    queueStatus: "{pending} pending · {running} running · {paused} paused · {done} done",
    queuePausedTitle: "Queue paused {percent}%",
    queueRunningTitle: "Queue processing {percent}%",
    queueRunningMeta: "Concurrency {limit} · {running} running · {queued} queued · current {currentEta} · all {queueEta}",
    queueDone: "Queue complete",
    completedOutputs: "{count} outputs complete",
    noAudio: "no audio",
    audioKeep: "keep source track",
    audioAutoAac: "auto AAC 192k",
    outputSummary: "Format {format} ({codec}){target} · Path ready · Bit depth {inputDepth}-bit → {outputDepth}-bit · Resolution {resolution} · {engine} · Source {sourceSize} / Output {outputSize} / Saved {saved} ({savedPercent}%){elapsed}",
    target: " · Target {bitrate} Mbps",
    batchSummary: "{count} outputs: source {source} · output {output} · saved {saved} ({percent}%) · total elapsed {elapsed}",
    incomplete: "Transcoding did not finish.",
    taskCancelled: "Task cancelled."
  }
};

boot();

async function boot() {
  bindUi();
  applyLanguage();

  if (!api) {
    els.runtimeStatus.textContent = t("desktopOnly");
    setGuard(t("cannotAccessDesktop"), t("electronMissing"), true);
    hideSplash();
    return;
  }

  try {
    state.environment = await api.getEnvironment();
    state.outputDir = state.environment.defaultOutputDir || "";
    els.outputDir.textContent = state.outputDir || "-";
    updateRuntimeStatus();
    applyLanguage();
  } catch (error) {
    els.runtimeStatus.textContent = t("runtimeFailed", { message: error.message });
  }

  api.onProgress(handleProgress);
  api.onComplete(handleComplete);
  api.onLog(() => {});
  updateAll();
  hideSplash();
}

function t(key, values = {}) {
  const table = I18N[state.language] || I18N.zh;
  const parts = key.split(".");
  const value =
    parts.reduce((current, part) => (current ? current[part] : null), table) ??
    parts.reduce((current, part) => (current ? current[part] : null), I18N.zh) ??
    key;
  return String(value).replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? "");
}

function applyLanguage() {
  document.documentElement.lang = state.language === "en" ? "en" : "zh-CN";
  document.title = t("appName");
  document.querySelector("h1").textContent = t("appName");
  document.querySelector(".splash-stack strong").textContent = t("appName");
  document.querySelector(".drop-zone strong").textContent = t("dropTitle");
  document.querySelector(".drop-zone small").textContent = t("dropSubtitle");

  els.authorLink.textContent = t("author", {
    version: state.environment?.version || "0.1.6",
    date: state.environment?.buildDate || "2026-05-27"
  });
  els.pickVideosButton.textContent = t("addVideos");
  els.pickFoldersButton.textContent = t("addFolders");
  els.clearListButton.textContent = t("clear");
  els.settingsButtonLabel.textContent = t("settingsButton");
  els.settingsDrawerTitle.textContent = t("settingsTitle");
  els.settingsDrawerSubtitle.textContent = t("settingsSubtitle");
  els.closeSettingsButton.setAttribute("aria-label", t("closeSettings"));
  document.querySelector(".section-title h2").textContent = t("queueTitle");
  labelFor("codecSelect", t("outputCodec"));
  labelFor("outputFormatSelect", t("outputFormat"));
  document.querySelector(".settings-card h2").textContent = t("queueSettings");
  labelFor("concurrencyInput", t("concurrencyLimit"));
  document.querySelector(".number-row span").textContent = t("tasksUnit");
  document.querySelector(".setting-note").textContent = t("concurrencyNote");
  els.advancedSettingsTitle.textContent = t("advancedSettings");
  els.hardwareAccelerationLabel.textContent = t("hardwareEnabled");
  labelFor("hardwareMode", t("hardwareMode"));
  labelFor("languageSelect", t("language"));
  els.modePreset.textContent = t("presetMode");
  els.modeCustom.textContent = t("customBitrate");
  document.querySelector("#presetPanel .field-label").textContent = t("qualityPreset");
  presetLabel("compact", t("compact"));
  presetLabel("balanced", t("balanced"));
  presetLabel("high", t("high"));
  presetLabel("master", t("master"));
  labelFor("bitrateSlider", t("bitrate"));
  els.applyRecommendedButton.textContent = t("applyRecommended");
  els.bitrateProtectionLabel.textContent = t("conservativeMode");
  labelFor("encoderPreset", t("encoderSpeed"));
  labelFor("audioMode", t("audio"));
  els.outputDirLabel.textContent = t("outputFolder");
  els.chooseOutputButton.textContent = t("choose");
  els.startButton.textContent = t("startQueue");
  els.cancelButton.textContent = t("stopQueue");
  els.revealButton.textContent = t("reveal");
  document.querySelector(".results-band h2").textContent = t("outputNotes");
  els.languageSelect.value = state.language;

  setSelectLabels();
  if (state.environment) updateRuntimeStatus();
  updateAll();
}

function labelFor(id, text) {
  const label = document.querySelector(`label[for="${id}"]`);
  if (label) label.textContent = text;
}

function presetLabel(preset, text) {
  const button = document.querySelector(`[data-preset="${preset}"] strong`);
  if (button) button.textContent = text;
}

function setSelectLabels() {
  setOptionLabel(els.outputFormatSelect, "mp4", t("outputMp4"));
  setOptionLabel(els.hardwareMode, "auto", t("hardwareAuto"));
  setOptionLabel(els.hardwareMode, "software", t("hardwareSoftware"));
  setOptionLabel(els.encoderPreset, "slow", t("speedSlow"));
  setOptionLabel(els.encoderPreset, "medium", t("speedMedium"));
  setOptionLabel(els.encoderPreset, "fast", t("speedFast"));
  setOptionLabel(els.encoderPreset, "veryfast", t("speedVeryFast"));
  setOptionLabel(els.audioMode, "auto", t("audioAuto"));
  setOptionLabel(els.audioMode, "copy", t("audioCopy"));
  setOptionLabel(els.audioMode, "aac", t("audioAac"));
}

function setOptionLabel(select, value, text) {
  const option = [...select.options].find((item) => item.value === value);
  if (option) option.textContent = text;
}

function hideSplash() {
  const remaining = Math.max(0, 900 - (performance.now() - bootStartedAt));
  window.setTimeout(() => {
    if (!els.splashScreen) return;
    els.splashScreen.classList.add("hide");
    window.setTimeout(() => els.splashScreen.remove(), 520);
  }, remaining);
}

function bindUi() {
  els.pickVideosButton.addEventListener("click", pickVideos);
  els.pickFoldersButton.addEventListener("click", pickFolders);
  els.clearListButton.addEventListener("click", clearList);

  els.fileInput.addEventListener("change", (event) => {
    const paths = [...event.target.files].map((file) => file.path).filter(Boolean);
    addPaths(paths);
    event.target.value = "";
  });

  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragging"));
  els.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
    const paths = [...event.dataTransfer.files].map((file) => file.path).filter(Boolean);
    addPaths(paths);
  });

  els.codecSelect.addEventListener("change", () => {
    state.codec = els.codecSelect.value;
    applyPresetOrRecommendation();
    updateAll();
  });

  els.outputFormatSelect.addEventListener("change", () => {
    state.outputFormat = els.outputFormatSelect.value;
    updateAll();
  });

  els.openSettingsButton.addEventListener("click", openSettings);
  els.settingsBackdrop.addEventListener("click", closeSettings);
  els.closeSettingsButton.addEventListener("click", closeSettings);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.settingsOverlay.hidden) closeSettings();
  });

  els.concurrencyInput.addEventListener("input", () => {
    state.maxConcurrent = clamp(Number(els.concurrencyInput.value || 2), 1, 4);
    els.concurrencyInput.value = String(state.maxConcurrent);
    updateAll();
    pumpQueue();
  });

  els.modePreset.addEventListener("click", () => setQualityMode("preset"));
  els.modeCustom.addEventListener("click", () => setQualityMode("custom"));

  for (const button of els.presetButtons) {
    button.addEventListener("click", () => {
      state.preset = button.dataset.preset;
      setQualityMode("preset");
      applyPresetOrRecommendation();
      updateAll();
    });
  }

  els.bitrateSlider.addEventListener("input", () => {
    state.bitrateMbps = Number(els.bitrateSlider.value);
    setQualityMode("custom");
    updateAll();
  });

  els.bitrateInput.addEventListener("input", () => {
    state.bitrateMbps = clamp(Number(els.bitrateInput.value || 0), 0.5, 240);
    setQualityMode("custom");
    updateAll({ skipNumberInput: true });
  });

  els.applyRecommendedButton.addEventListener("click", () => {
    state.preset = "balanced";
    applyPresetOrRecommendation();
    updateAll();
  });

  els.bitrateProtection.addEventListener("change", updateAll);
  els.audioMode.addEventListener("change", updateAll);
  els.hardwareAcceleration.addEventListener("change", () => {
    state.hardwareAcceleration = els.hardwareAcceleration.checked;
    updateAll();
  });
  els.hardwareMode.addEventListener("change", () => {
    state.hardwareMode = els.hardwareMode.value;
    if (state.hardwareMode === "software") {
      state.hardwareAcceleration = false;
      els.hardwareAcceleration.checked = false;
    } else if (!state.hardwareAcceleration) {
      state.hardwareAcceleration = true;
      els.hardwareAcceleration.checked = true;
    }
    updateAll();
  });
  els.languageSelect.addEventListener("change", () => {
    state.language = els.languageSelect.value;
    localStorage.setItem("mashang-language", state.language);
    applyLanguage();
  });
  els.authorLink.addEventListener("click", () => {
    if (state.environment?.authorUrl) api.openExternal(state.environment.authorUrl);
  });

  els.chooseOutputButton.addEventListener("click", async () => {
    if (!api) return;
    const dir = await api.selectOutputDir();
    if (dir) {
      state.outputDir = dir;
      els.outputDir.textContent = dir;
      updateAll();
    }
  });

  els.startButton.addEventListener("click", startQueue);
  els.pauseButton.addEventListener("click", togglePauseQueue);
  els.cancelButton.addEventListener("click", stopQueue);
  els.revealButton.addEventListener("click", () => {
    if (state.lastOutputPath) api.revealFile(state.lastOutputPath);
  });
}

function openSettings() {
  els.settingsOverlay.hidden = false;
  els.closeSettingsButton.focus({ preventScroll: true });
}

function closeSettings() {
  els.settingsOverlay.hidden = true;
  els.openSettingsButton.focus({ preventScroll: true });
}

async function pickVideos() {
  if (!api) return;
  addPaths(await api.selectVideos());
}

async function pickFolders() {
  if (!api) return;
  addPaths(await api.selectFolders());
}

function clearList() {
  const running = state.files.filter((file) => file.status === "running" || file.status === "starting" || file.status === "paused");
  state.files = running;
  state.selectedId = running[0] ? running[0].id : null;
  if (!running.length) state.queueRunning = false;
  state.lastOutputPath = "";
  updateAll();
}

async function addPaths(paths) {
  if (!paths || !paths.length || !api) return;

  const expanded = await api.expandPaths(paths);
  const uniquePaths = expanded.filter((filePath) => filePath && !state.files.some((file) => file.path === filePath));
  if (!uniquePaths.length) return;

  for (const filePath of uniquePaths) {
    const id = crypto.randomUUID();
    const placeholder = {
      id,
      path: filePath,
      name: filePath.split(/[\\/]/).pop(),
      loading: true,
      status: "loading",
      progress: 0,
      error: "",
      result: null
    };
    state.files.push(placeholder);
    if (!state.selectedId) state.selectedId = id;
    updateAll();

    try {
      const probed = await api.probeVideo(filePath);
      Object.assign(placeholder, probed, {
        id,
        loading: false,
        status: state.queueRunning ? "queued" : "ready",
        progress: 0,
        error: "",
        result: null
      });
      if (state.selectedId === id || state.files.length === 1) {
        state.selectedId = id;
        applyPresetOrRecommendation();
      }
    } catch (error) {
      Object.assign(placeholder, {
        loading: false,
        status: "error",
        error: error.message
      });
    }
    updateAll();
    if (state.queueRunning) pumpQueue();
  }
}

function selectedFile() {
  return state.files.find((file) => file.id === state.selectedId) || null;
}

function setQualityMode(mode) {
  state.qualityMode = mode;
  els.modePreset.classList.toggle("active", mode === "preset");
  els.modeCustom.classList.toggle("active", mode === "custom");
  els.presetPanel.style.opacity = mode === "preset" ? "1" : "0.66";
}

function applyPresetOrRecommendation() {
  const file = selectedFile();
  if (!file || !file.recommendations) return;
  const rec = file.recommendations[state.codec];
  const value = rec[state.preset] || rec.balanced;
  state.bitrateMbps = value;
}

function updateAll(options = {}) {
  renderFileList();
  renderResults();
  updateRecommendations();
  updateBitrate(options);
  updateGuard();
  updateQueueStatus();
  updateControls();
}

function updateRuntimeStatus() {
  if (!state.environment) {
    els.runtimeStatus.textContent = t("checkingRuntime");
    return;
  }
  const capabilities = state.environment.capabilities;
  const ffmpegReady = capabilities.ffmpeg.available;
  const ffprobeReady = capabilities.ffprobe.available;
  if (ffmpegReady && ffprobeReady) {
    const version = capabilities.ffmpeg.version.replace(/^ffmpeg version\s+/i, "ffmpeg ");
    els.runtimeStatus.textContent = t("runtimeReady", { version });
    return;
  }
  els.runtimeStatus.textContent = t("runtimeMissing");
}

function renderFileList() {
  if (!state.files.length) {
    els.fileList.className = "file-list empty";
    els.fileList.innerHTML = `<p>${escapeHtml(t("noVideos"))}</p>`;
    return;
  }

  els.fileList.className = "file-list";
  els.fileList.innerHTML = "";

  for (const file of state.files) {
    const card = document.createElement("article");
    card.className = `file-card${file.id === state.selectedId ? " selected" : ""}`;

    const top = document.createElement("div");
    top.className = "file-top";

    const copy = document.createElement("div");
    copy.innerHTML = `
      <div class="file-name">${escapeHtml(file.name)}</div>
      <div class="file-path">${escapeHtml(file.path)}</div>
    `;

    const buttons = document.createElement("div");
    buttons.className = "button-cluster";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = `select-button${file.id === state.selectedId ? " active" : ""}`;
    selectButton.textContent = file.id === state.selectedId ? t("selected") : t("select");
    selectButton.addEventListener("click", () => {
      state.selectedId = file.id;
      applyPresetOrRecommendation();
      updateAll();
    });

    const revealButton = document.createElement("button");
    revealButton.type = "button";
    revealButton.className = "select-button";
    revealButton.textContent = t("reveal");
    revealButton.disabled = !file.outputPath;
    revealButton.addEventListener("click", () => api.revealFile(file.outputPath));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "×";
    removeButton.disabled = file.status === "running" || file.status === "starting" || file.status === "paused";
    removeButton.addEventListener("click", () => {
      state.files = state.files.filter((item) => item.id !== file.id);
      if (state.selectedId === file.id) state.selectedId = state.files[0] ? state.files[0].id : null;
      applyPresetOrRecommendation();
      updateAll();
    });

    buttons.append(selectButton, revealButton, removeButton);
    top.append(copy, buttons);
    card.append(top);

    const chips = document.createElement("div");
    chips.className = "chip-row";

    if (file.loading) {
      chips.append(chip(statusText("loading")));
    } else if (file.error && file.status !== "done") {
      chips.append(chip(statusText(file.status)), chip(file.error));
    } else {
      chips.append(
        chip(statusText(file.status)),
        chip(`${file.video.width}×${file.video.height}`),
        chip(`${formatFps(file.video.fps)} fps`),
        chip(`${file.video.bitDepth}-bit`),
        chip(file.video.pixFmt),
        chip(t("sourceFile", { size: formatMB(file.size) })),
        chip(t("estimatedOutput", { size: formatMB(estimateOutputSize(file)) })),
        chip(formatCodecName(file.video.codec))
      );
      if (file.status === "running" || file.status === "paused") {
        chips.append(chip(t("currentEta", { eta: formatDuration(file.etaSeconds) })));
      }
      if (file.encoderLabel) {
        chips.append(chip(file.hardwareAccelerated ? t("hardware", { encoder: file.encoderLabel }) : t("software")));
      }
      if (file.hardwareAccelerated && file.hardwareDecode === "cuda") chips.append(chip(t("decodeCuda")));
      if (file.fallbackAttempted) chips.append(chip(t("fallbackSoftware")));
    }

    card.append(chips);

    if (file.status === "running" || file.status === "starting" || file.status === "paused") {
      const progress = document.createElement("div");
      progress.className = "mini-progress";
      progress.innerHTML = `<span style="width:${clamp(file.progress || 0, 0, 100)}%"></span>`;
      card.append(progress);
    }

    if (file.status === "done" && file.result) {
      const result = document.createElement("div");
      result.className = "output-note";
      result.textContent = outputSummary(file);
      card.append(result);
    }

    els.fileList.append(card);
  }
}

function renderResults() {
  const completed = state.files.filter((file) => file.status === "done" && file.result);
  els.resultsHint.textContent = completed.length ? batchSummary(completed) : t("resultsHint");

  if (!completed.length) {
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = `<p>${escapeHtml(t("noResults"))}</p>`;
    return;
  }

  els.resultsList.className = "results-list";
  els.resultsList.innerHTML = "";

  for (const file of completed) {
    const item = document.createElement("article");
    item.className = "result-card";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(file.name)}</strong>
        <p>${escapeHtml(outputSummary(file))}</p>
        <span>${escapeHtml(file.outputPath)}</span>
      </div>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button";
    button.textContent = t("reveal");
    button.addEventListener("click", () => api.revealFile(file.outputPath));
    item.append(button);
    els.resultsList.append(item);
  }
}

function updateRecommendations() {
  const file = selectedFile();
  const rec = file && file.recommendations ? file.recommendations[state.codec] : null;

  els.presetCompact.textContent = rec ? `${rec.compact} Mbps` : "-";
  els.presetBalanced.textContent = rec ? `${rec.balanced} Mbps` : "-";
  els.presetHigh.textContent = rec ? `${rec.high} Mbps` : "-";
  els.presetMaster.textContent = rec ? `${rec.master} Mbps` : "-";
  els.recommendedText.textContent = t("recommended", { value: rec ? `${rec.balanced} Mbps` : "-" });

  for (const button of els.presetButtons) {
    button.classList.toggle("active", button.dataset.preset === state.preset);
  }
}

function updateBitrate(options = {}) {
  const value = Number.isFinite(state.bitrateMbps) ? state.bitrateMbps : 8;
  els.bitrateValue.textContent = `${roundToTenth(value)} Mbps`;
  els.bitrateSlider.value = String(clamp(value, Number(els.bitrateSlider.min), Number(els.bitrateSlider.max)));
  if (!options.skipNumberInput) els.bitrateInput.value = String(roundToTenth(value));
}

function updateEstimateAnnotations() {
  renderFileList();
  renderResults();
}

function updateGuard() {
  const file = selectedFile();
  if (!file || file.loading) {
    setGuard(t("waitingVideo"), t("waitingVideoDescription"), false);
    els.bitDepthGuard.textContent = t("bitDepthStandby");
    return;
  }

  if (file.error) {
    setGuard(t("unreadableVideo"), file.error, true);
    els.bitDepthGuard.textContent = t("waitUsableVideo");
    return;
  }

  const support = getBitDepthSupport(file);
  const source = `${file.video.bitDepth}-bit ${file.video.pixFmt} · ${file.video.width}×${file.video.height}`;
  if (!support.ok) {
    setGuard(t("bitDepthBlocked"), support.message, true);
    els.bitDepthGuard.textContent = t("bitDepthGuardBlocked");
    return;
  }

  const targetBitrate = bitrateForFile(file);
  const audioCopy = audioModeDescription(file);
  setGuard(
    t("outputProtection"),
    t("guardReady", {
      source,
      choice: formatOutputChoice(),
      pixFmt: support.pixelFormat,
      bitrate: roundToTenth(targetBitrate),
      size: formatMB(estimateOutputSize(file)),
      audio: audioCopy,
      shrink: els.bitrateProtection.checked ? t("shrinkConservative") : t("shrinkNormal")
    }),
    false
  );
  els.bitDepthGuard.textContent = t("keepBitDepth", {
    depth: file.video.bitDepth,
    resolution: `${file.video.width}×${file.video.height}`
  });
}

function setGuard(title, description, warning) {
  els.guardTitle.textContent = title;
  els.guardDescription.textContent = description;
  els.guardPanel.classList.toggle("warning", warning);
}

function getBitDepthSupport(file) {
  if (!state.environment || !file || !file.video) return { ok: false, message: t("envNotReady") };
  const codecCaps = state.environment.capabilities.encoders[state.codec];
  if (!codecCaps) return { ok: false, message: t("encoderCapsMissing") };

  const pixelFormat = normalizePixelFormat(file.video.pixFmt, file.video.bitDepth);
  if (codecCaps.pixelFormats.includes(pixelFormat)) {
    return { ok: true, pixelFormat };
  }
  if (codecCaps.pixelFormats.includes(file.video.pixFmt)) {
    return { ok: true, pixelFormat: file.video.pixFmt };
  }

  return {
    ok: false,
    message: t("unsupportedBitDepth", {
      encoder: codecCaps.encoder,
      depth: file.video.bitDepth,
      pixFmt: file.video.pixFmt
    })
  };
}

function normalizePixelFormat(sourcePixFmt, bitDepth) {
  const pixFmt = String(sourcePixFmt || "").toLowerCase();
  if (pixFmt.includes("444")) return bitDepth > 8 ? `yuv444p${bitDepth}le` : "yuv444p";
  if (pixFmt.includes("422")) return bitDepth > 8 ? `yuv422p${bitDepth}le` : "yuv422p";
  if (pixFmt.includes("gbr")) return bitDepth > 8 ? `gbrp${bitDepth}le` : "gbrp";
  if (pixFmt.includes("gray")) return bitDepth > 8 ? `gray${bitDepth}le` : "gray";
  if (bitDepth > 8) return `yuv420p${bitDepth}le`;
  return pixFmt && pixFmt !== "unknown" && !pixFmt.includes("p010") ? pixFmt : "yuv420p";
}

function updateQueueStatus() {
  const counts = countStatuses();
  els.queueStatus.textContent = t("queueStatus", {
    pending: counts.ready + counts.queued,
    running: counts.running + counts.starting,
    paused: counts.paused,
    done: counts.done
  });
  els.hardwareStatus.textContent = state.hardwareAcceleration ? t("hardwareStatusAuto") : t("hardwareStatusOff");

  const processable = state.files.filter((file) => !file.loading && file.status !== "error");
  const total = processable.length;
  if (!total) {
    els.progressTitle.textContent = t("pending");
    els.progressMeta.textContent = t("addToStart");
    els.progressBar.style.width = "0%";
    return;
  }

  const finishedWeight = processable.reduce((sum, file) => {
    if (file.status === "done") return sum + 100;
    if (file.status === "running" || file.status === "starting" || file.status === "paused") return sum + (file.progress || 0);
    return sum;
  }, 0);
  const percent = finishedWeight / total;
  els.progressBar.style.width = `${clamp(percent, 0, 100)}%`;

  if (state.queuePaused) {
    els.progressTitle.textContent = t("queuePausedTitle", { percent: Math.round(percent) });
    els.progressMeta.textContent = t("queueRunningMeta", {
      limit: state.maxConcurrent,
      running: counts.running + counts.starting,
      queued: counts.queued,
      currentEta: currentTaskEtaText(),
      queueEta: formatDuration(estimateQueueEtaSeconds())
    });
  } else if (state.queueRunning || counts.running || counts.starting || counts.queued || counts.paused) {
    els.progressTitle.textContent = t("queueRunningTitle", { percent: Math.round(percent) });
    els.progressMeta.textContent = t("queueRunningMeta", {
      limit: state.maxConcurrent,
      running: counts.running + counts.starting,
      queued: counts.queued,
      currentEta: currentTaskEtaText(),
      queueEta: formatDuration(estimateQueueEtaSeconds())
    });
  } else if (counts.done) {
    const completed = state.files.filter((file) => file.status === "done" && file.result);
    els.progressTitle.textContent = t("queueDone");
    els.progressMeta.textContent = completed.length ? batchSummary(completed) : t("completedOutputs", { count: counts.done });
  }
}

function updateControls() {
  const file = selectedFile();
  const envReady =
    state.environment &&
    state.environment.capabilities.ffmpeg.available &&
    state.environment.capabilities.ffprobe.available;
  const counts = countStatuses();
  const canStart = counts.ready > 0 || counts.queued > 0;
  const hasActiveQueue = state.queueRunning || counts.running || counts.queued || counts.starting || counts.paused;

  els.startButton.disabled = !envReady || !canStart || state.queueRunning || state.queuePaused;
  els.pauseButton.disabled = !hasActiveQueue;
  els.pauseButton.textContent = state.queuePaused ? t("resumeQueue") : t("pauseQueue");
  els.cancelButton.disabled = !hasActiveQueue;
  els.revealButton.disabled = !state.lastOutputPath;
  els.codecSelect.value = state.codec;
  els.outputFormatSelect.value = state.outputFormat;
  els.concurrencyInput.value = String(state.maxConcurrent);
  els.hardwareAcceleration.checked = state.hardwareAcceleration;
  els.hardwareMode.value = state.hardwareAcceleration ? state.hardwareMode : "software";
  setQualityMode(state.qualityMode);
}

function startQueue() {
  const readyFiles = state.files.filter((file) => file.status === "ready" || file.status === "queued");
  if (!readyFiles.length) return;
  for (const file of readyFiles) {
    file.status = "queued";
    file.progress = 0;
    file.error = "";
    file.result = null;
  }
  state.queueRunning = true;
  state.queuePaused = false;
  state.batchStartedAt = Date.now();
  state.batchCompletedAt = 0;
  updateAll();
  pumpQueue();
}

async function pumpQueue() {
  if (!state.queueRunning || state.queuePaused || state.pumping) return;
  state.pumping = true;

  try {
    while (!state.queuePaused && state.queueRunning && countStatuses().running + countStatuses().starting < state.maxConcurrent) {
      const next = state.files.find((file) => file.status === "queued");
      if (!next) break;
      await startFile(next);
    }

    if (!state.files.some((file) => file.status === "queued" || file.status === "running" || file.status === "starting" || file.status === "paused")) {
      state.queueRunning = false;
      state.batchCompletedAt = Date.now();
    }
  } finally {
    state.pumping = false;
    updateAll();
  }
}

async function startFile(file) {
  const support = getBitDepthSupport(file);
  if (!support.ok) {
    file.status = "error";
    file.error = support.message;
    return;
  }

  file.status = "starting";
  file.progress = 0;
  file.outputPath = "";
  file.result = null;
  file.startedAt = Date.now();
  file.elapsedMs = 0;
  file.etaSeconds = null;
  file.rawSpeedValue = 0;
  file.speedValue = 0;
  file.hardwareDecode = "";
  file.decodeLabel = "";
  updateAll();

  try {
    const result = await api.startTranscode({
      input: file,
      options: {
        taskId: file.id,
        codec: state.codec,
        outputFormat: state.outputFormat,
        bitrateMbps: bitrateForFile(file),
        bitrateProtection: els.bitrateProtection.checked,
        outputDir: state.outputDir,
        encoderPreset: els.encoderPreset.value,
        audioMode: els.audioMode.value,
        hardware: {
          enabled: state.hardwareAcceleration,
          mode: state.hardwareMode,
          allowFallback: true
        }
      }
    });

    file.jobId = result.jobId;
    file.status = "running";
    file.outputPath = result.outputPath;
    file.targetPixFmt = result.pixelFormat;
    file.effectiveBitrateMbps = result.effectiveBitrateMbps;
    file.hardwareAccelerated = result.hardwareAccelerated;
    file.encoderLabel = result.encoderLabel;
    file.encoderUsed = result.encoderUsed;
    file.hardwareDecode = result.hardwareDecode;
    file.decodeLabel = result.decodeLabel;
  } catch (error) {
    file.status = "error";
    file.error = error.message;
  }
}

async function togglePauseQueue() {
  if (state.queuePaused) {
    state.queuePaused = false;
    for (const file of state.files) {
      if (file.status === "paused" && file.jobId) {
        const result = await api.resumeTranscode(file.jobId);
        if (result.ok) file.status = "running";
        else file.error = result.error || file.error;
      }
    }
    updateAll();
    pumpQueue();
    return;
  }

  state.queuePaused = true;
  for (const file of state.files) {
    if ((file.status === "running" || file.status === "starting") && file.jobId) {
      const result = await api.pauseTranscode(file.jobId);
      if (result.ok) file.status = "paused";
      else file.error = result.error || file.error;
    }
  }
  updateAll();
}

async function stopQueue() {
  state.queueRunning = false;
  state.queuePaused = false;
  for (const file of state.files) {
    if (file.status === "queued") file.status = "ready";
    if (file.status === "paused" && file.jobId) {
      await api.resumeTranscode(file.jobId);
      file.status = "running";
    }
    if ((file.status === "running" || file.status === "starting") && file.jobId) {
      file.status = "cancelling";
      await api.cancelTranscode(file.jobId);
    }
  }
  updateAll();
}

function handleProgress(payload) {
  const file = fileFromPayload(payload);
  if (!file) return;
  if (payload.hardwareFallback) {
    file.fallbackAttempted = true;
    file.hardwareAccelerated = false;
    file.encoderLabel = payload.encoderLabel;
    file.encoderUsed = payload.encoderUsed;
    file.progress = 0;
    file.currentSeconds = 0;
    file.rawSpeedValue = 0;
    file.speedValue = 0;
  }
  file.progress = clamp(payload.percent || 0, 0, 100);
  file.speed = payload.speed || "";
  file.currentSeconds = payload.currentSeconds || file.currentSeconds || 0;
  updateFileSpeedEstimate(file, payload);
  file.etaSeconds = estimateFileEta(file);
  file.hardwareAccelerated = Boolean(payload.hardwareAccelerated);
  file.encoderLabel = payload.encoderLabel || file.encoderLabel;
  file.encoderUsed = payload.encoderUsed || file.encoderUsed;
  file.hardwareDecode = payload.hardwareDecode || file.hardwareDecode;
  file.decodeLabel = payload.decodeLabel || file.decodeLabel;
  updateQueueStatus();
  renderFileList();
}

function handleComplete(payload) {
  const file = fileFromPayload(payload);
  if (!file) return;

  if (payload.ok) {
    file.status = "done";
    file.progress = 100;
    file.outputPath = payload.outputPath;
    file.result = payload.verification;
    file.elapsedMs = payload.elapsedMs || file.elapsedMs || 0;
    file.hardwareAccelerated = Boolean(payload.verification?.hardwareAccelerated);
    file.encoderLabel = payload.verification?.encoderLabel || file.encoderLabel;
    file.encoderUsed = payload.verification?.encoderUsed || file.encoderUsed;
    file.hardwareDecode = payload.verification?.hardwareDecode || file.hardwareDecode;
    file.decodeLabel = payload.verification?.decodeLabel || file.decodeLabel;
    file.fallbackAttempted = Boolean(payload.verification?.fallbackAttempted);
    file.error = "";
    state.lastOutputPath = payload.outputPath;
  } else {
    file.status = payload.cancelled ? "cancelled" : "error";
    file.error = payload.error || t("incomplete");
  }

  updateAll();
  pumpQueue();
}

function fileFromPayload(payload) {
  return (
    state.files.find((file) => payload.taskId && file.id === payload.taskId) ||
    state.files.find((file) => payload.jobId && file.jobId === payload.jobId)
  );
}

function bitrateForFile(file) {
  if (state.qualityMode === "preset" && file.recommendations) {
    const rec = file.recommendations[state.codec];
    return rec[state.preset] || rec.balanced;
  }
  return state.bitrateMbps;
}

function parseSpeedValue(speed) {
  const match = String(speed || "").match(/([\d.]+)x/);
  return match ? Number(match[1]) : 0;
}

function updateFileSpeedEstimate(file, payload) {
  const parsed = parseSpeedValue(payload.speed);
  file.rawSpeedValue = parsed;

  const elapsed = file.startedAt ? Math.max((Date.now() - file.startedAt) / 1000, 0) : 0;
  const observed = elapsed > 2 && payload.currentSeconds > 0 ? payload.currentSeconds / elapsed : 0;
  const combined = parsed && observed ? parsed * 0.35 + observed * 0.65 : parsed || observed || 0;

  if (combined > 0) {
    file.speedValue = file.speedValue ? file.speedValue * 0.72 + combined * 0.28 : combined;
  }
}

function estimateFileEta(file) {
  if (!file || !file.duration) return null;
  const speed = file.speedValue || averageObservedSpeed() || 0;
  if (speed > 0 && file.currentSeconds >= 0) {
    return Math.max((file.duration - file.currentSeconds) / speed, 0);
  }

  if (file.startedAt && file.progress > 1) {
    const elapsedSeconds = (Date.now() - file.startedAt) / 1000;
    return Math.max((elapsedSeconds / file.progress) * (100 - file.progress), 0);
  }

  return null;
}

function averageObservedSpeed() {
  const running = state.files.map((file) => file.speedValue).filter((value) => value > 0);
  if (running.length) return running.reduce((sum, value) => sum + value, 0) / running.length;

  const completed = state.files
    .filter((file) => file.status === "done" && file.elapsedMs && file.duration)
    .map((file) => file.duration / (file.elapsedMs / 1000))
    .filter((value) => value > 0);
  if (completed.length) return completed.reduce((sum, value) => sum + value, 0) / completed.length;

  return defaultEstimatedSpeed();
}

function defaultEstimatedSpeed() {
  if (!state.hardwareAcceleration) return 0.55;
  if (state.environment?.platform === "win32") return 2.2;
  if (state.environment?.platform === "darwin") return 3.2;
  return 1;
}

function currentTaskEtaText() {
  const running = state.files.find((file) => file.status === "running" || file.status === "paused" || file.status === "starting");
  return formatDuration(running?.etaSeconds);
}

function estimateQueueEtaSeconds() {
  const active = state.files.filter((file) => ["queued", "ready", "running", "starting", "paused"].includes(file.status));
  if (!active.length) return null;

  const speed = Math.max(averageObservedSpeed(), 0.1);
  const lanes = Math.max(1, Math.min(state.maxConcurrent, active.length));
  const laneTimes = active
    .filter((file) => file.status === "running" || file.status === "starting" || file.status === "paused")
    .map((file) => estimateFileEta(file) || 0)
    .slice(0, lanes);

  while (laneTimes.length < lanes) laneTimes.push(0);

  const queuedWorks = active
    .filter((file) => file.status === "queued" || file.status === "ready")
    .map((file) => Number(file.duration || 0) / speed)
    .sort((a, b) => b - a);

  for (const work of queuedWorks) {
    const index = laneTimes.indexOf(Math.min(...laneTimes));
    laneTimes[index] += work;
  }

  return Math.max(...laneTimes);
}

function outputSummary(file) {
  const result = file.result || {};
  const codec = formatCodecName(result.outputCodec || state.codec);
  const sourceSize = Number(result.sourceSize || file.size || 0);
  const outputSize = Number(result.outputSize || 0);
  const saved = Math.max(sourceSize - outputSize, 0);
  const savedPercent = sourceSize ? Math.round((saved / sourceSize) * 100) : 0;
  const format = result.outputFormat || formatOutputLabel(state.outputFormat);
  const target = result.targetBitrateMbps ? t("target", { bitrate: roundToTenth(result.targetBitrateMbps) }) : "";
  const engine = result.hardwareAccelerated
    ? formatHardwareEngine(result)
    : result.fallbackAttempted
      ? t("fallbackSoftware")
      : t("software");
  const elapsed = file.elapsedMs ? ` · ${t("elapsed", { time: formatDuration(file.elapsedMs / 1000) })}` : "";
  return t("outputSummary", {
    format,
    codec,
    target,
    inputDepth: result.inputBitDepth,
    outputDepth: result.outputBitDepth,
    resolution: result.outputResolution,
    engine,
    sourceSize: formatMB(sourceSize),
    outputSize: formatMB(outputSize),
    saved: formatMB(saved),
    savedPercent,
    elapsed
  });
}

function formatHardwareEngine(result) {
  const label = t("hardware", { encoder: result.encoderLabel || result.encoderUsed || "GPU" });
  if (result.hardwareDecode === "cuda") return `${label} / ${t("decodeCuda")}`;
  return label;
}

function batchSummary(files) {
  const sourceTotal = files.reduce((sum, file) => sum + Number(file.result?.sourceSize || file.size || 0), 0);
  const outputTotal = files.reduce((sum, file) => sum + Number(file.result?.outputSize || 0), 0);
  const saved = Math.max(sourceTotal - outputTotal, 0);
  const savedPercent = sourceTotal ? Math.round((saved / sourceTotal) * 100) : 0;
  const elapsedMs =
    state.batchStartedAt && state.batchCompletedAt
      ? state.batchCompletedAt - state.batchStartedAt
      : files.reduce((sum, file) => sum + Number(file.elapsedMs || 0), 0);
  return t("batchSummary", {
    count: files.length,
    source: formatMB(sourceTotal),
    output: formatMB(outputTotal),
    saved: formatMB(saved),
    percent: savedPercent,
    elapsed: formatDuration(elapsedMs / 1000)
  });
}

function countStatuses() {
  return state.files.reduce(
    (counts, file) => {
      counts[file.status] = (counts[file.status] || 0) + 1;
      return counts;
    },
    { loading: 0, ready: 0, queued: 0, starting: 0, running: 0, paused: 0, done: 0, error: 0, cancelled: 0, cancelling: 0 }
  );
}

function statusText(status) {
  return t(`status.${status}`) || t("status.ready");
}

function chip(text) {
  const span = document.createElement("span");
  span.className = "chip";
  span.textContent = text;
  return span;
}

function formatFps(value) {
  if (!value) return "-";
  return Math.round(value * 100) / 100;
}

function estimateOutputSize(file) {
  if (!file || !file.duration) return 0;
  const selectedBitrate = bitrateForFile(file);
  const sourceBitrateValue = file.videoBitrate || file.bitrate || 0;
  const sourceBitrate = sourceBitrateValue ? sourceBitrateValue / 1_000_000 : 0;
  const effectiveBitrate = els.bitrateProtection.checked && sourceBitrate ? Math.max(selectedBitrate, sourceBitrate) : selectedBitrate;
  const sourceAudioBitrate = file.audioBitrate || file.audio?.bitrate || 0;
  const sourceAudioMbps = sourceAudioBitrate ? sourceAudioBitrate / 1_000_000 : 0;
  const audioMbps = shouldUseAacAudio(file) ? 0.192 : sourceAudioMbps;
  const bytes = ((effectiveBitrate + audioMbps) * 1_000_000 * file.duration) / 8;
  const containerOverhead = 1.015;
  return bytes * containerOverhead;
}

function shouldUseAacAudio(file) {
  const mode = els.audioMode.value;
  if (mode === "aac") return true;
  if (mode === "copy") return false;
  return !canCopyAudioToContainer(file, state.outputFormat);
}

function canCopyAudioToContainer(file, outputFormat) {
  const codecs = (file.audio?.streams || [])
    .map((stream) => String(stream.codec || "").toLowerCase())
    .filter(Boolean);

  if (!codecs.length) return true;
  if (outputFormat === "mkv") return true;

  if (outputFormat === "mp4") {
    const mp4Safe = new Set(["aac", "mp3", "alac", "ac3", "eac3"]);
    return codecs.every((codec) => mp4Safe.has(codec));
  }

  if (outputFormat === "mov") {
    const movSafe = new Set(["aac", "mp3", "alac", "ac3", "eac3", "pcm_s16le", "pcm_s24le", "pcm_s32le"]);
    return codecs.every((codec) => movSafe.has(codec));
  }

  return false;
}

function audioModeDescription(file) {
  if (!file?.audio?.count) return t("noAudio");
  if (els.audioMode.value === "aac") return t("audioAac");
  if (els.audioMode.value === "copy") return t("audioCopy");
  return canCopyAudioToContainer(file, state.outputFormat) ? t("audioKeep") : t("audioAutoAac");
}

function formatMB(bytes) {
  const mb = Number(bytes || 0) / 1_000_000;
  if (!Number.isFinite(mb) || mb <= 0) return "-";
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${roundToTenth(mb)} MB`;
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return "-";
  const rounded = Math.max(1, Math.round(value));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (state.language === "en") {
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  if (hours) return `${hours}小时${minutes}分`;
  if (minutes) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
}

function formatCodecName(codec) {
  const normalized = String(codec || "").toLowerCase();
  if (normalized === "h265" || normalized === "hevc" || normalized.includes("265")) return "H.265";
  if (normalized === "h264" || normalized.includes("264") || normalized === "avc1") return "H.264";
  return String(codec || "视频").toUpperCase();
}

function formatOutputLabel(format) {
  const labels = { mp4: "MP4", mov: "MOV", mkv: "MKV" };
  return labels[format] || "MP4";
}

function formatOutputChoice() {
  return `${formatOutputLabel(state.outputFormat)} + ${state.codec === "h265" ? "H.265" : "H.264"}`;
}

function roundToTenth(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
