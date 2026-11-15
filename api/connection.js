import { jsonResponse } from '../lib/http.js';
export default function handler(req, res) {
  // Intentionally never read/parse the body, log content, or forward requests to the home machine.
  jsonResponse(req, res, 503, {
    error: {
      code: 'connection_not_configured',
      message: 'Encrypted pairing and the home bridge are not connected yet.',
      retryable: false
    }
  }, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
}
