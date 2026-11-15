import test from 'node:test';
import assert from 'node:assert/strict';
import health from '../api/health.js';
import capabilities from '../api/capabilities.js';
import connection from '../api/connection.js';
function response() { return { headers:{}, statusCode:0, body:'', setHeader(key,value){this.headers[key]=value}, end(value=''){this.body=value} }; }
test('health describes only gateway readiness, not home AI readiness',()=>{
  const res=response(); health({method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(JSON.parse(res.body).scope,'gateway_only');
  assert.equal(JSON.parse(res.body).connection_ready,false);
  assert.equal(res.headers['Cache-Control'],'no-store');
});
test('capabilities do not advertise pending connection or encryption',()=>{
  const res=response(); capabilities({method:'GET'},res); const body=JSON.parse(res.body);
  assert.equal(body.content_encryption.required,true);
  assert.equal(body.content_encryption.available,false);
  assert.equal(body.capabilities.encrypted_relay,false);
  assert.equal(body.ubuntu_bridge.status,'not_connected');
});
test('connection route fails closed without reading a submitted body',()=>{
  const req={method:'POST', get body(){ throw new Error('Must not read user content'); }};
  const res=response(); connection(req,res);
  assert.equal(res.statusCode,503);
  assert.equal(JSON.parse(res.body).error.code,'connection_not_configured');
  assert.equal(JSON.parse(res.body).error.retryable,false);
  assert.equal(JSON.parse(res.body).error.request_id,res.headers['X-Request-ID']);
});
test('unsupported methods are rejected without pretending to accept work',()=>{
  const res=response(); health({method:'POST'},res);
  assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,'GET, HEAD');
});
test('HEAD provides status without a response body',()=>{
  const res=response(); health({method:'HEAD'},res);
  assert.equal(res.statusCode,200);assert.equal(res.body,'');
});
test('responses use unique server request IDs, not caller-controlled data',()=>{
  const a=response(),b=response(); health({method:'GET'},a);health({method:'GET'},b);
  assert.notEqual(a.headers['X-Request-ID'],b.headers['X-Request-ID']);
});
