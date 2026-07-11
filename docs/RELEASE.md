# Release Guide

Step-by-step instructions for publishing ContextOptimizer to npm, PyPI, and Docker.

## Prerequisites (one-time, manual)

These steps require your npm/PyPI/GitHub accounts. They cannot be automated from the repo.

### 1. Create the npm organization

1. Go to [npmjs.com](https://www.npmjs.com/) and sign in
2. Create organization: **@contextoptimizer**
3. Add your GitHub account as owner

### 2. Claim package names

Before first publish, verify these names are available on npm:

| Package | Purpose |
|---------|---------|
| `@contextoptimizer/mcp` | **Primary** — MCP server for Cursor |
| `@contextoptimizer/cli` | `omni` CLI |
| `@contextoptimizer/api` | REST API server |
| `@contextoptimizer/engine` | Core engine |
| `@contextoptimizer/sdk-ts` | TypeScript SDK |
| (+ 15 internal packages) | Pulled in as dependencies |

On PyPI, claim: **contextoptimizer**

### 3. Create API tokens

**npm**

1. npm → Access Tokens → Generate New Token
2. Type: **Publish** (or Granular with publish access to `@contextoptimizer/*`)
3. Copy the token

**PyPI**

1. PyPI → Account Settings → API tokens
2. Scope: entire account (first publish) or project `contextoptimizer`
3. Copy the token

### 4. Add GitHub secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `NPM_TOKEN` | npm publish token |
| `PYPI_TOKEN` | PyPI token (`pypi-...`) |

`GITHUB_TOKEN` is provided automatically for Docker publishes to `ghcr.io`.

---

## Versioning

All npm packages are **fixed** at the same version via changesets (currently **1.0.0**).

The Python SDK (`contextoptimizer`) is versioned separately in `packages/sdk-python/pyproject.toml` — keep it aligned with npm releases.

---

## Release process

### 1. Prepare metadata and build

```bash
pnpm install
node scripts/sync-publish-metadata.mjs   # if package.json metadata changed
pnpm build
pnpm test
pnpm lint
```

### 2. Dry-run npm publish (optional)

```bash
node scripts/npm-publish-dry-run.mjs
```

### 3. Version bump (if using changesets)

```bash
# Add a changeset when making user-facing changes:
pnpm changeset

# Bump versions + changelogs:
pnpm changeset version

# Commit the version bump
git add .
git commit -m "chore: version packages"
```

For the initial 1.0.0 release, `.changeset/v1-release.md` is already configured.

### 4. Verify workspace deps (dev vs publish)

During development, internal deps use `workspace:*` — this is correct for pnpm workspaces.

At **publish time**, `pnpm changeset publish` calls `pnpm publish -r`, which automatically replaces `workspace:*` with the published semver (e.g. `^1.0.0`). You do not need to manually edit these.

To verify publish readiness:

```bash
pnpm publish:dry-run
```

### 5. Create GitHub Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Then on GitHub: **Releases → Draft a new release**

- Tag: `v1.0.0`
- Title: `v1.0.0`
- Publish release

This triggers:

| Workflow | Publishes |
|----------|-----------|
| `publish-npm.yml` | All `@contextoptimizer/*` packages via `pnpm changeset publish` |
| `publish-pypi.yml` | `contextoptimizer` Python SDK |
| `publish-docker.yml` | `ghcr.io/<repo>/api` Docker image |

---

## Test published MCP package locally

After first publish (or before, using `npm pack`):

```bash
cd apps/mcp-server
pnpm build
npm pack
# Creates contextoptimizer-mcp-1.0.0.tgz

# Test install
cd /tmp/test-mcp
npm init -y
npm install /path/to/contextoptimizer-mcp-1.0.0.tgz

# Run
REPO_PATH=/path/to/your/project npx contextoptimizer-mcp
```

Or after publish:

```bash
REPO_PATH=/path/to/your/project npx -y @contextoptimizer/mcp
```

---

## User-facing install (post-publish)

**MCP (recommended)**

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "npx",
      "args": ["-y", "@contextoptimizer/mcp"],
      "env": {
        "REPO_PATH": "/absolute/path/to/your/project"
      }
    }
  }
}
```

**CLI**

```bash
npm install -g @contextoptimizer/cli
omni index
```

**Python SDK**

```bash
pip install contextoptimizer
# Requires a running API: npm install -g @contextoptimizer/api
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `402 Payment Required` on npm | Create `@contextoptimizer` org or use `--access public` |
| `workspace:*` in published package | Run `pnpm changeset version` before publish |
| MCP not found on npm | Ensure `@contextoptimizer/mcp` is in changesets fixed group |
| PyPI name taken | Choose alternate name or request transfer |
| `NPM_TOKEN` invalid | Regenerate token with publish scope |
