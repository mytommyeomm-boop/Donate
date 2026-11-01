// Viewer donation page: form → live preview → payment status polling → confirmation.
const user=(location.pathname.split('/')[2]||new URLSearchParams(location.search).get('s')||'').toLowerCase();
const f=$('#donForm');let S,amount=0,poll;
async function init(){
  try{S=await api('/streamer/'+encodeURIComponent(user))}catch{$('#loading').classList.add('hide');$('#missing').classList.remove('hide');return}
  document.title=`โดเนทให้ ${S.displayName}`;document.documentElement.style.setProperty('--ac',S.accent);
  $('#who-n').textContent=S.displayName;$('#who-b').textContent=S.bio;$('#av').textContent=[...S.displayName][0]||'?';
  const chips=$('#chips');S.suggested.forEach(a=>{const b=el('button','',thb(a));b.type='button';b.onclick=()=>{setAmt(a);$('#custom').value=''};chips.append(b)});
  $('#custom').min=S.minAmount;$('#minhint').textContent='ขั้นต่ำ '+thb(S.minAmount);
  if((await api('/config')).dev)$('#devnote').classList.remove('hide');
  $('#loading').classList.add('hide');f.classList.remove('hide');preview();
}
function setAmt(a){amount=a;$$('#chips button').forEach(b=>b.classList.toggle('on',b.textContent===thb(a)));preview()}
function preview(){const p=$('#pv');p.replaceChildren();const a=buildAlert({name:f.name.value.trim()||'ชื่อของคุณ',amount:amount||0,message:f.message.value.trim()||'ข้อความของคุณจะแสดงตรงนี้'},S.alert);a.classList.add('static');p.append(a)}
f.addEventListener('input',e=>{if(e.target.id==='custom'){amount=Math.floor(+e.target.value)||0;$$('#chips button').forEach(b=>b.classList.remove('on'))}$('#cnt').textContent=f.message.value.length;preview()});
f.addEventListener('submit',async e=>{
  e.preventDefault();const err=$('#err');err.textContent='';
  if(!f.name.value.trim())return err.textContent='กรุณากรอกชื่อของคุณ';
  if(!amount||amount<S.minAmount)return err.textContent=`กรุณาเลือกยอดอย่างน้อย ${thb(S.minAmount)}`;
  try{const r=await busy($('#go'),()=>api('/donate',{method:'POST',body:{username:S.username,name:f.name.value.trim(),amount,message:f.message.value.trim()}}));pay(r)}catch(x){err.textContent=x.message}
});
function pay(r){
  f.classList.add('hide');const s=$('#status');s.classList.remove('hide');s.replaceChildren();
  const wait=el('div','state');wait.append(el('div','spin'),el('h3','','รอการยืนยันการชำระเงิน…'),el('p','mu',`${thb(amount)} · รหัส ${r.id}`),
   el('p','hint','สถานะจะอัปเดตอัตโนมัติ — จะไม่แสดงว่าสำเร็จจนกว่าระบบจะยืนยันการชำระเงินจริง'));
  if(r.checkoutUrl){const a=el('a','btn block','ไปหน้าชำระเงิน');a.href=r.checkoutUrl;a.style.marginTop='14px';wait.append(a)}
  if(r.dev){const b=el('button','btn ghost block','จำลองการชำระเงิน (โหมดทดสอบ)');b.style.marginTop='10px';b.onclick=()=>api('/dev/confirm/'+r.id,{method:'POST'}).catch(x=>toast(x.message,'bad'));wait.append(b)}
  s.append(wait);let n=0;
  poll=setInterval(async()=>{try{const d=await api('/donation/'+r.id);if(d.status!=='pending'){clearInterval(poll);done(d)}}catch{}if(++n>900)clearInterval(poll)},2000);
}
function done(d){
  const s=$('#status');s.replaceChildren();const ok=d.status==='paid',w=el('div','state');
  w.append(el('div','em',ok?'🎉':'❌'),el('h2','',ok?'ขอบคุณที่สนับสนุน!':'การชำระเงินไม่สำเร็จ'),
   el('p','mu',ok?`โดเนท ${thb(d.amount)} ถึง ${S.displayName} เรียบร้อยแล้ว${d.test?' (รายการทดสอบ)':''}`:'ไม่มีการตัดเงิน กรุณาลองใหม่อีกครั้ง'));
  const b=el('button','btn block',ok?'โดเนทอีกครั้ง':'ลองอีกครั้ง');b.style.marginTop='16px';b.onclick=()=>{s.classList.add('hide');f.classList.remove('hide');if(ok){f.message.value='';$('#cnt').textContent=0;preview()}};w.append(b);s.append(w);
}
init();
