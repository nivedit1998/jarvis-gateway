import { jsonResponse } from '../lib/http.js';
import { release } from '../lib/capabilities.js';
export default function handler(req, res) {
  jsonResponse(req, res, 200, {
    service: 'jarvis-gateway', release, status: 'ok',
    scope: 'gateway_only',
    connection_ready: false
  });
}
