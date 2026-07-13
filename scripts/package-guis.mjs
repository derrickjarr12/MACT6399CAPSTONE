import { existsSync } from "node:fs";
import { appendFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const releasesDir = path.join(rootDir, "releases");

const targets = {
  "v1.2": {
    label: "gui-v1.2",
    sourceDir: path.join(rootDir, "gui")
  }
};

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command} ${args.join(" ")} (exit ${code})`));
      }
    });
  });
}

async function readPackageVersion(guiDir) {
  const packageJsonPath = path.join(guiDir, "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.version || "0.0.0";
}

function readGitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8"
  });

  if (result.status !== 0) return "unknown";
  return (result.stdout || "").trim() || "unknown";
}

async function appendReleaseHistory(entry) {
  const historyPath = path.join(releasesDir, "release-history.jsonl");
  await appendFile(historyPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function packageTarget(versionKey) {
  const target = targets[versionKey];
  if (!target) {
    throw new Error(`Unknown target version: ${versionKey}`);
  }

  if (!existsSync(target.sourceDir)) {
    throw new Error(`Source GUI path does not exist: ${target.sourceDir}`);
  }

  console.log(`\nPackaging ${target.label} from ${path.relative(rootDir, target.sourceDir)}...`);
  await run("npm", ["run", "build"], target.sourceDir);

  const sourceDist = path.join(target.sourceDir, "dist");
  if (!existsSync(sourceDist)) {
    throw new Error(`Build output not found: ${sourceDist}`);
  }

  const outputDir = path.join(releasesDir, target.label);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(sourceDist, path.join(outputDir, "dist"), { recursive: true });

  const manifest = {
    versionTag: versionKey,
    packageName: target.label,
    sourcePath: path.relative(rootDir, target.sourceDir),
    sourcePackageVersion: await readPackageVersion(target.sourceDir),
    gitCommit: readGitCommit(),
    builtAt: new Date().toISOString()
  };

  await writeFile(
    path.join(outputDir, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  await appendReleaseHistory({
    ...manifest,
    outputPath: path.relative(rootDir, outputDir)
  });

  console.log(`Created ${path.relative(rootDir, outputDir)}`);
}

async function main() {
  const selected = process.argv[2];
  const toBuild = selected ? [selected] : ["v1.2"];

  await mkdir(releasesDir, { recursive: true });

  for (const key of toBuild) {
    await packageTarget(key);
  }

  console.log("\nPackaging complete.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
