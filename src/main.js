const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");
const { version: APP_VERSION } = require("../package.json");

const jobs = new Map();
const APP_NAME = "码上瘦身";
const BUILD_DATE = "2026-05-27";
const AUTHOR_URL = "https://github.com/YITHINMAO";
const TOOL_NAMES = {
  ffmpeg: process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  ffprobe: process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
};

const ENCODERS = {
  h264: {
    name: "H.264",
    encoder: "libx264",
    baseArgs: ["-c:v", "libx264"]
  },
  h265: {
    name: "H.265",
    encoder: "libx265",
    baseArgs: ["-c:v", "libx265"]
  }
};

const OUTPUT_FORMATS = {
  mp4: { label: "MP4", extension: "mp4" },
  mov: { label: "MOV", extension: "mov" },
  mkv: { label: "MKV", extension: "mkv" }
};

const VIDEO_EXTENSIONS = [
  "mp4",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "webm",
  "mts",
  "m2ts",
  "ts",
  "hevc",
  "h264"
];

function getToolPath(tool) {
  const platformArch = `${process.platform}-${process.arch}`;
  const executable = TOOL_NAMES[tool] || tool;
  const candidates = [];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "ffmpeg", platformArch, executable));
  }

  candidates.push(path.join(__dirname, "..", "vendor", "ffmpeg", platformArch, executable));
  candidates.push(path.join(__dirname, "..", "resources", "ffmpeg", platformArch, executable));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return executable;
}

function runSync(command, args) {
  const toolPath = getToolPath(command);
  const result = spawnSync(toolPath, args, { encoding: "utf8" });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  return {
    ok: !result.error && result.status === 0,
    stdout,
    stderr,
    output: `${stdout}\n${stderr}`,
    error: result.error ? result.error.message : null,
    path: toolPath,
    bundled: path.isAbsolute(toolPath)
  };
}

function getToolVersion(tool) {
  const result = runSync(tool, ["-version"]);
  if (!result.ok) {
    return { available: false, version: null, path: result.path, bundled: result.bundled, error: result.error || result.stderr };
  }
  return { available: true, version: result.stdout.split("\n")[0] || tool, path: result.path, bundled: result.bundled, error: null };
}

function getEncoderPixelFormats(encoder) {
  const result = runSync("ffmpeg", ["-hide_banner", "-h", `encoder=${encoder}`]);
  if (!result.ok) return [];

  const match = result.output.match(/Supported pixel formats:\s*([^\n]+)/);
  if (!match) return [];
  return match[1].trim().split(/\s+/).filter(Boolean);
}

function getAvailableEncoderNames() {
  const result = runSync("ffmpeg", ["-hide_banner", "-encoders"]);
  if (!result.ok) return [];
  return [...result.output.matchAll(/^\s*[A-Z.]{6}\s+([a-zA-Z0-9_]+)\s+/gm)].map((match) => match[1]);
}

function hardwarePixelFormats(candidate) {
  const detected = getEncoderPixelFormats(candidate.encoder);
  if (detected.length) return detected;

  const fallbackFormats = {
    h264_nvenc: ["cuda", "nv12", "yuv420p"],
    hevc_nvenc: ["cuda", "nv12", "p010le", "yuv420p", "yuv420p10le"],
    h264_qsv: ["qsv", "nv12", "yuv420p"],
    hevc_qsv: ["qsv", "nv12", "p010le", "yuv420p", "yuv420p10le"],
    h264_amf: ["nv12", "yuv420p"],
    hevc_amf: ["nv12", "p010le", "yuv420p", "yuv420p10le"]
  };

  return fallbackFormats[candidate.encoder] || [];
}

function loadCapabilities() {
  const ffmpeg = getToolVersion("ffmpeg");
  const ffprobe = getToolVersion("ffprobe");
  const availableEncoderNames = getAvailableEncoderNames();
  const availableEncoderSet = new Set(availableEncoderNames);
  const encoders = {};

  for (const [codec, config] of Object.entries(ENCODERS)) {
    encoders[codec] = {
      encoder: config.encoder,
      pixelFormats: getEncoderPixelFormats(config.encoder),
      hardware: hardwareCandidatesForCodec(codec)
        .filter((candidate) => availableEncoderSet.has(candidate.encoder))
        .map((candidate) => ({
          ...candidate,
          pixelFormats: hardwarePixelFormats(candidate)
        }))
    };
  }

  return { ffmpeg, ffprobe, encoders, availableEncoderNames };
}

function checkEncoderAvailability(encoderName) {
  const result = runSync("ffmpeg", ["-hide_banner", "-f", "lavfi", "-i", "nullsrc=s=1920x1080:r=1", "-c:v", encoderName, "-frames:v", "1", "-f", "null", "-"]);
  
  if (result.ok) return true;
  
  const errorMessage = (result.stderr || result.error || "").toLowerCase();
  const deviceErrors = ["no such device", "cannot load", "not found", "device not found", "failed to open", "could not initialize", "unsupported", "out of memory", "resource temporarily unavailable"];
  
  for (const error of deviceErrors) {
    if (errorMessage.includes(error)) {
      return false;
    }
  }
  
  return false;
}

