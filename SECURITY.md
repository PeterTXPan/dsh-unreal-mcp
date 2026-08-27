# Security Policy

## Security baseline

Only the compatibility combinations explicitly listed in the README are
tested. Do not use `dsh-unreal-mcp` on an Unreal project without a verified
source-control checkpoint or equivalent recovery copy.

The Bundle connects only to loopback Unreal MCP endpoints. It does not make a
remote Unreal Editor safe to expose and it does not replace DeepSeek Harness'
generic permission, approval, context, or MCP-client security controls.

## Reporting a vulnerability

Do not open a public issue for a vulnerability, credential, private project
path, proprietary asset, or Unreal log containing sensitive data. Use the
repository's private GitHub vulnerability-reporting flow:

https://github.com/PeterTXPan/dsh-unreal-mcp/security/advisories/new

Include the affected Bundle, DSH, MCP Client, Unreal Engine, Node.js, and
operating-system versions; a minimal reproduction; impact; and whether the
problem also reproduces with a non-Unreal MCP server.

## Scope boundary

This project fixes vulnerabilities in its Unreal-specific Bundle, Skill,
context, diagnostic, and packaging code. Generic DSH context management, Agent
Loop, approval, tool scheduling, session, and MCP-client issues are documented
and reported to the applicable upstream project instead of being reimplemented
inside this Bundle.
