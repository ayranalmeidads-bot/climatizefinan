/* Climatize 2.3.5: registro não bloqueante de ciência para contas existentes. */
(() => {
 'use strict';
 const VERSION = '1.0';
 const $ = (id) => document.getElementById(id);
 const panel = $('legal-ack-banner');
 const check = $('legal-ack-check');
 const button = $('legal-ack-button');
 const status = $('legal-ack-status');
 const auth = typeof supabase10 !== 'undefined' ? supabase10?.auth : null;
 if (!panel || !check || !button || !auth) return;
 let activeUserId = null;
 let working = false;
 let revision = 0;
 function notify(message) { status.textContent = message; status.classList.toggle('hidden', !message); }
 async function refresh() {
   const current = ++revision;
   try {
     const { data, error } = await auth.getUser();
     if (current !== revision) return;
     if (error || !data?.user) { activeUserId = null; panel.classList.add('hidden'); return; }
     activeUserId = data.user.id;
     const acknowledged = data.user.user_metadata?.termos_versao === VERSION && !!data.user.user_metadata?.termos_aceito_em;
     panel.classList.toggle('hidden', acknowledged);
     if (!acknowledged) { check.checked = false; button.disabled = true; notify(''); }
   } catch (_) { panel.classList.add('hidden'); }
 }
 check.addEventListener('change', () => { button.disabled = !check.checked || working; });
 button.addEventListener('click', async () => {
   if (!check.checked || working || !activeUserId) return;
   working = true; button.disabled = true; notify('Registrando sua ciência…');
   try {
     const { data, error } = await auth.updateUser({ data: { termos_versao: VERSION, termos_aceito_em: new Date().toISOString() } });
     if (error || data?.user?.id !== activeUserId) throw (error || Error('Não foi possível confirmar a conta.'));
     panel.classList.add('hidden'); notify('');
   } catch (e) { notify('Não foi possível registrar agora. Confira sua conexão e tente novamente.'); }
   finally { working = false; button.disabled = !check.checked; }
 });
 // Never restrict account access when legal metadata cannot be read or written.
 auth.onAuthStateChange((event) => {
   if (event === 'SIGNED_OUT') { activeUserId = null; panel.classList.add('hidden'); revision++; }
   else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') setTimeout(refresh, 0);
 });
 setTimeout(refresh, 0);
})();
