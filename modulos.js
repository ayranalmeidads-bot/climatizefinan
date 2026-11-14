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
  let activeQuote = null, mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected = dataLocal();
  let carregando = false, chavePagamento = null;

  function flash(message, danger = false) {
    const el = $('app-flash'); el.textContent = message; el.classList.remove('hidden');
    el.classList.toggle('is-danger', danger);
    el.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function apagarFlash() { $('app-flash').classList.add('hidden'); }
  function erro(e) { console.error('[Climatize 2.0]',e); flash(e?.message || String(e) || 'Não foi possível concluir a ação.',true); }
  function modulo(nome) {
    ['financeiro','agenda','orcamentos'].forEach(id => $('modulo-'+id).classList.toggle('hidden',id!==nome));
    document.querySelectorAll('[data-modulo]').forEach(b => { b.classList.toggle('is-active',b.dataset.modulo===nome); b.setAttribute('aria-selected',String(b.dataset.modulo===nome)); });
    apagarFlash();
    if(nome==='agenda') renderCalendario(); if(nome==='orcamentos') renderOrcamentos();
  }
  async function sessao() {
    if(!db) return;
    const {data:{user:u},error} = await db.auth.getUser(); if(error) throw error;
    user=u;
    if(!user) { orcamentos=[]; compromissos=[]; recebimentos=[]; return; }
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
    if(coincidencias.length && !confirm('Há compromissos no horário escolhido. Deseja salvar mesmo assim?'))return;
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
    if(!confirm('Excluir este compromisso? Esta operação não apaga o financeiro.'))return;
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
    const remover=document.createElement('button');remover.type='button';remover.className='btn-remove-item';remover.title='Excluir item';remover.textContent='×';remover.onclick=()=>{row.remove();atualizarTotais();};
    row.append(select,desc,qtd,valor,remover);container.append(row);
    [qtd,valor].forEach(el=>el.addEventListener('input',atualizarTotais));
    return row;
  }
  function itens(container) {return [...container.querySelectorAll('.quote-item-row')].map(r=>({tipo:r.querySelector('.item-tipo').value,descricao:r.querySelector('.item-descricao').value.trim(),quantidade:Number(r.querySelector('.item-quantidade').value),valor_unitario:Number(r.querySelector('.item-valor').value)}));}
  function soma(arr) {return cents(arr.reduce((acc,x)=>acc+cents(x.quantidade*x.valor_unitario),0));}
  function atualizarTotais(){
    const s=soma(itens($('orc-itens'))), v=Number($('orc-desconto').value)||0;
    const d=$('orc-desconto-tipo').value==='percentual'?cents(s*v/100):cents(v);
    $('orc-subtotal').textContent=dinheiro(s);$('orc-valor-desconto').textContent=dinheiro(d);$('orc-total').textContent=dinheiro(s-d);
    const ar=itens($('orc-itens-real'));
    $('orc-total-real').textContent=dinheiro(soma(ar)-(Number($('orc-desconto-real').value)||0));
    $('orc-total-ref').textContent=dinheiro(s-d);
  }
  function limparFormulario() {
    activeQuote=null;$('orc-form').reset();$('orc-id').value='';$('orc-status').value='rascunho';$('orc-validade').value='5';$('orc-data').value=dataLocal();
    $('orc-desconto').value='0';$('orc-desconto-real').value='0';$('orc-itens').replaceChildren();$('orc-itens-real').replaceChildren();
    createItem($('orc-itens'));
    $('orc-agendar').checked=false;$('orc-agendar-campos').classList.add('hidden');$('orc-conflitos').classList.add('hidden');
    $('orc-realizacao-wrap').classList.add('hidden');$('orc-recebimento-wrap').classList.add('hidden');
    $('orc-form-title').textContent='Novo orçamento';$('orc-form-wrap').classList.remove('hidden');$('orc-list-wrap').classList.add('hidden');
    $('orc-form').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);
    $('orc-itens-real').querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
    $('orc-status').querySelectorAll('option').forEach(opt=>opt.disabled=false);
    $('orc-pdf').disabled=true;chavePagamento=null;
    $('orc-revisoes').textContent='Este orçamento ainda não foi salvo.';$('orc-revisoes-wrap').open=false;atualizarTotais();$('orc-form-wrap').scrollIntoView({behavior:'smooth'});
  }
  function abrirOrcamento(id) {
    const q=orcamentos.find(o=>o.id===id);if(!q)return flash('Orçamento não encontrado.',true);
    activeQuote=q;$('orc-form').reset();$('orc-id').value=q.id;
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
    $('orc-realizacao-wrap').classList.toggle('hidden',q.status==='cancelado');
    $('orc-recebimento-wrap').classList.toggle('hidden',q.status==='cancelado');
    $('orc-pdf').disabled=false;
    const pagos=recebimentos.filter(p=>p.orcamento_id===q.id),totalPago=cents(pagos.reduce((a,p)=>a+Number(p.valor),0));
    const bloqueado=pagos.length>0;
    $('orc-itens').querySelectorAll('input,select,button').forEach(el=>el.disabled=bloqueado);
    ['orc-desconto','orc-desconto-tipo','orc-cliente'].forEach(id=>$(id).disabled=bloqueado);
    $('orc-add-item').disabled=bloqueado;
    // Pagamento adiantado não bloqueia registrar o serviço executado.
    $('orc-itens-real').querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
    ['orc-add-real','orc-copiar-real','orc-desconto-real','orc-confirmar-real'].forEach(id=>$(id).disabled=false);
    $('orc-salvar').disabled=false;
    $('orc-status').querySelectorAll('option').forEach(opt=>opt.disabled=Boolean((bloqueado&&['rascunho','enviado','cancelado'].includes(opt.value))||(q.status==='realizado'&&opt.value!=='realizado')));
    const hist=$('orc-recebimentos');hist.replaceChildren();
    pagos.forEach(p=>{const r=document.createElement('div');r.className='payment-row';r.textContent=`${dataFormatada(p.data_recebimento)} · ${dinheiro(p.valor)} · Lançamento ${p.transacao_id}`;hist.append(r);});
    const limite=Number(q.total_realizado??q.total),pendente=cents(limite-totalPago);
    const sum=document.createElement('div');sum.className='payment-summary';sum.textContent=`Cobrado: ${dinheiro(limite)} · Recebido: ${dinheiro(totalPago)} · Em aberto: ${dinheiro(pendente)}`;hist.prepend(sum);
    $('orc-pagamento').value=pendente>0?pendente.toFixed(2):'';$('orc-pagamento').max=String(pendente);
    $('orc-data-pagamento').value=dataLocal();$('orc-registrar-pagamento').disabled=pendente<=0;
    atualizarTotais();$('orc-form-wrap').scrollIntoView({behavior:'smooth'});
    carregarRevisoes(q.id);
  }
  async function carregarRevisoes(id) {
    const destino=$('orc-revisoes');destino.textContent='Consultando revisões...';
    const {data,error}=await db.from('climatize_orcamento_revisoes_v2').select('registrado_em,versao_anterior').eq('orcamento_id',id).order('registrado_em',{ascending:false}).limit(30);
    if($('orc-id').value!==id)return;
    if(error){destino.textContent='Histórico indisponível: '+error.message;return;}
    destino.replaceChildren();
    if(!data?.length){destino.textContent='Nenhuma revisão anterior. Esta é a versão inicial.';return;}
    data.forEach((rev,i)=>{const x=rev.versao_anterior||{};const div=document.createElement('div');div.className='payment-row';
      div.textContent=`${new Date(rev.registrado_em).toLocaleString('pt-BR')} · ${statusNome[x.status]||x.status||'Status desconhecido'} · proposta ${dinheiro(x.total)} · cobrado ${x.total_realizado===null?'não informado':dinheiro(x.total_realizado)} · ${Array.isArray(x.itens)?x.itens.length:0} item(ns)`;
      destino.append(div);
    });
  }
  function renderOrcamentos() {
    $('orc-count').textContent=String(orcamentos.length);
    $('orc-pendente').textContent=dinheiro(orcamentos.filter(x=>!['realizado','cancelado'].includes(x.status)).reduce((s,o)=>s+Number(o.total),0));
    $('orc-realizado').textContent=dinheiro(orcamentos.filter(x=>x.status==='realizado').reduce((s,o)=>s+Number(o.total_realizado??o.total),0));
    $('orc-recebido').textContent=dinheiro(recebimentos.reduce((s,p)=>s+Number(p.valor),0));
    const busca=$('orc-busca').value.trim().toLocaleLowerCase('pt-BR'),filtro=$('orc-filter').value;
    const result=orcamentos.filter(q=>(filtro==='todos'||q.status===filtro) && (!busca||q.cliente_nome.toLocaleLowerCase('pt-BR').includes(busca)||q.id.startsWith(busca)));
    const lista=$('orc-lista');lista.replaceChildren();
    if(!result.length)lista.innerHTML='<div class="empty-state">Nenhum orçamento encontrado. Crie o primeiro usando o botão acima.</div>';
    result.forEach(q=>{
      const paid=cents(recebimentos.filter(x=>x.orcamento_id===q.id).reduce((s,x)=>s+Number(x.valor),0));
      const total=Number(q.total_realizado??q.total),diff=q.total_realizado!=null?cents(total-Number(q.total)):null;
      const el=document.createElement('article');el.className='quote-history-card';
      el.innerHTML=`<div><span class="eyebrow">#${escapeHtml(q.id.slice(0,8).toUpperCase())} · ${dataFormatada(q.emissao)}</span><h4>${escapeHtml(q.cliente_nome)}</h4><span class="quote-status status-${escapeHtml(q.status)}">${escapeHtml(statusNome[q.status]||q.status)}</span></div><div class="history-numbers"><strong>${dinheiro(total)}</strong><small>Recebido ${dinheiro(paid)}${diff!==null?` · Diferença vs. proposta ${dinheiro(diff)}`:''}</small></div>`;
      const actions=document.createElement('div');actions.className='history-actions';
      const b=document.createElement('button');b.className='btn-outline';b.textContent='Abrir / editar';b.onclick=()=>abrirOrcamento(q.id);actions.append(b);
      const pdf=document.createElement('button');pdf.className='btn-outline';pdf.textContent='Baixar PDF';pdf.onclick=()=>gerarPdf(q);actions.append(pdf);
      el.append(actions);lista.append(el);
    });
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
      if(payload.agendado_inicio){const c=validarConflito(payload.agendado_inicio,payload.agendado_fim,compromissos.find(a=>a.orcamento_id===atual)?.id||null,'orc-conflitos');if(c.length&&!confirm('Existe compromisso nesse horário. Deseja salvar mesmo assim?'))return;}
      const r=atual?db.from('climatize_orcamentos_v2').update(payload).eq('id',atual).select('*').single():db.from('climatize_orcamentos_v2').insert(payload).select('*').single();
      const {data,error}=await r;if(error)throw error;
      try{await agendarOrcamento(data);}catch(e2){await recarregar();abrirOrcamento(data.id);throw new Error('Orçamento salvo, mas o vínculo com a agenda falhou. Reabra e salve novamente. Detalhes: '+e2.message);}
      await recarregar();abrirOrcamento(data.id);flash('Orçamento salvo com sucesso. Já pode gerar o PDF.');
    }catch(e2){erro(e2);}finally{botao.disabled=false;}
  }
  async function confirmarRealizacao() {
    if(!activeQuote)return;
    const arr=itens($('orc-itens-real'));
    const desconto=Number($('orc-desconto-real').value);
    if(!arr.length||arr.some(i=>!i.descricao||i.quantidade<=0||!Number.isFinite(i.valor_unitario)||i.valor_unitario<0)||!Number.isFinite(desconto)||desconto<0||desconto>soma(arr))return flash('Revise serviços executados, valores e descontos.',true);
    if(!confirm('Confirmar serviços executados e valores efetivamente cobrados?'))return;
    try{const {error}=await db.from('climatize_orcamentos_v2').update({status:'realizado',itens_realizados:arr,desconto_realizado:desconto}).eq('id',activeQuote.id);if(error)throw error;await recarregar();abrirOrcamento(activeQuote.id);flash('Execução registrada. O orçamento foi preservado para comparação.');}catch(e){erro(e);}
  }
  async function receber() {
    if(!activeQuote)return;
    const valor=Number($('orc-pagamento').value),data=$('orc-data-pagamento').value;
    if(!Number.isFinite(valor)||valor<=0||!data)return flash('Informe um valor recebido válido e a data.',true);
    const saldo=cents(Number(activeQuote.total_realizado??activeQuote.total)-recebimentos.filter(x=>x.orcamento_id===activeQuote.id).reduce((s,x)=>s+Number(x.valor),0));
    if(valor>saldo)return flash('O valor recebido excede o saldo. Confira o valor.',true);
    if(!['aprovado','agendado','realizado'].includes(activeQuote.status))return flash('Aprove ou agende o orçamento antes de registrar o recebimento.',true);
    if(!confirm(`Confirmar recebimento de ${dinheiro(valor)} em ${dataFormatada(data)}? Isso criará uma entrada financeira e não pode ser desfeito por esta tela.`))return;
    // Em falha de rede, repetir exatamente a mesma tentativa com a mesma chave.
    const tentativaId=`climatize_v2_pay_${activeQuote.id}_${valor.toFixed(2)}_${data}`;
    try {chavePagamento=sessionStorage.getItem(tentativaId)||crypto.randomUUID();sessionStorage.setItem(tentativaId,chavePagamento);}
    catch {chavePagamento ||= crypto.randomUUID();}
    const btn=$('orc-registrar-pagamento');btn.disabled=true;
    try{
      const {error}=await db.rpc('climatize_v2_confirmar_recebimento',{p_orcamento_id:activeQuote.id,p_valor:valor,p_data:data,p_chave_idempotencia:chavePagamento});
      if(error)throw error;
      try{sessionStorage.removeItem(tentativaId);}catch{} chavePagamento=null;
      await recarregar();abrirOrcamento(activeQuote.id);
      if(typeof buscarTransacoes==='function')await buscarTransacoes();
      flash('Recebimento confirmado e lançado uma única vez no financeiro.');
    }catch(e){erro(e);}finally{btn.disabled=false;}
  }

  // === PDF DO ORÇAMENTO ===
  let logoBase64=null;
  async function logo(){
    if(logoBase64)return logoBase64;
    const res=await fetch('climatize.png');if(!res.ok)throw new Error('Logo indisponível');
    const blob=await res.blob();return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>{logoBase64=rd.result;resolve(logoBase64);};rd.onerror=reject;rd.readAsDataURL(blob);});
  }
  async function gerarPdf(q) {
    if(!q)return flash('Salve o orçamento antes de gerar o PDF.',true);
    if(!window.jspdf?.jsPDF)return flash('Biblioteca de PDF indisponível. Confira a conexão e tente novamente.',true);
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
      const code=q.id.slice(0,8).toUpperCase();doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`Nº ${code}  •  Emissão: ${dataFormatada(q.emissao)}  •  Validade: ${q.validade_dias} dias`,14,68);
      setfill(light);doc.roundedRect(14,73,182,24,3,3,'F');settext(ink);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(`CLIENTE: ${String(q.cliente_nome).slice(0,65)}`,19,81);
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`Telefone: ${q.cliente_telefone||'Não informado'}`,19,87);
      const addr=doc.splitTextToSize(`Local: ${q.cliente_endereco||'A combinar'}`,169);doc.text(addr.slice(0,1),19,93);
      let y=106;
      const header=()=>{setfill(teal);doc.roundedRect(14,y,182,10,1.5,1.5,'F');settext([255,255,255]);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('SERVIÇO / DESCRIÇÃO',18,y+6.5);doc.text('QTD.',147,y+6.5,{align:'right'});doc.text('VALOR',191,y+6.5,{align:'right'});y+=12;};
      header();doc.setFont('helvetica','normal');
      (q.itens||[]).forEach((it,idx)=>{
        const descricao=doc.splitTextToSize(`${it.tipo} — ${it.descricao}`,117),altura=Math.max(13,descricao.length*4.3+5);
        if(y+altura>240){doc.addPage();page();y=57;header();}
        if(idx%2===0){setfill(light);doc.rect(14,y,182,altura,'F');}
        settext(ink);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(descricao,18,y+5.5);
        doc.text(String(it.quantidade),147,y+5.5,{align:'right'});doc.text(dinheiro(cents(it.quantidade*it.valor_unitario)),192,y+5.5,{align:'right'});
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
      doc.save(`Climatize_Orcamento_${code}_${q.cliente_nome.replace(/[^a-zA-ZÀ-ÿ0-9-_]+/g,'_').slice(0,30)}.pdf`);
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
    $('orc-novo').onclick=limparFormulario;$('orc-voltar').onclick=()=>{$('orc-form-wrap').classList.add('hidden');$('orc-list-wrap').classList.remove('hidden');renderOrcamentos();};
    $('orc-form').addEventListener('submit',salvarOrcamento);
    $('orc-add-item').onclick=()=>{createItem($('orc-itens'));atualizarTotais();};
    $('orc-add-real').onclick=()=>{createItem($('orc-itens-real'));atualizarTotais();};
    $('orc-copiar-real').onclick=()=>{$('orc-itens-real').replaceChildren();itens($('orc-itens')).forEach(x=>createItem($('orc-itens-real'),x,true));$('orc-desconto-real').value=$('orc-desconto-tipo').value==='percentual'?cents(soma(itens($('orc-itens')))*Number($('orc-desconto').value)/100):$('orc-desconto').value;atualizarTotais();};
    ['orc-desconto','orc-desconto-tipo','orc-desconto-real'].forEach(id=>$(id).addEventListener('input',atualizarTotais));
    $('orc-confirmar-real').onclick=confirmarRealizacao;$('orc-registrar-pagamento').onclick=receber;
    $('orc-agendar').onchange=()=>$('orc-agendar-campos').classList.toggle('hidden',!$('orc-agendar').checked);
    ['orc-inicio','orc-fim'].forEach(id=>$(id).addEventListener('change',()=>{if($('orc-inicio').value&&$('orc-fim').value)validarConflito($('orc-inicio').value,$('orc-fim').value,compromissos.find(a=>a.orcamento_id===$('orc-id').value)?.id||null,'orc-conflitos');}));
    $('orc-pdf').onclick=()=>gerarPdf(activeQuote);
    $('orc-filter').onchange=renderOrcamentos;$('orc-busca').oninput=renderOrcamentos;
    $('btn-logout').addEventListener('click',()=>{user=null;orcamentos=[];compromissos=[];recebimentos=[];modulo('financeiro');});
  }
  listeners();
  if(db){
    db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user){setTimeout(()=>sessao().catch(erro),0);}else if(event==='SIGNED_OUT'){user=null;orcamentos=[];compromissos=[];recebimentos=[];}});
    db.auth.getSession().then(({data})=>{if(data?.session)sessao().catch(erro);}).catch(erro);
  } else flash('Biblioteca Supabase indisponível.',true);
})();
