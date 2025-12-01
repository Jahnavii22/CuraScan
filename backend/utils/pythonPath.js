import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

let cachedPython = null;

function sanitizePath(candidate) {
  if (!candidate) return "";
  const trimmed = candidate.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^['"]+/, "").replace(/['"]+$/, "");
}

function venvPythonPath(venvRoot) {
  if (!venvRoot) return "";
  const bin = process.platform === "win32" ? "Scripts" : "bin";
  const exe = process.platform === "win32" ? "python.exe" : "python3";
  return path.join(venvRoot, bin, exe);
}

function pyLaunchers() {
  if (process.platform !== "win32") return [];
  const results = [];
  const programDirs = [
    path.join(process.env["ProgramFiles"] || "C:\\Program Files"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"),
    path.join(process.env.USERPROFILE || "", "AppData", "Local", "Programs"),
  ].filter((dir) => !!dir && fs.existsSync(dir));

  for (const dir of programDirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^python/i.test(entry.name)) continue;
      const exe = path.join(dir, entry.name, "python.exe");
      if (fs.existsSync(exe)) results.push(exe);
    }
  }

  return results;
}

function candidateList() {
  const candidates = [];

  const pushCandidate = (label, candidate) => {
    const sanitized = sanitizePath(candidate);
    if (!sanitized) return;
    candidates.push({ label, candidate: sanitized });
  };

  pushCandidate("PYTHON_PATH", process.env.PYTHON_PATH);
  pushCandidate("VIRTUAL_ENV", venvPythonPath(process.env.VIRTUAL_ENV));

  const searchDirs = [];
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    searchDirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const root of searchDirs) {
    const possible = venvPythonPath(path.join(root, ".venv"));
    pushCandidate(`auto(.venv:${root})`, possible);
  }

  if (process.platform === "win32") {
    for (const discovered of pyLaunchers()) {
      pushCandidate("system-discover", discovered);
    }
    pushCandidate("PATH", "py");
  }

  pushCandidate("PATH", process.platform === "win32" ? "python.exe" : "python3");
  pushCandidate("PATH", "python");

  return candidates;
}

function interpreterWorks(executable) {
  try {
    const result = spawnSync(executable, ["--version"], {
      encoding: "utf8",
      stdio: "ignore",
      timeout: 3000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function getPythonPath() {
  if (cachedPython && fs.existsSync(cachedPython)) {
    return cachedPython;
  }

  const checked = new Set();

  for (const { label, candidate } of candidateList()) {
    const resolved = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(process.cwd(), candidate);

    if (checked.has(resolved)) continue;
    checked.add(resolved);

    const exists = resolved.includes(path.sep)
      ? fs.existsSync(resolved)
      : true;

    if (!exists) {
      if (label === "PYTHON_PATH" || label === "VIRTUAL_ENV") {
        console.warn(
          `⚠️  ${label} points to missing interpreter (${resolved}), trying fallback locations`
        );
      }
      continue;
    }

    if (!interpreterWorks(resolved)) {
      console.warn(
        `⚠️  Interpreter ${resolved} could not start, skipping this candidate`
      );
      continue;
    }

    cachedPython = resolved;
    if (!label.startsWith("auto")) {
      console.log(`ℹ️  Using Python from ${label}: ${resolved}`);
    }
    return resolved;
  }

  console.warn(
    "⚠️  No valid Python interpreter found; please install Python 3.10+ and/or update PYTHON_PATH"
  );
  return process.platform === "win32" ? "python" : "python3";
}

