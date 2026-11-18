/* Climatize 2.0: módulos ADITIVOS. O financeiro legado continua em app.js. */
(() => {
  'use strict';
  const db = typeof supabase10 !== 'undefined' ? supabase10 : null;
  const $ = (id) => document.getElementById(id);
  const dinheiro = (n) => Number(n || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
  const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dataLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const horaLocal = (d) => `${dataLocal(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const dataFormatada = (d) => d ? new Date(`${String(d).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';
  const tipos = ['Instalação','Higienização','Manutenção corretiva','Infraestrutura','Desinstalação','Reoperação','Suporte','Kit frigorígeno','Material','Visita técnica','Outro'];
  const statusNome = {rascunho:'Rascunho',enviado:'Enviado',aprovado:'Aprovado',agendado:'Agendado',realizado:'Realizado',cancelado:'Cancelado'};
  const tipoAgenda = {instalacao:'Instalação',manutencao:'Manutenção',ferias:'Férias',visita:'Visita técnica',outro:'Outro'};
  let user = null, orcamentos = [], compromissos = [], recebimentos = [];
  let desconsiderados = new Set();
  let activeQuote = null, mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected = dataLocal();
  let carregando = false, chavePagamento = null, quoteDirty = false;

  function flash(message, danger = false) {
    const el = $('app-flash'); el.textContent = message; el.classList.remove('hidden');
    el.classList.toggle('is-danger', danger);
    el.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function apagarFlash() { $('app-flash').classList.add('hidden'); }
  function erro(e) { console.error('[Climatize 2.0]',e); flash(e?.message || String(e) || 'Não foi possível concluir a ação.',true); }
  function modulo(nome) {
    ['financeiro','agenda','orcamentos','marketing'].forEach(id => $('modulo-'+id).classList.toggle('hidden',id!==nome));
    document.querySelectorAll('[data-modulo]').forEach(b => { b.classList.toggle('is-active',b.dataset.modulo===nome); b.setAttribute('aria-selected',String(b.dataset.modulo===nome)); });
    apagarFlash();
    if(nome==='agenda') renderCalendario(); if(nome==='orcamentos') renderOrcamentos();
  }
  async function sessao() {
    if(window.ClimatizeAuthFlow?.isBlockingDashboard()) return;
    if(!db) return;
    const {data:{user:u},error} = await db.auth.getUser(); if(error) throw error;
    if(window.ClimatizeAuthFlow?.isBlockingDashboard()) return;
    user=u;
    if(!user) { orcamentos=[]; compromissos=[]; recebimentos=[]; desconsiderados.clear(); return; }
    if($('app-dashboard').classList.contains('hidden')) {
      $('auth-screen').classList.add('hidden'); $('app-dashboard').classList.remove('hidden');
      if(typeof initDashboard==='function') await initDashboard();
    }
    await carregar();
  }
  async function carregar() {
    if(!db || !user || carregando) return;
    carregando=true;
    try {
      const [o,a,p] = await Promise.all([
        db.from('climatize_orcamentos_v2').select('*').order('criado_em',{ascending:false}),
        db.from('climatize_agenda_v2').select('*').order('inicio',{ascending:true}),
        db.from('climatize_recebimentos_v2').select('*').order('criado_em',{ascending:false})
      ]);
      for(const r of [o,a,p]) if(r.error) throw r.error;
      orcamentos=o.data||[]; compromissos=a.data||[]; recebimentos=p.data||[];
      // Recurso de correção é opcional até a migração 02 ser homologada.
      const excluidos=await db.from('climatize_orcamentos_desconsiderados_v2').select('orcamento_id');
      desconsiderados=excluidos.error?new Set():new Set((excluidos.data||[]).map(x=>x.orcamento_id));
      renderOrcamentos(); renderCalendario();
    } catch(e) { erro(new Error('Não foi possível carregar os módulos v2. Confirme a migração SQL e as políticas de acesso. Detalhe: '+e.message)); }
    finally { carregando=false; }
  }
  async function recarregar() { carregando=false; await carregar(); }
  async function idUsuario() {
    const {data:{user:u},error}=await db.auth.getUser(); if(error||!u) throw new Error('Sessão expirada. Faça login novamente.');
    user=u; return u.id;
  }

  // === CALENDÁRIO ===
  function eventosDoDia(dia) {
    const inicio = new Date(`${dia}T00:00:00`).getTime(); const fim = new Date(`${dia}T00:00:00`).setDate(new Date(`${dia}T00:00:00`).getDate()+1);
    return compromissos.filter(e => Date.parse(e.inicio)<fim && Date.parse(e.fim)>inicio);
  }
  function renderCalendario() {
    $('cal-month').textContent = mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    const grid=$('cal-grid'); grid.replaceChildren();
    const first = new Date(mes.getFullYear(),mes.getMonth(),1);
    const start = new Date(first); start.setDate(1-first.getDay());
    for(let i=0;i<42;i++) {
      const day=new Date(start);day.setDate(start.getDate()+i);const iso=dataLocal(day);const ev=eventosDoDia(iso);
      const btn=document.createElement('button');btn.type='button';btn.className='cal-day';
      if(day.getMonth()!==mes.getMonth()) btn.classList.add('is-outside');
      if(iso===dataLocal())btn.classList.add('is-today');
      if(iso===selected)btn.classList.add('is-selected');
      btn.setAttribute('aria-label',`${dataFormatada(iso)} — ${ev.length} compromissos`);
      btn.innerHTML=`<span class="cal-number">${day.getDate()}</span><span class="cal-dots">${ev.slice(0,4).map(e=>`<i class="cal-dot ${escapeHtml(e.tipo)}"></i>`).join('')}</span>`;
      btn.addEventListener('click',()=>{selected=iso;if(day.getMonth()!==mes.getMonth())mes=new Date(day.getFullYear(),day.getMonth(),1);renderCalendario();});
      grid.append(btn);
    }
    $('agenda-selected-title').textContent=`${dataFormatada(selected)} · ${eventosDoDia(selected).length} compromisso(s)`;
    const lista=$('agenda-dia-lista');lista.replaceChildren();
    if(!eventosDoDia(selected).length)lista.innerHTML='<div class="empty-state">Nenhum compromisso nesta data. Toque em “+ Compromisso” para adicionar.</div>';
    eventosDoDia(selected).sort((a,b)=>Date.parse(a.inicio)-Date.parse(b.inicio)).forEach(e=>{
      const item=document.createElement('article');item.className='agenda-event';
      const hora=e.tipo==='ferias'?'Período reservado':`${new Date(e.inicio).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}–${new Date(e.fim).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
      item.innerHTML=`<span class="event-marker ${escapeHtml(e.tipo)}"></span><div><b>${escapeHtml(e.titulo)}</b><small>${escapeHtml(tipoAgenda[e.tipo]||e.tipo)} • ${hora}${e.cliente?' • '+escapeHtml(e.cliente):''}</small>${e.localizacao?`<small>📍 ${escapeHtml(e.localizacao)}</small>`:''}</div>`;
      const edit=document.createElement('button');edit.className='btn-outline';edit.textContent=e.orcamento_id?'Abrir orçamento':'Editar';
      edit.onclick=()=>{if(e.orcamento_id){modulo('orcamentos');abrirOrcamento(e.orcamento_id);}else abrirAgenda(e);};item.append(edit);
      if(!e.orcamento_id){const del=document.createElement('button');del.className='btn-text-danger';del.textContent='Excluir';del.onclick=()=>removerAgenda(e);item.append(del);}
      lista.append(item);
    });
  }
  function abrirAgenda(e=null) {
    $('agenda-form-wrap').classList.remove('hidden');$('agenda-form').reset();
    $('agenda-id').value=e?.id||'';
    $('agenda-form-heading').textContent=e?'Editar compromisso':'Novo compromisso';
    const start=e?new Date(e.inicio):new Date(`${selected}T09:00:00`);
    const end=e?new Date(e.fim):new Date(start.getTime()+60*60*1000);
    $('agenda-tipo').value=e?.tipo||'instalacao';$('agenda-titulo').value=e?.titulo||'';
    $('agenda-inicio').value=horaLocal(start);$('agenda-fim').value=horaLocal(end);
    $('agenda-cliente').value=e?.cliente||'';$('agenda-local').value=e?.localizacao||'';$('agenda-notas').value=e?.observacoes||'';
    $('agenda-conflitos').classList.add('hidden');$('agenda-form-wrap').scrollIntoView({behavior:'smooth'});
  }
  function conflito(inicio,fim,ignoreId=null) {
    const i=Date.parse(inicio),f=Date.parse(fim);
    return compromissos.filter(e => e.id!==ignoreId && Date.parse(e.inicio)<f && Date.parse(e.fim)>i);
  }
  function validarConflito(start,end,ign=null,alvo='agenda-conflitos') {
    const col=conflito(start,end,ign), el=$(alvo);
    el.classList.toggle('hidden',!col.length);
    el.textContent=col.length?`Atenção: ${col.length} compromisso(s) se sobrepõem a este horário: ${col.map(x=>x.titulo).join(', ')}. Verifique antes de salvar.`:'';
    return col;
  }
  async function salvarAgenda(ev) {
    ev.preventDefault();
    const inicio=$('agenda-inicio').value, fim=$('agenda-fim').value;
    if(!inicio||!fim||new Date(fim)<=new Date(inicio))return flash('A data final deve ser posterior à inicial.',true);
    const id=$('agenda-id').value;
    const coincidencias=validarConflito(inicio,fim,id||null);
    if(coincidencias.length && !await ClimatizeDialog.confirm('Há compromissos no horário escolhido. Deseja salvar mesmo assim?'))return;
    try {
      const dados={user_id:await idUsuario(),tipo:$('agenda-tipo').value,titulo:$('agenda-titulo').value.trim(),
        cliente:$('agenda-cliente').value.trim(),localizacao:$('agenda-local').value.trim(),observacoes:$('agenda-notas').value.trim(),
        inicio:new Date(inicio).toISOString(),fim:new Date(fim).toISOString()};
      const req=id?db.from('climatize_agenda_v2').update(dados).eq('id',id):db.from('climatize_agenda_v2').insert(dados);
      const {error}=await req;if(error)throw error;
      $('agenda-form-wrap').classList.add('hidden');selected=dataLocal(new Date(inicio));mes=new Date(new Date(inicio).getFullYear(),new Date(inicio).getMonth(),1);
      await recarregar();flash('Compromisso salvo na agenda.');
    } catch(e){erro(e);}
  }
  async function removerAgenda(e) {
    if(!await ClimatizeDialog.confirm('Excluir este compromisso? Esta operação não apaga o financeiro.'))return;
    try{const {error}=await db.from('climatize_agenda_v2').delete().eq('id',e.id);if(error)throw error;await recarregar();flash('Compromisso excluído.');}catch(ex){erro(ex);}
  }

  // === ORÇAMENTOS ===
  function createItem(container, item={}, realized=false) {
    const row=document.createElement('div');row.className='quote-item-row';
    const select=document.createElement('select');select.className='item-tipo';select.setAttribute('aria-label','Tipo de serviço');
    tipos.forEach(t=>{const o=new Option(t,t);select.add(o);});select.value=tipos.includes(item.tipo)?item.tipo:'Instalação';
    const desc=document.createElement('input');desc.type='text';desc.className='item-descricao';desc.placeholder='Descrição do serviço, equipamento e detalhes';desc.maxLength=400;desc.required=true;desc.value=item.descricao||'';
    const qtd=document.createElement('input');qtd.type='number';qtd.className='item-quantidade';qtd.min='0.01';qtd.max='10000';qtd.step='0.01';qtd.required=true;qtd.value=item.quantidade??1;qtd.setAttribute('aria-label','Quantidade');
    const valor=document.createElement('input');valor.type='number';valor.className='item-valor';valor.min='0';valor.max='10000000';valor.step='0.01';valor.required=true;valor.value=item.valor_unitario??0;valor.setAttribute('aria-label','Valor unitário');
    const remover=document.createElement('button');remover.type='button';remover.className='btn-remove-item';remover.title='Excluir item';remover.textContent='×';remover.onclick=()=>{row.remove();quoteDirty=true;atualizarTotais();};
    const campo=(titulo,el,classe)=>{
      const label=document.createElement('label');label.className='quote-item-field '+classe;
      const caption=document.createElement('span');caption.textContent=titulo;
      label.append(caption,el);return label;
    };
    const valorCampo=campo('Valor unitário (R$)',valor,'q-field-valor');
    const totalItem=document.createElement('output');totalItem.className='quote-item-subtotal';totalItem.textContent=`Total do item: ${dinheiro(cents(Number(qtd.value)*Number(valor.value)))}`;valorCampo.append(totalItem);
    row.append(campo('Tipo de serviço',select,'q-field-tipo'),campo('Descrição',desc,'q-field-descricao'),campo('Qtd.',qtd,'q-field-qtd'),valorCampo,remover);
    remover.setAttribute('aria-label','Remover item');container.append(row);
    [qtd,valor].forEach(el=>el.addEventListener('input',atualizarTotais));
    return row;
  }
  function itens(container) {return [...container.querySelectorAll('.quote-item-row')].map(r=>({tipo:r.querySelector('.item-tipo').value,descricao:r.querySelector('.item-descricao').value.trim(),quantidade:Number(r.querySelector('.item-quantidade').value),valor_unitario:Number(r.querySelector('.item-valor').value)}));}
  function soma(arr) {return cents(arr.reduce((acc,x)=>acc+cents(x.quantidade*x.valor_unitario),0));}
  function atualizarTotais(){
    document.querySelectorAll('#orc-itens .quote-item-row, #orc-itens-real .quote-item-row').forEach(row=>{
      const total=row.querySelector('.quote-item-subtotal');
      if(total)total.textContent=`Total do item: ${dinheiro(cents(Number(row.querySelector('.item-quantidade').value)*Number(row.querySelector('.item-valor').value)))}`;
    });
    const s=soma(itens($('orc-itens'))), v=Number($('orc-desconto').value)||0;
    const d=$('orc-desconto-tipo').value==='percentual'?cents(s*v/100):cents(v);
    $('orc-subtotal').textContent=dinheiro(s);$('orc-valor-desconto').textContent=dinheiro(d);$('orc-total').textContent=dinheiro(s-d);
    const ar=itens($('orc-itens-real'));
    $('orc-total-real').textContent=dinheiro(soma(ar)-(Number($('orc-desconto-real').value)||0));
    $('orc-total-ref').textContent=dinheiro(s-d);
    const subtotalReal=soma(ar), descontoReal=Number($('orc-desconto-real').value)||0;
    $('orc-conf-proposta').textContent=dinheiro(s-d);
    $('orc-conf-subtotal').textContent=dinheiro(subtotalReal);
    $('orc-conf-desconto').textContent='− '+dinheiro(descontoReal);
    $('orc-conf-total').textContent=dinheiro(subtotalReal-descontoReal);
    if(!activeQuote) atualizarResumoOrcamento(null);
  }

  // Interface de trabalho v2.3.2: somente um painel expandido, sem tocar no schema.
  const painéisOrc=['orc-proposta-panel','orc-agenda-panel','orc-realizacao-wrap','orc-recebimento-wrap','orc-revisoes-wrap','orc-correcao-wrap'];
  function abrirPainelOrc(id,rolar=true){
    painéisOrc.forEach(p=>{const el=$(p);if(el)el.open=p===id && !el.classList.contains('hidden');});
    if(id&&rolar)$(id).scrollIntoView({block:'start',behavior:'smooth'});
  }
  function avisoFluxo(message,danger=false){
    const el=$('orc-flow-notice');el.textContent=message;el.classList.remove('hidden');el.classList.toggle('is-error',danger);
  }
  function limparAvisoFluxo(){const el=$('orc-flow-notice');el.classList.add('hidden');el.classList.remove('is-error');el.textContent='';}
  function atualizarResumoOrcamento(q){
    const pagamentos=q?recebimentos.filter(r=>r.orcamento_id===q.id):[];
    const pago=cents(pagamentos.reduce((acc,r)=>acc+Number(r.valor),0));
    const proposta=q?Number(q.total):cents(soma(itens($('orc-itens')))-(Number($('orc-desconto-tipo').value==='percentual'?cents(soma(itens($('orc-itens')))*(Number($('orc-desconto').value)||0)/100):(Number($('orc-desconto').value)||0))));
    const executado=q?.total_realizado!=null;
    const cobrado=executado?Number(q.total_realizado):null;
    const base=q?Number(q.total_realizado??q.total):proposta;
    const saldo=Math.max(0,cents(base-pago));
    $('orc-resumo-situacao').textContent=q?`Orçamento #${q.id.slice(0,8).toUpperCase()} · ${q.cliente_nome}`:'Nova proposta ainda não salva';
    $('orc-resumo-status').textContent=q?(desconsiderados.has(q.id)?'Desconsiderado':(statusNome[q.status]||q.status)):'Novo';
    $('orc-resumo-proposta').textContent=dinheiro(proposta);
    $('orc-resumo-cobrado').textContent=executado?dinheiro(cobrado):'A confirmar';
    $('orc-resumo-recebido').textContent=dinheiro(pago);
    $('orc-resumo-pendente').textContent=q?dinheiro(saldo):'—';
    $('orc-resumo-hint').textContent=q&&desconsiderados.has(q.id)?'Registro de teste desconsiderado: preservado no histórico para auditoria. Não é possível registrar novos recebimentos.':!q?'Primeiro salve a proposta. Cobrança e recebimento são operações independentes.':q.status==='cancelado'?'Orçamento cancelado: execução e recebimentos estão indisponíveis.':executado?'Cobrança confirmada. Os pagamentos só aparecem aqui após registro no Financeiro.':pagamentos.length?'Sinal registrado. Execução ainda não confirmada; o saldo usa o valor da proposta.':'A execução ainda não foi confirmada; o saldo usa a proposta como referência.';
    $('orc-proposta-preview').textContent=q?`Proposta salva · ${dinheiro(proposta)} · editar ou gerar PDF`:'Cliente, serviços, valores e condições';
    $('orc-agenda-preview').textContent=q?.agendado_inicio?`Agendado para ${new Date(q.agendado_inicio).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Abrir para agendar, alterar ou remover agendamento';
    $('orc-execucao-preview').textContent=executado?`Cobrança confirmada · ${dinheiro(cobrado)}`:'Conferir serviços e valor efetivamente cobrado';
    $('orc-recebimento-preview').textContent=q?`${dinheiro(pago)} recebido · ${dinheiro(saldo)} pendente`:'Disponível após salvar a proposta';
    $('orc-pay-cobrado').textContent=dinheiro(base);
    $('orc-pay-recebido').textContent=dinheiro(pago);
    $('orc-pay-pendente').textContent=dinheiro(saldo);
    $('orc-acao-execucao').disabled=!q||q.status==='cancelado'||desconsiderados.has(q.id);
    $('orc-acao-receber').disabled=!q||q.status==='cancelado'||desconsiderados.has(q.id);
    $('orc-overview-pdf').disabled=!q;
  }
  function erroCampoExecucao(message,el){
    abrirPainelOrc('orc-realizacao-wrap',false);
    $('orc-itens-real').querySelectorAll('.quote-field-error').forEach(x=>x.classList.remove('quote-field-error'));
    if(el){el.classList.add('quote-field-error');el.focus({preventScroll:true});el.scrollIntoView({block:'center',behavior:'smooth'});}
    avisoFluxo(message,true);return flash(message,true);
  }

  function limparFormulario() {
    quoteDirty=false;activeQuote=null;$('orc-form').reset();$('orc-id').value='';$('orc-status').value='rascunho';$('orc-validade').value='5';$('orc-data').value=dataLocal();
    $('orc-desconto').value='0';$('orc-desconto-real').value='0';$('orc-itens').replaceChildren();$('orc-itens-real').replaceChildren();
    createItem($('orc-itens'));
    $('orc-agendar').checked=false;$('orc-agendar-campos').classList.add('hidden');$('orc-conflitos').classList.add('hidden');
    $('orc-realizacao-wrap').classList.add('hidden');$('orc-recebimento-wrap').classList.add('hidden');$('orc-correcao-wrap').classList.add('hidden');
    $('orc-form-title').textContent='Novo orçamento';$('orc-form-wrap').classList.remove('hidden');$('orc-list-wrap').classList.add('hidden');
    $('orc-form').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);
    $('orc-itens-real').querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
    $('orc-status').querySelectorAll('option').forEach(opt=>opt.disabled=false);
    $('orc-pdf').disabled=true;chavePagamento=null;
    abrirPainelOrc('orc-proposta-panel',false);limparAvisoFluxo();
    $('orc-revisoes').textContent='Este orçamento ainda não foi salvo.';$('orc-revisoes-wrap').open=false;atualizarTotais();atualizarResumoOrcamento(null);$('orc-form-wrap').scrollIntoView({behavior:'smooth'});
  }
  function abrirOrcamento(id) {
    const q=orcamentos.find(o=>o.id===id);if(!q)return flash('Orçamento não encontrado.',true);
    quoteDirty=false;activeQuote=q;$('orc-form').reset();$('orc-id').value=q.id;
    const campo={ 'orc-cliente':q.cliente_nome,'orc-telefone':q.cliente_telefone,'orc-email':q.cliente_email,'orc-endereco':q.cliente_endereco,'orc-data':q.emissao,'orc-validade':q.validade_dias,'orc-status':q.status,'orc-desconto-tipo':q.desconto_tipo,'orc-desconto':q.desconto_input,'orc-observacoes':q.observacoes};
    Object.entries(campo).forEach(([id,val])=>$(id).value=val??'');
    $('orc-itens').replaceChildren();(q.itens||[]).forEach(item=>createItem($('orc-itens'),item));
    $('orc-agendar').checked=Boolean(q.agendado_inicio);$('orc-agendar-campos').classList.toggle('hidden',!q.agendado_inicio);
    $('orc-inicio').value=q.agendado_inicio?horaLocal(new Date(q.agendado_inicio)):'';
    $('orc-fim').value=q.agendado_fim?horaLocal(new Date(q.agendado_fim)):'';
    $('orc-conflitos').classList.add('hidden');$('orc-form-title').textContent=`Orçamento #${q.id.slice(0,8).toUpperCase()} · ${q.cliente_nome}`;
    $('orc-list-wrap').classList.add('hidden');$('orc-form-wrap').classList.remove('hidden');
    $('orc-itens-real').replaceChildren(); (q.itens_realizados||q.itens||[]).forEach(item=>createItem($('orc-itens-real'),item,true));
    $('orc-desconto-real').value=q.itens_realizados?q.desconto_realizado:q.desconto_valor;
    $('orc-realizacao-wrap').classList.toggle('hidden',q.status==='cancelado'||desconsiderados.has(q.id));
    $('orc-recebimento-wrap').classList.toggle('hidden',q.status==='cancelado'||desconsiderados.has(q.id));
    if(desconsiderados.has(q.id)){$('orc-form').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);$('orc-itens-real').querySelectorAll('input,select,button').forEach(el=>el.disabled=true);}
    $('orc-pdf').disabled=false;
    $('orc-correcao-wrap').classList.toggle('hidden',desconsiderados.has(q.id));
    const pagos=recebimentos.filter(p=>p.orcamento_id===q.id),totalPago=cents(pagos.reduce((a,p)=>a+Number(p.valor),0));
    const bloqueado=pagos.length>0;
    $('orc-itens').querySelectorAll('input,select,button').forEach(el=>el.disabled=bloqueado);
    ['orc-desconto','orc-desconto-tipo','orc-cliente'].forEach(id=>$(id).disabled=bloqueado);
    $('orc-add-item').disabled=bloqueado;
    // Pagamento adiantado não bloqueia registrar o serviço executado.
    $('orc-itens-real').querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
    ['orc-add-real','orc-copiar-real','orc-desconto-real','orc-confirmar-real'].forEach(id=>$(id).disabled=false);
    $('orc-salvar').disabled=desconsiderados.has(q.id);
    $('orc-status').querySelectorAll('option').forEach(opt=>opt.disabled=Boolean((bloqueado&&['rascunho','enviado','cancelado'].includes(opt.value))||(q.status==='realizado'&&opt.value!=='realizado')));
    const hist=$('orc-recebimentos');hist.replaceChildren();
    pagos.forEach(p=>{const r=document.createElement('div');r.className='payment-row';r.textContent=`${dataFormatada(p.data_recebimento)} · ${dinheiro(p.valor)} · Lançamento ${p.transacao_id}`;hist.append(r);});
    const limite=Number(q.total_realizado??q.total),pendente=cents(limite-totalPago);
    const sum=document.createElement('div');sum.className='payment-summary';sum.textContent=`Cobrado: ${dinheiro(limite)} · Recebido: ${dinheiro(totalPago)} · Em aberto: ${dinheiro(pendente)}`;hist.prepend(sum);
    $('orc-pagamento').value=pendente>0?pendente.toFixed(2):'';$('orc-pagamento').max=String(pendente);
    $('orc-data-pagamento').value=dataLocal();$('orc-registrar-pagamento').disabled=pendente<=0||desconsiderados.has(q.id);
    atualizarPainelCorrecao(q);
    atualizarTotais();atualizarResumoOrcamento(q);abrirPainelOrc(null,false);limparAvisoFluxo();$('orc-form-wrap').scrollIntoView({behavior:'smooth'});
    carregarRevisoes(q.id);
  }
  async function carregarRevisoes(id) {
    const destino=$('orc-revisoes');destino.textContent='Consultando revisões...';
    const {data,error}=await db.from('climatize_orcamento_revisoes_v2').select('registrado_em,versao_anterior').eq('orcamento_id',id).order('registrado_em',{ascending:false}).limit(30);
    if($('orc-id').value!==id)return;
    if(error){destino.textContent='Histórico indisponível: '+error.message;return;}
    destino.replaceChildren();
    if(!data?.length)destino.textContent='Nenhuma revisão de proposta anterior.';
    (data||[]).forEach((rev,i)=>{const x=rev.versao_anterior||{};const div=document.createElement('div');div.className='payment-row';
      div.textContent=`${new Date(rev.registrado_em).toLocaleString('pt-BR')} · ${statusNome[x.status]||x.status||'Status desconhecido'} · proposta ${dinheiro(x.total)} · cobrado ${x.total_realizado===null?'não informado':dinheiro(x.total_realizado)} · ${Array.isArray(x.itens)?x.itens.length:0} item(ns)`;
      destino.append(div);
    });
    const correcao=await db.from('climatize_auditoria_correcao_v2')
      .select('criado_em,operacao,justificativa').eq('orcamento_id',id).order('criado_em',{ascending:false}).limit(30);
    if($('orc-id').value!==id || correcao.error)return;
    (correcao.data||[]).forEach(a=>{const div=document.createElement('div');div.className='payment-row';
      div.textContent=`${new Date(a.criado_em).toLocaleString('pt-BR')} · ${a.operacao==='anular_recebimento_equivocado'?'Recebimento incorreto anulado':'Orçamento de teste desconsiderado'} · Motivo: ${a.justificativa}`;destino.append(div);
    });
  }
  function renderOrcamentos() {
    $('orc-count').textContent=String(orcamentos.filter(q=>!desconsiderados.has(q.id)).length);
    $('orc-pendente').textContent=dinheiro(orcamentos.filter(x=>!desconsiderados.has(x.id)&&!['realizado','cancelado'].includes(x.status)).reduce((s,o)=>s+Number(o.total),0));
    $('orc-realizado').textContent=dinheiro(orcamentos.filter(x=>!desconsiderados.has(x.id)&&x.status==='realizado').reduce((s,o)=>s+Number(o.total_realizado??o.total),0));
    $('orc-recebido').textContent=dinheiro(recebimentos.reduce((s,p)=>s+Number(p.valor),0));
    const busca=$('orc-busca').value.trim().toLocaleLowerCase('pt-BR'),filtro=$('orc-filter').value;
    const result=orcamentos.filter(q=>(filtro==='todos'||q.status===filtro) && (!busca||q.cliente_nome.toLocaleLowerCase('pt-BR').includes(busca)||q.id.startsWith(busca)));
    const lista=$('orc-lista');lista.replaceChildren();
    if(!result.length)lista.innerHTML='<div class="empty-state">Nenhum orçamento encontrado. Crie o primeiro usando o botão acima.</div>';
    result.forEach(q=>{
      const paid=cents(recebimentos.filter(x=>x.orcamento_id===q.id).reduce((s,x)=>s+Number(x.valor),0));
      const total=Number(q.total_realizado??q.total),diff=q.total_realizado!=null?cents(total-Number(q.total)):null;
      const el=document.createElement('article');el.className='quote-history-card';
      el.innerHTML=`<div><span class="eyebrow">#${escapeHtml(q.id.slice(0,8).toUpperCase())} · ${dataFormatada(q.emissao)}</span><h4>${escapeHtml(q.cliente_nome)}</h4><span class="quote-status status-${escapeHtml(desconsiderados.has(q.id)?'desconsiderado':q.status)}">${escapeHtml(desconsiderados.has(q.id)?'Desconsiderado':(statusNome[q.status]||q.status))}</span></div><div class="history-numbers"><strong>${dinheiro(total)}</strong><small>Recebido ${dinheiro(paid)}${diff!==null?` · Diferença vs. proposta ${dinheiro(diff)}`:''}</small></div>`;
      const actions=document.createElement('div');actions.className='history-actions';
      const b=document.createElement('button');b.className='btn-outline';b.textContent=desconsiderados.has(q.id)?'Consultar':'Abrir / editar';b.onclick=()=>abrirOrcamento(q.id);actions.append(b);
      const pdf=document.createElement('button');pdf.className='btn-outline';pdf.textContent='Baixar PDF';pdf.onclick=()=>gerarPdf(q);actions.append(pdf);
      if(!desconsiderados.has(q.id)){const corr=document.createElement('button');corr.className='btn-outline';corr.textContent='Corrigir ou desconsiderar';corr.onclick=()=>{abrirOrcamento(q.id);abrirPainelOrc('orc-correcao-wrap');};actions.append(corr);}
      el.append(actions);lista.append(el);
    });
  }
  function atualizarPainelCorrecao(q) {
    const lista=$('orc-correcao-recebimento');lista.replaceChildren();
    const p=recebimentos.filter(x=>x.orcamento_id===q.id);
    if(!p.length){const opt=document.createElement('option');opt.textContent='Nenhum recebimento registrado';opt.value='';lista.append(opt);}
    else p.forEach(x=>{const opt=document.createElement('option');opt.value=x.id;opt.textContent=`${dataFormatada(x.data_recebimento)} · ${dinheiro(x.valor)} · lançamento ${x.transacao_id}`;lista.append(opt);});
    $('orc-anular-recebimento').disabled=!p.length;
    $('orc-desconsiderar').disabled=Boolean(p.length||desconsiderados.has(q.id));
    $('orc-correcao-status').textContent=p.length?'Para desconsiderar um orçamento de teste, primeiro anule apenas os recebimentos que nunca ocorreram de verdade.':'Sem recebimentos vinculados: um orçamento de teste pode ser desconsiderado com justificativa.';
  }
  async function executarCorrecao(tipo){
    if(!activeQuote||desconsiderados.has(activeQuote.id))return;
    const motivo=$('orc-correcao-motivo').value.trim();
    if(motivo.length<12||motivo.length>500){$('orc-correcao-motivo').focus();return avisoFluxo('Informe o motivo da correção com pelo menos 12 caracteres.',true);}
    if(quoteDirty)return avisoFluxo('Há alterações pendentes na proposta. Salve ou volte ao histórico antes de corrigir registros.',true);
    const declaracao=tipo==='recebimento';
    const mensagem=declaracao?'ATENÇÃO: Anular somente um recebimento que NÃO aconteceu de verdade. O registro original ficará preservado no log de auditoria. Confirma que nenhum dinheiro foi recebido?':'Desconsiderar este orçamento de TESTE? Ele ficará no histórico e deixará de contar nos indicadores do Climatize. Compromissos na agenda permanecem até serem removidos manualmente.';
    if(!await ClimatizeDialog.confirm(mensagem))return;
    const botao=$(declaracao?'orc-anular-recebimento':'orc-desconsiderar');botao.disabled=true;
    try{
      const id=activeQuote.id;
      const args=declaracao?{p_recebimento_id:$('orc-correcao-recebimento').value,p_justificativa:motivo,p_declaracao_sem_pagamento_real:true}:{p_orcamento_id:id,p_justificativa:motivo};
      const rpc=declaracao?'climatize_v2_anular_recebimento_equivoco':'climatize_v2_desconsiderar_orcamento_teste';
      const {error}=await db.rpc(rpc,args);
      if(error){if(/not found|schema cache|could not find|PGRST202/i.test(error.message||''))throw new Error('A correção segura ainda não foi habilitada neste aplicativo. Solicite a configuração ao suporte técnico. Nenhum registro foi alterado.');throw error;}
      await recarregar();
      const atual=orcamentos.find(q=>q.id===id);
      if(!atual)throw new Error('Operação gravada, mas não foi possível carregar a lista. Atualize o aplicativo e confira o histórico antes de tentar novamente.');
      abrirOrcamento(id);
      avisoFluxo(declaracao?'Recebimento incorreto anulado. O histórico de auditoria foi preservado e o Financeiro deve ser atualizado.':'Orçamento de teste desconsiderado. Permanece disponível para consulta e fora dos indicadores ativos.');
      flash(declaracao?'Correção financeira registrada. Confira os indicadores e o histórico.':'Orçamento de teste desconsiderado.');
      if(declaracao && typeof buscarTransacoes==='function')await buscarTransacoes();
    }catch(e){erro(e);avisoFluxo(e.message||'A correção não foi confirmada. Confira os registros antes de tentar novamente.',true);}
    finally{botao.disabled=false;if(activeQuote && !desconsiderados.has(activeQuote.id))atualizarPainelCorrecao(activeQuote);}
  }

  function getQuotePayload(uid) {
    const items=itens($('orc-itens'));
    if(!items.length||items.some(i=>!i.descricao||!Number.isFinite(i.quantidade)||i.quantidade<=0||!Number.isFinite(i.valor_unitario)||i.valor_unitario<0))throw new Error('Informe descrição, quantidade e valor válidos em todos os itens.');
    const base=soma(items),discount=Number($('orc-desconto').value);
    if(!Number.isFinite(discount)||discount<0||($('orc-desconto-tipo').value==='percentual'?discount>100:discount>base))throw new Error('Desconto inválido ou maior que o subtotal.');
    const agendar=$('orc-agendar').checked;
    const inicio=agendar?$('orc-inicio').value:null, fim=agendar?$('orc-fim').value:null;
    if(agendar&&(!inicio||!fim||new Date(fim)<=new Date(inicio)))throw new Error('Informe horário inicial e final válidos para agendamento.');
    return {user_id:uid,cliente_nome:$('orc-cliente').value.trim(),cliente_telefone:$('orc-telefone').value.trim(),cliente_email:$('orc-email').value.trim(),cliente_endereco:$('orc-endereco').value.trim(),emissao:$('orc-data').value,validade_dias:Number($('orc-validade').value),status:$('orc-status').value,itens:items,desconto_tipo:$('orc-desconto-tipo').value,desconto_input:discount,observacoes:$('orc-observacoes').value.trim(),agendado_inicio:inicio?new Date(inicio).toISOString():null,agendado_fim:fim?new Date(fim).toISOString():null};
  }
  async function agendarOrcamento(q) {
    const existing=compromissos.find(x=>x.orcamento_id===q.id);
    if(!q.agendado_inicio){if(existing){const {error}=await db.from('climatize_agenda_v2').delete().eq('id',existing.id);if(error)throw error;}return;}
    const tipo=q.itens?.[0]?.tipo?.toLowerCase().includes('manuten')?'manutencao':'instalacao';
    const payload={user_id:q.user_id,orcamento_id:q.id,tipo,titulo:`${tipo==='manutencao'?'Manutenção':'Serviço'} · ${q.cliente_nome}`,cliente:q.cliente_nome,localizacao:q.cliente_endereco||'',observacoes:`Orçamento #${q.id.slice(0,8)}`,inicio:q.agendado_inicio,fim:q.agendado_fim};
    if(existing){delete payload.orcamento_id;const {error}=await db.from('climatize_agenda_v2').update(payload).eq('id',existing.id);if(error)throw error;}
    else {const {error}=await db.from('climatize_agenda_v2').insert(payload);if(error)throw error;}
  }
  async function salvarOrcamento(e) {
    e.preventDefault();
    const botao=$('orc-salvar');if(botao.disabled)return;botao.disabled=true;
    try {
      const payload=getQuotePayload(await idUsuario());
      const atual=$('orc-id').value;
      if(payload.agendado_inicio){const c=validarConflito(payload.agendado_inicio,payload.agendado_fim,compromissos.find(a=>a.orcamento_id===atual)?.id||null,'orc-conflitos');if(c.length&&!await ClimatizeDialog.confirm('Existe compromisso nesse horário. Deseja salvar mesmo assim?'))return;}
      const r=atual?db.from('climatize_orcamentos_v2').update(payload).eq('id',atual).select('*').single():db.from('climatize_orcamentos_v2').insert(payload).select('*').single();
      const {data,error}=await r;if(error)throw error;
      try{await agendarOrcamento(data);}catch(e2){await recarregar();abrirOrcamento(data.id);throw new Error('Orçamento salvo, mas o vínculo com a agenda falhou. Reabra e salve novamente. Detalhes: '+e2.message);}
      await recarregar();abrirOrcamento(data.id);avisoFluxo('✓ Orçamento salvo com sucesso. Já pode gerar o PDF. Proposta e agendamento atualizados.');flash('Orçamento salvo com sucesso. Já pode gerar o PDF.');
    }catch(e2){erro(e2);}finally{botao.disabled=false;}
  }
  async function confirmarRealizacao() {
    if(!activeQuote)return;
    if(quoteDirty){abrirPainelOrc('orc-proposta-panel');return avisoFluxo('Há mudanças não salvas na proposta ou no agendamento. Salve antes de confirmar a execução.',true);}
    const rows=[...$('orc-itens-real').querySelectorAll('.quote-item-row')];
    if(!rows.length)return erroCampoExecucao('Adicione ao menos um serviço executado antes de confirmar.');
    for(let i=0;i<rows.length;i++){
      const row=rows[i],desc=row.querySelector('.item-descricao'),qtd=row.querySelector('.item-quantidade'),valor=row.querySelector('.item-valor');
      if(!desc.value.trim())return erroCampoExecucao(`Item ${i+1}: informe a descrição do serviço executado.`,desc);
      if(!qtd.value.trim()||!Number.isFinite(Number(qtd.value))||Number(qtd.value)<=0)return erroCampoExecucao(`Item ${i+1}: informe uma quantidade maior que zero.`,qtd);
      if(!valor.value.trim()||!Number.isFinite(Number(valor.value))||Number(valor.value)<0)return erroCampoExecucao(`Item ${i+1}: confira o valor unitário.`,valor);
    }
    const arr=itens($('orc-itens-real')),valorDesconto=$('orc-desconto-real').value,desconto=Number(valorDesconto);
    if(valorDesconto.trim()===''||!Number.isFinite(desconto)||desconto<0||desconto>soma(arr))return erroCampoExecucao('O desconto final deve ser um valor válido entre zero e o subtotal executado.',$('orc-desconto-real'));
    const total=cents(soma(arr)-desconto),jaPago=cents(recebimentos.filter(r=>r.orcamento_id===activeQuote.id).reduce((a,r)=>a+Number(r.valor),0));
    if(total<jaPago)return erroCampoExecucao(`O valor cobrado (${dinheiro(total)}) não pode ser menor do que o já recebido (${dinheiro(jaPago)}).`,$('orc-desconto-real'));
    const confirmado=await ClimatizeDialog.confirm(`Conferência da cobrança:\nProposta: ${dinheiro(activeQuote.total)}\nServiços executados: ${dinheiro(soma(arr))}\nDesconto final: ${dinheiro(desconto)}\nValor a cobrar: ${dinheiro(total)}\n\nIsto não registra nenhum recebimento. Confirma?`);
    if(!confirmado)return;
    const btn=$('orc-confirmar-real');btn.disabled=true;
    let gravado=false;
    try{
      const id=activeQuote.id;
      const {error}=await db.from('climatize_orcamentos_v2').update({status:'realizado',itens_realizados:arr,desconto_realizado:desconto}).eq('id',id);
      if(error)throw error;
      gravado=true;
      await recarregar();abrirOrcamento(id);
      if(activeQuote?.id!==id||cents(activeQuote.total_realizado)!==total){
        avisoFluxo('A execução foi gravada, mas a atualização dos valores na tela ainda não pôde ser confirmada. Reabra o histórico antes de tentar novamente.',true);
      }else{
        avisoFluxo(`✓ Execução registrada. Valor cobrado: ${dinheiro(total)}. Nenhum recebimento foi lançado por essa confirmação.`);
        flash('Execução registrada. O orçamento foi preservado para comparação.');
      }
    }catch(e){erro(e);avisoFluxo(gravado?'A execução foi gravada, mas a atualização da tela ficou pendente. Confira o histórico antes de tentar novamente.':'Não foi possível confirmar a cobrança. Confira os dados e tente novamente.',true);if(!gravado)abrirPainelOrc('orc-realizacao-wrap',false);}
    finally{btn.disabled=false;}
  }
  async function receber() {
    if(!activeQuote)return;
    if(quoteDirty){abrirPainelOrc('orc-proposta-panel');return avisoFluxo('Salve as mudanças pendentes na proposta antes de registrar o recebimento.',true);}
    const id=activeQuote.id,valor=Number($('orc-pagamento').value),data=$('orc-data-pagamento').value;
    if(!Number.isFinite(valor)||valor<=0||!data){abrirPainelOrc('orc-recebimento-wrap',false);$('orc-pagamento').focus();return avisoFluxo('Informe um valor recebido válido e uma data.',true);}
    const saldo=cents(Number(activeQuote.total_realizado??activeQuote.total)-recebimentos.filter(x=>x.orcamento_id===id).reduce((s,x)=>s+Number(x.valor),0));
    if(valor>saldo){abrirPainelOrc('orc-recebimento-wrap',false);$('orc-pagamento').focus();return avisoFluxo(`O pagamento de ${dinheiro(valor)} excede o saldo de ${dinheiro(saldo)}.`,true);}
    if(!['aprovado','agendado','realizado'].includes(activeQuote.status))return avisoFluxo('Aprove ou agende a proposta antes de registrar recebimento.',true);
    if(!await ClimatizeDialog.confirm(`Confirmar recebimento de ${dinheiro(valor)} em ${dataFormatada(data)}?\nSerá criada uma entrada no Financeiro. Isto não pode ser desfeito nesta tela.`))return;
    // Preservar a chave até verificar o recibo; uma falha de rede não pode duplicar a receita.
    const tentativaId=`climatize_v2_pay_${id}_${valor.toFixed(2)}_${data}`;
    try{chavePagamento=sessionStorage.getItem(tentativaId)||crypto.randomUUID();sessionStorage.setItem(tentativaId,chavePagamento);}
    catch{chavePagamento ||=crypto.randomUUID();}
    const btn=$('orc-registrar-pagamento');btn.disabled=true;
    let gravado=false;
    try{
      const {data:recebimentoId,error}=await db.rpc('climatize_v2_confirmar_recebimento',{p_orcamento_id:id,p_valor:valor,p_data:data,p_chave_idempotencia:chavePagamento});
      if(error)throw error;
      gravado=true;
      // A RPC retorna o ID do recebimento; não confundir êxito da RPC com
      // confirmação de que o dashboard do navegador já foi sincronizado.
      const {data:recibo,error:erroRecibo}=await db.from('climatize_recebimentos_v2').select('id,orcamento_id,transacao_id,valor,data_recebimento').eq('id',recebimentoId).eq('orcamento_id',id).single();
      if(erroRecibo||!recibo||!recibo.transacao_id)throw new Error('Recebimento registrado, mas ainda não foi possível validar seu lançamento financeiro.');
      const {data:entrada,error:erroEntrada}=await db.from('transacoes').select('id,tipo,valor,data').eq('id',recibo.transacao_id).single();
      if(erroEntrada||!entrada||entrada.tipo!=='entrada'||cents(entrada.valor)!==cents(recibo.valor))throw new Error('Pagamento registrado, mas a verificação do lançamento no Financeiro ficou pendente.');
      await recarregar();abrirOrcamento(id);
      if(typeof buscarTransacoes==='function'){
        try{await buscarTransacoes();}catch(err){console.warn('Atualização do dashboard pendente',err);}
      }
      // A busca financeira original captura erros internamente; conferir o estado
      // realmente atualizado antes de afirmar que o dashboard foi sincronizado.
      const sincronizado=typeof transacoes!=='undefined' && Array.isArray(transacoes) &&
        transacoes.some(t=>String(t.id)===String(recibo.transacao_id)&&t.tipo==='entrada'&&cents(t.valor)===cents(valor));
      if(sincronizado){
        try{sessionStorage.removeItem(tentativaId);}catch{}chavePagamento=null;
        avisoFluxo(`✓ Recebimento de ${dinheiro(valor)} registrado em ${dataFormatada(data)}. Entrada #${recibo.transacao_id} conferida no Financeiro e dashboard atualizado.`);
        flash('Recebimento confirmado e lançado uma única vez no financeiro.');
      }else{
        avisoFluxo(`✓ Recebimento de ${dinheiro(valor)} registrado no Financeiro (lançamento #${recibo.transacao_id}). Atualização visual do dashboard pendente; consulte o histórico antes de tentar novamente.`,true);
      }
    }catch(e){
      erro(e);
      avisoFluxo(gravado?'O pagamento foi registrado, mas a confirmação visual ficou pendente. Confira o histórico no Financeiro antes de tentar novamente.':'Não foi possível registrar o pagamento. Os dados permaneceram no formulário para nova tentativa.',true);
      if(!gravado)abrirPainelOrc('orc-recebimento-wrap',false);
    }finally{btn.disabled=false;}
  }

  // === PDF DO ORÇAMENTO ===
  let logoBase64=null;
  async function logo(){
    if(logoBase64)return logoBase64;
    const res=await fetch('climatize.png');if(!res.ok)throw new Error('Logo indisponível');
    const blob=await res.blob();return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>{logoBase64=rd.result;resolve(logoBase64);};rd.onerror=reject;rd.readAsDataURL(blob);});
  }
  async function gerarPdf(q) {
    if(q&&activeQuote?.id===q.id&&!$('orc-form-wrap').classList.contains('hidden')&&quoteDirty){
      return flash('Há alterações não salvas. Salve o orçamento antes de baixar o PDF para evitar perda de dados.',true);
    }
    if(!q)return flash('Salve o orçamento antes de gerar o PDF.',true);
    if(!window.jspdf?.jsPDF)return flash('Biblioteca de PDF indisponível. Confira a conexão e tente novamente.',true);
    const code=q.id.slice(0,8).toUpperCase();
    const nomePdf=await ClimatizeDialog.askPdfName(`Climatize_Orcamento_${q.cliente_nome}_${code}`);
    if(!nomePdf)return;
    try {
      const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),W=210,H=297;
      const teal=[7,79,85],turq=[65,183,198],light=[238,248,249],ink=[27,52,59];
      function setfill(c){doc.setFillColor(...c);}function settext(c){doc.setTextColor(...c);}
      function page(){setfill([255,255,255]);doc.rect(0,0,W,H,'F');setfill(teal);doc.rect(0,0,W,48,'F');setfill(turq);doc.rect(0,47,W,1,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(8);settext([255,255,255]);doc.text('CLIMATIZE AR-CONDICIONADO',204,10,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(7.7);
        doc.text('Tel.: (77) 99877-7658',204,18,{align:'right'});doc.text('allysonrener1999@gmail.com',204,24,{align:'right'});
        doc.text('CNPJ 44.022.609/0001-37',204,30,{align:'right'});doc.text('Téc. responsável: Allyson Rener',204,36,{align:'right'});
        doc.setDrawColor(210,225,228);doc.line(14,282,196,282);doc.setFontSize(8);settext([80,104,110]);doc.text('Climatize · Conforto e bem-estar para cada ambiente',14,289);doc.text(`${doc.internal.getNumberOfPages()}`,196,289,{align:'right'});
      }
      page();try{doc.addImage(await logo(),'PNG',13,4,63,39);}catch(err){console.warn('Logo não carregada no PDF',err);settext([255,255,255]);doc.setFontSize(19);doc.text('CLIMATIZE',14,25);}
      settext(ink);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('ORÇAMENTO DE SERVIÇOS',14,61);
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`Nº ${code}  •  Emissão: ${dataFormatada(q.emissao)}  •  Validade: ${q.validade_dias} dias`,14,68);
      setfill(light);doc.roundedRect(14,73,182,24,3,3,'F');settext(ink);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(`CLIENTE: ${String(q.cliente_nome).slice(0,65)}`,19,81);
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`Telefone: ${q.cliente_telefone||'Não informado'}`,19,87);
      const addr=doc.splitTextToSize(`Local: ${q.cliente_endereco||'A combinar'}`,169);doc.text(addr.slice(0,1),19,93);
      let y=106;
      const header=()=>{setfill(teal);doc.roundedRect(14,y,182,10,1.5,1.5,'F');settext([255,255,255]);doc.setFontSize(7.6);doc.setFont('helvetica','bold');doc.text('SERVIÇO / DESCRIÇÃO',18,y+6.5);doc.text('QTD.',116,y+6.5,{align:'right'});doc.text('UNITÁRIO',153,y+6.5,{align:'right'});doc.text('TOTAL',192,y+6.5,{align:'right'});y+=12;};
      header();doc.setFont('helvetica','normal');
      (q.itens||[]).forEach((it,idx)=>{
        const descricao=doc.splitTextToSize(`${it.tipo} — ${it.descricao}`,89),altura=Math.max(13,descricao.length*4.3+5);
        if(y+altura>240){doc.addPage();page();y=57;header();}
        if(idx%2===0){setfill(light);doc.rect(14,y,182,altura,'F');}
        settext(ink);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(descricao,18,y+5.5);
        doc.setFontSize(7.6);doc.text(String(it.quantidade),116,y+5.5,{align:'right'});doc.text(dinheiro(it.valor_unitario),153,y+5.5,{align:'right'});doc.text(dinheiro(cents(it.quantidade*it.valor_unitario)),192,y+5.5,{align:'right'});
        y+=altura;
      });
      if(y>213){doc.addPage();page();y=57;}
      y+=6;settext(ink);doc.setFontSize(9);doc.text(`Subtotal: ${dinheiro(q.subtotal)}`,192,y,{align:'right'});
      y+=7;doc.text(`Desconto à vista: - ${dinheiro(q.desconto_valor)}`,192,y,{align:'right'});
      y+=5;setfill(teal);doc.roundedRect(105,y,91,15,2,2,'F');settext([255,255,255]);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(`TOTAL: ${dinheiro(q.total)}`,190,y+10,{align:'right'});y+=22;
      const cond=[`Aprovação e agendamento mediante pagamento de 50% do valor total, salvo acordo específico.`, `Garantia: 90 dias legais + 90 dias adicionais para defeitos no serviço executado.`,`Não realizamos serviços de elétrica, hidráulica e alvenaria.`,`Proposta válida por ${q.validade_dias} dias a partir de ${dataFormatada(q.emissao)}.`,...(q.observacoes?[q.observacoes]:[])];
      if(y+32>277){doc.addPage();page();y=57;}
      doc.setFont('helvetica','bold');doc.setFontSize(9);settext(teal);doc.text('CONDIÇÕES E OBSERVAÇÕES',14,y);y+=5;doc.setFont('helvetica','normal');doc.setFontSize(8);settext(ink);
      cond.forEach(l=>{const parts=doc.splitTextToSize('• '+l,179);if(y+parts.length*4.2>278){doc.addPage();page();y=57;}doc.text(parts,15,y);y+=parts.length*4.2+1.5;});
      doc.save(nomePdf);
      // Somente a geração pela tela de edição encerra o formulário; PDFs baixados
      // diretamente do histórico não mudam o orçamento aberto em outra tela.
      if(activeQuote?.id===q.id && !$('orc-form-wrap').classList.contains('hidden')){
        $('orc-form-wrap').classList.add('hidden');$('orc-list-wrap').classList.remove('hidden');
        renderOrcamentos();$('orc-list-wrap').scrollIntoView({behavior:'smooth',block:'start'});
      }
    } catch(e){erro(e);}
  }

  function listeners() {
    document.querySelectorAll('[data-modulo]').forEach(b=>b.addEventListener('click',()=>modulo(b.dataset.modulo)));
    $('agenda-novo').onclick=()=>abrirAgenda();$('agenda-form').addEventListener('submit',salvarAgenda);
    $('agenda-cancel').onclick=()=>$('agenda-form-wrap').classList.add('hidden');
    $('cal-prev').onclick=()=>{mes=new Date(mes.getFullYear(),mes.getMonth()-1,1);renderCalendario();};
    $('cal-next').onclick=()=>{mes=new Date(mes.getFullYear(),mes.getMonth()+1,1);renderCalendario();};
    $('cal-today').onclick=()=>{selected=dataLocal();mes=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendario();};
    ['agenda-inicio','agenda-fim'].forEach(id=>$(id).addEventListener('change',()=>{if($('agenda-inicio').value&&$('agenda-fim').value)validarConflito($('agenda-inicio').value,$('agenda-fim').value,$('agenda-id').value||null);}));
    painéisOrc.forEach(id=>$(id).addEventListener('toggle',()=>{
      if($(id).open)painéisOrc.filter(other=>other!==id).forEach(other=>$(other).open=false);
    }));
    document.querySelectorAll('[data-open-quote]').forEach(b=>b.addEventListener('click',()=>{
      if(!b.disabled)abrirPainelOrc(b.dataset.openQuote);
    }));
    $('orc-overview-pdf').onclick=()=>gerarPdf(activeQuote);
    $('orc-ver-financeiro').onclick=()=>{modulo('financeiro');$('card-historico').scrollIntoView({block:'start',behavior:'smooth'});};
    $('orc-form').addEventListener('invalid',(e)=>{
      const p=e.target.closest('details.quote-work-panel');if(p)abrirPainelOrc(p.id,false);
    },true);
    $('orc-novo').onclick=limparFormulario;$('orc-voltar').onclick=()=>{$('orc-form-wrap').classList.add('hidden');$('orc-list-wrap').classList.remove('hidden');renderOrcamentos();};
    $('orc-form').addEventListener('submit',salvarOrcamento);
    $('orc-form').addEventListener('input',()=>{quoteDirty=true;});
    $('orc-form').addEventListener('change',()=>{quoteDirty=true;});
    $('orc-add-item').onclick=()=>{createItem($('orc-itens'));quoteDirty=true;atualizarTotais();};
    $('orc-add-real').onclick=()=>{createItem($('orc-itens-real'));atualizarTotais();};
    $('orc-copiar-real').onclick=()=>{$('orc-itens-real').replaceChildren();itens($('orc-itens')).forEach(x=>createItem($('orc-itens-real'),x,true));$('orc-desconto-real').value=$('orc-desconto-tipo').value==='percentual'?cents(soma(itens($('orc-itens')))*Number($('orc-desconto').value)/100):$('orc-desconto').value;atualizarTotais();};
    ['orc-desconto','orc-desconto-tipo','orc-desconto-real'].forEach(id=>$(id).addEventListener('input',atualizarTotais));
    $('orc-confirmar-real').onclick=confirmarRealizacao;$('orc-registrar-pagamento').onclick=receber;
    $('orc-anular-recebimento').onclick=()=>executarCorrecao('recebimento');
    $('orc-desconsiderar').onclick=()=>executarCorrecao('desconsiderar');
    $('orc-agendar').onchange=()=>$('orc-agendar-campos').classList.toggle('hidden',!$('orc-agendar').checked);
    ['orc-inicio','orc-fim'].forEach(id=>$(id).addEventListener('change',()=>{if($('orc-inicio').value&&$('orc-fim').value)validarConflito($('orc-inicio').value,$('orc-fim').value,compromissos.find(a=>a.orcamento_id===$('orc-id').value)?.id||null,'orc-conflitos');}));
    $('orc-pdf').onclick=()=>gerarPdf(activeQuote);
    $('orc-filter').onchange=renderOrcamentos;$('orc-busca').oninput=renderOrcamentos;
    $('btn-logout').addEventListener('click',()=>{user=null;orcamentos=[];compromissos=[];recebimentos=[];modulo('financeiro');});
  }
  listeners();
  if(db){
    db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user&&!window.ClimatizeAuthFlow?.isBlockingDashboard()){setTimeout(()=>sessao().catch(erro),0);}else if(event==='SIGNED_OUT'){user=null;orcamentos=[];compromissos=[];recebimentos=[];}});
    db.auth.getSession().then(({data})=>{if(data?.session&&!window.ClimatizeAuthFlow?.isBlockingDashboard())sessao().catch(erro);}).catch(erro);
  } else flash('Biblioteca Supabase indisponível.',true);
})();
