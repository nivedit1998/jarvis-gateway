import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createRelay} from '../api/relay.js';
import {sha,verifyRequest} from '../lib/relay-protocol.js';
const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pub=keys.publicKey.export({format:'der',type:'spki'}).subarray(-65).toString('base64url');
const bridge=sha(Buffer.from(pub,'base64url')), origin='https://jarvis-gateway-kappa.vercel.app', now=1800000000;
function signed(target,body,nonce='11111111-1111-4111-8111-111111111111'){
 const raw=Buffer.from(JSON.stringify(body));
 const input=['jarvis-http-v1','bridge',origin,bridge,bridge,'POST',target,sha(raw),String(now),nonce].join('\n');
 const signature=sign('sha256',Buffer.from(input),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const req=Readable.from([raw]);req.method='POST';req.url=target;req.headers={'x-principal-id':bridge,'x-bridge-id':bridge,'x-timestamp':String(now),'x-nonce':nonce,'x-signature':signature};return req;
}
function response(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.data=JSON.parse(s);}};}
const env={JARVIS_PUBLIC_ORIGIN:origin,JARVIS_BRIDGE_ID:bridge,JARVIS_BRIDGE_SIGNING_PUBLIC_KEY:pub};
test('valid signed request with query-rewrite reaches only its logical route',async()=>{
 const calls=[],store={nonce:async()=>{},rate:async()=>{},operation:async(b,op,p)=>{calls.push({b,op,p});return {records:{}};}};
 const req=signed('/api/v1/bridge/poll',{device_ids:[]});req.url='/api/relay?__route=bridge/poll';
 const res=response();await createRelay({env,storeFactory:()=>store,clock:()=>now})(req,res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.data,{envelopes:[],cursor:null});
});
test('signature modification cannot reach storage action',async()=>{
 const store={nonce:async()=>{throw Error('must not reach');}};
 const req=signed('/api/v1/bridge/poll',{device_ids:[]});req.headers['x-signature']='A'.repeat(86);
 const res=response();await createRelay({env,storeFactory:()=>store,clock:()=>now})(req,res);
 assert.equal(res.statusCode,401);assert.equal(res.data.error.code,'unauthorized');
});
test('unconfigured relay does not accept commands',async()=>{
 const req=signed('/api/v1/bridge/poll',{}),res=response();await createRelay({env:{}})(req,res);
 assert.equal(res.statusCode,503);assert.equal(res.data.error.code,'connection_not_configured');
});
test('both high-S and low-S valid signatures verify',()=>{
 const req=signed('/api/v1/bridge/poll',{});const raw=Buffer.from('{}');
 const original=Buffer.from(req.headers['x-signature'],'base64url');
 const n=BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
 const other=Buffer.concat([original.subarray(0,32),Buffer.from((n-BigInt('0x'+original.subarray(32).toString('hex'))).toString(16).padStart(64,'0'),'hex')]);
 for(const sig of [original,other]){req.headers['x-signature']=sig.toString('base64url');assert.equal(verifyRequest(req,raw,'bridge',origin,bridge,bridge,pub,now),req.headers['x-nonce']);}
});
