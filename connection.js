(() => {
 const $ = id => document.getElementById(id);
 $('frontend').textContent = location.origin + location.pathname.replace(/[^/]*$/, '');
 $('backend').textContent = OMNI.base || '(same host)';
 $('test').onclick = async () => {
   $('test').disabled = true; $('result').textContent = 'Checking PHP and MySQL…';
   try {
     const v = await OMNI.request('health');
     if(v.app !== 'OmniStaq' || v.database !== 'connected') throw new Error('Unexpected backend. Upload the complete v4 files to your PHP host.');
     $('result').textContent = 'Connected ✓\nBackend: ' + v.version + '\nMySQL: connected\nImage and receipt storage: MySQL\nNow open Admin setup, or sign in to your existing admin account.';
   } catch(e) { $('result').textContent = e.message; }
   finally { $('test').disabled = false; }
 };
})();
