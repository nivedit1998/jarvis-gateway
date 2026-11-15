import { randomUUID } from 'node:crypto';
import { RelayStore,RelayError } from '../lib/relay-state.js';
import { sha,UUID,HEX,requireThat,publicKey,unbase,verifyRequest,object,envelope } from '../lib/relay-protocol.js';
const MAX_HTTP=200000;
function parse(raw){try{return JSON.parse(raw.toString('utf8'));}catch{throw new RelayError('invalid_request');}}
async function rawBody(req){
  let size=0;const chunks=[];
  for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;requireThat(size<=MAX_HTTP,'request_too_large',413);chunks.push(b);}
  return Buffer.concat(chunks);
}
function response(res,status,data,id){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Request-ID',id);res.setHeader('Date',new Date().toUTCString());res.end(JSON.stringify(data));}
export function createRelay({env=process.env,storeFactory=e=>new RelayStore({url:e.JARVIS_UPSTASH_REST_URL,token:e.JARVIS_UPSTASH_REST_TOKEN}),clock=()=>Math.floor(Date.now()/1000)}={}){
 return async function handler(req,res){
  const id=randomUUID();
  try{
   requireThat(req.method==='POST','method_not_allowed',405);
   const origin=env.JARVIS_PUBLIC_ORIGIN,bridge=env.JARVIS_BRIDGE_ID,bkey=env.JARVIS_BRIDGE_SIGNING_PUBLIC_KEY;
   requireThat(origin==='https://jarvis-gateway-kappa.vercel.app' && HEX.test(bridge??'') && sha(unbase(bkey,65))===bridge,'connection_not_configured',503);
   const store=storeFactory(env),now=clock();
   const internal=new URL(req.url,origin);
   const path=req.query?.__route??internal.searchParams.get('__route')??internal.pathname.replace(/^\/api\/v1\//,'');
   requireThat(typeof path==='string' && /^[a-z/]+$/.test(path),'invalid_request');
   const target='/api/v1/'+path;
   const raw=await rawBody(req),body=parse(raw);
   requireThat(body && typeof body==='object' && !Array.isArray(body));
   const principal=req.headers['x-principal-id'];
   let role,device;
   const anonymous=path==='pairing/phone/request';
   if(!anonymous){
    role=path.startsWith('bridge/') || path.startsWith('pairing/bridge/')?'bridge':'phone';
    let key=bkey;
    if(role==='bridge')requireThat(principal===bridge,'unauthorized',401);
    else{
     requireThat(HEX.test(principal??''),'unauthorized',401);
     device=(await store.operation(bridge,'device',{id:principal},now)).device;
     requireThat(device && device.state!=='revoked','pairing_required',401);
     if(!path.startsWith('pairing/'))requireThat(device.state==='active','pairing_required',401);
     key=device.s;
    }
    const nonce=verifyRequest({headers:req.headers,method:req.method,url:target},raw,role,origin,bridge,principal,key,now);
    await store.nonce(bridge,principal,nonce);
    await store.rate(bridge+':'+principal,240);
   }else{
    await store.rate(bridge+':bootstrap:'+sha(String(req.headers['x-forwarded-for']??'unknown')).slice(0,32),10);
   }
   const offerFor=async offerID=>{
    requireThat(UUID.test(offerID??''));
    const offer=(await store.operation(bridge,'offer_get',{id:offerID},now)).offer;
    requireThat(offer && offer.expires_at>now,'message_expired',409);return offer;
   };
   const put=async(scope,bytes,h)=>store.operation(bridge,'put',{scope,id:h.message_id,digest:sha(bytes),bytes,expires_at:h.expires_at,lane:h.lane,seq:h.seq,epoch:h.key_epoch},now);
   const poll=async scopes=>{
    let all=[];
    for(const scope of scopes){const r=await store.operation(bridge,'poll',{scope},now);all.push(...Object.values(r.records));}
    all.sort((a,b)=> (a.lane==='control'?0:1)-(b.lane==='control'?0:1) || (BigInt(a.seq??'0')<BigInt(b.seq??'0')?-1:1));
    return {envelopes:all.slice(0,16).map(r=>r.bytes),cursor:null};
   };
   const ack=async scope=>{
    requireThat(Array.isArray(body.message_ids) && body.message_ids.length<=64 && body.message_ids.every(x=>typeof x==='string' && /^[a-f0-9-]{36,64}$/.test(x)));
    return store.operation(bridge,'ack',{scope,ids:body.message_ids},now);
   };
   let result,status=200;
   if(path==='bridge/wait'){
    object(body,[]);
    const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),50000);
    try{
     const watch=await store.fetch(store.url+'subscribe/'+encodeURIComponent('jarvis:notify:v1:'+bridge),{method:'POST',headers:{Authorization:'Bearer '+store.token,Accept:'text/event-stream'},redirect:'error',signal:abort.signal});
     requireThat(watch.ok,'store_unavailable',503);
     const reader=watch.body.getReader();const first=await reader.read();
     let buffer=first.done?'':new TextDecoder().decode(first.value);
     const ready=await store.operation(bridge,'has_work',{},now);
     if(!ready.ready && !buffer.includes('message,')){
      try{while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=new TextDecoder().decode(chunk.value);if(buffer.includes('message,' ) || buffer.includes('\"message\"'))break;if(buffer.length>4096)buffer=buffer.slice(-2048);}}finally{await reader.cancel().catch(()=>{});}
     }else await reader.cancel().catch(()=>{});
     result={wake:true};
    }catch(error){if(abort.signal.aborted)result={wake:false};else throw error;}finally{clearTimeout(timer);abort.abort();}
   }else if(path==='bridge/offer'){
    object(body,['offer_id','epoch','expires_at','u','b']);publicKey(body.u);publicKey(body.b);
    requireThat(UUID.test(body.offer_id) && body.b===bkey && Number.isInteger(body.epoch) && body.epoch>=1 && body.epoch<=4294967295 && body.expires_at>now && body.expires_at<=now+300);
    result=await store.operation(bridge,'offer',{offer:{id:body.offer_id,epoch:body.epoch,expires_at:body.expires_at,u:body.u,b:body.b,consumed:false}},now);status=202;
   }else if(path==='bridge/register'){
    object(body,['device_id','offer_id','epoch','s','d','state']);publicKey(body.s);publicKey(body.d);
    requireThat(sha(unbase(body.s,65))===body.device_id && ['pending','active'].includes(body.state));
    const offer=await offerFor(body.offer_id);
    requireThat(offer.epoch===body.epoch,'key_epoch_expired',409);
    const old=(await store.operation(bridge,'device',{id:body.device_id},now)).device;
    if(body.state==='active')requireThat(old && old.state==='pending' && old.offer_id===body.offer_id || old && old.state==='active' && old.offer_id===body.offer_id,'pairing_required',409);
    result=await store.operation(bridge,'register',{device:{id:body.device_id,offer_id:body.offer_id,epoch:body.epoch,s:body.s,d:body.d,state:body.state}},now);
   }else if(path==='bridge/revoke'){
    object(body,['device_id']);requireThat(HEX.test(body.device_id??''));result=await store.operation(bridge,'revoke',{id:body.device_id},now);
   }else if(path==='pairing/phone/request'){
    object(body,['envelope']);requireThat(typeof body.envelope==='string' && Buffer.byteLength(body.envelope)<=4096);
    const h=parse(Buffer.from(body.envelope));object(h,['v','origin','bridge_id','offer_id','key_epoch','created_at','enc','ct']);
    requireThat(h.v===1 && h.origin===origin && h.bridge_id===bridge && Number.isSafeInteger(h.created_at) && Math.abs(now-h.created_at)<=60);publicKey(h.enc);unbase(h.ct);
    const offer=await offerFor(h.offer_id);requireThat(!offer.consumed && offer.epoch===h.key_epoch,'pairing_required',409);
    const digest=sha(body.envelope);
    result=await store.operation(bridge,'put',{scope:'bu:'+h.offer_id,id:digest,digest,bytes:body.envelope,expires_at:offer.expires_at,lane:'command'},now);status=202;
   }else if(path==='phone/messages' || path==='bridge/messages'){
    object(body,['envelope']);const rawHeader=parse(Buffer.from(body.envelope));
    const d=role==='phone'?device:(await store.operation(bridge,'device',{id:rawHeader.device_id},now)).device;
    requireThat(d && d.state==='active','pairing_required',401);
    const h=envelope(body.envelope,{origin,bridge,device:d.id,epoch:d.epoch},now);
    requireThat(h.direction===(role==='phone'?'phone_to_bridge':'bridge_to_phone'),'invalid_envelope');
    result=await put((role==='phone'?'u:':'d:')+d.id,body.envelope,h);status=202;
   }else if(path==='phone/poll'){
    requireThat(Object.keys(body).every(k=>['cursor','max'].includes(k)));result=await poll(['d:'+device.id]);
   }else if(path==='phone/ack'){object(body,['message_ids']);result=await ack('d:'+device.id);
   }else if(path==='bridge/poll' || path==='bridge/ack'){
    object(body,path.endsWith('/ack')?['device_id','message_ids']:['device_ids']);
    if(path.endsWith('/poll')){requireThat(Array.isArray(body.device_ids) && body.device_ids.length<=8 && body.device_ids.every(x=>HEX.test(x)));result=await poll(body.device_ids.map(x=>'u:'+x));}
    else{requireThat(HEX.test(body.device_id));result=await ack('u:'+body.device_id);}
   }else if(/^pairing\/(phone|bridge)\/(poll|ack|messages)$/.test(path)){
    requireThat(Object.keys(body).every(k=>['offer_id','envelope','message_ids','cursor','max'].includes(k)));
    await offerFor(body.offer_id);
    if(role==='phone')requireThat(device.offer_id===body.offer_id,'unauthorized',401);
    const readScope=(role==='phone'?'bd:':'bu:')+body.offer_id;
    if(path.endsWith('/poll')){
     const r=await store.operation(bridge,'poll',{scope:readScope},now);
     result={envelopes:Object.values(r.records).slice(0,16).map(r=>r.bytes),message_ids:Object.keys(r.records).slice(0,16),cursor:null};
    }else if(path.endsWith('/ack'))result=await ack(readScope);
    else{
     requireThat(typeof body.envelope==='string');const rawHeader=parse(Buffer.from(body.envelope));
     const d=role==='phone'?device:(await store.operation(bridge,'device',{id:rawHeader.device_id},now)).device;
     requireThat(d && d.state!=='revoked' && d.offer_id===body.offer_id,'pairing_required',401);
     const h=envelope(body.envelope,{origin,bridge,device:d.id,epoch:d.epoch},now);
     requireThat(h.direction===(role==='phone'?'phone_to_bridge':'bridge_to_phone'),'invalid_envelope');
     const offer=await offerFor(body.offer_id);requireThat(h.expires_at<=offer.expires_at,'message_expired',409);
     result=await put((role==='phone'?'bu:':'bd:')+body.offer_id,body.envelope,h);status=202;
    }
   }else throw new RelayError('not_found',404);
   if(status===202 && (path==='phone/messages' || path==='pairing/phone/request' || path==='pairing/phone/messages'))await store.command(['PUBLISH','jarvis:notify:v1:'+bridge,'wake']);
   response(res,status,result,id);
  }catch(e){const error=e instanceof RelayError?e:new RelayError('invalid_request');response(res,error.status,{error:{code:error.code,retryable:['store_unavailable','queue_full','rate_limited'].includes(error.code),request_id:id}},id);}
 };
}
export default createRelay();
