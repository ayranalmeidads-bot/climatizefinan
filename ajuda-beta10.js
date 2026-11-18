/* Climatize Beta 1.0: tour por conta/aparelho e suporte autenticado via Supabase/RLS. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const db=typeof supabase10!=='undefined'?supabase10:null;
 const steps=[
  {module:'financeiro',title:'Seu Financeiro',description:'Aqui ficam o resumo, novos lançamentos, histórico e os filtros para baixar PDF ou Excel (.xlsx).'},
  {module:'agenda',title:'Agenda de serviços',description:'Selecione um dia para ver compromissos ou toque em “+ Compromisso” para agendar visitas e serviços.'},
  {module:'orcamentos',title:'Orçamentos sem confusão',description:'Monte a proposta, gere o PDF, depois confirme os serviços executados e o valor cobrado. Um valor cobrado ainda não é pagamento.'},
  {module:'orcamentos',title:'Recebimento e financeiro',description:'Para o valor realmente recebido aparecer no Financeiro, abra o orçamento e confirme o recebimento no painel correspondente.'},
  {module:'marketing',title:'Marketing e fotos',description:'Escolha um dos seis modelos, toque nas imagens para recortar e editar, e baixe a arte pronta em PNG.'},
  {module:'ajuda',title:'Ajuda sempre disponível',description:'Nesta aba você pode rever o tour, consultar as dúvidas frequentes e enviar mensagens ao suporte DS. Suas respostas aparecerão em “Minhas solicitações”.'}
 ];
 let tour=null,step=0,previousFocus=null,currentUser=null,autoStarted=false;
 function isVisible(){return !$('app-dashboard')?.classList.contains('hidden') && $('auth-screen')?.classList.contains('hidden');}
 function activateModule(name){document.querySelector(`.module-tab[data-modulo="${name}"]`)?.click();}
 function buildTour(){if(tour)return tour;
  tour=document.createElement('div');tour.className='cl-tour-dim';tour.id='cl-tour-overlay';tour.hidden=true;
  tour.innerHTML='<section class="cl-tour-card" role="dialog" aria-modal="true" aria-labelledby="cl-tour-title" aria-describedby="cl-tour-copy"><div class="cl-tour-kicker" id="cl-tour-progress"></div><h2 id="cl-tour-title"></h2><p id="cl-tour-copy"></p><div class="cl-tour-actions"><button class="btn-outline" type="button" id="cl-tour-skip">Pular tour</button><button class="btn-outline" type="button" id="cl-tour-prev">Voltar</button><button class="btn-primary" type="button" id="cl-tour-next">Próximo</button></div></section>';
  document.body.append(tour);$('cl-tour-skip').onclick=()=>closeTour(true);$('cl-tour-prev').onclick=()=>{step=Math.max(0,step-1);renderTour();};$('cl-tour-next').onclick=()=>{if(step===steps.length-1)closeTour(true);else{step++;renderTour();}};
  tour.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeTour(true);}if(e.key==='Tab'){const controls=[...tour.querySelectorAll('button')].filter(b=>!b.disabled);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});return tour;
 }
 function renderTour(){if(!isVisible()){closeTour(false);return;}const s=steps[step];activateModule(s.module);$('cl-tour-progress').textContent=`PASSO ${step+1} DE ${steps.length}`;$('cl-tour-title').textContent=s.title;$('cl-tour-copy').textContent=s.description;$('cl-tour-prev').hidden=step===0;$('cl-tour-next').textContent=step===steps.length-1?'Concluir tour':'Próximo';$('cl-tour-next').focus({preventScroll:true});}
 function startTour(){if(!isVisible())return;buildTour();previousFocus=document.activeElement;step=0;tour.hidden=false;renderTour();}
 function closeTour(mark){if(!tour||tour.hidden)return;tour.hidden=true;if(mark&&currentUser){try{localStorage.setItem('climatize_tour_beta10_'+currentUser.id,'feito');}catch{}}if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
 async function autoTour(){if(!db||!isVisible()||autoStarted)return;let u=null;try{const r=await db.auth.getUser();u=r.data?.user;}catch{return;}if(!u||!isVisible())return;currentUser=u;const key='climatize_tour_beta10_'+u.id;try{if(localStorage.getItem(key)==='feito'){autoStarted=true;return;}}catch{}autoStarted=true;setTimeout(()=>{if(isVisible()&&currentUser?.id===u.id)startTour();},700);}
 function status(text,error=false){const el=$('cl-feedback-status');if(el){el.textContent=text;el.classList.toggle('cl-error',error);}}
 function shortDate(iso){try{return new Date(iso).toLocaleString('pt-BR');}catch{return '—';}}
 const statusNames={novo:'Recebida',em_analise:'Em análise',respondido:'Respondida',concluido:'Concluída'};
 function node(tag,text='',cl=''){const e=document.createElement(tag);e.textContent=text;if(cl)e.className=cl;return e;}
 async function getAuthUser(){if(!db)throw Error('Conexão indisponível. Atualize a página.');const {data,error}=await db.auth.getUser();if(error||!data?.user)throw Error('Faça login novamente para enviar mensagens.');return data.user;}
 async function loadMessages(){const box=$('cl-feedback-items');if(!box)return;box.textContent='Consultando suas mensagens…';try{
  await getAuthUser();const {data,error}=await db.from('climatize_feedback_beta10').select('id,category,module,subject,body,status,admin_reply,created_at,replied_at').order('created_at',{ascending:false}).limit(30);
  if(error)throw error;box.replaceChildren();if(!data?.length){box.textContent='Nenhuma solicitação enviada ainda.';return;}
  data.forEach(m=>{const item=node('article','','cl-feedback-entry');item.append(node('small',`${shortDate(m.created_at)} · ${statusNames[m.status]||m.status||'Recebida'} · ${m.category||'Dúvida'}`),node('strong',m.subject),node('p',m.body));if(m.admin_reply){const reply=node('div','','cl-feedback-reply');reply.append(node('strong','Resposta do suporte'),node('p',m.admin_reply));item.append(reply);}box.append(item);});
 }catch(e){const msg=String(e.message||'');box.textContent=msg.includes('does not exist')||msg.includes('schema cache')||msg.includes('climatize_feedback_beta10')?'O envio de mensagens ainda não foi ativado. O administrador precisa executar o SQL 04 do pacote Beta 1.0.':'Não foi possível consultar as mensagens agora. Confira sua conexão e tente novamente.';}}
 async function submit(e){e.preventDefault();const button=$('cl-feedback-send');if(button.disabled)return;button.disabled=true;status('Enviando mensagem…');try{const user=await getAuthUser();const body=$('cl-feedback-message').value.trim(),subject=$('cl-feedback-subject').value.trim();if(body.length<12||subject.length<5)throw Error('Preencha um título e descreva a solicitação.');
 const {error}=await db.from('climatize_feedback_beta10').insert({user_id:user.id,category:$('cl-feedback-type').value,module:$('cl-feedback-module').value,subject,body});if(error)throw error;
 $('cl-feedback-form').reset();status('Mensagem recebida pelo sistema! Você poderá acompanhar a resposta em Minhas solicitações.');await loadMessages();
 }catch(err){const raw=String(err.message||'');status(raw.includes('climatize_feedback_beta10')||raw.includes('schema cache')?'Este recurso ainda não está habilitado no Supabase. Configure o SQL 04 antes de enviar.':raw.includes('limite')||raw.includes('Limite')?'Limite de mensagens atingido. Aguarde antes de tentar novamente.':'Não foi possível enviar agora. Confira sua conexão, aguarde um momento e tente novamente.',true);}finally{button.disabled=false;}}
 function init(){ $('cl-tour-restart')?.addEventListener('click',startTour);$('cl-feedback-form')?.addEventListener('submit',submit);$('cl-feedback-refresh')?.addEventListener('click',loadMessages);
  document.querySelector('.module-tab[data-modulo="ajuda"]')?.addEventListener('click',loadMessages);
  if(!db)return;
  const container=$('app-dashboard');if(container){const obs=new MutationObserver(()=>{if(isVisible())autoTour();else{closeTour(false);autoStarted=false;currentUser=null;}});obs.observe(container,{attributes:true,attributeFilter:['class']});}
  db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){currentUser=null;autoStarted=false;closeTour(false);}else if(event==='SIGNED_IN'&&session?.user)setTimeout(autoTour,600);});
  setTimeout(autoTour,900);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
