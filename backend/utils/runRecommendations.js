import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export function runRecommendations(pythonPath, scriptPath, tests, opts = {}) {
  return new Promise((resolve, reject) => {
    const tmpDir = opts.tmpDir || os.tmpdir();
    const tmpName = `recommend_${Date.now()}_${Math.floor(Math.random() * 10000)}.json`;
    const tmpPath = path.join(tmpDir, tmpName);

    try {
      fs.writeFileSync(tmpPath, JSON.stringify(tests, null, 2), "utf-8");
    } catch (err) {
      return reject(err);
    }

    const args = [path.resolve(scriptPath), tmpPath];

    const envVars = {
      ...process.env,
      ...(opts.envExtra || {}),
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    };

    const child = spawn(pythonPath, args, {
      env: envVars,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      try { fs.unlinkSync(tmpPath); } catch {}
      reject(err);
    });

    child.on("close", (code) => {
      try { fs.unlinkSync(tmpPath); } catch {}
      if (code !== 0) {
        return reject(new Error(stderr || `recommendations exited with code ${code}`));
      }

      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      try {
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(
          new Error(
            `Failed to parse Gemini output: ${e.message}\n--- STDOUT ---\n${stdout}\n--- STDERR ---\n${stderr}`
          )
        );
      }
    });
  });
}
