import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import health from '../api/health.js';
import capabilities from '../api/capabilities.js';
import connection from '../api/connection.js';
const assets = new Map([['/', ['index.html','text/html; charset=utf-8']],['/style.css',['style.css','text/css']],['/status.js',['status.js','text/javascript']]]);
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/health') return health(req,res);
  if (path === '/api/capabilities') return capabilities(req,res);
  if (path === '/api/connection' || path.startsWith('/api/v1/')) return connection(req,res);
  const asset = assets.get(path);
  if (!asset) { res.writeHead(404); return res.end('Not found'); }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  res.setHeader('Content-Type',asset[1]);
  const data = await readFile(new URL('../public/'+asset[0],import.meta.url));
  res.end(req.method==='HEAD'?undefined:data);
}).listen(3000,'127.0.0.1',()=>console.log('Local development: http://127.0.0.1:3000 (not Vercel CLI)'));
