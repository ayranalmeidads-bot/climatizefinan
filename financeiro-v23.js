// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://ditkzuoqdgxkziwjkege.supabase.co";
const SUPABASE_KEY = "sb_publishable_XRwRbPVyeDggyeYcbA0fQQ_ImSkKoi6";
// CLIMATIZE 2.3.3: somente redirecionamentos públicos de cadastro e recuperação.
// O endereço HTTPS é explícito: nunca enviar e-mail com retorno ao localhost.
const CLIMATIZE_AUTH_URL = 'https://ayranalmeidads-bot.github.io/climatizefinan/index.html';
// Recuperação usa uma página independente: evita abertura do dashboard antes da nova senha.
const CLIMATIZE_PASSWORD_RESET_URL = 'https://ayranalmeidads-bot.github.io/climatizefinan/reset-password.html';
const climatizeReturnURL = new URL(window.location.href);
const climatizeReturnQuery = climatizeReturnURL.searchParams;
const climatizeReturnHash = new URLSearchParams(climatizeReturnURL.hash.slice(1));
const climatizeReturnKind = climatizeReturnQuery.get('auth_action') === 'recovery' || climatizeReturnHash.get('type') === 'recovery' ? 'recovery'
    : climatizeReturnQuery.get('auth_action') === 'confirmed' || ['signup','email'].includes(climatizeReturnHash.get('type')) ? 'confirmed' : null;
const ClimatizeAuthFlow = {
    kind: climatizeReturnKind,
    hasProof: Boolean(climatizeReturnQuery.get('code') || climatizeReturnQuery.get('token_hash') || climatizeReturnHash.get('access_token')),
    tokenHash: climatizeReturnQuery.get('token_hash'),
    linkError: climatizeReturnQuery.get('error') || climatizeReturnHash.get('error') || climatizeReturnQuery.get('error_code') || climatizeReturnHash.get('error_code'),
    blocking: Boolean(climatizeReturnKind),
    isBlockingDashboard() { return this.blocking; }
};
window.ClimatizeAuthFlow = ClimatizeAuthFlow;
const supabase10 = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Categorias específicas fornecidas pelo usuário
const CATEGORIAS = {
    entrada: ["Instalação", "Higienização", "Manutenção corretiva", "Infraestrutura", "Desinstalação", "Reoperação"],
    saida: ["Tubulação", "Suporte", "Kit instalação", "Fita PVC", "Aluminizada", "Fita isolante", "Frete", "Silver tape", "Ferramenta", "Gasolina", "Ajudante","Frete", "Gás refrigerante", "Saque Pessoal"]
};

// Estado da Aplicação
let transacoes = [];
let chartInstance = null;

// ==========================================
// SELETORES DOM
// ==========================================
const screenAuth = document.getElementById('auth-screen');
const appDashboard = document.getElementById('app-dashboard');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const formTransacao = document.getElementById('form-transacao');

const selectTipo = document.getElementById('t-tipo');
const selectCategoria = document.getElementById('t-categoria');

const linkGoRegister = document.getElementById('go-to-register');
const linkGoLogin = document.getElementById('go-to-login');
const btnLogout = document.getElementById('btn-logout');

// Login, cadastro e recuperação compartilham o mesmo cartão, sem nova página.
const authForms = ['form-login','form-register','form-recovery-email','form-recovery-password','auth-link-result'];
function showAuthForm(id) {
    authForms.forEach(name => document.getElementById(name).classList.toggle('active',name===id));
    screenAuth.classList.remove('hidden');
    appDashboard.classList.add('hidden');
}
function authCleanURL() {
    const url=new URL(window.location.href); url.search=''; url.hash='';
    window.history.replaceState(null,'',url.href);
}
function authFeedback(id, message, danger=false) {
    const el=document.getElementById(id); el.textContent=message;
    el.classList.remove('hidden'); el.classList.toggle('auth-error',danger);
}


// ==========================================
// ATUALIZAÇÃO DINÂMICA DE CATEGORIAS
// ==========================================
function atualizarOpcoesCategorias() {
    const tipo = selectTipo.value;
    const lista = CATEGORIAS[tipo] || [];
    
    selectCategoria.innerHTML = '';
    lista.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        selectCategoria.appendChild(opt);
    });
}

selectTipo.addEventListener('change', atualizarOpcoesCategorias);

// ==========================================
// AUTENTICAÇÃO E FLUXO DE TELAS
// ==========================================
linkGoRegister.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthForm('form-register');
});

linkGoLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthForm('form-login');
});

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    try {
        const { error } = await supabase10.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;

        screenAuth.classList.add('hidden');
        appDashboard.classList.remove('hidden');
        initDashboard();
    } catch (error) {
        const mensagem = /invalid login credentials|invalid credentials|email or password/i.test(error?.message || '')
            ? 'E-mail ou senha incorretos. Confira seus dados e tente novamente.'
            : /email not confirmed/i.test(error?.message || '')
              ? 'Seu e-mail ainda não foi confirmado. Confira sua caixa de entrada.'
              : 'Não foi possível entrar agora. Confira sua conexão e tente novamente.';
        ClimatizeDialog.alert(mensagem, {titulo:'Acesso não autorizado', modo:'lock'});
    }
});

formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('reg-nome').value;
    const email = document.getElementById('reg-email').value;
    const senha = document.getElementById('reg-senha').value;

    try {
        const { error } = await supabase10.auth.signUp({ 
            email, 
            password: senha,
            options: { data: { nome: nome, termos_versao: '1.0', termos_aceito_em: new Date().toISOString() }, emailRedirectTo: `${CLIMATIZE_AUTH_URL}?auth_action=confirmed` }
        });
        if (error) throw error;

        showAuthForm('form-login');
        await ClimatizeDialog.alert('Cadastro solicitado! Confira seu e-mail e clique no link para confirmar sua conta. Depois, volte a esta tela para entrar.', {titulo:'Verifique seu e-mail'});
    } catch (error) {
        const aviso=/email rate limit|too many requests|rate limit/i.test(error?.message||'')
            ? 'O envio de e-mails atingiu um limite temporário. Aguarde um pouco e tente novamente.'
            : /user already registered|already registered|already exists/i.test(error?.message||'')
              ? 'Este e-mail já possui cadastro. Entre ou utilize a recuperação de senha.'
              : 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.';
        ClimatizeDialog.alert(aviso,{titulo:'Cadastro não concluído'});
    }
});

btnLogout.addEventListener('click', async () => {
    await supabase10.auth.signOut();
    appDashboard.classList.add('hidden');
    screenAuth.classList.remove('hidden');
});

// ==========================================
// CONFIRMAÇÃO DE E-MAIL E RECUPERAÇÃO DE SENHA — 2.3.3
// ==========================================
function showAuthResult(titulo,mensagem,novoLink=false) {
    document.getElementById('auth-result-title').textContent=titulo;
    document.getElementById('auth-result-text').textContent=mensagem;
    document.getElementById('auth-result-new-link').classList.toggle('hidden',!novoLink);
    showAuthForm('auth-link-result');
}
async function finishAuthEntry(showMessage=true) {
    // Forçar logout para que a confirmação e a recuperação terminem no login.
    if(supabase10){
        const {error}=await supabase10.auth.signOut({scope:'local'});
        if(error) throw error;
    }
    ClimatizeAuthFlow.blocking=false;
    ClimatizeAuthFlow.kind=null;
    authCleanURL();
    showAuthForm('form-login');
    document.getElementById('login-senha').value='';
    if(showMessage) await ClimatizeDialog.alert('Volte a entrar com seu e-mail e a nova senha.',{titulo:'Voltar ao login',modo:'lock'});
}

document.getElementById('go-to-recovery').addEventListener('click',(e)=>{
    e.preventDefault();
    document.getElementById('recovery-email').value=document.getElementById('login-email').value.trim();
    document.getElementById('recovery-email-feedback').classList.add('hidden');
    showAuthForm('form-recovery-email');
});
document.getElementById('go-to-login-from-recovery').addEventListener('click',(e)=>{e.preventDefault();showAuthForm('form-login');});
document.getElementById('auth-result-new-link').addEventListener('click',(e)=>{e.preventDefault();finishAuthEntry(false).then(()=>showAuthForm('form-recovery-email'));});
document.getElementById('auth-result-login').addEventListener('click',()=>finishAuthEntry(false));
document.getElementById('cancel-recovery').addEventListener('click',(e)=>{e.preventDefault();finishAuthEntry(false);});

document.getElementById('form-recovery-email').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const btn=document.getElementById('btn-send-recovery');
    const email=document.getElementById('recovery-email').value.trim();
    if(!email) return;
    btn.disabled=true;
    try {
        if(!supabase10) throw new Error('Serviço de autenticação indisponível.');
        const {error}=await supabase10.auth.resetPasswordForEmail(email,{redirectTo:CLIMATIZE_PASSWORD_RESET_URL});
        if(error) throw error;
        authFeedback('recovery-email-feedback','Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a pasta de spam.');
    }catch(err){
        console.error('Falha ao solicitar recuperação:',err?.message);
        authFeedback('recovery-email-feedback',/rate limit|too many/i.test(err?.message||'')?'Muitas tentativas. Aguarde alguns minutos antes de solicitar outro link.':'Não foi possível enviar a solicitação agora. Tente novamente.',true);
    }finally{btn.disabled=false;}
});

document.getElementById('form-recovery-password').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const senha=document.getElementById('recovery-new-password').value;
    const confirma=document.getElementById('recovery-confirm-password').value;
    if(!ClimatizeAuthFlow.blocking || ClimatizeAuthFlow.kind!=='recovery' || !ClimatizeAuthFlow.validated){
        return authFeedback('recovery-password-feedback','Link de recuperação não validado. Solicite um novo link.',true);
    }
    if(senha.length<8 || senha!==confirma){
        return authFeedback('recovery-password-feedback',senha.length<8?'A nova senha deve ter pelo menos 8 caracteres.':'As senhas não coincidem.',true);
    }
    const btn=document.getElementById('btn-update-recovery');btn.disabled=true;
    let senhaAtualizada=false;
    try{
        const {error}=await supabase10.auth.updateUser({password:senha});
        if(error) throw error;
        senhaAtualizada=true;
        document.getElementById('recovery-new-password').value='';
        document.getElementById('recovery-confirm-password').value='';
        // Confirmado pelo Auth, não efetuar login automático nem entrar no dashboard.
        await finishAuthEntry(false);
        await ClimatizeDialog.alert('Sua senha foi alterada! Entre com seu e-mail e a nova senha.',{titulo:'Senha atualizada',modo:'lock'});
    }catch(err){
        console.error('Falha ao redefinir senha:',err?.message);
        authFeedback('recovery-password-feedback',senhaAtualizada?'Sua nova senha foi salva, mas não foi possível encerrar a sessão automaticamente. Tente voltar ao login; se continuar, feche o aplicativo e abra novamente.':'Não foi possível salvar a nova senha. Confira as regras de senha e tente novamente.',true);
    }finally{btn.disabled=false;}
});

