import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import net from 'node:net';
import tls from 'node:tls';

const monitoredRepos = (process.env.REPOS || 'Softcatala/catalan-dict-tools,Softcatala/diccionari-multilingue,Softcatala/diccionari-angles-catala')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || 'inspecciona';
const statePath = process.env.UPSTREAM_STATE_PATH || join(process.cwd(), '.github', 'upstream', 'versions-state.json');
const issueTitle = 'New upstream versions detected';
const smtp = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || '587'),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  to: process.env.ALERT_EMAIL_TO || process.env.SMTP_TO || ''
};

async function fetchJson(url) {
  const headers = { 'User-Agent': 'inspecciona-upstream-forks', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function loadState() {
  try {
    const raw = await readFile(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { repos: {} };
  }
}

async function saveState(state) {
  await mkdir(join(process.cwd(), '.github', 'upstream'), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
}

function isNewerVersion(current, previous) {
  if (!current) return false;
  if (!previous) return false;

  if (current.kind === 'release' && previous.kind !== 'release') {
    return true;
  }

  if (current.versionId && previous.versionId && current.versionId !== previous.versionId) {
    return true;
  }

  if (current.publishedAt && previous.publishedAt && current.publishedAt !== previous.publishedAt) {
    return current.publishedAt > previous.publishedAt;
  }

  return false;
}

async function tryFetchJson(url) {
  const headers = { 'User-Agent': 'inspecciona-upstream-versions', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchRepoVersion(fullRepo) {
  const repoMeta = await fetchJson(`https://api.github.com/repos/${fullRepo}`);
  const latestRelease = await tryFetchJson(`https://api.github.com/repos/${fullRepo}/releases/latest`);

  if (latestRelease?.id) {
    return {
      kind: 'release',
      versionId: String(latestRelease.id),
      name: latestRelease.name || latestRelease.tag_name || 'unnamed release',
      ref: latestRelease.tag_name || '',
      htmlUrl: latestRelease.html_url || repoMeta.html_url,
      publishedAt: latestRelease.published_at || latestRelease.created_at || repoMeta.pushed_at || ''
    };
  }

  const branch = repoMeta.default_branch || 'main';
  const latestCommit = await fetchJson(`https://api.github.com/repos/${fullRepo}/commits/${branch}`);
  return {
    kind: 'commit',
    versionId: latestCommit.sha,
    name: latestCommit.commit?.message?.split('\n')[0] || `Head of ${branch}`,
    ref: branch,
    htmlUrl: latestCommit.html_url || repoMeta.html_url,
    publishedAt: latestCommit.commit?.committer?.date || repoMeta.pushed_at || ''
  };
}

async function getIssueForRepo(owner, repoName) {
  if (!token) return null;
  const issues = await fetchJson(`https://api.github.com/repos/${owner}/${repoName}/issues?state=open&per_page=100`);
  return issues.find((issue) => issue.title === issueTitle) || null;
}

async function createOrUpdateIssue(owner, repoName, body) {
  if (!token) return false;

  const existingIssue = await getIssueForRepo(owner, repoName);
  const payload = {
    title: issueTitle,
    body,
    labels: ['automation', 'upstream', 'forks']
  };

  const request = existingIssue
    ? `https://api.github.com/repos/${owner}/${repoName}/issues/${existingIssue.number}`
    : `https://api.github.com/repos/${owner}/${repoName}/issues`;

  const response = await fetch(request, {
    method: existingIssue ? 'PATCH' : 'POST',
    headers: {
      'User-Agent': 'inspecciona-upstream-forks',
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to create/update issue: ${response.status} ${response.statusText}`);
  }
  return true;
}

async function sendSmtpEmail(subject, body) {
  if (!smtp.host || !smtp.to) {
    return false;
  }

  const message = [
    `From: ${smtp.from}`,
    `To: ${smtp.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body
  ].join('\r\n');

  const readResponse = (socket) => new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const lastLine = lines[lines.length - 1];
      if (/^[0-9]{3}\s/.test(lastLine)) {
        socket.off('data', onData);
        resolve(lastLine);
      }
    };
    socket.on('data', onData);
    socket.on('error', reject);
  });

  const sendLine = async (socket, line, expectedPrefix) => {
    socket.write(`${line}\r\n`);
    const response = await readResponse(socket);
    if (!response.startsWith(expectedPrefix)) {
      throw new Error(`SMTP unexpected response for ${line}: ${response}`);
    }
  };

  const connectSocket = () => new Promise((resolve, reject) => {
    const socket = smtp.secure
      ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host }, () => resolve(socket))
      : net.connect({ host: smtp.host, port: smtp.port }, () => resolve(socket));
    socket.on('error', reject);
  });

  const upgradeToTls = (socket) => new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: smtp.host }, () => resolve(secureSocket));
    secureSocket.on('error', reject);
  });

  const socket = await connectSocket();
  try {
    await readResponse(socket);
    await sendLine(socket, `EHLO ${smtp.host}`, '250');
    if (!smtp.secure && smtp.port === 587) {
      await sendLine(socket, 'STARTTLS', '220');
      const tlsSocket = await upgradeToTls(socket);
      await sendLine(tlsSocket, `EHLO ${smtp.host}`, '250');
      if (smtp.user && smtp.pass) {
        await sendLine(tlsSocket, 'AUTH LOGIN', '334');
        await sendLine(tlsSocket, Buffer.from(smtp.user, 'utf8').toString('base64'), '334');
        await sendLine(tlsSocket, Buffer.from(smtp.pass, 'utf8').toString('base64'), '235');
      }
      await sendLine(tlsSocket, `MAIL FROM:<${smtp.from}>`, '250');
      await sendLine(tlsSocket, `RCPT TO:<${smtp.to}>`, '250');
      await sendLine(tlsSocket, 'DATA', '354');
      tlsSocket.write(`${message}\r\n.\r\n`);
      await readResponse(tlsSocket);
      await sendLine(tlsSocket, 'QUIT', '221');
      tlsSocket.end();
      return true;
    }

    if (smtp.user && smtp.pass) {
      await sendLine(socket, 'AUTH LOGIN', '334');
      await sendLine(socket, Buffer.from(smtp.user, 'utf8').toString('base64'), '334');
      await sendLine(socket, Buffer.from(smtp.pass, 'utf8').toString('base64'), '235');
    }
    await sendLine(socket, `MAIL FROM:<${smtp.from}>`, '250');
    await sendLine(socket, `RCPT TO:<${smtp.to}>`, '250');
    await sendLine(socket, 'DATA', '354');
    socket.write(`${message}\r\n.\r\n`);
    await readResponse(socket);
    await sendLine(socket, 'QUIT', '221');
    socket.end();
    return true;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

async function main() {
  const state = await loadState();
  const results = [];
  const alerts = [];
  let stateChanged = false;

  for (const fullRepo of monitoredRepos) {
    const [owner, name] = fullRepo.split('/');
    if (!owner || !name) continue;

    const latest = await fetchRepoVersion(fullRepo);
    const previous = state.repos?.[fullRepo] || null;

    if (latest) {
      state.repos = state.repos || {};
      state.repos[fullRepo] = {
        kind: latest.kind,
        versionId: latest.versionId,
        name: latest.name,
        ref: latest.ref,
        htmlUrl: latest.htmlUrl,
        publishedAt: latest.publishedAt
      };
      stateChanged = true;
    }

    if (previous && isNewerVersion(latest, previous)) {
      alerts.push({ repo: fullRepo, previous, latest });
    }

    results.push({
      repo: fullRepo,
      latest: latest || null,
      notified: previous ? isNewerVersion(latest, previous) : false
    });
  }

  if (stateChanged) {
    await saveState(state);
  }

  if (alerts.length > 0) {
    const subject = `Inspecciona: ${alerts.length} actualitzaci\u00f3(ns) upstream detectada(es)`;
    const body = [
      'S’han detectat noves versions o actualitzacions als repositoris vigilats:',
      '',
      ...alerts.flatMap((item) => [
        `Repository: ${item.repo}`,
        `- Abans: ${item.previous.kind} · ${item.previous.name || item.previous.ref || item.previous.versionId}`,
        `- Ara: ${item.latest.kind} · ${item.latest.name || item.latest.ref || item.latest.versionId}`,
        `- Ref: ${item.latest.ref || '-'}`,
        `- Data: ${item.latest.publishedAt || '-'}`,
        `- URL: ${item.latest.htmlUrl}`,
        ''
      ])
    ].join('\n');

    const emailed = await sendSmtpEmail(subject, body);
    const [owner, repoName] = repo.split('/');
    let issueCreated = false;
    if (owner && repoName) {
      issueCreated = await createOrUpdateIssue(owner, repoName, `${body}\n\nEmail enviat: ${emailed ? 'sí' : 'no'}`);
    }
    results.push({ mailSent: emailed, issueUpdated: issueCreated, subject });
  }

  console.log(JSON.stringify({ repo, monitoredRepos, results, alerts: alerts.length, statePath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
