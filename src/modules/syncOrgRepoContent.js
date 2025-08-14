import { Octokit } from '@octokit/rest';
import { env } from 'process';

async function syncSafeSettingConfig(app, context, orgName, orgConfig, orgToken) {
  app.log.info(`Syncing safe settings for organization: ${orgName}`);

  const pr = context.payload.pull_request;
  const { owner: srcOwner, repo: srcRepo } = context.repo();
  const pull_number = pr.number;

  // Source base path where org files live in the PR
  const sourceBase = (env.GITHUB_SAFE_SETTINGS_PATH || '.github/safe-settings/organizations').replace(/\/$/, '');

  app.log.info(`orgConfig: ${JSON.stringify(orgConfig, null, 2)}`);
  // Destination repo/owner/path - configurable via env
  const destOwner = orgName;
  const destRepo = orgConfig.adminRepo; 
  const destinationFolder = orgConfig.destinationFolder || '.github';
  const destBase = (process.env.GITHUB_SAFE_SETTINGS_DEST_PATH || sourceBase).replace(/\/$/, '');
  const destBaseBranch = process.env.GITHUB_SAFE_SETTINGS_DEST_BASE_BRANCH || 'main';

  app.log.info(`Syncing from ${srcOwner}/${srcRepo} PR #${pull_number} to ${destOwner}/${destRepo}/${destinationFolder} at ${destBaseBranch}`);
  
  const octokitSrc = context.octokit;
  const octokitDest = new Octokit({ auth: orgToken });

  // 1) List files changed in PR
  const files = await octokitSrc.paginate(
    octokitSrc.rest.pulls.listFiles,
    { owner: srcOwner, repo: srcRepo, pull_number, per_page: 100 }
  );

  // Filter files that belong to this org under sourceBase
  const orgPrefix = `${sourceBase}/${orgName}/`;
  const relevant = files.filter(f => f.filename === `${sourceBase}/${orgName}` || f.filename.startsWith(orgPrefix));
  if (relevant.length === 0) {
    app.log.info(`No files for org ${orgName} in PR #${pull_number}`);
    return;
  }

  // Create a branch name for this sync
  const timestamp = Date.now();
  const branchName = `panorg-sync/pr-${pull_number}-${orgName}-${timestamp}`;

  // Create branch on destination repo (from destBaseBranch)
  try {
    const baseRef = await octokitDest.rest.git.getRef({ owner: destOwner, repo: destRepo, ref: `heads/${destBaseBranch}` });
    const baseSha = baseRef.data.object.sha;
    await octokitDest.rest.git.createRef({
      owner: destOwner,
      repo: destRepo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });
    app.log.info(`Created branch ${branchName} in ${destOwner}/${destRepo}`);
  } catch (err) {
    // If ref exists, it's fine; otherwise surface error
    if (err.status === 422) {
      app.log.warn(`Branch ${branchName} already exists, continuing`);
    } else {
      app.log.error(`Failed creating branch: ${err.message}`);
      throw err;
    }
  }

  // For each relevant file: get content from source and commit into dest on the new branch
  for (const f of relevant) {
    // compute relative path after the org segment
    let relative = '';
    if (f.filename === `${sourceBase}/${orgName}`) {
      relative = ''; // top-level folder
    } else {
      relative = f.filename.slice(orgPrefix.length);
    }
    const destPath = relative ? `${destBase}/${orgName}/${relative}` : `${destBase}/${orgName}/README.md`;

    // Read file content from source repo (PR's head ref). try to get content via REST
    try {
      const srcContentResp = await octokitSrc.rest.repos.getContent({
        owner: srcOwner,
        repo: srcRepo,
        path: f.filename,
        ref: pr.head.sha
      });
      const data = srcContentResp.data;
      let fileContent;
      if (Array.isArray(data)) {
        // directory - skip
        app.log.info(`Skipping directory ${f.filename}`);
        continue;
      } else {
        fileContent = Buffer.from(data.content, data.encoding).toString('utf8');
      }

      const encoded = Buffer.from(fileContent, 'utf8').toString('base64');
      // Check if file exists in dest to get sha
      let existingSha = null;
      try {
        const destGet = await octokitDest.rest.repos.getContent({
          owner: destOwner,
          repo: destRepo,
          path: destPath,
          ref: destBaseBranch
        });
        if (!Array.isArray(destGet.data)) {
          existingSha = destGet.data.sha;
        }
      } catch (errGet) {
        if (errGet.status !== 404) {
          app.log.error(`Error checking dest file ${destPath}: ${errGet.message}`);
          throw errGet;
        }
        // 404 means file missing -> will create
      }

      // Create or update file on the created branch
      await octokitDest.rest.repos.createOrUpdateFileContents({
        owner: destOwner,
        repo: destRepo,
        path: destPath,
        message: `Sync safe-settings from ${srcOwner}/${srcRepo} PR #${pull_number}`,
        content: encoded,
        branch: branchName,
        sha: existingSha || undefined,
        committer: {
          name: 'PanOrg Bot',
          email: 'panorg-bot@example.com'
        },
        author: {
          name: 'PanOrg Bot',
          email: 'panorg-bot@example.com'
        }
      });

      app.log.info(`Committed ${destPath} to ${destOwner}/${destRepo}@${branchName}`);
    } catch (err) {
      app.log.error(`Failed to sync file ${f.filename}: ${err.message}`);
      throw err;
    }
  }

  // Create a PR in the destination repository
  try {
    const prTitle = `Sync safe-settings from ${srcOwner}/${srcRepo} PR #${pull_number}`;
    const prBody = `Automated sync of safe-settings for ${orgName} from ${srcOwner}/${srcRepo} PR #${pull_number}.`;
    const created = await octokitDest.rest.pulls.create({
      owner: destOwner,
      repo: destRepo,
      title: prTitle,
      head: branchName,
      base: destBaseBranch,
      body: prBody
    });
    app.log.info(`Created PR ${created.data.html_url} in ${destOwner}/${destRepo}`);
  } catch (err) {
    app.log.error(`Failed to create PR in ${destOwner}/${destRepo}: ${err.message}`);
    throw err;
  }
}
export {
  syncSafeSettingConfig
};