function measureSoftwareEncodingSpeed() {
  const startTime = Date.now();
  const result = runSync("ffmpeg", ["-hide_banner", "-f", "lavfi", "-i", "nullsrc=s=1920x1080:r=30", "-c:v", "libx264", "-preset", "medium", "-frames:v", "100", "-f", "null", "-"]);
  const elapsedMs = Date.now() - startTime;
  
  if (!result.ok) {
    return { ok: false, speedLevel: "unknown", fps: 0 };
  }
  
  const fps = Math.round(100 / (elapsedMs / 1000));
  
  let speedLevel;
  if (fps >= 60) {
    speedLevel = "fast";
  } else if (fps >= 30) {
    speedLevel = "medium";
  } else {
    speedLevel = "slow";
  }
  
  return { ok: true, speedLevel, fps };
}

function detectHardwareCapabilities() {
  const capabilities = loadCapabilities();
  const availableSet = new Set(capabilities.availableEncoderNames);
  const vendors = [];

  const appleH264Available = availableSet.has("h264_videotoolbox") && checkEncoderAvailability("h264_videotoolbox");
  const appleH265Available = availableSet.has("hevc_videotoolbox") && checkEncoderAvailability("hevc_videotoolbox");
  vendors.push({
    vendor: "apple",
    label: "Apple VideoToolbox",
    h264: appleH264Available,
    h265: appleH265Available,
    available: appleH264Available || appleH265Available
  });

  const nvidiaH264 = availableSet.has("h264_nvenc") && checkEncoderAvailability("h264_nvenc");
  const nvidiaH265 = availableSet.has("hevc_nvenc") && checkEncoderAvailability("hevc_nvenc");
  vendors.push({
    vendor: "nvidia",
    label: "NVIDIA NVENC",
    h264: nvidiaH264,
    h265: nvidiaH265,
    available: nvidiaH264 || nvidiaH265
  });

  const intelH264 = availableSet.has("h264_qsv") && checkEncoderAvailability("h264_qsv");
  const intelH265 = availableSet.has("hevc_qsv") && checkEncoderAvailability("hevc_qsv");
  vendors.push({
    vendor: "intel",
    label: "Intel Quick Sync",
    h264: intelH264,
    h265: intelH265,
    available: intelH264 || intelH265
  });

  const amdH264 = availableSet.has("h264_amf") && checkEncoderAvailability("h264_amf");
  const amdH265 = availableSet.has("hevc_amf") && checkEncoderAvailability("hevc_amf");
  vendors.push({
    vendor: "amd",
    label: "AMD AMF",
    h264: amdH264,
    h265: amdH265,
    available: amdH264 || amdH265
  });

  const softwareH264 = availableSet.has("libx264") && checkEncoderAvailability("libx264");
  const softwareH265 = availableSet.has("libx265") && checkEncoderAvailability("libx265");
  
  const softwareSpeed = softwareH264 ? measureSoftwareEncodingSpeed() : { ok: false, speedLevel: "unknown", fps: 0 };
  
  return {
    platform: process.platform,
    software: softwareH264 || softwareH265,
    softwareH264,
    softwareH265,
    softwareSpeedLevel: softwareSpeed.speedLevel,
    softwareFps: softwareSpeed.fps,
    vendors
  };
}

