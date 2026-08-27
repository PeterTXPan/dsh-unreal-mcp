import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import * as bundle from "../dist/index.js";

test("Cordis load and unload own both bundled skill and UE context", async () => {
  const root = new Context();
  await root.plugin(SkillRegistry, {});
  await root.plugin(SystemPrompt, {});

  const projectRoot = await mkdtemp(join(tmpdir(), "dsh-unreal-lifecycle-"));
  await writeFile(join(projectRoot, "Lifecycle.uproject"), "{}\n");

  const fiber = await root.plugin(bundle, {
    endpoint: "http://127.0.0.1:8000/mcp",
  });
  const listed = await root.skills.list({ cwd: projectRoot });
  const bundleSkillNames = listed
    .filter((skill) => skill.provider === "dsh-unreal-mcp")
    .map((skill) => skill.name)
    .sort();
  assert.deepEqual(bundleSkillNames, ["create-toolset", "unreal-mcp", "unreal-skill"]);
  for (const name of bundleSkillNames) {
    assert.ok((await root.skills.get(name, { cwd: projectRoot }))?.content);
  }

  const assembled = await root.systemPrompt.assemble({
    agent: { session: { header: { cwd: projectRoot } } },
  });
  assert.ok(assembled.contexts.some((entry) =>
    entry.name === "dsh-unreal-mcp:project" &&
      entry.text.includes("Lifecycle.uproject") &&
      entry.text.includes("http://127.0.0.1:8000/mcp") &&
      entry.text.includes("C++/UObject patterns")
  ));

  const unrelated = await mkdtemp(join(tmpdir(), "dsh-unreal-unrelated-"));
  const unrelatedAssembly = await root.systemPrompt.assemble({
    agent: { session: { header: { cwd: unrelated } } },
  });
  assert.equal(
    unrelatedAssembly.contexts.find((entry) =>
      entry.name === "dsh-unreal-mcp:project"
    )?.text,
    "",
  );

  await fiber.dispose();
  assert.equal(
    (await root.skills.list({ cwd: projectRoot })).some((skill) =>
      skill.provider === "dsh-unreal-mcp"
    ),
    false,
  );
  assert.equal(
    (await root.systemPrompt.assemble({})).contexts.some((entry) =>
      entry.name === "dsh-unreal-mcp:project"
    ),
    false,
  );

  await root.fiber.dispose();
});

test("Cordis plugin can reload without duplicate skill or context contributions", async () => {
  const root = new Context();
  await root.plugin(SkillRegistry, {});
  await root.plugin(SystemPrompt, {});
  const projectRoot = await mkdtemp(join(tmpdir(), "dsh-unreal-reload-"));
  await writeFile(join(projectRoot, "Reload.uproject"), "{}\n");

  const first = await root.plugin(bundle, { endpoint: "http://localhost:8000/mcp" });
  await first.dispose();
  const second = await root.plugin(bundle, { endpoint: "http://127.0.0.1:8000/mcp" });

  const skills = await root.skills.list({ cwd: projectRoot });
  assert.deepEqual(
    skills.filter((skill) => skill.provider === "dsh-unreal-mcp")
      .map((skill) => skill.name)
      .sort(),
    ["create-toolset", "unreal-mcp", "unreal-skill"],
  );
  const assembled = await root.systemPrompt.assemble({
    agent: { session: { header: { cwd: projectRoot } } },
  });
  const contexts = assembled.contexts.filter((entry) =>
    entry.name === "dsh-unreal-mcp:project"
  );
  assert.equal(contexts.length, 1);
  assert.match(contexts[0].text, /127\.0\.0\.1:8000/);
  assert.doesNotMatch(contexts[0].text, /localhost:8000/);

  await second.dispose();
  await root.fiber.dispose();
});
