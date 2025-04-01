# Ventryx Deployment Guide

This document outlines the deployment process for the Ventryx application, with a focus on the Plaid integration environment configuration.

## Environment Configuration

### Development Environment

Development environment uses Plaid's sandbox environment:

```bash
# In .env.development
PLAID_ENV=sandbox
VITE_PLAID_ENV=sandbox
```

### Production Environment

Production environment uses Plaid's production environment:

```bash
# In .env.production
PLAID_ENV=production
VITE_PLAID_ENV=production
```

## Deployment Process

### Staging Deployment

For deploying to a staging environment:

1. Ensure your `.env.staging` file is properly configured with sandbox credentials
2. Run the staging deployment command:

```bash
npm run deploy:staging
```

This will:
- Build the application with staging configuration
- Deploy to a Netlify staging site
- Maintain sandbox Plaid environment for testing

### Production Deployment

For deploying to production:

1. Ensure your `.env.production` file is correctly configured with production credentials
2. Set up the required environment variables in your CI/CD or manually:

```bash
export PLAID_CLIENT_ID=your_production_plaid_client_id
export PLAID_SECRET=your_production_plaid_secret
```

3. Run the production deployment command:

```bash
npm run deploy:production
```

This will:
- Configure Firebase Functions with production Plaid credentials
- Build the application with production configuration
- Deploy the backend functions to Firebase
- Deploy the frontend to Netlify production

## Environment Variables

### Required for Deployment

- `PLAID_CLIENT_ID`: Your Plaid client ID
- `PLAID_SECRET`: Your Plaid secret
- `PLAID_ENV`: The Plaid environment (`sandbox` or `production`)
- `VITE_PLAID_ENV`: The Plaid environment for frontend code
- `NETLIFY_AUTH_TOKEN`: For automated Netlify deployments
- `NETLIFY_STAGING_SITE_ID`: For staging deployments

### Netlify Environment Variables

It's critical to set these environment variables in your Netlify site settings:

1. Go to Netlify dashboard > Your site > Site settings > Environment variables
2. Add all required `VITE_` prefixed variables including:
   - `VITE_PLAID_ENV` (set to `sandbox` for staging, `production` for production)
   - `VITE_PLAID_CLIENT_ID`
   - `VITE_PLAID_SECRET`
3. Deploy or redeploy your site after changing environment variables

## Verification Steps

After deployment, verify:

1. The correct Plaid environment is being used:
   - Check browser console logs for `Using Plaid production environment`
   - Verify backend logs show `Using Plaid environment: production`

2. Test Plaid integration:
   - In production, ensure a real bank connection works
   - Verify transactions are retrieved correctly

## Rollback Process

If issues are detected:

1. For minor issues: Deploy a hotfix
2. For major issues: Revert to the previous deployment
   - Use Netlify's deployment rollback feature
   - Revert Firebase Functions configuration:
     ```bash
     firebase functions:config:set plaid.env=sandbox
     firebase deploy --only functions
     ```

## Monitoring

Monitor for potential issues after deployment:
- Check Firebase Functions logs
- Monitor Plaid API response errors
- Set up alerts for critical error patterns 