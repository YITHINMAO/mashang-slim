const { spawnSync } = require("node:child_process");

for (const tool of ["ffmpeg", "ffprobe"]) {
  const result = spawnSync(tool, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`${tool} is not available on PATH.`);
    process.exit(1);
  }

  const firstLine = (result.stdout || "").split("\n")[0];
  console.log(firstLine);
}

console.log("Runtime check passed.");
