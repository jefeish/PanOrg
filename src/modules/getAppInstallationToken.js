/**
 * @describe This module provides functions to generate a JWT token for GitHub App authentication
 * and to retrieve an installation access token using that JWT. 
 * 
 */
import axios from 'axios';
import jwt from 'jsonwebtoken';
import fs from 'fs';

/**
 * Generate a JWT token for GitHub App authentication
 * @param {string} clientId - GitHub App Client ID
 * @param {string} privatePem - Private key content (PEM format) or path to private key file
 * @param {number} expirationMinutes - Token expiration time in minutes (default: 9, max: 10)
 * @returns {string} JWT token
 */
function generateJWT(clientId, privatePem, expirationMinutes = 9) {
    if (!clientId) {
        throw new Error('Client ID is required');
    }
    
    if (!privatePem) {
        throw new Error('Private key is required');
    }

    if (expirationMinutes > 10) {
        throw new Error('JWT expiration cannot exceed 10 minutes');
    }

    // Check if privatePem is a file path or the actual key content
    let privateKey;
    try {
        // If it's a file path, read the file
        if (fs.existsSync(privatePem)) {
            privateKey = fs.readFileSync(privatePem, 'utf8');
        } else {
            // Assume it's the key content itself
            privateKey = privatePem;
        }
    } catch (error) {
        throw new Error(`Error reading private key: ${error.message}`);
    }

    const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60),
        iss: clientId
    };

    try {
        return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    } catch (error) {
        throw new Error(`Error generating JWT: ${error.message}`);
    }
}

/**
 * Get installation access token using JWT
 * @param {string} jwtToken - JWT token generated for the GitHub App
 * @param {string|number} installationId - GitHub App installation ID
 * @returns {Promise<Object>} Promise resolving to the API response
 */
async function getInstallationAccessToken(jwtToken, installationId) {
    if (!jwtToken) {
        throw new Error('JWT token is required');
    }
    
    if (!installationId) {
        throw new Error('Installation ID is required');
    }

    try {
        const response = await axios.post(
            `https://api.github.com/app/installations/${installationId}/access_tokens`, 
            {}, 
            {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    Accept: 'application/vnd.github.v3+json',
                    'User-Agent': 'GitHub-App-Node-Client'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`GitHub API error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
        } else if (error.request) {
            throw new Error('Network error: Unable to reach GitHub API');
        } else {
            throw new Error(`Request error: ${error.message}`);
        }
    }
}

/**
 * Complete workflow to get installation access token
 * @param {Object} config - Configuration object
 * @param {string} config.clientId - GitHub App Client ID
 * @param {string} config.privatePem - Private key content or path to private key file
 * @param {string|number} config.installationId - GitHub App installation ID
 * @param {number} [config.expirationMinutes=9] - JWT expiration time in minutes
 * @returns {Promise<string>} Promise resolving to the access token
 */
async function getAccessToken({ clientId, privatePem, installationId, expirationMinutes = 9 }) {
    try {
        // Generate JWT
        const jwtToken = generateJWT(clientId, privatePem, expirationMinutes);
        
        // Get installation access token
        const tokenData = await getInstallationAccessToken(jwtToken, installationId);
        
        return tokenData.token;
    } catch (error) {
        throw new Error(`Failed to get access token: ${error.message}`);
    }
}

export {
    getAccessToken
};