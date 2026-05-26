const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip";
const cacheDir = path.join(root, "vendor", "cache");
const zipPath = path.join(cacheDir, "ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip");
const extractDir = path.join(cacheDir, "ffmpeg-win64");
const outDir = path.join(root, "vendor", "ffmpeg", "win32-x64");

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(zipPath)) {
  run("curl", ["-L", "--fail", "--show-error", "-o", zipPath, url]);
}

fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });
run("unzip", ["-q", zipPath, "-d", extractDir]);

const rootFolder = fs
  .readdirSync(extractDir, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.startsWith("ffmpeg-"));

if (!rootFolder) {
  throw new Error("Could not find extracted ffmpeg folder.");
}

const extractedRoot = path.join(extractDir, rootFolder.name);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of fs.readdirSync(path.join(extractedRoot, "bin"))) {
  fs.copyFileSync(path.join(extractedRoot, "bin", entry), path.join(outDir, entry));
}

for (const name of ["LICENSE.txt", "README.txt"]) {
  const source = path.join(extractedRoot, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(outDir, name));
}

console.log(`Windows ffmpeg binaries are ready in ${outDir}`);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
