import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type {} from "@deepseek-ai/dsh-agent";
import type { AssembleContext } from "@deepseek-ai/dsh-system-prompt";
import {
  DEFAULT_SEARCH_DEPTH,
  DEFAULT_UNREAL_MCP_ENDPOINT,
  assertLoopbackMcpEndpoint,
  detectUnrealContext,
  renderUnrealContext,
} from "./project-context.js";
import { createUnrealSkillProvider } from "./skill-provider.js";

export interface Config {
  endpoint?: string;
  engineRoot?: string;
  maxSearchDepth?: number;
}

export const Config = z.object({
  endpoint: z.string().default(DEFAULT_UNREAL_MCP_ENDPOINT),
  engineRoot: z.string().required(false),
  maxSearchDepth: z.number().step(1).min(1).default(DEFAULT_SEARCH_DEPTH),
});

export const name = "dsh-unreal-mcp";
export const inject = ["skills", "systemPrompt"];

function assemblyCwd(context: AssembleContext): string {
  return context.agent?.session.header.cwd ?? process.cwd();
}

export function apply(ctx: Context, config: Config = {}): void {
  const endpoint = config.endpoint ?? DEFAULT_UNREAL_MCP_ENDPOINT;
  assertLoopbackMcpEndpoint(endpoint);

  ctx.skills.registerProvider(() => createUnrealSkillProvider());
  ctx.systemPrompt.context({
    name: "dsh-unreal-mcp:project",
    order: 50,
    text(assembly) {
      const detected = detectUnrealContext(assemblyCwd(assembly), {
        ...(config.engineRoot === undefined ? {} : { engineRoot: config.engineRoot }),
        maxSearchDepth: config.maxSearchDepth ?? DEFAULT_SEARCH_DEPTH,
      });
      return detected === undefined
        ? ""
        : renderUnrealContext(detected, endpoint);
    },
  });
}

export {
  DEFAULT_SEARCH_DEPTH,
  DEFAULT_UNREAL_MCP_ENDPOINT,
  assertLoopbackMcpEndpoint,
  detectUnrealContext,
  renderUnrealContext,
} from "./project-context.js";
export { createUnrealSkillProvider } from "./skill-provider.js";
