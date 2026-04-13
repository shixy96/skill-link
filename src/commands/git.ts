import { fetchRepo, pushRepo, getCapabilities } from '../lib/gh-git.js';
import { listManagedRepos } from '../lib/skill-registry.js';

export async function gitFetch(repo?: string): Promise<void> {
  const capabilities = await getCapabilities();

  if (!capabilities.canFetch) {
    console.error(`[GH_NOT_AUTHED] GitHub authentication required`);
    console.error(`  → Run: gh auth login`);
    return;
  }

  if (repo) {
    const repos = await listManagedRepos();
    const match = repos.find((entry) => entry.name === repo || `${entry.owner}/${entry.name}` === repo);
    if (!match) {
      console.error(`[REPO_NOT_FOUND] Repository not found: ${repo}`);
      return;
    }

    console.log(`Fetching ${repo}...`);
    const result = await fetchRepo(match.path);

    if (result.success) {
      console.log(`✓ Fetch successful`);
    } else {
      console.error(`[FETCH_FAILED] ${repo}`);
      console.error(`  → Check network and repo remote`);
      console.error(result.stderr || result.error);
    }
  } else {
    // Fetch all repos
    const repos = await listManagedRepos();

    if (repos.length === 0) {
      console.log('No repositories to fetch.');
      return;
    }

    console.log(`Fetching ${repos.length} repository(s)...\n`);

    for (const r of repos) {
      console.log(`  ${r.owner}/${r.name}...`);
      const result = await fetchRepo(r.path);

      if (result.success) {
        console.log(`    ✓ Fetched`);
      } else {
        console.error(`    ✗ Failed`);
      }
    }

    console.log(`\n✓ Fetch complete`);
  }
}

export async function gitPush(repo?: string): Promise<void> {
  const capabilities = await getCapabilities();

  if (!capabilities.canPush) {
    console.error(`[GH_NOT_AUTHED] GitHub authentication required`);
    console.error(`  → Run: gh auth login`);
    return;
  }

  let repoPath: string | undefined;
  if (repo) {
    const repos = await listManagedRepos();
    const match = repos.find((entry) => entry.name === repo || `${entry.owner}/${entry.name}` === repo);
    if (!match) {
      console.error(`[REPO_NOT_FOUND] Repository not found: ${repo}`);
      return;
    }
    repoPath = match.path;
  } else {
    const repos = await listManagedRepos();
    repoPath = repos[0]?.path;
  }

  if (!repoPath) {
    console.log('No repositories to push.');
    return;
  }

  console.log(`Pushing${repo ? ` ${repo}` : ''}...`);
  const result = await pushRepo(repoPath);

  if (result.success) {
    console.log(`✓ Push successful`);
  } else {
    console.error(`[PUSH_FAILED] Failed to push`);
    console.error(`  → Check write permissions`);
    console.error(result.stderr || result.error);
  }
}
