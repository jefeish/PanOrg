import fs from 'fs';
import yaml from 'js-yaml';
import { getOrgTokens } from './index.js';
import { getAccessToken } from './getAppInstallationToken.js';

// Option 1: Use the complete workflow function
async function example1() {
  try {
    const KEY = fs.readFileSync('./private-key.pem', 'utf8');
    const accessToken = await getAccessToken({
      clientId: 'Iv23li204uWVTW2bUzA2',
      privatePem: KEY,
      installationId: '53975571'
    });

    console.log('Access Token:', accessToken);
    return accessToken;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Call the function to test
example1();

// Parse YAML string to object
const yamlString = fs.readFileSync('org-info.yml', 'utf8');
console.log('YAML String:', yamlString);

const yamlData = yaml.load(yamlString);
console.log('Parsed YAML Data:', yamlData);


const orgToken = await getOrgTokens(yamlData);
console.log('Organization Info:', orgToken);
// print all orgs and their tokens
for (const [org, token] of Object.entries(orgToken)) {
  console.log(`Org: ${org}, Token: ${token}`);
}