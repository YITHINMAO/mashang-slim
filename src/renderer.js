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
  queueRunning: false,
  pumping: false,
  lastOutputPath: ""
};

const els = {
  splashScreen: document.querySelector("#splashScreen"),
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
  applyRecommendedButton: document.querySelector("#applyRecommendedButton"),
  encoderPreset: document.querySelector("#encoderPreset"),
  audioMode: document.querySelector("#audioMode"),
  outputDir: document.querySelector("#outputDir"),
  chooseOutputButton: document.querySelector("#chooseOutputButton"),
  guardPanel: document.querySelector("#guardPanel"),
  guardTitle: document.querySelector("#guardTitle"),
  guardDescription: document.querySelector("#guardDescription"),
  startButton: document.querySelector("#startButton"),
  cancelButton: document.querySelector("#cancelButton"),
  revealButton: document.querySelector("#revealButton"),
  progressTitle: document.querySelector("#progressTitle"),
  progressMeta: document.querySelector("#progressMeta"),
  progressBar: document.querySelector("#progressBar"),
  resultsHint: document.querySelector("#resultsHint"),
  resultsList: document.querySelector("#resultsList")
};

boot();

async function boot() {
  bindUi();

  if (!api) {
    els.runtimeStatus.textContent = "请在桌面应用中运行。";
    setGuard("无法访问桌面能力", "当前页面没有连接到 Electron 主进程。", true);
    hideSplash();
    return;
  }

  try {
    state.environment = await api.getEnvironment();
    state.outputDir = state.environment.defaultOutputDir || "";
    els.outputDir.textContent = state.outputDir || "-";
    updateRuntimeStatus();
  } catch (error) {
    els.runtimeStatus.textContent = `环境检查失败：${error.message}`;
  }

  api.onProgress(handleProgress);
  api.onComplete(handleComplete);
  api.onLog(() => {});
  updateAll();
  hideSplash();
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
  els.cancelButton.addEventListener("click", stopQueue);
  els.revealButton.addEventListener("click", () => {
    if (state.lastOutputPath) api.revealFile(state.lastOutputPath);
  });
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
  const running = state.files.filter((file) => file.status === "running" || file.status === "starting");
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
  const capabilities = state.environment.capabilities;
  const ffmpegReady = capabilities.ffmpeg.available;
  const ffprobeReady = capabilities.ffprobe.available;
  if (ffmpegReady && ffprobeReady) {
    const version = capabilities.ffmpeg.version.replace(/^ffmpeg version\s+/i, "ffmpeg ");
    els.runtimeStatus.textContent = `${version}，离线队列转码就绪`;
    return;
  }
  els.runtimeStatus.textContent = "缺少 ffmpeg 或 ffprobe。";
}

