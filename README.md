# dsh-unreal-mcp

Unofficial DeepSeek Harness Bundle for Unreal Engine 5.8's official Unreal MCP
server.

The Bundle is a thin UE adapter. It reuses Unreal's
`ModelContextProtocol`, `ToolsetRegistry`, and `AllToolsets`, and mounts the MCP
Client already supplied by DeepSeek Harness. It does not include Unreal Engine
code, add a UE `.uplugin`, fork DSH, or implement a general-purpose MCP client.

## Scope

This project aims to bring DSH's **UE adapter capabilities** toward the same
practical boundary as Epic's Claude Code integration:

```text
Claude Code + Epic UE plugin  ->  Unreal MCP server
DSH + dsh-unreal-mcp          ->  Unreal MCP server
```

It owns Bundle packaging, Unreal endpoint configuration, `.uproject` and UE
source context, Unreal Skills, read-only diagnostics, UE workflow coverage, and
adapter-level compatibility evidence.

It does not own DSH's general context management, Agent Loop, model behavior,
sessions, approvals, tool scheduling, retries, or the generic MCP protocol
implementation. A problem reproducible with a non-Unreal MCP server should be
reduced and reported upstream instead of fixed here as UE-specific behavior.

## Capabilities

The Bundle provides:

- a Cordis plugin managed by DSH's load/unload lifecycle;
- three bundled Unreal Skills registered through `ctx.skills`;
- per-session `.uproject` and UE source-tree detection;
- concise Unreal context routed through `ctx.systemPrompt.context()`;
- one loopback-only endpoint setting shared by the context and MCP Client row;
- a read-only diagnostic for connection, Tool Search, and ToolsetRegistry;
- DSH-specific adaptations of Epic's MIT-licensed Unreal Skill guidance.

The bundled Skills are:

- `unreal-mcp` for discovering and invoking existing Unreal Editor Toolsets;
- `create-toolset` for authoring AI-callable C++ or Python Toolsets;
- `unreal-skill` for authoring UE Agent Skills registered inside the Editor.

The last item is distinct from a DSH harness Skill: it guides creation of
`UAgentSkill` classes or project-specific Skill assets managed by Unreal.

Repository tests cover the package, Skill, context, endpoint validation, and
plugin lifecycle. Unreal MCP has editor-level privileges, so mutating tasks must
use a disposable project with a tested recovery point and retain matching tool
results and final Editor state as evidence.

## Prerequisites

- Unreal Engine 5.8 with `ModelContextProtocol` and `AllToolsets` enabled
- DeepSeek Harness with Bundle and plugin APIs compatible with 0.1.1-rc.2
- Node.js 20 or newer and pnpm available to `dsh plugin`
- a disposable Unreal test project

The recorded compatibility configuration is UE 5.8.1, DSH 0.1.1-rc.2,
`@deepseek-ai/dsh-mcp-client` 0.1.1-rc.2, Node.js 20/22/24, and macOS arm64.

## Build and verify

```bash
npm ci
npm run check
```

`npm run check` compiles `dist/`, runs the Bundle tests, checks the package
allowlist and executable bit, installs the generated tarball into a clean npm
project, and exercises the installed Skill/context lifecycle.

## Install into a DSH Profile

From a built checkout:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-unreal-mcp
```

For a reviewed tarball:

```bash
npm pack
dsh plugin --profile web add /absolute/path/to/dsh-unreal-mcp-0.1.0.tgz
```

From npm:

```bash
dsh plugin --profile web add dsh-unreal-mcp
```

One DSH command installs the Bundle layer. Its Cordis patch loads this package
and configures DSH's in-box `@deepseek-ai/dsh-mcp-client` for the Unreal MCP
endpoint; users do not copy a Skill or edit DSH source.

An npm tarball contains prebuilt `dist/` and installs without running project
code. A direct GitHub install builds through `prepare`; pnpm 10+ may require the
user to allow that package build explicitly, so releases should prefer npm or a
reviewed tarball.

## Connect Unreal

Enable `ModelContextProtocol` and `AllToolsets`, then run this in the Unreal
Editor console:

```text
ModelContextProtocol.StartServer 8000
```

A successful Output Log contains:

```text
Created new HttpListener on 127.0.0.1:8000
```

Start DSH from the Unreal project directory:

```bash
dsh --profile web
```

The configured endpoint is `http://127.0.0.1:8000/mcp`. An optional
`DSH_UNREAL_MCP_TIMEOUT_MS` changes the MCP call timeout. Source engine
checkouts can provide `DSH_UNREAL_ENGINE_ROOT`; game projects are found by
walking upward from each session's working directory.

See [setup.md](skills/unreal-mcp/references/setup.md) for persistent startup and
[operations.md](skills/unreal-mcp/references/operations.md) for troubleshooting.

## Diagnose the live connection

```bash
npm run diagnose -- --endpoint=http://127.0.0.1:8000/mcp \
  --cwd="/absolute/path/to/MyGame/Content"
```

The diagnostic is read-only. It performs MCP initialization, verifies
`list_toolsets`/`describe_toolset`/`call_tool`, and confirms Unreal returns a
non-empty toolset catalog. It reports separate errors for a missing project,
an unreachable endpoint, missing Tool Search meta-tools, and an empty catalog.

## Uninstall

```bash
dsh plugin --profile web remove dsh-unreal-mcp
```

The Bundle plugin, its context and Skill provider, and its configured MCP row
are removed from that Profile together.

## Safety and evidence

Unreal MCP has editor-level privileges and some toolsets can execute Python.
The bundled Skill tells the agent to issue UE calls sequentially, require
explicit user authorization before mutations, and inspect UE state before
retrying a non-idempotent operation. Enforcement remains the responsibility of
DSH and the execution environment; this Bundle does not add a generic approval,
scheduler, sandbox, or retry subsystem.

A final answer is not proof by itself: release claims require matching Unreal
tool results and final Editor state.

## Security

Report vulnerabilities according to [SECURITY.md](SECURITY.md).

## License

Project-original code and documentation are MIT licensed. Adapted Epic Skill
material retains Epic's MIT notice in
[EPIC-UNREAL-SKILLS-MIT.txt](licenses/EPIC-UNREAL-SKILLS-MIT.txt). Unreal Engine
and its plugins remain governed by Epic's applicable terms. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
