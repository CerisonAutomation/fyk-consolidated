# Vercel Deployment Patterns

> Source: https://vercel.com/docs/deployments/overview

## Deployment Methods

### 1. Git Integration (Recommended)

Connect your Git repository for automatic deployments on every push and pull request.

**Supported providers:** GitHub, GitLab, Bitbucket, Azure DevOps

```bash
# Import a repo via Vercel CLI
vercel --prod
```

- Push to any branch triggers a **preview deployment**
- Push/merge to `main` triggers a **production deployment**
- Each deployment gets a unique URL for previewing changes

### 2. Vercel CLI

```bash
# Install
npm i -g vercel

# Initial deployment (links to project and creates production deployment)
vercel --prod

# Deploy a specific preview
vercel deploy

# Roll back to a previous deployment
vercel rollback
```

The CLI creates a `.vercel` directory storing Project and Organization IDs.

### 3. Deploy Hooks

Trigger deployments via HTTP without a new commit:

- Go to Project Settings > Deploy Hooks
- Create a hook to get a unique URL
- Make an HTTP GET/POST request to that URL

### 4. Vercel REST API

For custom workflows, multi-tenant apps, or third-party integrations:

1. Generate a SHA for each file
2. Upload files to Vercel
3. Send a request to create a new deployment with file references

## Environments

| Environment | Purpose | URL Pattern |
|---|---|---|
| **Local** | Development and testing | `localhost:3000` |
| **Preview** | QA, collaboration, testing | `project-name-abc123.vercel.app` |
| **Production** | Live, user-facing site | `yourdomain.com` |

## Managing Deployments

From the Vercel Dashboard:

- **Redeploy:** Re-run the build for a specific commit
- **Inspect:** View logs and build outputs
- **Assign Custom Domain:** Point domains to any deployment
- **Promote to Production:** Convert a preview to production

## Best Practices

### Environment Variables

```bash
# Set environment variables per environment
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development
```

### Monorepo Deployments

```json
// vercel.json
{
  "buildCommand": "cd apps/web && npm run build",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs"
}
```

### Preview Deployment Verification

```bash
# Deploy preview
vercel deploy

# Verify the preview URL
curl https://your-preview-url.vercel.app

# Check deployment logs
vercel logs --deployment <deployment-id> --level error
```

### Production Deployment

```bash
# Deploy to production
vercel deploy --prod
```

## Quick Start Checklist

1. Connect Git repository (or use CLI)
2. Configure environment variables per environment
3. Set up custom domains in Project Settings
4. Enable deploy notifications for team awareness
5. Use preview deployments for PR reviews
6. Set up rollback procedures for incidents
