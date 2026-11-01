'use strict';
// StreamDonate backend — zero dependencies (Node 18+). Data lives in data.json; swap `db` helpers for Supabase/SQL later.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
try{for(const l of fs.readFileSync(path.join(__dirname,'.env'),'utf8').split('\n')){const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2]}}catch{}
const PORT=+process.env.PORT||3000,DEV=process.env.DEV_MODE==='1',WH=process.env.WEBHOOK_SECRET||'',CHECKOUT=process.env.CHECKOUT_URL||'';
const FILE=path.join(__dirname,'data.json'),PUB=path.join(__dirname,'public');
let db={users:{},donations:[],sessions:{}};try{db=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch{}
const save=()=>{fs.writeFileSync(FILE+'.tmp',JSON.stringify(db));fs.renameSync(FILE+'.tmp',FILE)};
const rid=n=>crypto.randomBytes(n).toString('hex'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const HEX=/^#[0-9a-f]{6}$/i,FONTS=['Prompt','Kanit','Sarabun','Mitr','Noto Sans Thai'],ANIMS=['slide','pop','bounce','fade'],SOUNDS=['chime','coin','pop','none'];
const defaults=()=>({minAmount:10,alert:{color:'#8b5cf6',color2:'#22d3ee',font:'Prompt',anim:'slide',duration:7000,sound:'chime',volume:.6},page:{accent:'#8b5cf6',bio:'ขอบคุณที่ติดตามและสนับสนุนนะ 💜',suggested:[20,50,100,300]}});
const bad=(m,c=400)=>{throw Object.assign(new Error(m),{status:c})};
function mergeSettings(cur,inp){
  const s=JSON.parse(JSON.stringify(cur)),a=inp.alert||{},p=inp.page||{};
  const hex=(v,d)=>v===undefined?d:HEX.test(v)?v:bad('รหัสสีไม่ถูกต้อง');
  const pick=(v,l,d)=>v===undefined?d:l.includes(v)?v:bad('ค่าที่เลือกไม่ถูกต้อง');
  const num=(v,lo,hi,d)=>v===undefined?d:(Number.isFinite(+v)&&+v>=lo&&+v<=hi)?+v:bad('ตัวเลขอยู่นอกช่วงที่กำหนด');
  s.alert={color:hex(a.color,s.alert.color),color2:hex(a.color2,s.alert.color2),font:pick(a.font,FONTS,s.alert.font),anim:pick(a.anim,ANIMS,s.alert.anim),sound:pick(a.sound,SOUNDS,s.alert.sound),duration:num(a.duration,3000,20000,s.alert.duration),volume:num(a.volume,0,1,s.alert.volume)};
  let sg=s.page.suggested;if(p.suggested!==undefined){if(!Array.isArray(p.suggested)||p.suggested.length<2||p.suggested.length>6||!p.suggested.every(n=>Number.isInteger(n)&&n>=1&&n<=100000))bad('ยอดแนะนำต้องเป็นจำนวนเต็ม 2–6 ค่า');sg=p.suggested}
  s.page={accent:hex(p.accent,s.page.accent),bio:p.bio===undefined?s.page.bio:String(p.bio).slice(0,160),suggested:sg};
  s.minAmount=num(inp.minAmount,1,10000,s.minAmount);return s;
}
const publicStreamer=u=>({username:u.username,displayName:u.displayName,bio:u.settings.page.bio,accent:u.settings.page.accent,suggested:u.settings.page.suggested,minAmount:u.settings.minAmount,alert:{color:u.settings.alert.color,color2:u.settings.alert.color2,font:u.settings.alert.font}});
// ---- helpers
const hits=new Map();const limited=(req,k,max)=>{const key=k+(req.socket.remoteAddress||''),n=Date.now(),h=hits.get(key);if(!h||h[1]<n){hits.set(key,[1,n+6e4]);return false}return ++h[0]>max};
const send=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const body=req=>new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e4){req.destroy();no(Object.assign(new Error('ข้อมูลใหญ่เกินไป'),{status:413}))}});req.on('end',()=>ok(b));req.on('error',no)});
const parse=raw=>{try{return JSON.parse(raw||'{}')}catch{return bad('รูปแบบข้อมูลไม่ถูกต้อง')}};
const authUser=req=>{const t=(req.headers.authorization||'').replace(/^Bearer /,''),s=t&&db.sessions[sha(t)];return s&&s.exp>Date.now()?db.users[s.u]:null};
const needAuth=req=>authUser(req)||bad('กรุณาเข้าสู่ระบบ',401);
const hashPw=(pw,salt)=>crypto.scryptSync(pw,salt,64).toString('hex');
const newSession=u=>{const t=rid(32);db.sessions[sha(t)]={u:u.username,exp:Date.now()+7*864e5};save();return t};
// ---- realtime (SSE)
const clients=new Map();
const emit=(user,event,data)=>{for(const r of clients.get(user.username)||[])r.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)};
const alertFor=d=>({name:d.name,amount:d.amount,message:d.message,test:!!d.test});
function markPaid(d){if(d.status!=='pending')return;d.status='paid';d.paidAt=Date.now();save();const u=db.users[d.streamer];if(u)emit(u,'alert',{donation:alertFor(d),settings:u.settings.alert})}
const expire=d=>{if(d.status==='pending'&&Date.now()-d.created>30*6e4){d.status='failed';save()}};
// ---- API
async function api(req,res,url){
  const m=req.method,p=url.pathname;
  if(m==='GET'&&p==='/api/config')return send(res,200,{dev:DEV});
  if(m==='POST'&&p==='/api/register'){
    if(limited(req,'reg',10))bad('ลองใหม่อีกครั้งภายหลัง',429);const b=parse(await body(req)),un=String(b.username||'').toLowerCase();
    if(!/^[a-z0-9_]{3,20}$/.test(un))bad('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ ความยาว 3–20 ตัว');
    if(String(b.password||'').length<8)bad('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    const dn=String(b.displayName||'').trim().slice(0,40);if(!dn)bad('กรุณากรอกชื่อที่แสดง');if(db.users[un])bad('ชื่อผู้ใช้นี้ถูกใช้แล้ว',409);
    const salt=rid(16),u=db.users[un]={username:un,displayName:dn,salt,hash:hashPw(b.password,salt),overlayKey:rid(16),settings:defaults(),created:Date.now()};
    return send(res,201,{token:newSession(u)});
  }
  if(m==='POST'&&p==='/api/login'){
    if(limited(req,'login',10))bad('ลองใหม่อีกครั้งภายหลัง',429);const b=parse(await body(req)),u=db.users[String(b.username||'').toLowerCase()];
    if(!u||!crypto.timingSafeEqual(Buffer.from(hashPw(String(b.password||''),u.salt)),Buffer.from(u.hash)))bad('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);
    return send(res,200,{token:newSession(u)});
  }
  if(m==='POST'&&p==='/api/logout'){const t=(req.headers.authorization||'').replace(/^Bearer /,'');delete db.sessions[sha(t)];save();return send(res,200,{ok:true})}
  if(m==='GET'&&p==='/api/me'){const u=needAuth(req);return send(res,200,{username:u.username,displayName:u.displayName,overlayKey:u.overlayKey,settings:u.settings})}
  if(m==='PUT'&&p==='/api/settings'){const u=needAuth(req),b=parse(await body(req));u.settings=mergeSettings(u.settings,b);if(b.displayName!==undefined){const dn=String(b.displayName).trim().slice(0,40);if(!dn)bad('ชื่อที่แสดงห้ามว่าง');u.displayName=dn}save();return send(res,200,{settings:u.settings,displayName:u.displayName})}
  if(m==='GET'&&p==='/api/dashboard'){
    const u=needAuth(req),mine=db.donations.filter(d=>d.streamer===u.username);mine.forEach(expire);
    const paid=mine.filter(d=>d.status==='paid'),real=paid.filter(d=>!d.test),sum=a=>a.reduce((s,d)=>s+d.amount,0),day=new Date().setHours(0,0,0,0),top={};
    real.forEach(d=>{top[d.name]=(top[d.name]||0)+d.amount});
    return send(res,200,{total:sum(real),count:real.length,today:sum(real.filter(d=>d.paidAt>=day)),testTotal:sum(paid.filter(d=>d.test)),
      top:Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount})),
      recent:mine.slice(-100).reverse().map(d=>({id:d.id,name:d.name,amount:d.amount,message:d.message,status:d.status,test:!!d.test,time:d.paidAt||d.created}))});
  }
  if(m==='POST'&&p==='/api/test-alert'){const u=needAuth(req);emit(u,'alert',{donation:{name:'ผู้ชมทดสอบ',amount:100,message:'นี่คือการแจ้งเตือนทดสอบ',test:true},settings:u.settings.alert});return send(res,200,{ok:true})}
  let g;if(m==='GET'&&(g=p.match(/^\/api\/streamer\/([a-z0-9_]+)$/))){const u=db.users[g[1]];if(!u)bad('ไม่พบสตรีมเมอร์',404);return send(res,200,publicStreamer(u))}
  if(m==='POST'&&p==='/api/donate'){
    if(limited(req,'don',8))bad('ส่งบ่อยเกินไป ลองใหม่ในอีกสักครู่',429);
    if(!DEV&&!(CHECKOUT&&WH))bad('ระบบชำระเงินยังไม่ได้ตั้งค่า',503);
    const b=parse(await body(req)),u=db.users[String(b.username||'')];if(!u)bad('ไม่พบสตรีมเมอร์',404);
    const name=String(b.name||'').trim().slice(0,40),msg=String(b.message||'').trim().slice(0,200),amount=b.amount;
    if(!name)bad('กรุณากรอกชื่อ');if(!Number.isInteger(amount)||amount>100000)bad('จำนวนเงินไม่ถูกต้อง');if(amount<u.settings.minAmount)bad(`ขั้นต่ำ ${u.settings.minAmount} บาท`);
    const d={id:'dn_'+rid(8),streamer:u.username,name,amount,message:msg,status:'pending',test:DEV,created:Date.now()};db.donations.push(d);save();
    return send(res,201,{id:d.id,status:'pending',dev:DEV,checkoutUrl:CHECKOUT&&!DEV?CHECKOUT+(CHECKOUT.includes('?')?'&':'?')+'ref='+d.id:null});
  }
  if(m==='GET'&&(g=p.match(/^\/api\/donation\/(dn_[a-f0-9]+)$/))){const d=db.donations.find(x=>x.id===g[1]);if(!d)bad('ไม่พบรายการ',404);expire(d);return send(res,200,{id:d.id,status:d.status,amount:d.amount,name:d.name,test:!!d.test})}
  if(m==='POST'&&(g=p.match(/^\/api\/dev\/confirm\/(dn_[a-f0-9]+)$/))){if(!DEV)bad('ไม่พบ',404);const d=db.donations.find(x=>x.id===g[1]);if(!d)bad('ไม่พบรายการ',404);markPaid(d);return send(res,200,{status:d.status})}
  if(m==='POST'&&p.startsWith('/api/webhook/')){ // payment verification: signed by provider, amount must match
    if(!WH)bad('ยังไม่ได้ตั้งค่า WEBHOOK_SECRET',503);const raw=await body(req),sig=String(req.headers['x-signature']||''),exp=crypto.createHmac('sha256',WH).update(raw).digest('hex');
    if(sig.length!==exp.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(exp)))bad('ลายเซ็นไม่ถูกต้อง',401);
    const b=parse(raw),d=db.donations.find(x=>x.id===b.donationId);if(!d||d.test)bad('ไม่พบรายการ',404);
    if(b.status==='paid'){if(b.amount!==d.amount)bad('ยอดเงินไม่ตรงกัน',409);markPaid(d)}else if(b.status==='failed'&&d.status==='pending'){d.status='failed';save()}
    return send(res,200,{ok:true});
  }
  if(m==='GET'&&p==='/api/overlay/stream'){
    const u=Object.values(db.users).find(x=>x.overlayKey===url.searchParams.get('key'));if(!u)bad('คีย์ไม่ถูกต้อง',401);
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive','X-Accel-Buffering':'no'});
    res.write(`event: settings\ndata: ${JSON.stringify(u.settings.alert)}\n\n`);
    const set=clients.get(u.username)||new Set();set.add(res);clients.set(u.username,set);
    const ka=setInterval(()=>res.write(': ka\n\n'),25000);req.on('close',()=>{clearInterval(ka);set.delete(res)});return;
  }
  bad('ไม่พบ API',404);
}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  const url=new URL(req.url,'http://x');
  try{
    if(url.pathname.startsWith('/api/'))return await api(req,res,url);
    let f=url.pathname==='/'?'/index.html':/^\/d\/[a-z0-9_]+$/.test(url.pathname)?'/donate.html':url.pathname;
    const fp=path.normalize(path.join(PUB,f));if(!fp.startsWith(PUB))bad('forbidden',403);
    fs.readFile(fp,(e,data)=>{if(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('ไม่พบหน้านี้')}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(data)});
  }catch(e){if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'เซิร์ฟเวอร์ผิดพลาด'});if(!e.status)console.error(e)}
}).listen(PORT,()=>console.log(`StreamDonate on http://localhost:${PORT}${DEV?'  [DEV_MODE: payments are simulated]':''}`));
