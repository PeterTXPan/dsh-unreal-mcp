import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from "@deepseek-ai/dsh-skill";

export const UNREAL_MCP_SKILL_DESCRIPTION =
  "Use for live Unreal Editor inspection or operations through the official Unreal MCP server. Trigger for levels, actors, Blueprints, widgets, materials, Niagara, Sequencer, Control Rig, GAS, Live Coding, UE assets, .uproject files, Content Browser, Outliner, UE C++ macros/types, and common asset prefixes such as BP_, WBP_, M_, MI_, NS_, CR_, SK_, SM_, and ABP_; skip purely conceptual questions and non-Unreal engines.";

export const CREATE_TOOLSET_SKILL_DESCRIPTION =
  "Use when authoring or extending an Unreal Engine Toolset registered with ToolsetRegistry and exposed through Unreal MCP. Trigger for new AI-callable C++ or Python tool methods, ToolsetRegistry registration, schemas, converters, and Toolset tests; skip invoking existing tools or authoring an Unreal Agent Skill.";

export const UNREAL_AGENT_SKILL_DESCRIPTION =
  "Use when creating, editing, or reviewing an Unreal Engine Agent Skill registered inside the Editor as a Python UAgentSkill or UAsset. This is distinct from a DSH harness Skill; skip Toolset authoring and ordinary use of an existing Unreal Skill.";

const PROVIDER_NAME = "dsh-unreal-mcp";
const INVOCATION = { modelInvocable: true, userInvocable: true } as const;

interface BundledSkillSpec {
  name: string;
  description: string;
  directory: string;
}

const SKILL_SPECS: readonly BundledSkillSpec[] = [
  {
    name: "unreal-mcp",
    description: UNREAL_MCP_SKILL_DESCRIPTION,
    directory: "unreal-mcp",
  },
  {
    name: "create-toolset",
    description: CREATE_TOOLSET_SKILL_DESCRIPTION,
    directory: "create-toolset",
  },
  {
    name: "unreal-skill",
    description: UNREAL_AGENT_SKILL_DESCRIPTION,
    directory: "unreal-skill",
  },
];

function resourceBase(spec: BundledSkillSpec) {
  return {
    kind: "directory" as const,
    path: fileURLToPath(new URL(`../skills/${spec.directory}/`, import.meta.url)),
  };
}

function skillUrl(spec: BundledSkillSpec): URL {
  return new URL(`../skills/${spec.directory}/SKILL.md`, import.meta.url);
}

const CANDIDATES: readonly SkillCandidate[] = SKILL_SPECS.map((spec) => {
  const locator = skillUrl(spec);
  return {
    name: spec.name,
    description: spec.description,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: "bundled",
    resourceBase: resourceBase(spec),
    rank: BUNDLED_SKILL_RANK,
    locator,
    path: fileURLToPath(locator),
  };
});

const SPEC_BY_NAME = new Map(SKILL_SPECS.map((spec) => [spec.name, spec]));

function removeFrontmatter(markdown: string): string {
  const normalized = markdown.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return normalized;
  const end = normalized.indexOf("\n---\n", 4);
  return end === -1 ? normalized : normalized.slice(end + 5);
}

export function createUnrealSkillProvider(): SkillProvider {
  return {
    name: PROVIDER_NAME,
    list: () => Promise.resolve([...CANDIDATES]),
    async get(candidate): Promise<SkillDefinition | undefined> {
      const spec = SPEC_BY_NAME.get(candidate.name);
      if (spec === undefined) return undefined;
      const locator = skillUrl(spec);
      return {
        name: spec.name,
        description: spec.description,
        invocation: INVOCATION,
        provider: PROVIDER_NAME,
        source: "bundled",
        resourceBase: resourceBase(spec),
        path: fileURLToPath(locator),
        content: removeFrontmatter(await readFile(locator, "utf8")),
      };
    },
  };
}
