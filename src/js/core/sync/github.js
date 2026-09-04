/**
 * The GitHub Contents API, as much of it as one JSON file needs.
 *
 * Every save is a commit, which buys three things for free: real history,
 * per-DM attribution, and GitHub's own optimistic locking — a PUT carrying a
 * stale blob sha is rejected with 409 instead of quietly overwriting whoever
 * saved first.
 *
 * `fetch` is injected so this can be tested without a network.
 */

const API = 'https://api.github.com';

class HttpError extends Error {
  constructor(status, message, body){
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** True for the one status that means "someone else saved first". */
export const isConflict = err => err instanceof HttpError && (err.status === 409 || err.status === 422);

export class GitHubFile {
  /**
   * @param {{owner:string, repo:string, path:string, branch?:string, token:string}} cfg
   * @param {typeof fetch} [fetchImpl]
   */
  constructor(cfg, fetchImpl){
    this.cfg = cfg;
    this.fetch = fetchImpl || globalThis.fetch.bind(globalThis);
    this.sha = null;      // blob sha of the version we last saw
    this.etag = null;     // for conditional GETs, which do not spend rate limit
    this.rateRemaining = null;
  }

  get url(){
    const { owner, repo, path } = this.cfg;
    return `${API}/repos/${enc(owner)}/${enc(repo)}/contents/${path.split('/').map(enc).join('/')}`;
  }

  headers(extra){
    return Object.assign({
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }, extra || {});
  }

  note(res){
    const left = res.headers && res.headers.get && res.headers.get('X-RateLimit-Remaining');
    if (left != null && left !== '') this.rateRemaining = Number(left);
  }

  /**
   * Read the file.
   * @returns {Promise<{status:'ok', data:object}|{status:'unchanged'}|{status:'absent'}>}
   */
  async read(){
    const branch = this.cfg.branch ? `?ref=${enc(this.cfg.branch)}` : '';
    const headers = this.headers(this.etag ? { 'If-None-Match': this.etag } : null);
    const res = await this.fetch(this.url + branch, { method: 'GET', headers });
    this.note(res);

    if (res.status === 304) return { status: 'unchanged' };
    if (res.status === 404) return { status: 'absent' };
    if (!res.ok) throw await httpError(res);

    const body = await res.json();
    this.sha = body.sha;
    const tag = res.headers && res.headers.get && res.headers.get('ETag');
    if (tag) this.etag = tag;
    return { status: 'ok', data: JSON.parse(fromBase64(body.content || '')) };
  }

  /**
   * Write the file. Throws a conflict when the remote moved since the last
   * read, which the caller resolves by reading, merging and trying again.
   */
  async write(data, message){
    const payload = {
      message: message || 'Update board',
      content: toBase64(JSON.stringify(data, null, 2)),
    };
    if (this.sha) payload.sha = this.sha;
    if (this.cfg.branch) payload.branch = this.cfg.branch;

    const res = await this.fetch(this.url, {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    this.note(res);
    if (!res.ok) throw await httpError(res);

    const body = await res.json();
    this.sha = body.content && body.content.sha;
    this.etag = null;             // our own write invalidates the cached tag
    return { sha: this.sha };
  }

  /** Cheap credential check: can this token see the repo at all? */
  async probe(){
    const { owner, repo } = this.cfg;
    const res = await this.fetch(`${API}/repos/${enc(owner)}/${enc(repo)}`,
      { method: 'GET', headers: this.headers() });
    this.note(res);
    if (!res.ok) throw await httpError(res);
    const body = await res.json();
    return { private: !!body.private, permissions: body.permissions || {} };
  }
}

async function httpError(res){
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  const detail = body && body.message ? body.message : res.statusText;
  return new HttpError(res.status, `${res.status} ${detail}`, body);
}

const enc = encodeURIComponent;

/* GitHub wants base64, and the board is full of Cyrillic — go through UTF-8. */
export function toBase64(text){
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export function fromBase64(b64){
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
