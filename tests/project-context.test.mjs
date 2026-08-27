import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertLoopbackMcpEndpoint,
  detectUnrealContext,
  renderUnrealContext,
} from "../dist/project-context.js";

test("finds a .uproject from a nested project directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-unreal-project-"));
  await writeFile(join(root, "Example.uproject"), "{}\n");
  const nested = join(root, "Source", "Example", "Private");
  await mkdir(nested, { recursive: true });

  const detected = detectUnrealContext(nested);
  assert.equal(detected?.kind, "game-project");
  assert.equal(detected?.root, root);
  assert.equal(detected?.projectFile, join(root, "Example.uproject"));
});

test("finds a .uproject when the session cwd is a file", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-unreal-project-file-"));
  await writeFile(join(root, "FileStart.uproject"), "{}\n");
  const sourceFile = join(root, "Source", "FileStart", "FileStart.cpp");
  await mkdir(join(root, "Source", "FileStart"), { recursive: true });
  await writeFile(sourceFile, "// test\n");

  const detected = detectUnrealContext(sourceFile);
  assert.equal(detected?.projectFile, join(root, "FileStart.uproject"));
  assert.equal(detected?.cwd, join(root, "Source", "FileStart"));
});

test("selects multiple .uproject files deterministically and reports all candidates", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-unreal-multi-project-"));
  await writeFile(join(root, "Zulu.uproject"), "{}\n");
  await writeFile(join(root, "AProject.uproject"), "{}\n");

  const detected = detectUnrealContext(root);
  assert.equal(detected?.projectFile, join(root, "AProject.uproject"));
  assert.deepEqual(detected?.projectFiles, [
    join(root, "AProject.uproject"),
    join(root, "Zulu.uproject"),
  ]);
  assert.match(
    renderUnrealContext(detected, "http://127.0.0.1:8000/mcp"),
    /2 \.uproject files found; selected AProject\.uproject.*Confirm the intended descriptor/,
  );
});

test("does not treat a bare Engine directory as an engine source checkout", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-unreal-false-positive-"));
  const nested = join(root, "Engine", "Notes");
  await mkdir(nested, { recursive: true });
  assert.equal(detectUnrealContext(nested), undefined);
});

test("detects an Unreal engine source root using reliable markers", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-unreal-engine-"));
  const nested = join(root, "Engine", "Source", "Runtime");
  await mkdir(join(root, "Engine", "Build"), { recursive: true });
  await mkdir(nested, { recursive: true });
  await writeFile(join(root, "Engine", "Build", "Build.version"), "{}\n");

  const detected = detectUnrealContext(nested);
  assert.equal(detected?.kind, "engine-source");
  assert.equal(detected?.engineRoot, root);
});

test("validates a configured Unreal engine root", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "dsh-unreal-configured-project-"));
  await writeFile(join(projectRoot, "Configured.uproject"), "{}\n");
  const engineRoot = await mkdtemp(join(tmpdir(), "dsh-unreal-configured-engine-"));
  await mkdir(join(engineRoot, "Engine", "Build"), { recursive: true });
  await mkdir(join(engineRoot, "Engine", "Source"), { recursive: true });
  await writeFile(join(engineRoot, "Engine", "Build", "Build.version"), "{}\n");

  const detected = detectUnrealContext(projectRoot, { engineRoot });
  assert.equal(detected?.engineRoot, engineRoot);
  assert.throws(() => detectUnrealContext(projectRoot, { engineRoot: projectRoot }));
});

test("accepts only loopback HTTP endpoints", () => {
  assert.equal(assertLoopbackMcpEndpoint("http://127.0.0.1:8000/mcp").port, "8000");
  assert.equal(assertLoopbackMcpEndpoint("http://localhost:8000/custom-mcp").pathname, "/custom-mcp");
  assert.equal(assertLoopbackMcpEndpoint("http://[::1]:8000/mcp").hostname, "[::1]");
  assert.throws(() => assertLoopbackMcpEndpoint("https://example.com/mcp"));
  assert.throws(() => assertLoopbackMcpEndpoint("http://192.168.1.2:8000/mcp"));
  assert.throws(() => assertLoopbackMcpEndpoint("http://user:secret@127.0.0.1:8000/mcp"));
});

test("renders a short skill-routing context", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-unreal-render-"));
  const projectFile = join(root, "Render.uproject");
  await writeFile(projectFile, "{}\n");
  const detected = detectUnrealContext(root);
  assert.ok(detected);
  const text = renderUnrealContext(detected, "http://127.0.0.1:8000/mcp");
  assert.match(text, /Render\.uproject/);
  assert.match(text, /load the bundled `unreal-mcp` skill/);
  assert.match(text, /C\+\+\/UObject patterns, Slate, and UHT reflection/);
  assert.match(text, /Bundle owns MCP configuration/);
  assert.doesNotMatch(text, /Session cwd:/);
  assert.ok(text.length < 1_200);
});
