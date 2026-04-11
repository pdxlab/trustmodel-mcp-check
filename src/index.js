const core = require('@actions/core');
const https = require('https');

// Known MCP server scores (bundled for offline/no-API-key usage)
// Full list at https://trustmodel.ai/mcp-servers
const KNOWN_SCORES = {
  "filesystem": { score: 5.3, tier: "Use With Caution" },
  "git": { score: 5.2, tier: "Use With Caution" },
  "fetch": { score: 7.8, tier: "Generally Safe" },
  "memory": { score: 6.8, tier: "Generally Safe" },
  "sequential-thinking": { score: 8.0, tier: "Highly Trusted" },
  "time": { score: 8.0, tier: "Highly Trusted" },
  "aws": { score: 4.2, tier: "Use With Caution" },
  "azure": { score: 4.2, tier: "Use With Caution" },
  "firebase": { score: 4.5, tier: "Use With Caution" },
  "cloudflare": { score: 4.5, tier: "Use With Caution" },
  "terraform": { score: 2.9, tier: "High Risk" },
  "kubernetes": { score: 2.9, tier: "High Risk" },
  "github": { score: 5.3, tier: "Use With Caution" },
  "gitlab": { score: 5.3, tier: "Use With Caution" },
  "postgresql": { score: 6.5, tier: "Generally Safe" },
  "supabase": { score: 4.8, tier: "Use With Caution" },
  "mongodb": { score: 4.8, tier: "Use With Caution" },
  "clickhouse": { score: 7.6, tier: "Generally Safe" },
  "neon": { score: 5.9, tier: "Use With Caution" },
  "elasticsearch": { score: 5.9, tier: "Use With Caution" },
  "redis": { score: 5.9, tier: "Use With Caution" },
  "sqlite": { score: 5.9, tier: "Use With Caution" },
  "slack": { score: 4.1, tier: "Use With Caution" },
  "stripe": { score: 4.5, tier: "Use With Caution" },
  "cashfree": { score: 2.6, tier: "High Risk" },
  "flutterwave": { score: 2.6, tier: "High Risk" },
  "alpaca": { score: 2.6, tier: "High Risk" },
  "brave-search": { score: 7.8, tier: "Generally Safe" },
  "exa": { score: 7.2, tier: "Generally Safe" },
  "firecrawl": { score: 7.2, tier: "Generally Safe" },
  "puppeteer": { score: 6.8, tier: "Generally Safe" },
  "crowdstrike-falcon": { score: 4.5, tier: "Use With Caution" },
  "burp-suite": { score: 4.5, tier: "Use With Caution" },
  "databricks": { score: 5.9, tier: "Use With Caution" },
  "snowflake": { score: 7.6, tier: "Generally Safe" },
  "sentry": { score: 7.6, tier: "Generally Safe" },
  "grafana": { score: 7.6, tier: "Generally Safe" },
  "salesforce": { score: 5.6, tier: "Use With Caution" },
  "hubspot": { score: 5.6, tier: "Use With Caution" },
  "google-drive": { score: 6.2, tier: "Generally Safe" },
  "notion": { score: 5.6, tier: "Use With Caution" },
  "auth0": { score: 4.1, tier: "Use With Caution" },
  "atlassian": { score: 5.6, tier: "Use With Caution" },
  "docker": { score: 4.2, tier: "Use With Caution" },
  "daytona": { score: 5.6, tier: "Use With Caution" },
  "e2b": { score: 5.6, tier: "Use With Caution" },
};

function normalizeServerName(input) {
  // Handle GitHub URLs
  let name = input.trim().toLowerCase();
  if (name.includes('github.com/')) {
    // Extract repo name from URL
    const parts = name.split('/');
    name = parts[parts.length - 1] || parts[parts.length - 2];
  }
  // Remove common prefixes/suffixes
  name = name.replace(/^mcp-server-/, '').replace(/-mcp-server$/, '').replace(/-mcp$/, '').replace(/^mcp-/, '');
  return name;
}

