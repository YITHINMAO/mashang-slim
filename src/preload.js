const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("transcoder", {
  getEnvironment: () => ipcRenderer.invoke("app:getEnvironment"),
  selectVideos: () => ipcRenderer.invoke("dialog:selectVideos"),
  selectFolders: () => ipcRenderer.invoke("dialog:selectFolders"),
  selectOutputDir: () => ipcRenderer.invoke("dialog:selectOutputDir"),
  expandPaths: (paths) => ipcRenderer.invoke("paths:expand", paths),
  probeVideo: (filePath) => ipcRenderer.invoke("video:probe", filePath),
  startTranscode: (payload) => ipcRenderer.invoke("transcode:start", payload),
  cancelTranscode: (jobId) => ipcRenderer.invoke("transcode:cancel", jobId),
  pauseTranscode: (jobId) => ipcRenderer.invoke("transcode:pause", jobId),
  resumeTranscode: (jobId) => ipcRenderer.invoke("transcode:resume", jobId),
  revealFile: (filePath) => ipcRenderer.invoke("file:reveal", filePath),
  openExternal: (url) => ipcRenderer.invoke("link:openExternal", url),
  onProgress: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("transcode:progress", listener);
    return () => ipcRenderer.removeListener("transcode:progress", listener);
  },
  onLog: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("transcode:log", listener);
    return () => ipcRenderer.removeListener("transcode:log", listener);
  },
  onComplete: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("transcode:complete", listener);
    return () => ipcRenderer.removeListener("transcode:complete", listener);
  }
});
