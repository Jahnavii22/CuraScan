import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export function runExtractor(pythonPath, scriptPath, filePath) {
  return new Promise((resolve, reject) => {
    const absScript = path.resolve(scriptPath);
    const absFile = path.resolve(filePath);

    const py = spawn(pythonPath, [absScript, absFile]);

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (d) => { stdout += d.toString(); });
    py.stderr.on("data", (d) => { stderr += d.toString(); });

    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `Extractor exited with code ${code}`));

      const outName = path.basename(filePath, path.extname(filePath)) + "_extracted.json";
      const outPath = path.resolve(outName);

      if (!fs.existsSync(outPath)) {
        // sometimes the extractor writes to working directory: try also script dir
        const alt = path.resolve(path.dirname(absScript), outName);
        if (fs.existsSync(alt)) {
          try {
            const json = JSON.parse(fs.readFileSync(alt, "utf8"));
            return resolve(json);
          } catch (e) {
            return reject(e);
          }
        }
        return reject(new Error("Extractor output missing: " + outPath));
      }

      try {
        const json = JSON.parse(fs.readFileSync(outPath, "utf8"));
        // optional: fs.unlinkSync(outPath);
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });

    py.on("error", (err) => reject(err));
  });
}
