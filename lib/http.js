import { randomUUID } from 'node:crypto';

export function jsonResponse(req, res, status, body, allowed = ['GET', 'HEAD']) {
  const requestId = randomUUID();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Request-ID', requestId);
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    res.statusCode = 405;
    res.end(JSON.stringify({ error: { code: 'method_not_allowed', retryable: false, request_id: requestId } }));
    return;
  }
  res.statusCode = status;
  if (req.method === 'HEAD') { res.end(); return; }
  const payload = body.error ? { ...body, error: { ...body.error, request_id: requestId } } : body;
  res.end(JSON.stringify(payload));
}
