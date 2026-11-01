// OBS Browser Source: transparent page, server-sent events, one alert at a time.
// URL: /overlay.html?key=OVERLAY_KEY[&pos=top|center|bottom]
const q=new URLSearchParams(location.search),key=q.get('key'),stage=$('#stage'),queue=[];let S=null,busyNow=false;
stage.classList.add('pos-'+(q.get('pos')||'top'));
function next(){if(busyNow||!queue.length||!S)return;busyNow=true;showAlert(stage,queue.shift(),S,()=>{busyNow=false;setTimeout(next,350)})}
if(key){const es=new EventSource('/api/overlay/stream?key='+encodeURIComponent(key));
  es.addEventListener('settings',e=>{S=JSON.parse(e.data);next()});
  es.addEventListener('alert',e=>{const m=JSON.parse(e.data);S=m.settings||S;queue.push(m.donation);next()});}