async function handleAuthReturn() {
    if(!ClimatizeAuthFlow.blocking) return;
    const kind=ClimatizeAuthFlow.kind;
    showAuthForm(kind==='recovery'?'form-recovery-password':'auth-link-result');
    if(ClimatizeAuthFlow.linkError || !ClimatizeAuthFlow.hasProof){
        authCleanURL();
        showAuthResult('Link inválido ou expirado','Este link não pôde ser validado. Solicite um novo link de recuperação ou tente entrar com suas credenciais.',kind==='recovery');
        return;
    }
    try{
        if(!supabase10) throw new Error('Serviço indisponível');
        if(ClimatizeAuthFlow.tokenHash){
            const {error}=await supabase10.auth.verifyOtp({token_hash:ClimatizeAuthFlow.tokenHash,type:kind==='recovery'?'recovery':'email'});
            if(error) throw error;
        }
        // getSession espera o processamento do callback OAuth/OTP pelo Supabase JS.
        const {data:{session},error:sessionError}=await supabase10.auth.getSession();
        if(sessionError || !session) throw sessionError||new Error('Sessão do link não encontrada.');
        const {data:{user},error:userError}=await supabase10.auth.getUser();
        if(userError || !user) throw userError||new Error('Link sem usuário válido.');
        if(kind==='recovery'){
            ClimatizeAuthFlow.validated=true;
            authCleanURL(); // Remove os parâmetros do link após validação.
            document.getElementById('recovery-link-status').textContent='Link validado. Escolha uma senha nova com pelo menos 8 caracteres.';
            ['recovery-new-password','recovery-confirm-password','btn-update-recovery'].forEach(id=>document.getElementById(id).disabled=false);
            showAuthForm('form-recovery-password');
        }else{
            // A confirmação não deve fazer login automático, mesmo que o Supabase crie sessão.
            const {error:logoutError}=await supabase10.auth.signOut({scope:'local'});
            if(logoutError) throw logoutError;
            authCleanURL();
            showAuthResult('E-mail confirmado','Sua conta foi confirmada. Clique abaixo para entrar no Climatize com seu e-mail e senha.');
        }
    }catch(err){
        console.warn('Retorno de autenticação não validado:',err?.message);
        authCleanURL();
        showAuthResult('Não foi possível validar o link','O link pode ter expirado ou já ter sido utilizado. Solicite um novo link ou tente entrar pelo login.',kind==='recovery');
    }
}
// Mensagem de retorno após concluir a troca na página dedicada.
if (climatizeReturnQuery.get('auth_reset') === 'success') {
    const aviso = document.getElementById('login-reset-status');
    if (aviso) { aviso.textContent = 'Senha alterada com sucesso! Entre usando sua nova senha.'; aviso.classList.remove('hidden'); }
    authCleanURL();
}
// Inicializado após os formulários e cliente Auth; não modifica módulos financeiros.
handleAuthReturn().catch(err=>{console.error('Falha no retorno de autenticação:',err);showAuthResult('Falha de autenticação','Tente novamente ou solicite um novo link.',true);});

// ==========================================
// MÓDULO FINANCEIRO (DASHBOARD)
// ==========================================
async function initDashboard() {
    atualizarOpcoesCategorias();
    renderChart();
    await buscarTransacoes();
}

async function buscarTransacoes() {
    try {
        const { data: { user } } = await supabase10.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase10
            .from('transacoes')
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;

        transacoes = data;
        updateCalculos();
        renderTabela();
        if(typeof atualizarFiltrosExportacao==='function')atualizarFiltrosExportacao();
        updateChart();
    } catch (error) {
        console.error("Erro ao buscar transações:", error.message);
    }
}

formTransacao.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const { data: { user } } = await supabase10.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const tipo = selectTipo.value;
        const categoria = selectCategoria.value;
        const descricao = document.getElementById('t-descricao').value;
        const valor = parseFloat(document.getElementById('t-valor').value);
        const data = document.getElementById('t-data').value;

        const novaTransacao = { 
            tipo, 
            categoria, 
            descricao, 
            valor, 
            data,
            user_id: user.id 
        };

        const { error } = await supabase10
            .from('transacoes')
            .insert([novaTransacao]);

        if (error) throw error;

        formTransacao.reset();
        atualizarOpcoesCategorias();
        await buscarTransacoes();
        ClimatizeDialog.alert("Lançamento adicionado com sucesso!");
    } catch (error) {
        ClimatizeDialog.alert("Erro ao salvar transação: " + error.message);
    }
});

function updateCalculos() {
    const entradas = transacoes
        .filter(t => t.tipo === 'entrada')
        .reduce((acc, t) => acc + t.valor, 0);

    const saidas = transacoes
        .filter(t => t.tipo === 'saida')
        .reduce((acc, t) => acc + t.valor, 0);

    const saldo = entradas - saidas;

    document.getElementById('total-entradas').innerText = entradas.toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
    document.getElementById('total-saidas').innerText = saidas.toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
    document.getElementById('saldo-liquido').innerText = saldo.toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
}