function getScore(serverName) {
  const normalized = normalizeServerName(serverName);

  // Check known scores
  if (KNOWN_SCORES[normalized]) {
    return { name: serverName, normalized, ...KNOWN_SCORES[normalized], source: "trustmodel-database" };
  }

  // Unknown server — return warning
  return { name: serverName, normalized, score: null, tier: "Unknown", source: "not-found" };
}

function tierEmoji(tier) {
  switch (tier) {
    case "Highly Trusted": return "🟢";
    case "Generally Safe": return "🟡";
    case "Use With Caution": return "🟠";
    case "High Risk": return "🔴";
    case "Critical Risk": return "⛔";
    default: return "❓";
  }
}

async function run() {
  try {
    const serversInput = core.getInput('servers');
    const minScore = parseFloat(core.getInput('min-score'));
    const failOnHighRisk = core.getInput('fail-on-high-risk') === 'true';

    const servers = serversInput.split(',').map(s => s.trim()).filter(Boolean);

    if (servers.length === 0) {
      core.setFailed('No servers specified. Provide a comma-separated list of MCP server names.');
      return;
    }

    core.info(`🔍 Checking TrustScore for ${servers.length} MCP server(s)...`);
    core.info(`   Minimum required score: ${minScore}`);
    core.info(`   Fail on High Risk: ${failOnHighRisk}`);
    core.info('');

    const results = [];
    let allPassed = true;
    let summaryLines = [];

    for (const server of servers) {
      const result = getScore(server);
      results.push(result);

      if (result.score === null) {
        core.warning(`${tierEmoji("Unknown")} ${server}: Not in TrustModel database. Evaluate at https://trustmodel.ai/mcp-servers`);
        summaryLines.push(`❓ ${server}: Unknown (not yet evaluated)`);
        continue;
      }

      const emoji = tierEmoji(result.tier);
      const passed = result.score >= minScore;
      const highRisk = result.tier === "High Risk" || result.tier === "Critical Risk";

      if (passed && !(failOnHighRisk && highRisk)) {
        core.info(`${emoji} ${server}: ${result.score}/10 (${result.tier}) ✓ PASS`);
        summaryLines.push(`${emoji} ${server}: ${result.score}/10 (${result.tier}) ✓`);
      } else {
        allPassed = false;
        core.error(`${emoji} ${server}: ${result.score}/10 (${result.tier}) ✗ FAIL — below minimum ${minScore}`);
        summaryLines.push(`${emoji} ${server}: ${result.score}/10 (${result.tier}) ✗ BLOCKED`);
      }
    }

    core.info('');
    core.info('───────────────────────────────────────');
    core.info(`Results: ${results.filter(r => r.score >= minScore).length}/${results.filter(r => r.score !== null).length} passed`);
    core.info('Full rankings: https://trustmodel.ai/mcp-servers');
    core.info('───────────────────────────────────────');

    // Set outputs
    core.setOutput('results', JSON.stringify(results));
    core.setOutput('passed', allPassed.toString());
    core.setOutput('summary', summaryLines.join('\n'));

    // Write job summary
    let summary = `## 🛡️ MCP Trust Check Results\n\n`;
    summary += `| Server | TrustScore | Tier | Status |\n|---|---|---|---|\n`;
    for (const r of results) {
      const status = r.score === null ? '❓ Unknown' : (r.score >= minScore ? '✓ Pass' : '✗ Fail');
      summary += `| ${r.name} | ${r.score || 'N/A'} | ${r.tier} | ${status} |\n`;
    }
    summary += `\n*Minimum required: ${minScore} | [Full rankings](https://trustmodel.ai/mcp-servers)*\n`;
    core.summary.addRaw(summary).write();

    if (!allPassed) {
      core.setFailed(
        `One or more MCP servers failed the trust check. ` +
        `Minimum score: ${minScore}. See https://trustmodel.ai/mcp-servers for details.`
      );
    }

  } catch (error) {
    core.setFailed(`TrustModel MCP check failed: ${error.message}`);
  }
}

run();