function expandInputPaths(inputPaths) {
  const expanded = [];
  const seen = new Set();

  for (const inputPath of inputPaths || []) {
    collectVideoPaths(inputPath, expanded, seen);
  }

  return expanded.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function collectVideoPaths(inputPath, expanded, seen) {
  if (!inputPath || seen.has(inputPath)) return;
  seen.add(inputPath);

  let stat;
  try {
    stat = fs.statSync(inputPath);
  } catch {
    return;
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(inputPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      collectVideoPaths(path.join(inputPath, entry.name), expanded, seen);
    }
    return;
  }

  if (stat.isFile() && isVideoPath(inputPath)) {
    expanded.push(inputPath);
  }
}

function isVideoPath(filePath) {
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return VIDEO_EXTENSIONS.includes(extension);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 1020,
    minHeight: 700,
    backgroundColor: "#fff8ea",
    title: APP_NAME,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("app:getEnvironment", () => {
    return {
      platform: process.platform,
      home: os.homedir(),
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      authorUrl: AUTHOR_URL,
      defaultOutputDir: app.getPath("videos"),
      capabilities: loadCapabilities()
    };
  });

  ipcMain.handle("app:detectHardware", () => {
    return detectHardwareCapabilities();
  });

  ipcMain.handle("dialog:selectVideos", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择视频",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Videos", extensions: VIDEO_EXTENSIONS }]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("dialog:selectFolders", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择视频文件夹",
      properties: ["openDirectory", "multiSelections"]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("dialog:selectOutputDir", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择输出文件夹",
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("video:probe", async (_event, filePath) => probeVideo(filePath));

  ipcMain.handle("paths:expand", async (_event, paths) => expandInputPaths(paths));

  ipcMain.handle("transcode:start", async (event, payload) => {
    return startTranscode(event.sender, payload);
  });

  ipcMain.handle("transcode:cancel", async (_event, jobId) => {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "没有正在运行的任务。" };
    job.cancelled = true;
    job.process.kill("SIGTERM");
    return { ok: true };
  });

  ipcMain.handle("transcode:pause", async (_event, jobId) => {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "没有正在运行的任务。" };
    const result = pauseProcess(job);
    if (result.ok) job.paused = true;
    return result;
  });

  ipcMain.handle("transcode:resume", async (_event, jobId) => {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "没有正在运行的任务。" };
    const result = resumeProcess(job);
    if (result.ok) job.paused = false;
    return result;
  });

  ipcMain.handle("file:reveal", async (_event, filePath) => {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle("link:openExternal", async (_event, url) => {
    if (url) await shell.openExternal(url);
    return true;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function probeVideo(filePath) {
  const result = runSync("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath
  ]);

  if (!result.ok) {
    throw new Error(result.stderr || result.error || "ffprobe 无法读取该文件。");
  }

  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`ffprobe 返回了无法解析的信息：${error.message}`);
  }

  const videoStream = (data.streams || []).find((stream) => stream.codec_type === "video");
  const audioStreams = (data.streams || []).filter((stream) => stream.codec_type === "audio");
  if (!videoStream) throw new Error("没有找到视频轨。");

  const format = data.format || {};
  const duration = Number(videoStream.duration || format.duration || 0);
  const formatBitrate = Number(format.bit_rate || 0);
  const explicitVideoBitrate = Number(videoStream.bit_rate || 0);
  const explicitAudioBitrate = audioStreams.reduce((sum, stream) => sum + Number(stream.bit_rate || 0), 0);
  const videoBitrate = explicitVideoBitrate || Math.max(formatBitrate - explicitAudioBitrate, 0) || formatBitrate;
  const audioBitrate =
    explicitAudioBitrate || (formatBitrate && videoBitrate ? Math.max(formatBitrate - videoBitrate, 0) : 0);
  const fps = parseFrameRate(videoStream.avg_frame_rate || videoStream.r_frame_rate);
  const bitDepth = detectBitDepth(videoStream);

  return {
    path: filePath,
    name: path.basename(filePath),
    directory: path.dirname(filePath),
    size: Number(format.size || 0),
    duration,
    bitrate: videoBitrate,
    videoBitrate,
    audioBitrate,
    totalBitrate: formatBitrate || videoBitrate + audioBitrate,
    video: {
      codec: videoStream.codec_name || "unknown",
      codecLongName: videoStream.codec_long_name || "",
      width: Number(videoStream.width || 0),
      height: Number(videoStream.height || 0),
      fps,
      pixFmt: videoStream.pix_fmt || "unknown",
      bitDepth,
      profile: videoStream.profile || "",
      colorRange: cleanMetadata(videoStream.color_range),
      colorSpace: cleanMetadata(videoStream.color_space),
      colorTransfer: cleanMetadata(videoStream.color_transfer),
      colorPrimaries: cleanMetadata(videoStream.color_primaries),
      fieldOrder: videoStream.field_order || "",
      rotation: getRotation(videoStream)
    },
    audio: {
      count: audioStreams.length,
      bitrate: audioBitrate,
      streams: audioStreams.map((stream) => ({
        codec: stream.codec_name || "unknown",
        bitRate: Number(stream.bit_rate || 0),
        sampleRate: Number(stream.sample_rate || 0),
        channels: Number(stream.channels || 0)
      })),
      codecs: [...new Set(audioStreams.map((stream) => stream.codec_name).filter(Boolean))]
    },
    recommendations: buildRecommendations({
      width: Number(videoStream.width || 0),
      height: Number(videoStream.height || 0),
      fps,
      bitDepth,
      sourceBitrate: videoBitrate
    })
  };
}

function cleanMetadata(value) {
  if (!value || value === "unknown" || value === "reserved") return null;
  return value;
}

function getRotation(stream) {
  const sideData = stream.side_data_list || [];
  for (const item of sideData) {
    if (typeof item.rotation === "number") return item.rotation;
  }
  const rotateTag = stream.tags && stream.tags.rotate;
  return rotateTag ? Number(rotateTag) : 0;
}

function parseFrameRate(value) {
  if (!value || value === "0/0") return 0;
  const [rawNumerator, rawDenominator] = String(value).split("/");
  const numerator = Number(rawNumerator);
  const denominator = Number(rawDenominator || 1);
  if (!numerator || !denominator) return 0;
  return numerator / denominator;
}

function detectBitDepth(stream) {
  const explicit = Number(stream.bits_per_raw_sample || stream.bits_per_sample || 0);
  if (explicit > 0) return explicit;

  const pixFmt = String(stream.pix_fmt || "").toLowerCase();
  const match = pixFmt.match(/(?:p|gray|gbrp|rgba|ya)(10|12|14|16)(?:le|be)?/);
  if (match) return Number(match[1]);
  if (pixFmt.includes("p010")) return 10;
  if (pixFmt.includes("p016")) return 16;
  return 8;
}

function buildRecommendations({ width, height, fps, bitDepth, sourceBitrate }) {
  const pixels = Math.max(width * height, 640 * 360);
  const fpsFactor = Math.max(fps || 30, 24) / 30;
  const bitDepthFactor = bitDepth > 8 ? 1.18 : 1;
  const complexityFactor = 1.08;
  const baseH264 = (pixels / (1920 * 1080)) * 8.2 * fpsFactor * bitDepthFactor * complexityFactor;
  const sourceMbps = sourceBitrate ? sourceBitrate / 1_000_000 : 0;

  const h264Raw = sourceMbps
    ? {
        compact: Math.min(baseH264 * 0.55, sourceMbps * 0.62),
        balanced: Math.min(baseH264 * 0.75, sourceMbps * 0.82),
        high: Math.min(baseH264, sourceMbps * 0.98),
        master: Math.min(baseH264 * 1.16, sourceMbps * 1.05)
      }
    : {
        compact: baseH264 * 0.55,
        balanced: baseH264 * 0.75,
        high: baseH264,
        master: baseH264 * 1.16
      };

  return {
    h264: normalizeRecommendations(h264Raw, "h264", pixels, sourceMbps),
    h265: normalizeRecommendations(
      sourceMbps
        ? {
            compact: Math.min(baseH264 * 0.32, sourceMbps * 0.38),
            balanced: Math.min(baseH264 * 0.48, sourceMbps * 0.55),
            high: Math.min(baseH264 * 0.68, sourceMbps * 0.72),
            master: Math.min(baseH264 * 0.88, sourceMbps * 0.9)
          }
        : {
            compact: baseH264 * 0.32,
            balanced: baseH264 * 0.48,
            high: baseH264 * 0.68,
            master: baseH264 * 0.88
          },
      "h265",
      pixels,
      sourceMbps
    )
  };
}

function normalizeRecommendations(raw, codec, pixels, sourceMbps) {
  const baseFloor = minBitrateForResolution(pixels, codec);
  const floor = sourceMbps ? Math.min(baseFloor, sourceMbps * 0.9) : baseFloor;
  const ceiling = codec === "h265" ? 100 : 140;

  const compact = clamp(raw.compact, Math.max(0.3, floor * 0.62), ceiling);
  const balanced = clamp(Math.max(raw.balanced, compact + 0.1), floor, ceiling);
  const high = clamp(Math.max(raw.high, balanced + 0.1), floor, ceiling);
  const master = clamp(Math.max(raw.master, high + 0.1), floor, ceiling);

  return {
    compact: roundToTenth(compact),
    balanced: roundToTenth(balanced),
    high: roundToTenth(high),
    master: roundToTenth(master)
  };
}

function minBitrateForResolution(pixels, codec) {
  if (pixels >= 3840 * 2160) return codec === "h265" ? 4 : 7;
  if (pixels >= 2560 * 1440) return codec === "h265" ? 2.4 : 4.2;
  if (pixels >= 1920 * 1080) return codec === "h265" ? 1.4 : 2.4;
  if (pixels >= 1280 * 720) return codec === "h265" ? 0.8 : 1.3;
  return codec === "h265" ? 0.45 : 0.7;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hardwareCandidatesForCodec(codec) {
  if (process.platform === "darwin") {
    return codec === "h265"
      ? [{ encoder: "hevc_videotoolbox", label: "Apple VideoToolbox", vendor: "apple" }]
      : [{ encoder: "h264_videotoolbox", label: "Apple VideoToolbox", vendor: "apple" }];
  }

  if (process.platform === "win32") {
    return codec === "h265"
      ? [
          { encoder: "hevc_nvenc", label: "NVIDIA NVENC", vendor: "nvidia" },
          { encoder: "hevc_qsv", label: "Intel Quick Sync", vendor: "intel" },
          { encoder: "hevc_amf", label: "AMD AMF", vendor: "amd" }
        ]
      : [
          { encoder: "h264_nvenc", label: "NVIDIA NVENC", vendor: "nvidia" },
          { encoder: "h264_qsv", label: "Intel Quick Sync", vendor: "intel" },
          { encoder: "h264_amf", label: "AMD AMF", vendor: "amd" }
        ];
  }

  return [];
}

function selectHardwareCandidate(codec, capabilities, hardware = {}) {
  if (!hardware.enabled) return null;

  const available = capabilities.encoders[codec]?.hardware || [];
  if (!available.length) return null;

  const mode = hardware.mode || "auto";
  if (mode === "software") return null;
  if (mode === "auto") return available[0] || null;

  return available.find((candidate) => candidate.vendor === mode || candidate.encoder.includes(mode)) || null;
}

function chooseHardwarePixelFormat(sourcePixFmt, bitDepth, candidate) {
  const supported = candidate.pixelFormats || [];
  const source = String(sourcePixFmt || "").toLowerCase();

  if (bitDepth > 8) {
    if (bitDepth > 10) return { ok: false, error: `${candidate.label} 不支持保持 ${bitDepth}-bit 输出。` };
    if (candidate.encoder.includes("h264")) return { ok: false, error: `${candidate.label} 不支持 H.264 ${bitDepth}-bit 输出。` };
    if (supported.includes("cuda") && candidate.vendor === "nvidia") return { ok: true, pixelFormat: "p010le" };
    if (supported.includes("p010le")) return { ok: true, pixelFormat: "p010le" };
    if (supported.includes("yuv420p10le")) return { ok: true, pixelFormat: "yuv420p10le" };
    return { ok: false, error: `${candidate.label} 不支持保持 ${bitDepth}-bit 输出。` };
  }

  if (supported.includes("cuda") && candidate.vendor === "nvidia") return { ok: true, pixelFormat: "nv12" };
  if (supported.includes(source)) return { ok: true, pixelFormat: source };
  if (supported.includes("nv12")) return { ok: true, pixelFormat: "nv12" };
  if (supported.includes("yuv420p")) return { ok: true, pixelFormat: "yuv420p" };

  return { ok: false, error: `${candidate.label} 不支持 ${sourcePixFmt} 输出。` };
}

function startTranscode(webContents, payload) {
  const input = payload.input;
  const options = payload.options;
  const capabilities = loadCapabilities();
  const encoderConfig = ENCODERS[options.codec];
  if (!encoderConfig) throw new Error("不支持的编码器。");
  if (!input || !input.path) throw new Error("没有输入文件。");

  const outputDir = options.outputDir || input.directory;
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFormat = OUTPUT_FORMATS[options.outputFormat] ? options.outputFormat : "mp4";
  const outputPath = buildOutputPath(input.path, outputDir, options.codec, outputFormat);
  const requestedBitrateMbps = Number(options.bitrateMbps);
  if (!Number.isFinite(requestedBitrateMbps) || requestedBitrateMbps <= 0) throw new Error("码率设置无效。");

  const sourceBitrate = input.videoBitrate || input.bitrate || 0;
  const sourceBitrateMbps = sourceBitrate ? sourceBitrate / 1_000_000 : 0;
  const bitrateProtection = options.bitrateProtection === true && sourceBitrateMbps > 0;
  const effectiveBitrateMbps = bitrateProtection
    ? roundToTenth(Math.max(requestedBitrateMbps, sourceBitrateMbps))
    : requestedBitrateMbps;

  const plan = buildTranscodePlan({
    input,
    options,
    capabilities,
    outputPath,
    outputFormat,
    bitrateMbps: effectiveBitrateMbps,
    forceSoftware: false,
    hardwareDecode: "auto"
  });

  const fallbackPlans = buildFallbackPlans({
    input,
    options,
    capabilities,
    outputPath,
    outputFormat,
    bitrateMbps: effectiveBitrateMbps,
    primaryPlan: plan
  });

  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const job = {
    id: jobId,
    process: null,
    outputPath,
    input,
    options,
    requestedBitrateMbps,
    effectiveBitrateMbps,
    bitrateProtection,
    plan,
    fallbackPlans,
    fallbackAttempted: false,
    fallbackReason: "",
    cancelled: false,
    paused: false,
    startedAt: Date.now(),
    stderr: ""
  };
  jobs.set(jobId, job);
  launchJob(webContents, job);

  return {
    ok: true,
    jobId,
    outputPath,
    pixelFormat: plan.pixelFormat,
    outputFormat,
    requestedBitrateMbps,
    effectiveBitrateMbps,
    bitrateProtection,
    hardwareAccelerated: plan.hardwareAccelerated,
    encoderUsed: plan.encoder,
    encoderLabel: plan.encoderLabel,
    hardwareDecode: plan.hardwareDecode,
    decodeLabel: plan.decodeLabel,
    argsPreview: [getToolPath("ffmpeg"), ...plan.args]
  };
}

function buildFallbackPlans({ input, options, capabilities, outputPath, outputFormat, bitrateMbps, primaryPlan }) {
  if (!primaryPlan.hardwareAccelerated || options.hardware?.allowFallback === false) return [];

  const fallbacks = [];
  if (primaryPlan.hardwareDecode === "cuda") {
    fallbacks.push(
      buildTranscodePlan({
        input,
        options,
        capabilities,
        outputPath,
        outputFormat,
        bitrateMbps,
        forceSoftware: false,
        hardwareDecode: "off"
      })
    );
  }

  fallbacks.push(
    buildTranscodePlan({
      input,
      options,
      capabilities,
      outputPath,
      outputFormat,
      bitrateMbps,
      forceSoftware: true,
      hardwareDecode: "off"
    })
  );

  return fallbacks;
}

function buildTranscodePlan({ input, options, capabilities, outputPath, outputFormat, bitrateMbps, forceSoftware, hardwareDecode }) {
  const codec = options.codec;
  const hardwareCandidate = forceSoftware ? null : selectHardwareCandidate(codec, capabilities, options.hardware || {});
  let encoder = ENCODERS[codec].encoder;
  let encoderLabel = ENCODERS[codec].name;
  let hardwareAccelerated = false;
  let targetPixFmt = null;
  let selectedHardwareDecode = "off";
  let decodeLabel = "CPU decode";

  if (hardwareCandidate) {
    const hardwarePixFmt = chooseHardwarePixelFormat(input.video.pixFmt, input.video.bitDepth, hardwareCandidate);
    if (hardwarePixFmt.ok) {
      encoder = hardwareCandidate.encoder;
      encoderLabel = hardwareCandidate.label;
      hardwareAccelerated = true;
      targetPixFmt = hardwarePixFmt;
      selectedHardwareDecode = chooseHardwareDecodeMode(input, hardwareCandidate, hardwareDecode);
      decodeLabel = selectedHardwareDecode === "cuda" ? "CUDA decode" : "CPU decode";
    }
  }

  if (!targetPixFmt) {
    targetPixFmt = choosePixelFormat(input.video.pixFmt, input.video.bitDepth, codec, capabilities);
  }

  if (!targetPixFmt.ok) {
    throw new Error(targetPixFmt.error);
  }

  const args = buildFfmpegArgs({
    input,
    outputPath,
    codec,
    encoder,
    hardwareAccelerated,
    hardwareDecode: selectedHardwareDecode,
    bitrateMbps,
    encoderPreset: options.encoderPreset || "medium",
    audioMode: options.audioMode || "auto",
    pixelFormat: targetPixFmt.pixelFormat,
    outputFormat
  });

  return {
    args,
    encoder,
    encoderLabel,
    hardwareAccelerated,
    hardwareDecode: selectedHardwareDecode,
    decodeLabel,
    pixelFormat: targetPixFmt.pixelFormat
  };
}

function chooseHardwareDecodeMode(input, candidate, requestedMode) {
  if (requestedMode === "off") return "off";
  if (process.platform !== "win32" || candidate.vendor !== "nvidia") return "off";

  const codec = String(input.video?.codec || "").toLowerCase();
  const cudaDecodable = new Set(["h264", "hevc", "av1", "vp9", "mpeg2video", "vc1"]);
  return cudaDecodable.has(codec) ? "cuda" : "off";
}

function launchJob(webContents, job) {
  const child = spawn(getToolPath("ffmpeg"), job.plan.args, { windowsHide: true });
  job.process = child;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    const progress = parseProgress(chunk, job.input.duration);
    if (progress) {
      webContents.send("transcode:progress", {
        jobId: job.id,
        taskId: job.options.taskId || null,
        outputPath: job.outputPath,
        hardwareAccelerated: job.plan.hardwareAccelerated,
        encoderUsed: job.plan.encoder,
        encoderLabel: job.plan.encoderLabel,
        hardwareDecode: job.plan.hardwareDecode,
        decodeLabel: job.plan.decodeLabel,
        ...progress
      });
    }
  });

  child.stderr.on("data", (chunk) => {
    job.stderr += chunk;
    webContents.send("transcode:log", {
      jobId: job.id,
      taskId: job.options.taskId || null,
      message: chunk
    });
  });

  child.on("error", (error) => {
    jobs.delete(job.id);
    webContents.send("transcode:complete", {
      jobId: job.id,
      taskId: job.options.taskId || null,
      ok: false,
      outputPath: job.outputPath,
      error: error.message
    });
  });

  child.on("close", (code) => {
    if (job.cancelled) {
      jobs.delete(job.id);
      webContents.send("transcode:complete", {
        jobId: job.id,
        taskId: job.options.taskId || null,
        ok: false,
        cancelled: true,
        outputPath: job.outputPath,
        error: "任务已取消。"
      });
      return;
    }

    if (code !== 0) {
      const usefulError = extractUsefulError(job.stderr);
      if (job.fallbackPlans.length && shouldFallbackFromHardware(usefulError || job.stderr)) {
        cleanupFailedOutput(job.outputPath);
        job.fallbackAttempted = true;
        job.fallbackReason = usefulError || "硬件路径启动失败，已自动切换备用方案。";
        job.plan = job.fallbackPlans.shift();
        job.stderr = "";
        job.paused = false;
        webContents.send("transcode:progress", {
          jobId: job.id,
          taskId: job.options.taskId || null,
          outputPath: job.outputPath,
          percent: 0,
          hardwareFallback: true,
          encoderUsed: job.plan.encoder,
          encoderLabel: job.plan.encoderLabel,
          hardwareAccelerated: job.plan.hardwareAccelerated,
          hardwareDecode: job.plan.hardwareDecode,
          decodeLabel: job.plan.decodeLabel,
          state: "fallback"
        });
        launchJob(webContents, job);
        return;
      }

      jobs.delete(job.id);
      cleanupFailedOutput(job.outputPath);
      webContents.send("transcode:complete", {
        jobId: job.id,
        taskId: job.options.taskId || null,
        ok: false,
        outputPath: job.outputPath,
        error: usefulError || `ffmpeg 退出码：${code}`
      });
      return;
    }

    let verification = null;
    try {
      verification = verifyOutput(job.input, job.outputPath, {
        codec: job.options.codec,
        requestedBitrateMbps: job.requestedBitrateMbps,
        effectiveBitrateMbps: job.effectiveBitrateMbps,
        bitrateProtection: job.bitrateProtection,
        outputFormat: job.options.outputFormat,
        hardwareAccelerated: job.plan.hardwareAccelerated,
        encoderUsed: job.plan.encoder,
        encoderLabel: job.plan.encoderLabel,
        hardwareDecode: job.plan.hardwareDecode,
        decodeLabel: job.plan.decodeLabel,
        fallbackAttempted: job.fallbackAttempted,
        fallbackReason: job.fallbackReason
      });
    } catch (error) {
      if (job.fallbackPlans.length) {
        cleanupFailedOutput(job.outputPath);
        job.fallbackAttempted = true;
        job.fallbackReason = error.message;
        job.plan = job.fallbackPlans.shift();
        job.stderr = "";
        job.paused = false;
        webContents.send("transcode:progress", {
          jobId: job.id,
          taskId: job.options.taskId || null,
          outputPath: job.outputPath,
          percent: 0,
          hardwareFallback: true,
          encoderUsed: job.plan.encoder,
          encoderLabel: job.plan.encoderLabel,
          hardwareAccelerated: job.plan.hardwareAccelerated,
          hardwareDecode: job.plan.hardwareDecode,
          decodeLabel: job.plan.decodeLabel,
          state: "fallback"
        });
        launchJob(webContents, job);
        return;
      }

      jobs.delete(job.id);
      cleanupFailedOutput(job.outputPath);
      webContents.send("transcode:complete", {
        jobId: job.id,
        taskId: job.options.taskId || null,
        ok: false,
        outputPath: job.outputPath,
        error: error.message
      });
      return;
    }

    jobs.delete(job.id);
    webContents.send("transcode:complete", {
      jobId: job.id,
      taskId: job.options.taskId || null,
      ok: true,
      outputPath: job.outputPath,
      verification,
      elapsedMs: Date.now() - job.startedAt
    });
  });
}

