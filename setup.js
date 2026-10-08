(()=>{
 const $=s=>document.querySelector(s),form=$('#setupForm');
 const button=form.querySelector('button');
 button.disabled=true;
 const call=async(path,opts)=>({ok:true,v:await OMNI.request(path,opts)});
 call('setup/status').then(({v})=>{
   if(typeof v.needed!=='boolean')throw new Error('Invalid setup response. Upload the complete v4 backend.');
   if(!v.needed){location.replace('admin.html');return;}
   $('#keyWrap').hidden=!v.needKey;button.disabled=false;
 }).catch(e=>{$('#setupError').textContent=e.message+' Open connection.html to test the connection.'});
 $('#showPassword').onchange=e=>{const type=e.target.checked?'text':'password';$('#password').type=type;$('#confirm').type=type};
 $('#password').oninput=()=>{const n=$('#password').value.length;$('#lengthHint').textContent=n>=10?'Password length is good ✓':n+' of 10 characters entered';$('#lengthHint').classList.toggle('good',n>=10);$('#setupError').textContent=''};
 form.onsubmit=async e=>{e.preventDefault();const password=$('#password').value,confirm=$('#confirm').value,button=form.querySelector('button');if(password.length<10){$('#setupError').textContent='Password must have at least 10 characters.';return}if(password!==confirm){$('#setupError').textContent='The two passwords do not match.';return}button.disabled=true;button.textContent='Creating account...';try{window.OmniLoader&&window.OmniLoader.show('Creating your account…');const {ok,v}=await call('setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,confirm,setupKey:$('#setupKey').value})});if(!ok)throw new Error(v.error||'Setup failed');const login=await call('admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});if(!login.ok)throw new Error('Account created. Open the admin page and sign in.');location.replace('admin.html')}catch(err){window.OmniLoader&&window.OmniLoader.hide();$('#setupError').textContent=err.message;button.disabled=false;button.innerHTML='Create admin account <span>→</span>'}};
})();
