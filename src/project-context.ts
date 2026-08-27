import {
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

export const DEFAULT_UNREAL_MCP_ENDPOINT = "http://127.0.0.1:8000/mcp";
export const DEFAULT_SEARCH_DEPTH = 64;

export interface DetectUnrealContextOptions {
  engineRoot?: string;
  maxSearchDepth?: number;
}

export interface UnrealProjectContext {
  cwd: string;
  kind: "game-project" | "engine-source";
  root: string;
  projectFile?: string;
  projectFiles: readonly string[];
  engineRoot?: string;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readDirectory(path: string): string[] {
  try {
    return readdirSync(path).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function projectFilesAt(path: string): string[] {
  return readDirectory(path)
    .filter((entry) => entry.toLowerCase().endsWith(".uproject"))
    .map((entry) => join(path, entry))
    .filter(isFile);
}

/**
 * Detect a real Unreal source checkout without accepting a bare `Engine/`
 * directory as proof. Game projects commonly contain folders named Engine,
 * so a generated-project marker or Build.version must also be present.
 */
export function isUnrealEngineSourceRoot(path: string): boolean {
  const generateProjectFiles = [
    "GenerateProjectFiles.bat",
    "GenerateProjectFiles.sh",
    "GenerateProjectFiles.command",
  ].some((entry) => isFile(join(path, entry)));
  const buildVersion = isFile(join(path, "Engine", "Build", "Build.version"));
  const sourceDirectory = isDirectory(join(path, "Engine", "Source"));

  return (generateProjectFiles && isDirectory(join(path, "Engine"))) ||
    (buildVersion && sourceDirectory);
}

function normalizeStartPath(startPath: string): string {
  const absolute = resolve(startPath);
  if (!existsSync(absolute)) return absolute;
  return isDirectory(absolute) ? absolute : dirname(absolute);
}

function validateSearchDepth(value: number | undefined): number {
  const depth = value ?? DEFAULT_SEARCH_DEPTH;
  if (!Number.isSafeInteger(depth) || depth < 1) {
    throw new Error("maxSearchDepth must be a positive safe integer");
  }
  return depth;
}

function normalizeEngineRoot(engineRoot: string | undefined): string | undefined {
  if (engineRoot === undefined || engineRoot.trim() === "") return undefined;
  const normalized = resolve(engineRoot);
  if (!isUnrealEngineSourceRoot(normalized)) {
    throw new Error(
      `Configured engineRoot is not an Unreal source root: ${normalized}`,
    );
  }
  return normalized;
}

function isWithin(child: string, parent: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function detectUnrealContext(
  startPath: string,
  options: DetectUnrealContextOptions = {},
): UnrealProjectContext | undefined {
  const cwd = normalizeStartPath(startPath);
  const maxDepth = validateSearchDepth(options.maxSearchDepth);
  const configuredEngineRoot = normalizeEngineRoot(options.engineRoot);
  let current = cwd;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const projectFiles = projectFilesAt(current);
    if (projectFiles.length > 0) {
      const projectFile = projectFiles[0]!;
      return {
        cwd,
        kind: "game-project",
        root: current,
        projectFile,
        projectFiles,
        ...(configuredEngineRoot === undefined
          ? {}
          : { engineRoot: configuredEngineRoot }),
      };
    }

    if (isUnrealEngineSourceRoot(current)) {
      return {
        cwd,
        kind: "engine-source",
        root: current,
        projectFiles: [],
        engineRoot: current,
      };
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  if (configuredEngineRoot !== undefined && isWithin(cwd, configuredEngineRoot)) {
    return {
      cwd,
      kind: "engine-source",
      root: configuredEngineRoot,
      projectFiles: [],
      engineRoot: configuredEngineRoot,
    };
  }

  return undefined;
}

export function assertLoopbackMcpEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`Invalid Unreal MCP endpoint URL: ${endpoint}`);
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname)) {
    throw new Error(
      "Unreal MCP endpoint must use plain HTTP on a loopback host " +
        "(127.0.0.1, localhost, or ::1)",
    );
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("Unreal MCP endpoint must not contain credentials");
  }
  return url;
}

export function renderUnrealContext(
  context: UnrealProjectContext,
  endpoint: string,
): string {
  const lines = [
    "<unreal_project_context>",
    `Unreal workspace detected: ${context.kind}`,
    `Workspace root: ${context.root}`,
  ];

  if (context.projectFile !== undefined) {
    lines.push(`Project descriptor: ${context.projectFile}`);
    if (context.projectFiles.length > 1) {
      lines.push(
        `${context.projectFiles.length} .uproject files found; selected ` +
          `${basename(context.projectFile)} by stable lexical order. Confirm the ` +
          "intended descriptor before project-file edits.",
      );
    }
  }
  if (context.engineRoot !== undefined) {
    lines.push(`Engine source root: ${context.engineRoot}`);
  }

  lines.push(
    `Configured DSH Unreal MCP endpoint: ${endpoint}`,
    "Prefer Unreal Engine conventions (C++/UObject patterns, Slate, and UHT reflection).",
    "For live-editor queries or changes, load the bundled `unreal-mcp` skill.",
    "The DSH Bundle owns MCP configuration; do not create Claude Code .mcp.json for DSH.",
    "</unreal_project_context>",
  );
  return lines.join("\n");
}