function choosePixelFormat(sourcePixFmt, bitDepth, codec, capabilities) {
  const supported = capabilities.encoders[codec] ? capabilities.encoders[codec].pixelFormats : [];
  const normalized = normalizePixelFormat(sourcePixFmt, bitDepth, codec);

  if (supported.includes(normalized)) {
    return { ok: true, pixelFormat: normalized };
  }

  if (supported.includes(sourcePixFmt)) {
    return { ok: true, pixelFormat: sourcePixFmt };
  }

  const encoderName = ENCODERS[codec].encoder;
  return {
    ok: false,
    error: `${encoderName} 不支持保持 ${bitDepth}-bit 的 ${sourcePixFmt} 输出。请选择另一种编码，或安装支持该位深的 ffmpeg。`
  };
}

function normalizePixelFormat(sourcePixFmt, bitDepth, codec) {
  const pixFmt = String(sourcePixFmt || "").toLowerCase();

  if (pixFmt.includes("444")) return bitDepth > 8 ? `yuv444p${bitDepth}le` : "yuv444p";
  if (pixFmt.includes("422")) return bitDepth > 8 ? `yuv422p${bitDepth}le` : "yuv422p";
  if (pixFmt.includes("gbr")) return bitDepth > 8 ? `gbrp${bitDepth}le` : "gbrp";
  if (pixFmt.includes("gray")) return bitDepth > 8 ? `gray${bitDepth}le` : "gray";

  if (bitDepth > 8) {
    if (codec === "h264" && bitDepth > 10) return `yuv420p${bitDepth}le`;
    return `yuv420p${bitDepth}le`;
  }

  return pixFmt && pixFmt !== "unknown" && !pixFmt.includes("p010") ? pixFmt : "yuv420p";
}

