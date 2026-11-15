// Explicit opt-in live synthetic Redis test. Never invoked by build or default tests.
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {RelayStore} from '../lib/relay-state.js';
if(!process.argv[2])throw Error('Pass a protected Jarvis-only mailbox configuration file.');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
const store=new RelayStore(config),b=createHash('sha256').update('synthetic-'+randomUUID()).digest('hex');
const now=Math.floor(Date.now()/1000),offer=randomUUID();
try{
 assert.equal(await store.command(['PING']),'PONG');
 await store.operation(b,'offer',{offer:{id:offer,epoch:1,expires_at:now+120}},now);
 assert.equal((await store.operation(b,'offer_get',{id:offer},now)).offer.id,offer);
 const record={scope:'u:synthetic',id:randomUUID(),digest:'synthetic',bytes:'synthetic opaque test bytes',expires_at:now+60,lane:'control',seq:'1',epoch:1};
 const writes=await Promise.all([store.operation(b,'put',record,now),store.operation(b,'put',record,now)]);
 assert.equal(writes.filter(x=>x.duplicate).length,1);
 await assert.rejects(store.operation(b,'put',{...record,digest:'different'},now),/message_conflict/);
 let r=await store.operation(b,'poll',{scope:record.scope},now);assert.equal(Object.keys(r.records).length,1);
 await store.operation(b,'ack',{scope:record.scope,ids:[record.id]},now);
 r=await store.operation(b,'poll',{scope:record.scope},now);assert.equal(Object.keys(r.records).length,0);
 await assert.rejects(store.operation(b,'put',{...record,id:randomUUID()},now),/message_conflict/);
 const nonce=randomUUID();await store.nonce(b,b,nonce);
 await assert.rejects(store.nonce(b,b,nonce),/replay_detected/);
 await store.command(['DEL',`jarvis:nonce:v1:${b}:${b}:${nonce}`]);
 console.log('Live dedicated Redis: atomic offer, racing deduplication, conflict, poll, ack, sequence replay and nonce replay passed.');
}finally{await store.command(['DEL','jarvis:relay:v1:'+b]);}