function renderTabela() {
    const tbody=document.getElementById('transacoes-list');
    tbody.replaceChildren();
    transacoes.forEach(t=>{
        const tr=document.createElement('tr');
        const cell=(label,valor,classe='')=>{
            const td=document.createElement('td');td.dataset.label=label;
            td.textContent=String(valor??'');if(classe)td.className=classe;
            tr.append(td);return td;
        };
        cell('Data',formatarDataFinanceira(t.data));
        const tipo=cell('Tipo',String(t.tipo||'').toUpperCase());
        tipo.style.color=t.tipo==='entrada'?'var(--success)':'var(--danger)';
        cell('Categoria',t.categoria||'—');cell('Descrição',t.descricao||'—');
        cell('Valor',moedaFinanceira(t.valor),'money-cell');
        const acao=document.createElement('td');acao.dataset.label='Ações';
        const grupo=document.createElement('div');grupo.className='transaction-actions';
        const editar=document.createElement('button');editar.type='button';editar.textContent='Editar';
        editar.className='btn-row-edit';editar.addEventListener('click',()=>abrirEdicaoTransacao(t));
        const excluir=document.createElement('button');excluir.type='button';excluir.textContent='Excluir';
        excluir.className='btn-row-danger';excluir.addEventListener('click',()=>deletarTransacao(t.id));
        grupo.append(editar,excluir);acao.append(grupo);tr.append(acao);tbody.append(tr);
    });
}

const moedaFinanceira=(valor)=>Number(valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function formatarDataFinanceira(iso){
    const v=String(iso||'').slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v)?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:v;
}

// O backend v2 tem trigger que proíbe alterações em recebimentos conciliados.
// Fazemos também a pré-checagem no cliente e nunca liberamos edição se ela falhar.
async function validarTransacaoLivre(id){
    const {data,error}=await supabase10.from('climatize_recebimentos_v2')
      .select('id').eq('transacao_id',String(id)).limit(1);
    if(error && !['42P01','PGRST205'].includes(error.code))throw new Error('Não foi possível verificar o vínculo com orçamentos. Operação cancelada por segurança.');
    // Se a tabela ainda não existir, nenhuma receita v2 poderá estar vinculada.
    if(data?.length)throw new Error('Este lançamento pertence a um recebimento de orçamento e não pode ser editado ou excluído isoladamente.');
}

const modalEditarTransacao=document.getElementById('transacao-edit-dialog');
const formEditarTransacao=document.getElementById('form-editar-transacao');
let transacaoEmEdicao=null;
const editTipo=document.getElementById('edit-t-tipo');
const editCategoria=document.getElementById('edit-t-categoria');
function atualizarCategoriasEdicao(preferida){
    const valores=[...new Set([...(CATEGORIAS[editTipo.value]||[]),preferida].filter(Boolean))];
    editCategoria.replaceChildren();
    valores.forEach(cat=>editCategoria.add(new Option(cat,cat)));
    if(preferida)editCategoria.value=preferida;
}
editTipo.addEventListener('change',()=>atualizarCategoriasEdicao());
document.getElementById('edit-t-cancelar').addEventListener('click',()=>modalEditarTransacao.close());
modalEditarTransacao.addEventListener('close',()=>{transacaoEmEdicao=null;formEditarTransacao.reset();});
async function abrirEdicaoTransacao(lancamento){
    try{
        const {data:{user},error}=await supabase10.auth.getUser();
        if(error||!user||user.id!==lancamento.user_id)throw new Error('Sessão inválida ou lançamento sem permissão de edição.');
        await validarTransacaoLivre(lancamento.id);
        // Recarregar o registro evita editar valores já alterados em outro dispositivo.
        const {data:atual,error:erroBusca}=await supabase10.from('transacoes')
          .select('id,user_id,tipo,categoria,descricao,valor,data').eq('id',lancamento.id).eq('user_id',user.id).single();
        if(erroBusca||!atual)throw new Error('Não foi possível carregar o lançamento atualizado.');
        transacaoEmEdicao=atual;
        editTipo.value=atual.tipo;
        atualizarCategoriasEdicao(atual.categoria);
        document.getElementById('edit-t-descricao').value=atual.descricao||'';
        document.getElementById('edit-t-valor').value=atual.valor;
        document.getElementById('edit-t-data').value=String(atual.data).slice(0,10);
        modalEditarTransacao.showModal();
    }catch(e){await ClimatizeDialog.alert(e.message,{titulo:'Edição indisponível'});}
}
formEditarTransacao.addEventListener('submit',async e=>{
    e.preventDefault();if(!transacaoEmEdicao)return;
    const salvar=document.getElementById('edit-t-salvar');salvar.disabled=true;
    try{
        const antiga=transacaoEmEdicao;
        const {data:{user},error:authError}=await supabase10.auth.getUser();
        if(authError||!user||user.id!==antiga.user_id)throw new Error('Sessão expirada ou acesso não autorizado.');
        await validarTransacaoLivre(antiga.id);
        const nova={tipo:editTipo.value,categoria:editCategoria.value,
          descricao:document.getElementById('edit-t-descricao').value.trim(),
          valor:Number(document.getElementById('edit-t-valor').value),
          data:document.getElementById('edit-t-data').value};
        if(!['entrada','saida'].includes(nova.tipo)||!nova.categoria||!nova.descricao||
          !Number.isFinite(nova.valor)||nova.valor<=0||!/^\d{4}-\d{2}-\d{2}$/.test(nova.data)){
          throw new Error('Preencha todos os campos com valores válidos.');
        }
        // Controle de concorrência: a edição só persiste caso o registro permaneça
        // exatamente como estava quando o formulário foi aberto.
        let req=supabase10.from('transacoes').update(nova)
          .eq('id',antiga.id).eq('user_id',user.id).eq('tipo',antiga.tipo)
          .eq('categoria',antiga.categoria).eq('valor',antiga.valor).eq('data',antiga.data);
        req=antiga.descricao===null?req.is('descricao',null):req.eq('descricao',antiga.descricao);
        const {data,error}=await req.select('id');
        if(error)throw error;
        if(!data?.length)throw new Error('O lançamento foi alterado em outro dispositivo ou não está disponível. Nenhuma mudança foi aplicada. Atualize o histórico e tente novamente.');
        modalEditarTransacao.close();
        await buscarTransacoes();
        await ClimatizeDialog.alert('Lançamento atualizado com sucesso!');
    }catch(err){
        console.error('Erro ao editar lançamento:',err);
        await ClimatizeDialog.alert('Não foi possível salvar as alterações: '+err.message,{titulo:'Edição não concluída',modo:'danger'});
    }finally{salvar.disabled=false;}
});

