/* Climatize 2.3: avisos, confirmações, troca de senha e nomeação de PDF.
   Não utiliza alert(), confirm() ou prompt() do navegador. Não envia dados ao banco. */
(() => {
  'use strict';
  let fila = Promise.resolve();
  const icones = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    danger: '<path d="M10.3 3.8 2.2 18a1.8 1.8 0 0 0 1.6 2.7h16.4a1.8 1.8 0 0 0 1.6-2.7L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
    file: '<path d="M7 3h7l5 5v13H5V3h2zM14 3v5h5M8 13h8M8 17h8"/>'
  };
  const icon = (nome) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icones[nome] || icones.info}</svg>`;
  function adicionarNaFila(op) {
    const resultado = fila.then(op, op);
    fila = resultado.then(() => {}, () => {});
    return resultado;
  }
  function abrir({ titulo, mensagem = '', modo = 'info', confirmar = 'OK', cancelar = null, campos = [], validar, preparar }) {
    return adicionarNaFila(() => new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'cl-modal cl-modal-' + modo;
      d.setAttribute('aria-labelledby', 'cl-modal-titulo');
      d.setAttribute('aria-describedby', 'cl-modal-mensagem');
      const corpo = document.createElement('form');
      corpo.className = 'cl-modal-form';
      corpo.noValidate = true;
      const topo = document.createElement('div'); topo.className = 'cl-modal-heading';
      const simbolo = document.createElement('span'); simbolo.className = 'cl-modal-icon'; simbolo.innerHTML = icon(modo);
      const tituloEl = document.createElement('h2'); tituloEl.id = 'cl-modal-titulo'; tituloEl.textContent = titulo;
      topo.append(simbolo, tituloEl); corpo.append(topo);
      if (mensagem) {
        const p = document.createElement('p'); p.id = 'cl-modal-mensagem'; p.className = 'cl-modal-message'; p.textContent = mensagem; corpo.append(p);
      } else d.removeAttribute('aria-describedby');
      const controls = new Map();
      for (const f of campos) {
        const label = document.createElement('label'); label.className = 'cl-modal-field';
        const nome = document.createElement('span'); nome.textContent = f.label;
        const input = document.createElement('input');
        input.name = f.name; input.type = f.type || 'text'; input.value = f.value || '';
        input.placeholder = f.placeholder || ''; input.required = f.required !== false;
        input.autocomplete = f.autocomplete || 'off'; input.maxLength = f.maxLength || 120;
        if (f.minLength) input.minLength = f.minLength;
        label.append(nome, input); corpo.append(label); controls.set(f.name, input);
      }
      const error = document.createElement('p'); error.className = 'cl-modal-error hidden'; error.setAttribute('role','alert'); corpo.append(error);
      const actions = document.createElement('div'); actions.className = 'cl-modal-actions';
      const cancelButton = document.createElement('button'); cancelButton.type = 'button'; cancelButton.className = 'btn-outline'; cancelButton.textContent = cancelar || 'Cancelar';
      const okButton = document.createElement('button'); okButton.type = 'submit'; okButton.className = modo === 'danger' ? 'cl-modal-danger-button' : 'btn-primary'; okButton.textContent = confirmar;
      if (cancelar !== null) actions.append(cancelButton);
      actions.append(okButton); corpo.append(actions); d.append(corpo); document.body.append(d);
      let finalizado = false;
      function terminar(valor) {
        if (finalizado) return;
        finalizado = true;
        try { if (d.open) d.close(); } catch (_) {}
        d.remove(); resolve(valor);
      }
      cancelButton.addEventListener('click', () => terminar(null));
      d.addEventListener('cancel', (e) => { e.preventDefault(); terminar(null); });
      corpo.addEventListener('submit', (e) => {
        e.preventDefault();
        for (const inp of controls.values()) {
          if (!inp.checkValidity()) { inp.reportValidity(); inp.focus(); return; }
        }
        const dados = Object.fromEntries([...controls].map(([key, inp]) => [key, inp.value]));
        const mensagemErro = validar ? validar(dados) : null;
        if (mensagemErro) { error.textContent = mensagemErro; error.classList.remove('hidden'); return; }
        terminar(campos.length ? dados : true);
      });
      if (preparar) preparar({dialog:d, corpo, controls, error});
      d.showModal();
      const primeiro = controls.values().next().value;
      (primeiro || okButton).focus({preventScroll:true});
      if (primeiro && primeiro.type === 'text') primeiro.select();
    }));
  }
  async function alerta(texto, op = {}) {
    await abrir({titulo:op.titulo || 'Aviso', mensagem:String(texto), modo:op.modo || 'info', confirmar:'Entendi'});
  }
  async function confirmar(texto, op = {}) {
    return Boolean(await abrir({titulo:op.titulo || 'Confirmação', mensagem:String(texto), modo:op.modo || 'info', cancelar:'Cancelar', confirmar:op.confirmar || 'Confirmar'}));
  }
  function limparNome(nome) {
    return String(nome || '').normalize('NFKC')
      .replace(/[\\/<>:"|?*\u0000-\u001f\u007f]/g, ' ')
      .replace(/\.pdf$/i, '')
      .replace(/\s+/g, ' ').trim().replace(/[.\s]+$/g, '').slice(0,90).trim();
  }
  function sufixoUnico() {
    const d = new Date();
    const part = v => String(v).padStart(2,'0');
    const stamp = `${d.getFullYear()}${part(d.getMonth()+1)}${part(d.getDate())}-${part(d.getHours())}${part(d.getMinutes())}${part(d.getSeconds())}`;
    let rand;
    try { rand = crypto.randomUUID().replaceAll('-', '').slice(0,12).toUpperCase(); }
    catch { try { rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => n.toString(16).padStart(2,'0')).join('').toUpperCase(); }
            catch { rand = String(Date.now()) + String(Math.random()).slice(2,8); } }
    return `${stamp}-${rand}`;
  }
  async function nomePdf(padrao) {
    const sufixo = sufixoUnico();
    const texto = String(padrao || 'Climatize').replace(/\.pdf$/i, '');
    const nomeBase = limparNome(texto) || 'Climatize';
    let preview;
    const r = await abrir({
      titulo:'Escolher nome do PDF',
      mensagem:'Digite o nome desejado (por exemplo, nome do cliente). O sistema acrescenta um código exclusivo para preservar os downloads anteriores.',
      modo:'file', confirmar:'Baixar PDF', cancelar:'Cancelar',
      campos:[{name:'nome',label:'Nome do arquivo (sem .pdf)',value:nomeBase,maxLength:120,required:true}],
      validar:({nome}) => limparNome(nome) ? null : 'Digite um nome válido para o PDF.',
      preparar:({corpo,controls}) => {
        const linha = document.createElement('p'); linha.className = 'cl-modal-preview';
        const label = document.createElement('strong'); label.textContent = 'O arquivo será salvo como:';
        preview = document.createElement('span');
        const atualizar = () => {preview.textContent = `${limparNome(controls.get('nome').value) || 'Climatize'}_${sufixo}.pdf`;};
        linha.append(label,preview);
        corpo.insertBefore(linha, corpo.querySelector('.cl-modal-error'));
        controls.get('nome').addEventListener('input',atualizar); atualizar();
      }
    });
    if (!r) return null;
    return `${limparNome(r.nome)}_${sufixo}.pdf`;
  }
  async function trocarSenha() {
    const r = await abrir({titulo:'Alterar senha', mensagem:'Confirme sua senha atual e escolha uma nova senha. Os campos são protegidos e não serão salvos no navegador.',modo:'lock',confirmar:'Alterar senha', cancelar:'Cancelar',
      campos:[
        {name:'atual',label:'Senha atual',type:'password',autocomplete:'current-password',maxLength:256},
        {name:'nova',label:'Nova senha',type:'password',autocomplete:'new-password',maxLength:256},
        {name:'confirmacao',label:'Confirmar nova senha',type:'password',autocomplete:'new-password',maxLength:256}
      ],
      validar:(v) => v.nova !== v.confirmacao ? 'A confirmação não corresponde à nova senha.' : v.nova.length < 8 ? 'A nova senha deve ter pelo menos 8 caracteres.' : null
    });
    return r || null;
  }
  window.ClimatizeDialog = Object.freeze({alert:alerta,confirm:confirmar,askPdfName:nomePdf,changePassword:trocarSenha});
})();
