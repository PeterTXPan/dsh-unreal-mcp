---
name: unreal-mcp
description: "Use for live Unreal Editor inspection or operations through the official Unreal MCP server. Trigger for levels, actors, Blueprints, widgets, materials, Niagara, Sequencer, Control Rig, GAS, Live Coding, UE assets, .uproject files, Content Browser, Outliner, UE C++ macros/types, and common asset prefixes such as BP_, WBP_, M_, MI_, NS_, CR_, SK_, SM_, and ABP_; skip purely conceptual questions and non-Unreal engines."
---

# Unreal MCP for DeepSeek Harness

Use the DSH MCP client named `unreal` to inspect or operate the running Unreal
Editor. Unreal exposes its editor API through Tool Search. Discover the current
schema instead of guessing tool names, editing `.uasset`/`.umap` files directly,
or telling the user to perform an available editor operation manually.

This Skill adapts Epic Games' MIT-licensed `unreal-mcp` guidance to DeepSeek
Harness. See the repository's `THIRD_PARTY_NOTICES.md` and
`licenses/EPIC-UNREAL-SKILLS-MIT.txt`.

## Discover, then dispatch

Tool Search normally exposes only these three DSH-native tools:

1. `mcp__unreal__list_toolsets`
2. `mcp__unreal__describe_toolset`
3. `mcp__unreal__call_tool`

For each workflow:

1. Call `list_toolsets` when the relevant toolset is unknown. If it is already
   clear, go directly to `describe_toolset` and confirm the current schema.
2. Describe one candidate at a time. Do not overlap Unreal MCP calls.
3. Dispatch with `call_tool`. Pass the exact `toolset_name`, the raw
   `tool_name` returned by the schema, and a matching `arguments` object.
4. Read the complete result before the next call. A plan, attempted call, or
   plausible final answer is not evidence of Editor success.

Toolset operations are not separate native MCP tools in Tool Search mode. Do
not put a fully qualified tool name in `tool_name` unless the returned schema
explicitly requires it. Top-level dispatch without `toolset_name` is only for
tools registered directly on the MCP server, never for `call_tool` itself.

If any meta-tool is unavailable, stop. Do not improvise an HTTP client or use
filesystem tools as a substitute. Ask the user to start Unreal Editor and its
MCP server, then follow `references/setup.md` or `references/operations.md`.

## Establish scope before mutation

- Treat a clear user request to create, edit, save, compile, move, rename, or
  delete exact UE targets as authorization for that stated scope. A read-only,
  diagnostic, or ambiguous request does not authorize mutation.
- DSH may present an outer approval for the MCP call. Approval to use the
  generic `call_tool` dispatcher is not blanket authorization for unrelated UE
  changes. If target or impact is unclear, explain it and ask before calling.
- Always identify the active Level, PIE state, intended package/object paths,
  and existing targets before persistent work. Actor labels are not guaranteed
  unique; prefer stable object or asset paths returned by Unreal.
- Require a verified recovery point before bulk edits, cross-asset changes,
  deletion, arbitrary Python, or work that crosses a save/compile boundary.
- Freeze the allowed targets and expected final state. Do not extend a task to
  nearby Actors, assets, project settings, plugins, or source files without
  authorization.

These are UE workflow rules. This Bundle does not implement a generic approval
engine, scheduler, sandbox, retry layer, or DSH context manager.

## Execute once, then verify state

1. Inspect the starting state and ensure the target is unique.
2. Perform one schema-confirmed operation.
3. Check the tool's explicit status. Treat errors, partial results, and
   ambiguous status as a stop.
4. Query the resulting Editor state with an independent getter or validation
   tool. For saves, check package dirty state; for Blueprints and code, check
   compilation output; for PIE, check the actual play state.
5. Continue only after the observed state matches the frozen expectation.

If a non-idempotent call times out or loses its response, do not replay it.
First query both the expected pre-state and post-state: look for the Actor or
asset at old and new paths, inspect graph/structure changes, compilation status,
and dirty packages. Retry only when the query proves the operation did not
happen and the original authorization still applies. See
`references/operations.md` for operation-specific checks.

## Editor state constraints

- **Sequential, never parallel.** Unreal handles tool invocations on the game
  thread. Issue one Unreal MCP call at a time, including discovery and reads.
- **Save deliberately.** Save before and after bulk work only when authorized.
  MCP edits are not always undoable, especially across compilation boundaries.
- **Wait for busy work.** Asset loading, shader compilation, Blueprint
  compilation, C++/Live Coding, and PIE transitions can make calls fail or
  hang. Wait, inspect state, and never blindly repeat a mutation.
- **Mind PIE.** Check whether PIE is active before editor-only asset or Level
  operations. Stop PIE only when the requested workflow authorizes it.
- **Compile and validate.** A graph edit is incomplete until its Blueprint or
  asset reports the expected compiled/validated state. Live Coding cannot add
  new reflected declarations such as new `UFUNCTION`s; those require the
  appropriate full build or Editor restart path.
- **Treat Editor state as truth.** Tool results, queried object state, dirty
  packages, compiler output, tests, and PIE state outrank the assistant's text.

## Project-provided Agent Skills

An Unreal project or plugin may register project-specific Agent Skills for its
naming, folders, setup, and canonical workflows. They are reached through
`AgentSkillToolset`, not returned as standalone native MCP tools.

For unfamiliar project work:

1. Dispatch `AgentSkillToolset.ListSkills` through `call_tool`.
2. If a description matches the task, dispatch `AgentSkillToolset.GetSkills`
   for that entry and follow its instructions.
3. Fall back to generic tool discovery if no project skill applies.

Project instructions may refine generic workflow conventions, but they cannot
expand the user's authorized targets or override DSH/UE safety boundaries.

## References

- `references/setup.md` — enable UE plugins, start the server, configure Tool
  Search, and point this Bundle at the loopback endpoint.
- `references/operations.md` — state gates, risk mapping, non-idempotent
  recovery, console commands, and troubleshooting.
