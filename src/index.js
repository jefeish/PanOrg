import fs from 'fs';
import { getAccessToken } from './getAppInstallationToken.js';

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");
  const yamlData = app.loadYaml('org-info.yml');
  const orgToken = getOrgTokens(yamlData);
  app.log.info("Loaded org info:", orgToken);

  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });
};


// Function to get ORG info from the Yaml files and return map of org -> token
export async function getOrgTokens(yamlData) {
  console.log("Input yamlData:", yamlData); // Debug log
  
  if (!yamlData) {
    console.error("No YAML data provided");
    return {};
  }
  
  const orgs = yamlData.organizations || [];
  console.log("Found organizations:", orgs); // Debug log
  
  if (orgs.length === 0) {
    console.warn("No organizations found in YAML data");
    return {};
  }
  
  const orgTokenMap = {};
  
  for (const org of orgs) {
    try {
      console.log(`Processing org:`, org.name); // Debug log
      
      // Check if private key file exists
      if (!fs.existsSync(org.privatePemPath)) {
        console.error(`Private key file not found: ${org.privatePemPath}`);
        orgTokenMap[org.name] = null;
        continue;
      }
      
      const privatePem = fs.readFileSync(org.privatePemPath, 'utf8');
      
      // Get the installation token
      const accessToken = await getAccessToken({
        clientId: org.clientId,
        privatePem: privatePem,
        installationId: org.installationId
      });
      
      orgTokenMap[org.name] = accessToken;
      console.log(`✓ Successfully got token for ${org.name}: ${orgTokenMap[org.name]}`);
      
    } catch (error) {
      console.error(`Error processing org ${org.name}:`, error.message);
      orgTokenMap[org.name] = null;
    }
  }
  
  console.log("Final org token map:", Object.keys(orgTokenMap)); // Debug log (without sensitive data)
  return orgTokenMap;
}