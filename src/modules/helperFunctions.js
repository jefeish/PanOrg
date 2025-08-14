/**
 * @description: Helper functions for managing organization tokens and other utilities.
 * @module: helperFunctions
 */
import fs from 'fs';
import { getAccessToken } from './getAppInstallationToken.js';

/**
 * @description Function to get ORG info from the Yaml files and return map of org -> token
 * @param {Object} yamlData - The parsed YAML data
 * @returns {Promise<Object>} - A promise that resolves to a map of org names to their access tokens
 */
async function getOrgToken(yamlData, orgName) {
  if (!yamlData || !orgName) {
    console.error('getOrgToken requires yamlData and orgName');
    return null;
  }

  const orgs = yamlData.organizations || [];
  const org = orgs.find(o => o.name === orgName);

  if (!org) {
    console.error(`Organization "${orgName}" not found in YAML data`);
    return null;
  }

  console.log(`Processing org:`, orgName); // Debug log
  
  try {
    if (!fs.existsSync(org.privatePemPath)) {
      console.error(`Private key file not found for ${orgName}: ${org.privatePemPath}`);
      return null;
    }

    const privatePem = fs.readFileSync(org.privatePemPath, 'utf8');

    const accessToken = await getAccessToken({
      clientId: org.clientId,
      privatePem: privatePem,
      installationId: org.installationId
    });

    // Do not log the token itself
    console.log(`✓ Successfully retrieved token for ${orgName}`);
    return accessToken || null;
  } catch (error) {
    console.error(`Error retrieving token for ${orgName}:`, error.message);
    return null;
  }
}

/**
 * @description Function to get ORG info from the Yaml files and return map of org -> token
 * @param {Object} yamlData - The parsed YAML data
 * @returns {Promise<Object>} - A promise that resolves to a map of org names to their access tokens
 */
async function getOrgTokens(yamlData) {
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
  console.log("Full OrgToken Map:", orgTokenMap)
  return orgTokenMap;
}

export {
  getOrgTokens,
  getOrgToken
};