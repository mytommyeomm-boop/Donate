// Streamer dashboard: stats, history, customization, link copying, test alerts.
let me;const cf=$('#cf');
if(!getToken())location.replace('/login.html');
const row=(d,showStatus)=>{const r=el('div','row'),tx=el('div','tx'),b=el('b','',d.name);tx.append(b);
  if(d.message!==undefined)tx.append(el('small','',(d.message||'—')));r.append(el('div','av',[...d.name][0]||'?'),tx);
  const rt=el('div');rt.style.textAlign='right';rt.append(el('b','',thb(d.amount)));
  if(showStatus){const bd=el('span','badge b-'+d.status,{paid:'สำเร็จ',pending:'รอชำระ',failed:'ล้มเหลว'}[d.status]);rt.append(el('br'),bd);if(d.test)rt.append(' ',el('span','badge b-test','ทดสอบ'))}
  r.append(rt);return r};
function fill(box,list,fn,empty){box.replaceChildren();list.length?list.forEach(x=>box.append(fn(x))):box.append(el('p','mu',empty))}
async function load(){
  const d=await api('/dashboard');
  $('#st-total').textContent=thb(d.total);$('#st-today').textContent=thb(d.today);$('#st-count').textContent=d.count;
  fill($('#top'),d.top,t=>row(t,false),'ยังไม่มีข้อมูล');
  fill($('#recent'),d.recent.slice(0,5),x=>row(x,true),'ยังไม่มีรายการโดเนท');
  fill($('#all'),d.recent,x=>row(x,true),'ยังไม่มีรายการโดเนท');
}
function setForm(s,name){const a=s.alert,p=s.page;
  Object.entries({color:a.color,color2:a.color2,font:a.font,anim:a.anim,sound:a.sound,volume:a.volume,duration:a.duration/1000,displayName:name,bio:p.bio,accent:p.accent,suggested:p.suggested.join(','),minAmount:s.minAmount}).forEach(([k,v])=>cf[k].value=v);$('#dv').textContent=cf.duration.value}
function readForm(){const sg=cf.suggested.value.split(',').map(x=>x.trim()).filter(Boolean).map(Number);
  return{displayName:cf.displayName.value.trim(),minAmount:+cf.minAmount.value,alert:{color:cf.color.value,color2:cf.color2.value,font:cf.font.value,anim:cf.anim.value,sound:cf.sound.value,volume:+cf.volume.value,duration:cf.duration.value*1000},page:{accent:cf.accent.value,bio:cf.bio.value,suggested:sg}}}
function preview(){const s=readForm().alert,pv=$('#pv');pv.replaceChildren();showAlert(pv,{name:'ตัวอย่าง',amount:100,message:'ข้อความตัวอย่างจากผู้ชม',test:true},s)}
(async()=>{try{me=await api('/me')}catch{setToken(null);return location.replace('/login.html')}
  $('#hi').textContent=me.displayName;const o=location.origin;$('#u-page').value=`${o}/d/${me.username}`;$('#u-ov').value=`${o}/overlay.html?key=${me.overlayKey}`;
  setForm(me.settings,me.displayName);await load().catch(x=>toast(x.message,'bad'));setInterval(()=>load().catch(()=>{}),10000)})();
$('#tabs').onclick=e=>{const t=e.target.dataset.t;if(!t)return;$$('#tabs button').forEach(b=>b.classList.toggle('on',b===e.target));['over','hist','cust'].forEach(id=>$('#'+id).classList.toggle('hide',id!==t))};
document.addEventListener('click',async e=>{const id=e.target.dataset.copy;if(!id)return;const i=$('#'+id);try{await navigator.clipboard.writeText(i.value)}catch{i.select();document.execCommand('copy')}toast('คัดลอกลิงก์แล้ว')});
cf.addEventListener('input',()=>{$('#dv').textContent=cf.duration.value});
$('#prev').onclick=preview;
$('#obs').onclick=async e=>{try{await api('/test-alert',{method:'POST'});toast('ส่งการแจ้งเตือนทดสอบแล้ว (ต้องเปิดหน้า overlay อยู่)')}catch(x){toast(x.message,'bad')}};
cf.addEventListener('submit',async e=>{e.preventDefault();const err=$('#cerr');err.textContent='';
  try{const r=await busy($('#save'),()=>api('/settings',{method:'PUT',body:readForm()}));me.settings=r.settings;$('#hi').textContent=r.displayName;toast('บันทึกแล้ว')}catch(x){err.textContent=x.message}});
$('#logout').onclick=async()=>{try{await api('/logout',{method:'POST'})}catch{}setToken(null);location.href='/'};
