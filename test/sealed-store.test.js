import test from 'node:test';
import assert from 'node:assert/strict';
import { SealedMessageStore } from '../lib/sealed-store.js';
const device = '00000000-0000-4000-8000-000000000001';
const message = '00000000-0000-4000-8000-000000000002';
const ciphertext = new Uint8Array(32).fill(7); // Synthetic storage bytes, NOT crypto vectors.
function setup(results) {
  const calls = [];
  const store = new SealedMessageStore({ url:'https://synthetic.upstash.io', token:'synthetic-token',
    fetchImpl: async (url, options) => { calls.push({url,...options});
      return {ok:true,text:async()=>JSON.stringify(results.shift())}; } });
  return {store,calls};
}
test('unconfigured and non-Upstash stores fail closed',()=>{
  assert.throws(()=>SealedMessageStore.fromEnvironment({}),/store_not_configured/);
  for (const url of ['http://synthetic.upstash.io','https://example.com','https://synthetic.upstash.io/?secret=x']) {
    assert.throws(()=>new SealedMessageStore({url,token:'synthetic'}));
  }
});
test('write uses atomic NX and bounded expiry, no cache or redirect',async()=>{
  const {store,calls}=setup([{result:'OK'}]);
  assert.deepEqual(await store.put(device,message,ciphertext),{duplicate:false});
  const call=calls[0], command=JSON.parse(call.body);
  assert.equal(command[0],'SET'); assert.deepEqual(command.slice(3),['NX','EX',300]);
  assert.equal(call.redirect,'error');assert.equal(call.cache,'no-store');
  assert.equal(call.headers.Authorization,'Bearer synthetic-token');
});
test('exact retry is deduplicated without extending TTL; changed bytes conflict',async()=>{
  const encoded=Buffer.from(ciphertext).toString('base64');
  const {store,calls}=setup([{result:null},{result:encoded},{result:null},{result:'different'}]);
  assert.deepEqual(await store.put(device,message,ciphertext),{duplicate:true});
  await assert.rejects(store.put(device,message,ciphertext),/sealed_record_conflict/);
  assert.equal(calls.length,4);
});
test('invalid inputs never make a network call',async()=>{
  const {store,calls}=setup([]);
  await assert.rejects(store.put('../private',message,ciphertext));
  await assert.rejects(store.put(device,message,'plaintext'));
  await assert.rejects(store.put(device,message,ciphertext,301));
  assert.equal(calls.length,0);
});
test('read returns only bounded opaque bytes or missing',async()=>{
  const {store}=setup([{result:Buffer.from(ciphertext).toString('base64')},{result:null},{result:'private text'}]);
  assert.deepEqual(await store.get(device,message),Buffer.from(ciphertext));
  assert.equal(await store.get(device,message),null);
  await assert.rejects(store.get(device,message),/invalid_stored_record/);
});
test('provider errors are redacted',async()=>{
  const {store}=setup([{error:'private provider detail synthetic-token'}]);
  await assert.rejects(store.get(device,message),error=>error.message==='store_unavailable');
});
