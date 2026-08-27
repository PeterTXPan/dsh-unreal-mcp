import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "dsh-unreal-mcp-package-"));
const packDirectory = join(temporaryRoot, "pack");
const installDirectory = join(temporaryRoot, "install");
const cacheDirectory = join(temporaryRoot, "npm-cache");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const sourceManifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
const peerPackages = Object.entries(sourceManifest.peerDependencies ?? {}).map(
  ([name, version]) => `${name}@${version}`,
);
const installedRuntimeSmoke = `
const { Context } = await import("@deepseek-ai/cordis");
const { default: SkillRegistry } = await import("@deepseek-ai/dsh-skill");
const { default: SystemPrompt } = await import("@deepseek-ai/dsh-system-prompt");
const bundle = await import("dsh-unreal-mcp");
const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
const { tmpdir } = await import("node:os");
const { join } = await import("node:path");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const root = new Context();
const projectRoot = await mkdtemp(join(tmpdir(), "dsh-unreal-installed-runtime-"));
let fiber;
try {
  await writeFile(join(projectRoot, "Packaged.uproject"), "{}\\n");
  await root.plugin(SkillRegistry, {});
  await root.plugin(SystemPrompt, {});
  fiber = await root.plugin(bundle, { endpoint: "http://127.0.0.1:8000/mcp" });

  const skills = await root.skills.list({ cwd: projectRoot });
  const expectedSkillNames = ["create-toolset", "unreal-mcp", "unreal-skill"];
  const installedSkillNames = skills
    .filter((skill) => skill.provider === "dsh-unreal-mcp")
    .map((skill) => skill.name)
    .sort();
  assert(JSON.stringify(installedSkillNames) === JSON.stringify(expectedSkillNames),
    "installed Bundle did not register all three Unreal Skills");
  for (const name of expectedSkillNames) {
    const skill = await root.skills.get(name, { cwd: projectRoot });
    assert((skill?.content.length ?? 0) > 500,
      \`installed Bundle returned incomplete \${name} Skill content\`);
    assert(skill?.resourceBase?.path.includes(\`node_modules/dsh-unreal-mcp/skills/\${name}\`),
      \`installed \${name} resource base does not point into the tarball\`);
  }

  const assembled = await root.systemPrompt.assemble({
    agent: { session: { header: { cwd: projectRoot } } },
  });
  const context = assembled.contexts.find((entry) =>
    entry.name === "dsh-unreal-mcp:project"
  );
  assert(context?.text.includes("Packaged.uproject"),
    "installed Bundle did not inject the packaged project context");
  assert(context?.text.includes("http://127.0.0.1:8000/mcp"),
    "installed project context did not use the configured endpoint");

  await fiber.dispose();
  fiber = undefined;
  assert(!(await root.skills.list({ cwd: projectRoot })).some((skill) =>
    skill.provider === "dsh-unreal-mcp"
  ), "installed Skills remained after Bundle disposal");
  assert(!(await root.systemPrompt.assemble({})).contexts.some((entry) =>
    entry.name === "dsh-unreal-mcp:project"
  ), "installed project context remained after Bundle disposal");
} finally {
  if (fiber !== undefined) await fiber.dispose();
  await root.fiber.dispose();
  await rm(projectRoot, { recursive: true, force: true });
}
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error !== undefined || result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed${output === "" ? "" : `:\n${output}`}`,
      { cause: result.error },
    );
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  mkdirSync(packDirectory, { recursive: true });
  mkdirSync(installDirectory, { recursive: true });

  const packed = run(
    npmCommand,
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--silent",
      "--pack-destination",
      packDirectory,
      "--cache",
      cacheDirectory,
    ],
    { cwd: repositoryRoot },
  );
  const packResults = JSON.parse(packed.stdout);
  assert(Array.isArray(packResults) && packResults.length === 1, "npm pack returned no package");
  const [packResult] = packResults;
  const packagedPaths = packResult.files.map((file) => file.path).sort();
  const requiredPaths = [
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    "cordis.patch.yml",
    "dist/diagnose.js",
    "dist/index.d.ts",
    "dist/index.js",
    "dist/project-context.js",
    "dist/skill-provider.js",
    "licenses/EPIC-UNREAL-SKILLS-MIT.txt",
    "package.json",
    "skills/create-toolset/SKILL.md",
    "skills/create-toolset/references/cpp.md",
    "skills/create-toolset/references/python.md",
    "skills/create-toolset/references/testing.md",
    "skills/unreal-mcp/SKILL.md",
    "skills/unreal-mcp/references/operations.md",
    "skills/unreal-mcp/references/setup.md",
    "skills/unreal-skill/SKILL.md",
  ];
  for (const requiredPath of requiredPaths) {
    assert(packagedPaths.includes(requiredPath), `package is missing ${requiredPath}`);
  }

  const allowedFiles = new Set([
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    "cordis.patch.yml",
    "package.json",
  ]);
  const allowedPrefixes = ["dist/", "licenses/", "skills/"];
  const unexpectedPaths = packagedPaths.filter(
    (path) => !allowedFiles.has(path) && !allowedPrefixes.some((prefix) => path.startsWith(prefix)),
  );
  assert(unexpectedPaths.length === 0, `package has unexpected files: ${unexpectedPaths.join(", ")}`);

  const diagnosticEntry = packResult.files.find((file) => file.path === "dist/diagnose.js");
  assert(diagnosticEntry !== undefined, "package is missing the diagnostic entry");
  if (process.platform !== "win32") {
    assert((diagnosticEntry.mode & 0o111) !== 0, "packaged diagnostic is not executable");
  }

  const tarballPath = join(packDirectory, packResult.filename);
  assert(existsSync(tarballPath), `npm pack did not create ${tarballPath}`);
  writeFileSync(
    join(installDirectory, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      cacheDirectory,
      tarballPath,
      ...peerPackages,
    ],
    { cwd: installDirectory },
  );

  const installedRoot = join(installDirectory, "node_modules", "dsh-unreal-mcp");
  const installedManifest = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  assert(
    installedManifest.bin?.["dsh-unreal-mcp-diagnose"] === "dist/diagnose.js",
    "published manifest lost the diagnostic bin entry",
  );
  const installedBin = join(
    installDirectory,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "dsh-unreal-mcp-diagnose.cmd" : "dsh-unreal-mcp-diagnose",
  );
  assert(existsSync(installedBin), "npm install did not create the diagnostic bin link");

  run(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      installedRuntimeSmoke,
    ],
    { cwd: installDirectory },
  );

  console.log(
    `[PASS] package allowlist, executable bin, clean install, Skill/context lifecycle ` +
      `(${packagedPaths.length} files)`,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
