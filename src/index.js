import fs from 'fs';
import yaml from 'js-yaml';
import { getOrgTokens, getOrgToken } from './modules/helperFunctions.js';
import { syncSafeSettingConfig } from './modules/syncOrgRepoContent.js';
import { env } from 'process';
import { Octokit } from '@octokit/rest'; 

let orgTokens

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default async (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  // ---------------------------------------------------------------------------

  // Parse YAML string to object
  const yamlString = fs.readFileSync('./src/org-info.yml', 'utf8');
  app.log.debug('YAML String:', yamlString);
  // Load YAML data and get organization tokens
  const yamlData = yaml.load(yamlString);
  app.log.debug('Parsed YAML Data:', yamlData);

  // ---------------------------------------------------------------------------

  app.on('pull_request.closed', async (context) => {
    app.log.info('Pull request closed event received');
    const baseSettingsPath = env.GITHUB_SAFE_SETTINGS_PATH || '.github/safe-settings/organizations'; // base folder
    try {
      const pr = context.payload.pull_request;
      const { owner, repo } = context.repo();
      const pull_number = pr.number;
  
      // Paginate through all files changed in the PR
      const files = await context.octokit.paginate(
        context.octokit.rest.pulls.listFiles,
        { owner, repo, pull_number, per_page: 100 }
      );
        // Normalize baseSettingsPath (remove trailing slash if any)
      const normalizedBase = baseSettingsPath.replace(/\/$/, '');
      app.log.debug(`Normalized base path: ${normalizedBase}`);
      
      // Escape string for use in RegExp
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Build a RegExp that captures the first path segment after the base path
      const basePattern = new RegExp(`^${escapeRegex(normalizedBase)}/([^/]+)(?:/|$)`);
      app.log.debug(`Base pattern for org matching: ${basePattern}`);

      // Collect unique org names
      const orgNamesSet = new Set();
      files.forEach(f => {
        const m = f.filename.match(basePattern);
        if (m && m[1]) {
          orgNamesSet.add(m[1]);
        }
      });

      const orgNames = Array.from(orgNamesSet); // e.g. ['jester-lab', 'jefeish']
      app.log.info(`Orgs updated in PR #${pull_number}: ${orgNames.join(', ')}`);

      // loop through each org name
      for (const orgName of orgNames) {
        const orgToken = await getOrgToken(yamlData, orgName);
        if (!orgToken) {
          app.log.warn(`No token found for organization: ${orgName}`);
          continue; // Skip to the next org if no token is found
        }
        app.log.info(`Processing organization: ${orgName} with token: ${orgToken}`);
                
        // get the destination folder for this org
        const orgConfig = yamlData.organizations.find(o => o.name === orgName);
        if (!orgConfig || !orgConfig.destinationFolder) {
          app.log.warn(`No destination folder configured for organization: ${orgName}`);
          continue; // Skip if no destination folder is configured
        }
        // Call sync helper
        await syncSafeSettingConfig(app, context, orgName, orgConfig, orgToken);

      }

    } catch (error) {
      app.log.error(`Error processing pull request: ${error.message}`);
      throw error;
    }
  });

  // ---------------------------------------------------------------------------

  /**
   * @description Handles changes in the target subfolder
   */
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });

    await apiTest() // Call the apiTest function to test the API interaction

    const res = context.octokit.issues.createComment(issueComment);
    return res
  });

  // ---------------------------------------------------------------------------

};

