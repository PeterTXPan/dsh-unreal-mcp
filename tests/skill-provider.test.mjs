import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";
import {
  CREATE_TOOLSET_SKILL_DESCRIPTION,
  UNREAL_AGENT_SKILL_DESCRIPTION,
  UNREAL_MCP_SKILL_DESCRIPTION,
  createUnrealSkillProvider,
} from "../dist/skill-provider.js";

const expected = new Map([
  ["unreal-mcp", UNREAL_MCP_SKILL_DESCRIPTION],
  ["create-toolset", CREATE_TOOLSET_SKILL_DESCRIPTION],
  ["unreal-skill", UNREAL_AGENT_SKILL_DESCRIPTION],
]);

test("bundled skill provider lists and loads all Unreal skills", async () => {
  const provider = createUnrealSkillProvider();
  const candidates = await provider.list({});
  assert.equal(Array.isArray(candidates), true);
  assert.deepEqual(candidates.map((candidate) => candidate.name), [
    "unreal-mcp",
    "create-toolset",
    "unreal-skill",
  ]);

  for (const candidate of candidates) {
    const skill = await provider.get(candidate, {});
    assert.equal(skill?.name, candidate.name);
    assert.equal(skill?.provider, "dsh-unreal-mcp");
    assert.equal(skill?.description, expected.get(candidate.name));
    assert.doesNotMatch(skill?.content ?? "", /^---/);
    assert.ok((skill?.content.length ?? 0) > 500);
    assert.equal(basename(skill?.resourceBase?.path ?? ""), candidate.name);

    const markdown = await readFile(join(skill.resourceBase.path, "SKILL.md"), "utf8");
    const frontmatterDescription = markdown.match(/^description: "(.*)"$/m)?.[1];
    assert.equal(frontmatterDescription, expected.get(candidate.name));
  }

  const unrealMcp = await provider.get(candidates[0], {});
  assert.match(unrealMcp?.content ?? "", /Sequential, never parallel/);
  assert.match(unrealMcp?.content ?? "", /Execute once, then verify state/);
  assert.match(unrealMcp?.content ?? "", /AgentSkillToolset\.ListSkills/);

  const skill = unrealMcp;
  const resourceRoot = skill?.resourceBase?.path;
  assert.equal(typeof resourceRoot, "string");
  await stat(join(resourceRoot, "references", "setup.md"));
  await stat(join(resourceRoot, "references", "operations.md"));

  assert.equal(await provider.get({ name: "missing-skill" }, {}), undefined);
});
