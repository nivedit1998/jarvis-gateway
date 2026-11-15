// Atomic bounded state for one owner-controlled bridge. Content is always sealed envelope bytes.
export const STATE_SCRIPT = `
local now=tonumber(ARGV[1]); local op=ARGV[2]; local p=cjson.decode(ARGV[3])
local raw=redis.call('GET',KEYS[1]); local s=raw and cjson.decode(raw) or {devices={},offers={},queues={},seen={}}
local function fail(code) return cjson.encode({error=code}) end
for k,v in pairs(s.offers) do if v.expires_at<now then s.offers[k]=nil end end
for k,q in pairs(s.queues) do for id,r in pairs(q) do if r.expires_at<=now then q[id]=nil end end end
for id,r in pairs(s.seen) do if r.expires_at<=now then s.seen[id]=nil end end
local result={}
if op=='has_work' then
 for scope,q in pairs(s.queues) do if string.sub(scope,1,2)=='u:' then for id,r in pairs(q) do return cjson.encode({ready=true}) end end end
 return cjson.encode({ready=false})
elseif op=='device' then return cjson.encode({device=s.devices[p.id] or false})
elseif op=='offer_get' then return cjson.encode({offer=s.offers[p.id] or false})
elseif op=='offer' then
 if s.offers[p.offer.id] then return fail('message_conflict') end
 local count=0; for k,v in pairs(s.offers) do count=count+1 end
 if count>=4 then return fail('queue_full') end
 s.offers[p.offer.id]=p.offer; result={stored=true}
elseif op=='register' then
 local offer=s.offers[p.device.offer_id]
 if not offer then return fail('message_expired') end
 local old=s.devices[p.device.id]
 if old and (old.s~=p.device.s or old.d~=p.device.d or old.epoch~=p.device.epoch or old.offer_id~=p.device.offer_id) then return fail('message_conflict') end
 if p.device.epoch~=offer.epoch then return fail('key_epoch_expired') end
 if old and old.state=='active' and p.device.state=='pending' then return fail('message_conflict') end
 local count=0; for k,v in pairs(s.devices) do count=count+1 end
 if not old and count>=8 then return fail('queue_full') end
 s.devices[p.device.id]=p.device
 if p.device.state=='active' then offer.consumed=true end
 result={stored=true}
elseif op=='revoke' then
 if s.devices[p.id] then s.devices[p.id].state='revoked' end; result={stored=true}
elseif op=='put' then
 local prior=s.seen[p.scope..':'..p.id]
 if prior then
  if prior.digest~=p.digest then return fail('message_conflict') end
  return cjson.encode({duplicate=true})
 end
 local q=s.queues[p.scope] or {}; local count=0
 for id,r in pairs(q) do
  count=count+1
  if p.seq and r.lane==p.lane and r.epoch==p.epoch and r.seq==p.seq then return fail('message_conflict') end
 end
 if count>=(p.lane=='command' and 112 or 128) then return fail('queue_full') end
 local seenCount=0
 for id,r in pairs(s.seen) do
  seenCount=seenCount+1
  if p.seq and r.scope==p.scope and r.lane==p.lane and r.epoch==p.epoch and r.seq==p.seq then return fail('message_conflict') end
 end
 if seenCount>=4096 then return fail('queue_full') end
 q[p.id]=p; s.queues[p.scope]=q
 s.seen[p.scope..':'..p.id]={digest=p.digest,expires_at=p.expires_at+180,scope=p.scope,lane=p.lane,epoch=p.epoch,seq=p.seq}
 result={stored=true,duplicate=false}
elseif op=='poll' then result={records=s.queues[p.scope] or {}}
elseif op=='ack' then
 local q=s.queues[p.scope] or {}
 for _,id in ipairs(p.ids) do q[id]=nil end
 result={stored=true}
else return fail('invalid_request') end
redis.call('SET',KEYS[1],cjson.encode(s)); return cjson.encode(result)
`;
export class RelayError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
export class RelayStore {
  constructor({url,token,fetchImpl=fetch}) {
    if (!url || !token) throw new RelayError('store_unavailable',503);
    const u=new URL(url);
    if(u.protocol!=='https:' || !u.hostname.endsWith('.upstash.io') || u.port || u.username || u.password || u.search || u.hash || u.pathname!=='/')throw new RelayError('store_unavailable',503);
    this.url=u.href;this.token=token;this.fetch=fetchImpl;
  }
  async command(args){
    try{
      const r=await this.fetch(this.url,{method:'POST',redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(7000)});
      if(!r.ok)throw Error();
      const text=await r.text();if(text.length>24*1024*1024)throw Error();
      const data=JSON.parse(text);if(data.error || !Object.hasOwn(data,'result'))throw Error();return data.result;
    }catch {throw new RelayError('store_unavailable',503);}
  }
  async operation(bridge,op,p,now=Math.floor(Date.now()/1000)){
    const value=JSON.parse(await this.command(['EVAL',STATE_SCRIPT,1,`jarvis:relay:v1:${bridge}`,now,op,JSON.stringify(p)]));
    if(value.error)throw new RelayError(value.error,value.error==='queue_full'?429:409);return value;
  }
  async nonce(bridge,principal,nonce){
    const key=`jarvis:nonce:v1:${bridge}:${principal}:${nonce}`;
    if(await this.command(['SET',key,'1','NX','EX',180])!=='OK')throw new RelayError('replay_detected',401);
  }
  async rate(key,limit=120){
    // Fixed minute window, increment and expiry in one atomic operation.
    const n=await this.command(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",1,`jarvis:rate:${key}`]);
    if(n>limit)throw new RelayError('rate_limited',429);
  }
}