function buildOutputPath(inputPath, outputDir, codec, outputFormat) {
  const parsed = path.parse(inputPath);
  const suffix = codec === "h265" ? "h265" : "h264";
  const extension = OUTPUT_FORMATS[outputFormat] ? OUTPUT_FORMATS[outputFormat].extension : "mp4";
  let candidate = path.join(outputDir, `${parsed.name}-${suffix}.${extension}`);
  removeEmptyOutput(candidate);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `${parsed.name}-${suffix}-${index}.${extension}`);
    removeEmptyOutput(candidate);
    index += 1;
  }
  return candidate;
}

function removeEmptyOutput(filePath) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
      fs.rmSync(filePath, { force: true });
    }
  } catch {
    // If cleanup is blocked, the normal numbered output fallback will keep going.
  }
}

function buildFfmpegArgs({
  input,
  outputPath,
  codec,
  encoder,
  hardwareAccelerated,
  hardwareDecode,
  bitrateMbps,
  encoderPreset,
  audioMode,
  pixelFormat,
  outputFormat
}) {
  const bitrate = `${bitrateMbps}M`;
  const maxrate = `${roundToTenth(bitrateMbps * 1.35)}M`;
  const bufsize = `${roundToTenth(bitrateMbps * 2)}M`;

  const args = [
    "-hide_banner",
    "-y",
    ...buildInputHardwareArgs(hardwareDecode),
    "-i",
    input.path,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-map_metadata",
    "0",
    "-c:v",
    encoder,
    ...buildEncoderTuningArgs(encoder, encoderPreset),
    "-b:v",
    bitrate,
    "-maxrate",
    maxrate,
    "-bufsize",
    bufsize
  ];

  if (hardwareDecode !== "cuda") {
    args.push("-pix_fmt", pixelFormat);
  }

  if (encoder === "libx265") {
    args.push("-x265-params", "log-level=error:aq-mode=3:repeat-headers=1");
  }

  const profile = getVideoProfile(codec, input.video.bitDepth, pixelFormat, encoder, hardwareAccelerated);
  if (profile) args.push("-profile:v", profile);

  if (codec === "h265" && (outputFormat === "mp4" || outputFormat === "mov")) {
    args.push("-tag:v", "hvc1");
  }

  appendColorArgs(args, input.video);

  const resolvedAudioMode = resolveAudioMode(input, outputFormat, audioMode);
  if (resolvedAudioMode === "aac") {
    args.push("-c:a", "aac", "-b:a", "192k");
  } else {
    args.push("-c:a", "copy");
  }

  if (outputFormat === "mp4" || outputFormat === "mov") {
    args.push("-movflags", "+faststart");
  }

  args.push("-progress", "pipe:1", "-nostats", outputPath);
  return args;
}