function renderFileList() {
  if (!state.files.length) {
    els.fileList.className = "file-list empty";
    els.fileList.innerHTML = "<p>还没有选择视频。</p>";
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
    selectButton.textContent = file.id === state.selectedId ? "已选" : "选择";
    selectButton.addEventListener("click", () => {
      state.selectedId = file.id;
      applyPresetOrRecommendation();
      updateAll();
    });

    const revealButton = document.createElement("button");
    revealButton.type = "button";
    revealButton.className = "select-button";
    revealButton.textContent = "显示";
    revealButton.disabled = !file.outputPath;
    revealButton.addEventListener("click", () => api.revealFile(file.outputPath));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "×";
    removeButton.disabled = file.status === "running" || file.status === "starting";
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
      chips.append(chip("读取中"));
    } else if (file.error && file.status !== "done") {
      chips.append(chip(statusText(file.status)), chip(file.error));
    } else {
      chips.append(
        chip(statusText(file.status)),
        chip(`${file.video.width}×${file.video.height}`),
        chip(`${formatFps(file.video.fps)} fps`),
        chip(`${file.video.bitDepth}-bit`),
        chip(file.video.pixFmt),
        chip(`源文件 ${formatMB(file.size)}`),
        chip(`预计输出 ${formatMB(estimateOutputSize(file))}`),
        chip(formatCodecName(file.video.codec))
      );
    }

    card.append(chips);

    if (file.status === "running" || file.status === "starting") {
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
  els.resultsHint.textContent = completed.length ? batchSummary(completed) : "完成后会在这里列出格式、路径、色深、分辨率和体积变化。";

  if (!completed.length) {
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = "<p>暂无输出。</p>";
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
    button.textContent = "显示";
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
  els.recommendedText.textContent = rec ? `推荐码率：${rec.balanced} Mbps` : "推荐码率：-";

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
    setGuard("等待视频", "选择视频后会显示源位深、分辨率、原始大小和预计输出大小。", false);
    els.bitDepthGuard.textContent = "位深保护待命";
    return;
  }

  if (file.error) {
    setGuard("无法读取视频", file.error, true);
    els.bitDepthGuard.textContent = "等待可用视频";
    return;
  }

  const support = getBitDepthSupport(file);
  const source = `${file.video.bitDepth}-bit ${file.video.pixFmt} · ${file.video.width}×${file.video.height}`;
  if (!support.ok) {
    setGuard("当前编码不可保持位深", support.message, true);
    els.bitDepthGuard.textContent = "位深保护拦截";
    return;
  }

  const targetBitrate = bitrateForFile(file);
  const estimateCopy = `，目标 ${roundToTenth(targetBitrate)} Mbps，预计输出约 ${formatMB(estimateOutputSize(file))}`;
  const shrinkCopy = els.bitrateProtection.checked ? "保守模式会抬高到源视频码率" : "会按所选码率重新编码瘦身";
  const audioCopy = audioModeDescription(file);
  setGuard("输出保护开启", `源视频 ${source}，输出为 ${formatOutputChoice()}，使用 ${support.pixelFormat}${estimateCopy}，音频${audioCopy}，${shrinkCopy}，完成后会再次验证。`, false);
  els.bitDepthGuard.textContent = `保持 ${file.video.bitDepth}-bit / ${file.video.width}×${file.video.height}`;
}

function setGuard(title, description, warning) {
  els.guardTitle.textContent = title;
  els.guardDescription.textContent = description;
  els.guardPanel.classList.toggle("warning", warning);
}

function getBitDepthSupport(file) {
  if (!state.environment || !file || !file.video) return { ok: false, message: "环境还没有准备好。" };
  const codecCaps = state.environment.capabilities.encoders[state.codec];
  if (!codecCaps) return { ok: false, message: "未找到编码器能力。" };

  const pixelFormat = normalizePixelFormat(file.video.pixFmt, file.video.bitDepth);
  if (codecCaps.pixelFormats.includes(pixelFormat)) {
    return { ok: true, pixelFormat };
  }
  if (codecCaps.pixelFormats.includes(file.video.pixFmt)) {
    return { ok: true, pixelFormat: file.video.pixFmt };
  }

  return {
    ok: false,
    message: `${codecCaps.encoder} 不支持 ${file.video.bitDepth}-bit 的 ${file.video.pixFmt} 输出。`
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
  els.queueStatus.textContent = `${counts.ready + counts.queued} 待处理 · ${counts.running + counts.starting} 运行 · ${counts.done} 完成`;

  const processable = state.files.filter((file) => !file.loading && file.status !== "error");
  const total = processable.length;
  if (!total) {
    els.progressTitle.textContent = "待开始";
    els.progressMeta.textContent = "添加视频或文件夹后开始。";
    els.progressBar.style.width = "0%";
    return;
  }

  const finishedWeight = processable.reduce((sum, file) => {
    if (file.status === "done") return sum + 100;
    if (file.status === "running" || file.status === "starting") return sum + (file.progress || 0);
    return sum;
  }, 0);
  const percent = finishedWeight / total;
  els.progressBar.style.width = `${clamp(percent, 0, 100)}%`;

  if (state.queueRunning || counts.running || counts.starting || counts.queued) {
    els.progressTitle.textContent = `队列处理中 ${Math.round(percent)}%`;
    els.progressMeta.textContent = `并发上限 ${state.maxConcurrent} · ${counts.running + counts.starting} 运行 · ${counts.queued} 排队`;
  } else if (counts.done) {
    const completed = state.files.filter((file) => file.status === "done" && file.result);
    els.progressTitle.textContent = "队列完成";
    els.progressMeta.textContent = completed.length ? batchSummary(completed) : `完成 ${counts.done} 个输出`;
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

  els.startButton.disabled = !envReady || !canStart || state.queueRunning;
  els.cancelButton.disabled = !(state.queueRunning || counts.running || counts.queued || counts.starting);
  els.revealButton.disabled = !state.lastOutputPath;
  els.codecSelect.value = state.codec;
  els.outputFormatSelect.value = state.outputFormat;
  els.concurrencyInput.value = String(state.maxConcurrent);
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
  updateAll();
  pumpQueue();
}

async function pumpQueue() {
  if (!state.queueRunning || state.pumping) return;
  state.pumping = true;

  try {
    while (state.queueRunning && countStatuses().running + countStatuses().starting < state.maxConcurrent) {
      const next = state.files.find((file) => file.status === "queued");
      if (!next) break;
      await startFile(next);
    }

    if (!state.files.some((file) => file.status === "queued" || file.status === "running" || file.status === "starting")) {
      state.queueRunning = false;
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
        audioMode: els.audioMode.value
      }
    });

    file.jobId = result.jobId;
    file.status = "running";
    file.outputPath = result.outputPath;
    file.targetPixFmt = result.pixelFormat;
    file.effectiveBitrateMbps = result.effectiveBitrateMbps;
  } catch (error) {
    file.status = "error";
    file.error = error.message;
  }
}

async function stopQueue() {
  state.queueRunning = false;
  for (const file of state.files) {
    if (file.status === "queued") file.status = "ready";
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
  file.progress = clamp(payload.percent || 0, 0, 100);
  file.speed = payload.speed || "";
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
    file.error = "";
    state.lastOutputPath = payload.outputPath;
  } else {
    file.status = payload.cancelled ? "cancelled" : "error";
    file.error = payload.error || "转码没有完成。";
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

function outputSummary(file) {
  const result = file.result || {};
  const codec = formatCodecName(result.outputCodec || state.codec);
  const sourceSize = Number(result.sourceSize || file.size || 0);
  const outputSize = Number(result.outputSize || 0);
  const saved = Math.max(sourceSize - outputSize, 0);
  const savedPercent = sourceSize ? Math.round((saved / sourceSize) * 100) : 0;
  const format = result.outputFormat || formatOutputLabel(state.outputFormat);
  const target = result.targetBitrateMbps ? ` · 目标 ${roundToTenth(result.targetBitrateMbps)} Mbps` : "";
  return `格式 ${format} (${codec})${target} · 路径已生成 · 色深 ${result.inputBitDepth}-bit → ${result.outputBitDepth}-bit · 分辨率 ${result.outputResolution} · 原始 ${formatMB(sourceSize)} / 输出 ${formatMB(outputSize)} / 减少 ${formatMB(saved)}（${savedPercent}%）`;
}

function batchSummary(files) {
  const sourceTotal = files.reduce((sum, file) => sum + Number(file.result?.sourceSize || file.size || 0), 0);
  const outputTotal = files.reduce((sum, file) => sum + Number(file.result?.outputSize || 0), 0);
  const saved = Math.max(sourceTotal - outputTotal, 0);
  const savedPercent = sourceTotal ? Math.round((saved / sourceTotal) * 100) : 0;
  return `本批 ${files.length} 个：原始 ${formatMB(sourceTotal)} · 输出 ${formatMB(outputTotal)} · 共减少 ${formatMB(saved)}（${savedPercent}%）`;
}

function countStatuses() {
  return state.files.reduce(
    (counts, file) => {
      counts[file.status] = (counts[file.status] || 0) + 1;
      return counts;
    },
    { loading: 0, ready: 0, queued: 0, starting: 0, running: 0, done: 0, error: 0, cancelled: 0, cancelling: 0 }
  );
}

function statusText(status) {
  const labels = {
    loading: "读取中",
    ready: "待处理",
    queued: "排队中",
    starting: "启动中",
    running: "转码中",
    cancelling: "取消中",
    done: "已完成",
    error: "失败",
    cancelled: "已取消"
  };
  return labels[status] || "待处理";
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
  if (!file?.audio?.count) return "无音轨";
  if (els.audioMode.value === "aac") return "转 AAC 192k";
  if (els.audioMode.value === "copy") return "强制保留原轨";
  return canCopyAudioToContainer(file, state.outputFormat) ? "保留原轨" : "自动转 AAC 192k";
}

function formatMB(bytes) {
  const mb = Number(bytes || 0) / 1_000_000;
  if (!Number.isFinite(mb) || mb <= 0) return "-";
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${roundToTenth(mb)} MB`;
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
