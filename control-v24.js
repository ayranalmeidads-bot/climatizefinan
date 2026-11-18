/* Climatize 2.4: consulta à configuração pública mínima, sem chaves administrativas. */
(()=>{'use strict';const notice=document.createElement('div');notice.id='clim-central-notice';notice.hidden=true;notice.setAttribute('role','status');
 const locked=document.createElement('div');locked.id='clim-central-lock';locked.hidden=true;locked.innerHTML='<div class="clim-maintenance-box"><div style="font-size:44px" aria-hidden="true">⚒</div><h1>Climatize em manutenção</h1><p id="clim-central-message"></p><p>Seus registros permanecem preservados. Tente novamente mais tarde.</p><a href="mailto:ayranalmeidads@gmail.com">Suporte técnico DS</a></div>';
 document.body.prepend(notice,locked);
 let config=null;async function check(){try{
   if(typeof supabase10==='undefined'||!supabase10)return;
   const {data,error}=await supabase10.from('climatize_public_settings_v24').select('mode,message,published_version,marketing_defaults,changed_at').eq('id','main').maybeSingle();
   if(error)throw error;if(!data)return;
   config=data;const message=(data.message||'Atualização programada').slice(0,400);notice.hidden=data.mode!=='aviso';if(!notice.hidden)notice.textContent='ℹ️ '+message;
   locked.hidden=data.mode!=='manutencao';if(!locked.hidden){document.getElementById('clim-central-message').textContent=message;document.body.style.overflow='hidden';}else document.body.style.overflow='';
   window.dispatchEvent(new CustomEvent('climatize:config',{detail:{marketing:data.marketing_defaults||{},version:data.published_version}}));
 }catch(e){/* Banco mantém proteção das operações mesmo quando aviso não carrega. */console.warn('Estado de manutenção indisponível: conexão ou SQL pendente.');}}
 check();setInterval(check,60000);window.addEventListener('focus',check);
})();