function buildEncoderTuningArgs(encoder, encoderPreset) {
  if (encoder === "libx264" || encoder === "libx265") {
    return ["-preset", encoderPreset];
  }

  if (encoder.includes("_nvenc")) {
    const presetMap = {
      slow: "p5",
      medium: "p3",
      fast: "p2",
      veryfast: "p1"
    };
    return ["-preset", presetMap[encoderPreset] || "p3", "-rc", "vbr"];
  }

  return [];
}

function buildInputHardwareArgs(hardwareDecode) {
  if (hardwareDecode === "cuda") {
    return ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda", "-extra_hw_frames", "16"];
  }

  return [];
}

function resolveAudioMode(input, outputFormat, audioMode) {
  if (audioMode === "aac") return "aac";
  if (audioMode === "copy") return "copy";
  return canCopyAudioToContainer(input, outputFormat) ? "copy" : "aac";
}

function canCopyAudioToContainer(input, outputFormat) {
  const codecs = (input.audio?.streams || [])
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

function appendColorArgs(args, video) {
  if (video.colorRange) args.push("-color_range", video.colorRange);
  if (video.colorPrimaries) args.push("-color_primaries", video.colorPrimaries);
  if (video.colorTransfer) args.push("-color_trc", video.colorTransfer);
  if (video.colorSpace) args.push("-colorspace", video.colorSpace);
}

function getVideoProfile(codec, bitDepth, pixelFormat, encoder, hardwareAccelerated) {
  if (hardwareAccelerated && encoder === "hevc_videotoolbox" && bitDepth > 8) return "main10";
  if (hardwareAccelerated && encoder === "hevc_nvenc" && bitDepth > 8) return "main10";
  if (hardwareAccelerated) return null;
  if (bitDepth <= 8) return null;

  if (codec === "h264") {
    if (pixelFormat.includes("444")) return "high444";
    if (pixelFormat.includes("422")) return "high422";
    return "high10";
  }

  if (codec === "h265" && bitDepth === 10 && pixelFormat.includes("420")) {
    return "main10";
  }

  return null;
}

function parseProgress(chunk, duration) {
  const lines = String(chunk).split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const [key, value] = line.split("=");
    if (key && value !== undefined) values[key] = value;
  }

  if (!Object.keys(values).length) return null;

  const outTimeMs = Number(values.out_time_ms || 0);
  const currentSeconds = outTimeMs / 1_000_000;
  const percent = duration ? clamp((currentSeconds / duration) * 100, 0, 100) : 0;

  return {
    percent,
    currentSeconds,
    fps: Number(values.fps || 0),
    speed: values.speed || "",
    state: values.progress || "continue"
  };
}

