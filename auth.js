// Login + register forms.
const form=$('#authForm'),isReg=form.dataset.mode==='register';
if(getToken())api('/me').then(()=>location.replace('/dashboard.html')).catch(()=>setToken(null));
form.addEventListener('submit',async e=>{
  e.preventDefault();const err=$('#err'),btn=$('button',form);err.textContent='';
  const body={username:form.username.value.trim(),password:form.password.value};
  if(isReg){body.displayName=form.displayName.value.trim();if(body.password.length<8)return err.textContent='รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'}
  try{const r=await busy(btn,()=>api(isReg?'/register':'/login',{method:'POST',body}));setToken(r.token);location.href='/dashboard.html'}catch(x){err.textContent=x.message}
});
