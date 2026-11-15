// Internal storage primitive only: no public route or settled mailbox protocol.
// Callers must supply authenticated E2E ciphertext; opaque bytes are NOT proof of encryption.
export class StoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export class SealedMessageStore {
  #url; #token; #fetch;
  constructor({ url, token, fetchImpl = fetch }) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new StoreError('store_not_configured'); }
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.upstash.io') || parsed.port ||
        parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
        typeof token !== 'string' || !token || /\s/.test(token)) {
      throw new StoreError('invalid_store_configuration');
    }
    this.#url = parsed.href; this.#token = token; this.#fetch = fetchImpl;
  }
  static fromEnvironment(env = process.env) {
    return new SealedMessageStore({ url: env.JARVIS_UPSTASH_REST_URL, token: env.JARVIS_UPSTASH_REST_TOKEN });
  }
  #key(deviceID, messageID) {
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id.test(deviceID) || !id.test(messageID)) throw new StoreError('invalid_store_identity');
    return `jarvis:sealed:${deviceID.toLowerCase()}:${messageID.toLowerCase()}`;
  }
  async #command(command) {
    let response, body;
    try {
      response = await this.#fetch(this.#url, {
        method: 'POST', redirect: 'error', cache: 'no-store',
        headers: { Authorization: `Bearer ${this.#token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command), signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 100_000) throw new Error();
      body = JSON.parse(text);
    } catch { throw new StoreError('store_unavailable'); }
    if (!body || typeof body !== 'object' || 'error' in body || !('result' in body)) {
      throw new StoreError('store_unavailable');
    }
    return body.result;
  }
  async put(deviceID, messageID, sealedBytes, ttlSeconds = 300) {
    const key = this.#key(deviceID, messageID);
    if (!(sealedBytes instanceof Uint8Array) || sealedBytes.length < 28 || sealedBytes.length > 65_536 ||
        !Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
      throw new StoreError('invalid_sealed_record');
    }
    const value = Buffer.from(sealedBytes).toString('base64');
    const result = await this.#command(['SET', key, value, 'NX', 'EX', ttlSeconds]);
    if (result === 'OK') return { duplicate: false };
    if (result !== null) throw new StoreError('store_unavailable');
    if (await this.#command(['GET', key]) === value) return { duplicate: true };
    // Never overwrite the same ID with different ciphertext, or silently refresh its TTL.
    throw new StoreError('sealed_record_conflict');
  }
  async get(deviceID, messageID) {
    const value = await this.#command(['GET', this.#key(deviceID, messageID)]);
    if (value === null) return null;
    if (typeof value !== 'string' || value.length > 87_384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      throw new StoreError('invalid_stored_record');
    }
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length < 28 || bytes.length > 65_536 || bytes.toString('base64') !== value) {
      throw new StoreError('invalid_stored_record');
    }
    return bytes;
  }
}
