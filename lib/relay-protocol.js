import { createHash,createPublicKey,verify } from 'node:crypto';
import { RelayError } from './relay-state.js';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const HEX=/^[0-9a-f]{64}$/;
export function requireThat(test,code='invalid_request',status=400){if(!test)throw new RelayError(code,status);}
export function unbase(s,length){
  requireThat(typeof s==='string' && /^[A-Za-z0-9_-]+$/.test(s));
  const b=Buffer.from(s,'base64url');requireThat(b.toString('base64url')===s && (!length || b.length===length));return b;
}
export function publicKey(s){
  const b=unbase(s,65);requireThat(b[0]===4);
  try{return createPublicKey({key:Buffer.concat([Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200','hex'),b]),format:'der',type:'spki'});}catch{throw new RelayError('invalid_request');}
}
export function verifyRequest(req,raw,role,origin,bridge,principal,key,now){
  const ts=req.headers['x-timestamp'],nonce=req.headers['x-nonce'],sig=req.headers['x-signature'];
  requireThat(typeof ts==='string' && /^(0|[1-9][0-9]{0,15})$/.test(ts) && Number.isSafeInteger(Number(ts)) && Math.abs(now-Number(ts))<=60,'unauthorized',401);
  requireThat(UUID.test(nonce??'') && req.headers['x-principal-id']===principal && req.headers['x-bridge-id']===bridge,'unauthorized',401);
  const input=['jarvis-http-v1',role,origin,bridge,principal,req.method,req.url,sha(raw),ts,nonce].join('\n');
  let valid=false;try{valid=verify('sha256',Buffer.from(input),{key:publicKey(key),dsaEncoding:'ieee-p1363'},unbase(sig,64));}catch{}
  requireThat(valid,'unauthorized',401);return nonce;
}
export function object(value,keys){
  requireThat(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).every(k=>keys.includes(k)) && keys.every(k=>Object.hasOwn(value,k)));return value;
}
export function envelope(bytes,scope,now){
  requireThat(typeof bytes==='string' && Buffer.byteLength(bytes)<=65536,'invalid_envelope');
  // Flat, ASCII, unescaped envelope: detect duplicate fields before JSON.parse.
  requireThat(!/[^\x20-\x7e\r\n\t]/.test(bytes) && !bytes.includes('\\'),'invalid_envelope');
  const names=[...bytes.matchAll(/"([^"\\]*)"\s*:/g)].map(m=>m[1]);requireThat(new Set(names).size===names.length,'invalid_envelope');
  let h;try{h=JSON.parse(bytes);}catch{throw new RelayError('invalid_envelope');}
  object(h,['v','origin','bridge_id','device_id','direction','lane','message_id','key_epoch','seq','created_at','expires_at','enc','ct']);
  requireThat(h.v===1 && h.origin===scope.origin && h.bridge_id===scope.bridge && h.device_id===scope.device && h.key_epoch===scope.epoch && UUID.test(h.message_id),'invalid_envelope');
  requireThat(HEX.test(h.device_id) && Number.isSafeInteger(h.key_epoch) && h.key_epoch>=1 && h.key_epoch<=4294967295,'invalid_envelope');
  requireThat(typeof h.seq==='string' && /^[1-9][0-9]{0,19}$/.test(h.seq) && BigInt(h.seq)<=18446744073709551615n,'invalid_envelope');
  const up=h.direction==='phone_to_bridge';requireThat(up?['command','control'].includes(h.lane):h.direction==='bridge_to_phone' && h.lane==='event','invalid_envelope');
  requireThat(Number.isSafeInteger(h.created_at) && Number.isSafeInteger(h.expires_at) && h.created_at>=0 && h.created_at<=now+60 && h.expires_at>now && h.expires_at>h.created_at && h.expires_at-h.created_at<=(up?120:900),'message_expired',409);
  publicKey(h.enc);const ct=unbase(h.ct);requireThat(ct.length>=16 && ct.length<=32784,'invalid_envelope');return h;
}
