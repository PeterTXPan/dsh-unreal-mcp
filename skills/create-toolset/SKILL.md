---
name: create-toolset
description: "Use when authoring or extending an Unreal Engine Toolset registered with ToolsetRegistry and exposed through Unreal MCP. Trigger for new AI-callable C++ or Python tool methods, ToolsetRegistry registration, schemas, converters, and Toolset tests; skip invoking existing tools or authoring an Unreal Agent Skill."
---

# Create Toolset

Author or extend an Unreal Engine Toolset: a collection of static, AI-callable
functions registered with `ToolsetRegistry` and exposed through Unreal MCP.
Use `unreal-mcp` instead when the task only invokes tools that already exist.

## Establish scope

Before editing code:

1. Confirm the exact project, plugin, module, and allowed files. Do not modify an
   installed Engine checkout or enable project settings without explicit user
   authorization.
2. If the Editor is connected, use Tool Search to inspect existing Toolsets. If
   it is not connected, search nearby `Toolsets` folders and read relevant
   headers or Python modules. Do not add functionality that is already exposed.
3. Decide whether the capability is general. Prefer an existing generic
   Toolset—such as `AssetTools` or `ObjectTools`—over a domain-specific duplicate.
4. Add to an existing Toolset when its domain already fits. Create a new
   Toolset or plugin only when ownership is distinct; ask the user when that
   placement decision is not clear.
5. Compare Python and C++ API coverage, explain the tradeoff, and let the user
   choose when either is viable.

## Design contract

A good Toolset is:

- **Clean:** expose the smallest useful API rather than mirroring a complex UE
  subsystem directly.
- **Complete:** provide sensible create/read/update/delete symmetry. Read-only
  getters are fine when mutation is not meaningful.
- **Composable:** use consistent real UE types so results from one tool can feed
  another without string parsing.
- **Non-duplicative:** reuse generic Toolsets and shared helpers.

All exposed methods must be static. Use real parameter and return types rather
than JSON encoded inside strings. A normal return communicates success; an
exception or UE script error communicates failure. Do not use boolean returns,
error strings, or result wrappers merely as status channels. Async UE result
objects are the exception because they explicitly represent eventual success or
failure.

Document the Toolset domain, every tool, parameters, return meaning, units,
ranges, encodings, and empty/null semantics that cannot be inferred from the
signature. Remove descriptions that only repeat names, types, defaults, or
obvious call order. Use `UPROPERTY` metadata for machine-readable constraints.

Every tool requires a success-path test and coverage for each explicit error
condition. Do not declare the Toolset complete from schema discovery alone.

## Choose an implementation

Prefer Python when all required APIs appear in
`<project>/Intermediate/PythonStub/unreal.py`; search the stubs narrowly rather
than loading the entire file. If stubs are missing, tell the user that generating
them requires enabling Python Developer Mode and restarting the Editor—do not
change that setting silently. Choose C++ when Python coverage is materially
insufficient. Stop and report the gap if neither surface exposes the required
API rather than inventing a fragile workaround.

- For C++ declarations, registration, async results, converters, and errors,
  read [references/cpp.md](references/cpp.md).
- For Python decorators, registration, reload, and errors, read
  [references/python.md](references/python.md).
- Before implementing tests or reporting completion, read
  [references/testing.md](references/testing.md).

## Handoff

Report the Toolset and plugin changed, language chosen, AI-callable methods,
registration path, tests run, actual MCP discovery result when available, and
any restart/reload requirement. Keep UE runtime mutations within the user's
explicit authorization and follow the `unreal-mcp` Skill when using live Editor
tools for verification.
