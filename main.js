// Shared helpers: DOM, API, toast, nav, sounds, alert rendering.
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
const thb=n=>'฿'+Number(n).toLocaleString('th-TH');
const getToken=()=>{try{return localStorage.getItem('sd_token')}catch{return null}};
const setToken=t=>{try{t?localStorage.setItem('sd_token',t):localStorage.removeItem('sd_token')}catch{}};
async function api(path,opt={}){
  const h={'Content-Type':'application/json'},t=getToken();if(t)h.Authorization='Bearer '+t;
  const r=await fetch('/api'+path,{method:opt.method||'GET',headers:h,body:opt.body?JSON.stringify(opt.body):undefined});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw Object.assign(new Error(d.error||'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'),{status:r.status});return d;
}
function toast(msg,kind='ok'){let box=$('#toasts');if(!box){box=el('div');box.id='toasts';document.body.append(box)}const t=el('div','toast '+kind,(kind==='ok'?'✅ ':'⚠️ ')+msg);box.append(t);setTimeout(()=>t.remove(),3800)}
async function busy(btn,fn){btn.disabled=true;btn.classList.add('load');try{return await fn()}finally{btn.disabled=false;btn.classList.remove('load')}}
document.addEventListener('DOMContentLoaded',()=>{
  const b=$('.burger'),l=$('.links');if(b)b.onclick=()=>l.classList.toggle('open');
  if(l&&getToken()){const a=$('[data-auth]',l);if(a){a.textContent='แดชบอร์ด';a.href='/dashboard.html'}}
});
let AC;function playSound(name,vol=.6){if(name==='none')return;
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
  const seq={chime:[[880,0],[1318,.12],[1760,.24]],coin:[[988,0],[1319,.09]],pop:[[400,0],[700,.06]]}[name]||[];
  seq.forEach(([f,t])=>{const o=AC.createOscillator(),g=AC.createGain(),s=AC.currentTime+t;o.type=name==='coin'?'square':'sine';o.frequency.value=f;g.gain.setValueAtTime(vol*.25,s);g.gain.exponentialRampToValueAtTime(.001,s+.4);o.connect(g);g.connect(AC.destination);o.start(s);o.stop(s+.45)})}catch{}}
function buildAlert(d,s){
  const a=el('div','alert');a.style.setProperty('--c1',s.color);a.style.setProperty('--c2',s.color2);a.style.fontFamily=`'${s.font}',sans-serif`;
  const top=el('div','alert-top'),t=el('div','alert-title');t.append(el('b','',d.name),' โดเนท ',el('b','amt',thb(d.amount)));
  top.append(el('span','','💜'),t);if(d.test)top.append(el('span','tag','ทดสอบ'));a.append(top);
  if(d.message)a.append(el('div','alert-msg',d.message));return a;
}
function showAlert(root,d,s,done){
  const a=buildAlert(d,s);a.classList.add('a-'+s.anim);root.append(a);playSound(s.sound,s.volume);
  setTimeout(()=>{a.classList.add('out');setTimeout(()=>{a.remove();done&&done()},600)},s.duration);
}