// ==========================================
// FUNÇÃO DE EXCLUSÃO CORRIGIDA
// ==========================================
async function deletarTransacao(id) {
    // Registros originados dos orçamentos V2 são conciliados: não excluir isoladamente.
    try {
        const {data:pagos, error:pgErr} = await supabase10.from('climatize_recebimentos_v2').select('id').eq('transacao_id',String(id)).limit(1);
        if (!pgErr && pagos?.length) {ClimatizeDialog.alert('Este lançamento veio de um orçamento. Para preservar a conciliação, não é possível excluí-lo isoladamente.');return;}
        if (pgErr && pgErr.code !== '42P01' && pgErr.code !== 'PGRST205') { throw pgErr; }
    } catch (err) {ClimatizeDialog.alert('Não foi possível verificar a vinculação do lançamento. Exclusão cancelada por segurança.');return;}
    if (!await ClimatizeDialog.confirm("Tem certeza de que deseja apagar este lançamento?")) return;

    try {
        const { error } = await supabase10
            .from('transacoes')
            .delete()
            .match({ id: id }); // Mantém a exclusão original e as políticas RLS existentes

        if (error) throw error;

        await buscarTransacoes();
    } catch (error) {
        console.error("Erro ao apagar transação:", error.message);
        ClimatizeDialog.alert("Erro ao apagar transação: Verifique as permissões (RLS) no Supabase para a tabela transacoes.");
    }
}

// ==========================================
// GRÁFICOS (CHART.JS)
// ==========================================
function renderChart() {
    // Evita "Canvas is already in use" ao restaurar a sessão ou fazer novo login.
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const ctx = document.getElementById('financeChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                label: 'Total (R$)',
                data: [0, 0],
                backgroundColor: ['#19a58e', '#e46b78'],
                borderRadius: 9,
                borderSkipped: false,
                maxBarThickness: 85
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}, tooltip: {callbacks: {label: (ctx) => Number(ctx.parsed.y || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}}},
            scales: {x: {grid: {display:false}, ticks:{color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#617b81',font:{size:13,weight:600}}}, y: {beginAtZero:true,grid:{color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#e7eff0'},ticks:{color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#617b81',callback:(v)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',notation:'compact'})}, border:{display:false}}}
        }
    });
}

function updateChart() {
    const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
    const saidas = transacoes.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + t.valor, 0);

    if (!chartInstance) return;
    chartInstance.data.datasets[0].data = [entradas, saidas];
    chartInstance.update();
}

// ==========================================
// MÓDULO OCR DETALHADO POR ITENS (NUVEM OCR.SPACE)
// ==========================================
const btnTriggerCamera = document.getElementById('btn-trigger-camera');
const btnTriggerGallery = document.getElementById('btn-trigger-gallery');
const ocrFileInput = document.getElementById('ocr-file-input');
const ocrPreviewContainer = document.getElementById('ocr-preview-container');
const ocrPrevTipo = document.getElementById('ocr-prev-tipo');
const ocrPrevTotal = document.getElementById('ocr-prev-total');
const ocrPrevDesc = document.getElementById('ocr-prev-desc');
const ocrItensList = document.getElementById('ocr-itens-list');
const btnConfirmOcr = document.getElementById('btn-confirm-ocr');
const btnCancelOcr = document.getElementById('btn-cancel-ocr');
const statusDiv = document.getElementById('ocr-status');

btnTriggerCamera.addEventListener('click', () => {
    ocrFileInput.setAttribute('capture', 'environment');
    ocrFileInput.click();
});

btnTriggerGallery.addEventListener('click', () => {
    ocrFileInput.removeAttribute('capture');
    ocrFileInput.click();
});

ocrFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;

    const file = e.target.files[0];
    statusDiv.innerText = 'Enviando imagem para análise detalhada na nuvem (OCR.space)... Aguarde.';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('apikey', 'helloworld');
    formData.append('language', 'por');
    formData.append('isOverlayRequired', 'false');

    try {
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.IsErroredOnProcessing) {
            throw new Error(result.ErrorMessage || 'Erro ao processar OCR.');
        }

        const parsedText = result.ParsedResults && result.ParsedResults.length > 0 
            ? result.ParsedResults[0].ParsedText 
            : '';

        statusDiv.innerText = 'Leitura concluída! Revise e ajuste os itens e valores abaixo.';

        const linhas = parsedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        let itensEncontrados = [];
        let valoresExtraidos = [];

        const regexValor = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g;

        linhas.forEach((linha) => {
            let match;
            let achouValorNaLinha = false;
            while ((match = regexValor.exec(linha)) !== null) {
                let valNum = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                valoresExtraidos.push(valNum);
                achouValorNaLinha = true;
            }
            if (linha.length > 3 && !/total|cnpj|cpf|data|rua|fone|caixa|operador|dinheiro|troco/i.test(linha)) {
                itensEncontrados.push({ 
                    texto: linha, 
                    valor: achouValorNaLinha ? valoresExtraidos[valoresExtraidos.length - 1] || 0 : 0 
                });
            }
        });

        if (valoresExtraidos.length > 0) {
            ocrPrevTotal.value = Math.max(...valoresExtraidos).toFixed(2);
        } else {
            ocrPrevTotal.value = '0.00';
        }

        ocrPrevDesc.value = itensEncontrados[0]?.texto || "Nota Fiscal Escaneada";
        ocrPrevTipo.value = 'saida';

        ocrItensList.innerHTML = '';
        if (itensEncontrados.length === 0) {
            itensEncontrados.push({ texto: "Item geral da nota", valor: ocrPrevTotal.value });
        }

        itensEncontrados.forEach((item, index) => {
            const divItem = document.createElement('div');
            divItem.style.cssText = "display: flex; gap: 8px; align-items: center;";
            // OCR é dado externo: construir elementos sem interpolar HTML.
            const labelItem = document.createElement('span');
            labelItem.style.cssText = 'font-size:0.8rem;font-weight:bold;min-width:45px;';
            labelItem.textContent = `Item ${index + 1}:`;
            const descInput = document.createElement('input');
            descInput.type = 'text'; descInput.className = 'item-desc'; descInput.value = item.texto;
            descInput.style.cssText = 'flex:2;min-width:150px;padding:6px;border:1px solid #ccc;border-radius:4px;font-size:0.85rem;';
            const valorInput = document.createElement('input');
            valorInput.type = 'number'; valorInput.step = '0.01'; valorInput.className = 'item-val';
            valorInput.value = item.valor || ''; valorInput.placeholder = 'Valor R$';
            valorInput.style.cssText = 'flex:1;min-width:100px;padding:6px;border:1px solid #ccc;border-radius:4px;font-size:0.85rem;';
            divItem.append(labelItem, descInput, valorInput);
            ocrItensList.appendChild(divItem);
        });

        ocrPreviewContainer.style.display = 'block';

    } catch (err) {
        statusDiv.innerText = 'Erro ao processar imagem.';
        console.error(err);
        ClimatizeDialog.alert("Erro no OCR: " + err.message);
    }
});

btnConfirmOcr.addEventListener('click', async () => {
    try {
        const { data: { user } } = await supabase10.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const tipo = ocrPrevTipo.value;
        const descricaoGeral = ocrPrevDesc.value;
        const dataHoje = new Date().toISOString().split('T')[0];
        const categoriaPadrao = CATEGORIAS[tipo][0];

        const linhasItens = ocrItensList.querySelectorAll('div');
        let transacoesParaInserir = [];

        linhasItens.forEach((div) => {
            const descItem = div.querySelector('.item-desc').value;
            const valItem = parseFloat(div.querySelector('.item-val').value);

            if (valItem && valItem > 0) {
                transacoesParaInserir.push({
                    tipo,
                    categoria: categoriaPadrao,
                    descricao: `${descricaoGeral} - ${descItem}`,
                    valor: valItem,
                    data: dataHoje,
                    user_id: user.id
                });
            }
        });

        if (transacoesParaInserir.length === 0) {
            transacoesParaInserir.push({
                tipo,
                categoria: categoriaPadrao,
                descricao: descricaoGeral,
                valor: parseFloat(ocrPrevTotal.value) || 0,
                data: dataHoje,
                user_id: user.id
            });
        }

        const { error } = await supabase10
            .from('transacoes')
            .insert(transacoesParaInserir);

        if (error) throw error;

        ocrPreviewContainer.style.display = 'none';
        statusDiv.innerText = 'Lançamentos detalhados enviados com sucesso para o Supabase!';
        ocrFileInput.value = '';
        await buscarTransacoes();
    } catch (error) {
        ClimatizeDialog.alert("Erro ao salvar lançamentos: " + error.message);
    }
});

btnCancelOcr.addEventListener('click', () => {
    ocrPreviewContainer.style.display = 'none';
    statusDiv.innerText = 'Leitura descartada. Tire outra foto quando desejar.';
    ocrFileInput.value = '';
});