function shouldFallbackFromHardware(errorText) {
  return /videotoolbox|nvenc|qsv|amf|cuda|cuvid|hwaccel|hardware|device|gpu|driver|decoder|filter|pixel format|conversion|no capable devices|cannot load|initializ|unsupported|not supported/i.test(
    String(errorText || "")
  );
}

function pauseProcess(job) {
  if (!job.process || job.paused) return { ok: true };

  if (process.platform === "win32") {
    return runPowerShellProcessControl("NtSuspendProcess", job.process.pid);
  }

  try {
    job.process.kill("SIGSTOP");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function resumeProcess(job) {
  if (!job.process || !job.paused) return { ok: true };

  if (process.platform === "win32") {
    return runPowerShellProcessControl("NtResumeProcess", job.process.pid);
  }

  try {
    job.process.kill("SIGCONT");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function runPowerShellProcessControl(method, pid) {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NativeProcessControl {
  [DllImport("ntdll.dll")]
  public static extern int NtSuspendProcess(IntPtr processHandle);
  [DllImport("ntdll.dll")]
  public static extern int NtResumeProcess(IntPtr processHandle);
}
"@
$process = Get-Process -Id ${Number(pid)} -ErrorAction Stop
$result = [NativeProcessControl]::${method}($process.Handle)
if ($result -ne 0) { throw "${method} failed with code $result" }
`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    windowsHide: true
  });

  if (result.status === 0 && !result.error) return { ok: true };
  return { ok: false, error: result.error?.message || result.stderr || `${method} failed.` };
}

function verifyOutput(input, outputPath, options = {}) {
  const output = probeVideo(outputPath);
  const inputDepth = Number(input.video.bitDepth || 8);
  const outputDepth = Number(output.video.bitDepth || 8);
  const inputWidth = Number(input.video.width || 0);
  const inputHeight = Number(input.video.height || 0);
  const outputWidth = Number(output.video.width || 0);
  const outputHeight = Number(output.video.height || 0);

  if (outputDepth !== inputDepth) {
    throw new Error(`位深验证失败：源视频是 ${inputDepth}-bit，输出变成了 ${outputDepth}-bit。已阻止标记为完成。`);
  }

  if (outputWidth !== inputWidth || outputHeight !== inputHeight) {
    throw new Error(`分辨率验证失败：源视频是 ${inputWidth}×${inputHeight}，输出变成了 ${outputWidth}×${outputHeight}。已阻止标记为完成。`);
  }

  return {
    inputBitDepth: inputDepth,
    outputBitDepth: outputDepth,
    inputResolution: `${inputWidth}×${inputHeight}`,
    outputResolution: `${outputWidth}×${outputHeight}`,
    outputPixFmt: output.video.pixFmt,
    outputCodec: output.video.codec,
    outputFormat: (OUTPUT_FORMATS[options.outputFormat] ? OUTPUT_FORMATS[options.outputFormat].label : path.extname(outputPath).replace(".", "").toUpperCase()) || "MP4",
    requestedBitrateMbps: options.requestedBitrateMbps,
    targetBitrateMbps: options.effectiveBitrateMbps,
    bitrateProtection: Boolean(options.bitrateProtection),
    hardwareAccelerated: Boolean(options.hardwareAccelerated),
    encoderUsed: options.encoderUsed || output.video.codec,
    encoderLabel: options.encoderLabel || null,
    hardwareDecode: options.hardwareDecode || "off",
    decodeLabel: options.decodeLabel || null,
    fallbackAttempted: Boolean(options.fallbackAttempted),
    fallbackReason: options.fallbackReason || "",
    sourceBitrateMbps:
      input.videoBitrate || input.bitrate ? roundToTenth((input.videoBitrate || input.bitrate) / 1_000_000) : null,
    sourceAudioBitrateMbps: input.audioBitrate ? roundToTenth(input.audioBitrate / 1_000_000) : null,
    sourceSize: input.size,
    outputBitrate: output.bitrate,
    outputSize: output.size
  };
}

function cleanupFailedOutput(outputPath) {
  if (!outputPath) return;
  try {
    if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
  } catch {
    // Best effort cleanup only; the real ffmpeg error is more useful to the UI.
  }
}

function extractUsefulError(stderr) {
  const lines = String(stderr || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const ignored = new Set(["Conversion failed!"]);
  const important = [...lines].reverse().find(
    (line) =>
      !ignored.has(line) &&
      /could not find tag|could not write header|error initializing|invalid argument|not currently supported|not supported|unknown encoder|encoder.*not found|cuda|cuvid|nvenc|qsv|amf|hardware|unable|failed/i.test(
        line
      )
  );

  if (important) {
    const index = lines.indexOf(important);
    return lines
      .slice(Math.max(0, index - 1), Math.min(lines.length, index + 3))
      .filter((line) => !ignored.has(line))
      .join(" / ");
  }

  const fallback = [...lines].reverse().find((line) => !ignored.has(line));
  return fallback || lines.slice(-1)[0] || "";
}
