import { jsonResponse } from '../lib/http.js';
import { capabilities } from '../lib/capabilities.js';
export default function handler(req, res) { jsonResponse(req, res, 200, capabilities()); }