// ==========================================
// EXPORTAÇÃO FILTRADA — CSV E PDF
// ==========================================
const exportPeriodo=document.getElementById('export-periodo');
const exportTipo=document.getElementById('export-tipo');
const exportCategoria=document.getElementById('export-categoria');
const exportResumo=document.getElementById('export-filtros-resumo');
function atualizarFiltrosExportacao(){
    const periodo=exportPeriodo.value;
    document.getElementById('export-mes-wrap').classList.toggle('hidden',periodo!=='mes');
    document.getElementById('export-inicio-wrap').classList.toggle('hidden',periodo!=='intervalo');
    document.getElementById('export-fim-wrap').classList.toggle('hidden',periodo!=='intervalo');
    const selecionada=exportCategoria.value;
    const categorias=[...new Set([...CATEGORIAS.entrada,...CATEGORIAS.saida,...transacoes.map(t=>t.categoria)].filter(Boolean))];
    const permitidas=exportTipo.value==='todos'?categorias:
        [...new Set([...(CATEGORIAS[exportTipo.value]||[]),...transacoes.filter(t=>t.tipo===exportTipo.value).map(t=>t.categoria)].filter(Boolean))];
    exportCategoria.replaceChildren(new Option('Todas as categorias','todos'));
    permitidas.sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(cat=>exportCategoria.add(new Option(cat,cat)));
    exportCategoria.value=permitidas.includes(selecionada)?selecionada:'todos';
    const itens=[];
    if(periodo==='mes')itens.push('Mês: '+(document.getElementById('export-mes').value||'não definido'));
    if(periodo==='intervalo')itens.push('Intervalo: '+(document.getElementById('export-inicio').value||'início não definido')+' a '+(document.getElementById('export-fim').value||'fim não definido'));
    if(exportTipo.value!=='todos')itens.push(exportTipo.value==='entrada'?'Entradas':'Saídas');
    if(exportCategoria.value!=='todos')itens.push('Categoria: '+exportCategoria.value);
    exportResumo.textContent=itens.length?itens.join(' · '):'Todos os registros';
}
['export-periodo','export-tipo','export-categoria','export-mes','export-inicio','export-fim'].forEach(id=>{
    document.getElementById(id).addEventListener('change',atualizarFiltrosExportacao);
});
document.getElementById('export-limpar').addEventListener('click',()=>{
    exportPeriodo.value='todos';exportTipo.value='todos';exportCategoria.value='todos';
    ['export-mes','export-inicio','export-fim'].forEach(id=>document.getElementById(id).value='');
    atualizarFiltrosExportacao();
});
function selecionarRegistrosExportacao(){
    const periodo=exportPeriodo.value;
    let desde=null,ate=null,etiqueta='Todos os períodos';
    if(periodo==='mes'){
        const mes=document.getElementById('export-mes').value;
        if(!/^\d{4}-\d{2}$/.test(mes))throw new Error('Escolha um mês para exportar.');
        desde=mes+'-01';const [ano,m]=mes.split('-').map(Number);
        ate=`${ano}-${String(m).padStart(2,'0')}-${String(new Date(ano,m,0).getDate()).padStart(2,'0')}`;
        etiqueta=`${String(m).padStart(2,'0')}/${ano}`;
    }
    if(periodo==='intervalo'){
        desde=document.getElementById('export-inicio').value;
        ate=document.getElementById('export-fim').value;
        if(!desde||!ate||desde>ate)throw new Error('Informe um intervalo de datas válido.');
        etiqueta=`${formatarDataFinanceira(desde)} a ${formatarDataFinanceira(ate)}`;
    }
    const tipo=exportTipo.value,categoria=exportCategoria.value;
    const registros=transacoes.filter(t=>{
        const data=String(t.data||'').slice(0,10);
        return (!desde||data>=desde)&&(!ate||data<=ate)&&
            (tipo==='todos'||t.tipo===tipo)&&(categoria==='todos'||t.categoria===categoria);
    }).sort((a,b)=>String(a.data).localeCompare(String(b.data))||Number(a.id)-Number(b.id));
    const filtros=[`Período: ${etiqueta}`];
    if(tipo!=='todos')filtros.push(`Tipo: ${tipo==='entrada'?'Entradas':'Saídas'}`);
    if(categoria!=='todos')filtros.push(`Categoria: ${categoria}`);
    return {registros,etiqueta,filtros:filtros.join('  ·  ')};
}
async function validarExportacao(){
    try{
        const resultado=selecionarRegistrosExportacao();
        if(!resultado.registros.length){await ClimatizeDialog.alert('Nenhum lançamento encontrado para os filtros escolhidos.');return null;}
        return resultado;
    }catch(e){await ClimatizeDialog.alert(e.message,{titulo:'Revise os filtros'});return null;}
}
// Exportação em Excel verdadeiro (.xlsx), reutilizando os filtros do PDF.
// Textos do usuário são células de texto, nunca fórmulas executáveis.
document.getElementById('btn-export-xlsx').addEventListener('click',async()=>{
    const selecionado=await validarExportacao();if(!selecionado)return;
    if(!window.ClimatizeXlsx){await ClimatizeDialog.alert('Exportação Excel indisponível. Atualize o aplicativo e tente novamente.');return;}
    const nome=await ClimatizeDialog.askXlsxName('Climatize_Relatorio_Financeiro');if(!nome)return;
    try{window.ClimatizeXlsx.baixar(selecionado,nome);}
    catch(err){console.error('Falha ao exportar Excel:',err);await ClimatizeDialog.alert('Não foi possível gerar o arquivo Excel: '+(err.message||'Tente novamente.'));}
});

