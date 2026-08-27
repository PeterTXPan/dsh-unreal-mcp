---
name: unreal-skill
description: "Use when creating, editing, or reviewing an Unreal Engine Agent Skill registered inside the Editor as a Python UAgentSkill or UAsset. This is distinct from a DSH harness Skill; skip Toolset authoring and ordinary use of an existing Unreal Skill."
---

# Unreal Skill

Author or review an Unreal Engine Agent Skill: reusable instructions registered
inside the UE Editor. This is not a DSH Skill stored in this Bundle. Use
`create-toolset` for new callable Toolsets and `unreal-mcp` when merely invoking
an existing UE Skill or Editor tool.

## Principles

A useful UE Agent Skill is:

- **Novel:** teach durable knowledge the agent cannot discover from tool schemas
  or direct state inspection.
- **Collegial:** brief a knowledgeable UE colleague rather than reproducing a
  manual.
- **Flexible:** prescribe order only where UE correctness or safety requires it.
- **Durable:** avoid volatile property and tool names when discovery can provide
  them at runtime.
- **Harness-agnostic:** do not mention DSH, Claude Code, model names, or agent
  wiring inside the UE Skill payload.
- **Parsimonious:** justify every token added to the agent context.

## Before writing

1. Use Unreal MCP Tool Search to discover the Agent Skill Toolset and its current
   schema. List registered UE Skills and inspect relevant ones before creating a
   duplicate.
2. Confirm the exact project/plugin and obtain authorization before creating or
   modifying Python files, Content Browser assets, plugin registration, or
   Editor settings.
3. Choose the implementation based on ownership:
   - **Python `UAgentSkill`:** code-plugin guidance that belongs in version
     control and loads with the plugin.
   - **UAsset Skill:** project-specific guidance stored in Content and managed
     through the live Editor.

## Skill contract

Each UE Agent Skill has a concise discovery description and an instruction
payload. The description must let an agent decide when the Skill applies without
loading the body. Instructions should contain only non-obvious, reusable
guidance and assume the agent will discover current Toolsets and schemas at
runtime.

## Python Skills

Define a subclass of `unreal.AgentSkill`, decorate it with the agent-skill
decorator supplied by ToolsetRegistry, use the class docstring as the discovery
description, and place the instruction payload in its `instructions` class
attribute.

```python
import unreal
from toolset_registry.agent_skill import agent_skill

_INSTRUCTIONS = (
    "Do X before Y because Z.\n"
    "Verify the resulting Editor state after the operation.\n"
)

@agent_skill
class MySkill(unreal.AgentSkill):
    """Guidance for X workflows in Unreal Engine."""

    instructions = _INSTRUCTIONS
```

Follow the plugin's existing import path: Skill modules normally live under a
`skills` package imported by `init_unreal.py`. They register on import. After an
authorized edit, reload the owning Python package before verification. Enabling
Python Remote Execution is a separate security-sensitive setting and must not
be changed silently.

## UAsset Skills

Use the current Agent Skill Toolset schema discovered through MCP. For creation,
provide an authorized Content folder, PascalCase asset name, short description,
and instructions. For updates, target the exact existing Skill object path.
Never guess a path or repeat a timed-out create/update call: first query the
Editor to determine whether the intended Skill already exists and what content
it contains.

## Review and verification

Query the saved or registered Skill through the Agent Skill Toolset, then read
its description and instructions together as the agent will receive them.
Verify:

- the description routes only relevant tasks;
- instructions add knowledge unavailable from tools;
- the payload contains no harness-specific assumptions;
- no volatile tool catalog is embedded;
- the correct Python class or UAsset path is registered;
- only explicitly authorized files/assets changed and intended packages were
  saved.

Report the implementation path, registered name/path, reload or save result,
verification query, and any changes the user still needs to persist.
