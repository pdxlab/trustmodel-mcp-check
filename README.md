# TrustModel MCP Trust Check

GitHub Action that checks TrustScore of MCP servers before allowing AI agent connections. Block high-risk servers in CI/CD.

[![TrustScore](https://trustmodel.ai/badge/mcp-trust-badge.svg)](https://trustmodel.ai/mcp-servers)

## Usage

```yaml
name: MCP Trust Gate
on: [push, pull_request]

jobs:
  trust-check:
    runs-on: ubuntu-latest
    steps:
      - uses: pdxlab/trustmodel-mcp-check@v1
        with:
          servers: "stripe, github, slack, postgresql"
          min-score: "6.0"
          fail-on-high-risk: "true"
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `servers` | Yes | — | Comma-separated MCP server names or GitHub URLs |
| `min-score` | No | `6.0` | Minimum TrustScore (0-10) to pass |
| `fail-on-high-risk` | No | `true` | Fail if any server is High Risk or Critical |
| `api-key` | No | — | TrustModel API key (public scores work without key) |

## Outputs

| Output | Description |
|---|---|
| `results` | JSON array of server scores |
| `passed` | `true` if all servers meet minimum score |
| `summary` | Human-readable summary |

## Example Output

```
🔍 Checking TrustScore for 4 MCP server(s)...
   Minimum required score: 6.0
   Fail on High Risk: true

🟡 stripe: 4.5/10 (Use With Caution) ✗ FAIL — below minimum 6.0
🟡 github: 5.3/10 (Use With Caution) ✗ FAIL — below minimum 6.0
🟠 slack: 4.1/10 (Use With Caution) ✗ FAIL — below minimum 6.0
🟡 postgresql: 6.5/10 (Generally Safe) ✓ PASS

Results: 1/4 passed
Full rankings: https://trustmodel.ai/mcp-servers
```

## How Scores Are Calculated

Each MCP server is evaluated across 10 security dimensions:

1. **Tool Safety** (15%) — Can tools cause irreversible harm?
2. **Input Validation** (15%) — SQL injection, path traversal, command injection via tool args
3. **Permission Scope** (12%) — Least privilege? Read-only available?
4. **Auth Security** (10%) — Credential storage, rotation, scoping
5. **Audit Trail** (10%) — All operations logged with context?
6. **Data Sensitivity** (10%) — PII/PHI/financial data flowing through?
7. **Rate Limiting** (8%) — Resource exhaustion protection?
8. **Network Isolation** (8%) — SSRF protection? Internal access blocked?
9. **Output Validation** (7%) — Prompt injection filtering?
10. **Rollback** (5%) — Can operations be undone?

Full methodology and rankings: [trustmodel.ai/mcp-servers](https://trustmodel.ai/mcp-servers)

## Use Cases

### Block risky servers in enterprise CI
```yaml
- uses: pdxlab/trustmodel-mcp-check@v1
  with:
    servers: "stripe, aws, kubernetes"
    min-score: "7.0"        # Enterprise threshold
    fail-on-high-risk: "true"
```

### Audit all MCP servers in your agent config
```yaml
- uses: pdxlab/trustmodel-mcp-check@v1
  with:
    servers: "github, slack, postgresql, notion, salesforce"
    min-score: "5.0"        # Lower threshold, just flag risks
    fail-on-high-risk: "false"
```

### Check before merging new MCP server additions
```yaml
on:
  pull_request:
    paths:
      - 'mcp-config.json'
      - '.claude/settings.json'
jobs:
  trust-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: pdxlab/trustmodel-mcp-check@v1
        with:
          servers: "new-server-from-pr"
          min-score: "6.0"
```

## Links

- [Full MCP Server Rankings](https://trustmodel.ai/mcp-servers)
- [TrustModel Platform](https://trustmodel.ai)
- [Evaluation Methodology](https://trustmodel.ai/mcp-servers#methodology)
- [Get Your MCP Server Evaluated](https://trustmodel.ai/contact)

## License

MIT