document.getElementById('btn-export-pdf').addEventListener('click',async()=>{
    if(!window.jspdf?.jsPDF){await ClimatizeDialog.alert('Biblioteca de PDF indisponível. Verifique a conexão e tente novamente.');return;}
    const selecionado=await validarExportacao();if(!selecionado)return;
    const nome=await ClimatizeDialog.askPdfName(`Climatize_Relatorio_Financeiro_${new Date().toLocaleDateString('sv-SE')}`);
    if(!nome)return;
    try{
        const {jsPDF}=window.jspdf;
        const doc=new jsPDF({unit:'mm',format:'a4'}),W=210,H=297;
        const teal=[7,79,85],turq=[65,183,198],light=[238,248,249],ink=[27,52,59];
        let logo=null;
        try{
            const response=await fetch('climatize.png');if(!response.ok)throw new Error('Logo não localizada');
            const blob=await response.blob();
            logo=await new Promise((resolve,reject)=>{
                const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);
            });
        }catch(err){console.warn('Logo indisponível no relatório:',err);}
        const fill=c=>doc.setFillColor(...c),text=c=>doc.setTextColor(...c);
        function pagina(){
            fill([255,255,255]);doc.rect(0,0,W,H,'F');fill(teal);doc.rect(0,0,W,43,'F');
            fill(turq);doc.rect(0,42,W,1,'F');
            if(logo){try{doc.addImage(logo,'PNG',13,3,63,37);}catch(err){console.warn('Erro ao desenhar logo:',err);}}
            else{doc.setFont('helvetica','bold');doc.setFontSize(19);text([255,255,255]);doc.text('CLIMATIZE',14,25);}
            text([255,255,255]);doc.setFont('helvetica','bold');doc.setFontSize(9);
            doc.text('CLIMATIZE AR-CONDICIONADO',196,12,{align:'right'});
            doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('RELATÓRIO FINANCEIRO',196,20,{align:'right'});
            doc.setDrawColor(210,225,228);doc.line(14,281,196,281);
            text([80,104,110]);doc.setFontSize(8);doc.text('Climatize · Conforto e bem-estar para cada ambiente',14,288);
            doc.text(String(doc.internal.getNumberOfPages()),196,288,{align:'right'});
        }
        pagina();text(ink);doc.setFont('helvetica','bold');doc.setFontSize(16);
        doc.text('RELATÓRIO FINANCEIRO',14,55);
        doc.setFont('helvetica','normal');doc.setFontSize(9);
        doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`,14,62);
        const filtroLinhas=doc.splitTextToSize(selecionado.filtros,180);
        doc.text(filtroLinhas,14,69);
        let y=69+filtroLinhas.length*4.4+5;
        const entradas=selecionado.registros.filter(t=>t.tipo==='entrada').reduce((a,t)=>a+Number(t.valor||0),0);
        const saidas=selecionado.registros.filter(t=>t.tipo==='saida').reduce((a,t)=>a+Number(t.valor||0),0);
        const indicadores=[['ENTRADAS',entradas],['SAÍDAS',saidas],['SALDO',entradas-saidas]];
        indicadores.forEach(([titulo,valor],i)=>{
            const x=14+i*62;fill(light);doc.roundedRect(x,y,58,19,2,2,'F');
            text(teal);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(titulo,x+4,y+6.5);
            doc.setFontSize(11);text(ink);doc.text(moedaFinanceira(valor),x+4,y+14);
        });
        y+=27;
        function cabecalhoTabela(){
            fill(teal);doc.roundedRect(14,y,182,10,1.4,1.4,'F');
            doc.setFont('helvetica','bold');doc.setFontSize(7.3);text([255,255,255]);
            doc.text('DATA',17,y+6.5);doc.text('DESCRIÇÃO',41,y+6.5);
            doc.text('CATEGORIA',113,y+6.5);doc.text('TIPO',157,y+6.5);
            doc.text('VALOR',192,y+6.5,{align:'right'});y+=12;
        }
        cabecalhoTabela();
        let n=0;
        for(const item of selecionado.registros){
            const descricao=doc.splitTextToSize(String(item.descricao||'—'),67);
            const categoria=doc.splitTextToSize(String(item.categoria||'—'),38);
            let i=0,j=0,primeiro=true;
            do{
                // Registros excepcionalmente extensos continuam na página seguinte.
                const linhasDisponiveis=Math.max(1,Math.floor((269-y-5)/4.2));
                if(linhasDisponiveis<2){doc.addPage();pagina();y=54;cabecalhoTabela();continue;}
                const desc=descricao.slice(i,i+linhasDisponiveis),cat=categoria.slice(j,j+linhasDisponiveis);
                const contagem=Math.max(desc.length,cat.length,1),altura=Math.max(11,contagem*4.2+5);
                if(y+altura>270){doc.addPage();pagina();y=54;cabecalhoTabela();continue;}
                if(n%2===0){fill(light);doc.rect(14,y,182,altura,'F');}
                doc.setFont('helvetica','normal');doc.setFontSize(7.4);text(ink);
                if(primeiro){
                    doc.text(formatarDataFinanceira(item.data),17,y+5);
                    doc.text(item.tipo==='entrada'?'Entrada':'Saída',157,y+5);
                    doc.text(moedaFinanceira(item.valor),193,y+5,{align:'right'});
                }
                if(desc.length)doc.text(desc,41,y+5);
                if(cat.length)doc.text(cat,113,y+5);
                i+=desc.length;j+=cat.length;y+=altura;primeiro=false;
                if(i<descricao.length||j<categoria.length){doc.addPage();pagina();y=54;cabecalhoTabela();}
            }while(i<descricao.length||j<categoria.length);
            n++;
        }
        doc.save(nome);
    }catch(e){console.error('Erro ao gerar relatório:',e);await ClimatizeDialog.alert('Não foi possível gerar o relatório: '+e.message,{titulo:'Falha na exportação',modo:'danger'});}
});

// ==========================================
// ALTERAÇÃO DE SENHA SEGURA
// ==========================================
document.getElementById('btn-alterar-senha').addEventListener('click', async () => {
    const dados = await ClimatizeDialog.changePassword();
    if (!dados) return;
    try {
        const { data: { user } } = await supabase10.auth.getUser();
        if (!user || !user.email) throw new Error('Usuário não identificado.');
        const { error: authError } = await supabase10.auth.signInWithPassword({
            email: user.email,
            password: dados.atual
        });
        if (authError) throw new Error('A senha atual está incorreta.');
        const { error: updateError } = await supabase10.auth.updateUser({ password: dados.nova });
        if (updateError) throw updateError;
        await ClimatizeDialog.alert('Senha alterada com sucesso!', { titulo:'Senha atualizada', modo:'lock' });
    } catch (error) {
        await ClimatizeDialog.alert('Erro ao alterar senha: ' + error.message, { titulo:'Não foi possível alterar a senha', modo:'danger' });
    }
});