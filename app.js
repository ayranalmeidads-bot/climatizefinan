// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://itkzuoqdgxkzlwjkege.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0a3p1b3FnZ2t4enxsd2prZWdlIiwicm9sZSI6InB1YmxpY2hlIiwiaWF0IjoxNzEzMTk2OTE5LCJleHAiOjIwMjg3NTI5MTl9.sb_publishable_XRwRbPyyeEdggyeycba0FQQ_ImSkKo16";
const supabase10 = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Categorias específicas fornecidas pelo usuário
const CATEGORIAS = {
    entrada: [
        "Instalação", "Higienização", "Manutenção corretiva", "Infraestrutura", "Desinstalação"
    ],
    saida: [
        "Tubulação", "Suporte", "Kit instalação", "Fita PVC", "Aluminizada", "Fita isolante", "Silver tape", "Ferramenta", "Gasolina", "Ajudante"
    ]
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

// Escuta mudança de tipo (Entrada/Saída) para carregar as categorias corretas
selectTipo.addEventListener('change', atualizarOpcoesCategorias);

// ==========================================
// AUTENTICAÇÃO E FLUXO DE TELAS
// ==========================================
linkGoRegister.addEventListener('click', (e) => {
    e.preventDefault();
    formLogin.classList.remove('active');
    formRegister.classList.add('active');
});

linkGoLogin.addEventListener('click', (e) => {
    e.preventDefault();
    formRegister.classList.remove('active');
    formLogin.classList.add('active');
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
        alert("Erro no login: " + error.message);
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
            options: { data: { nome: nome } }
        });
        if (error) throw error;

        alert(`Usuário ${nome} registrado com sucesso! Faça seu login.`);
        formRegister.classList.remove('active');
        formLogin.classList.add('active');
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
    }
});

btnLogout.addEventListener('click', async () => {
    await supabase10.auth.signOut();
    appDashboard.classList.add('hidden');
    screenAuth.classList.remove('hidden');
});

// ==========================================
// MÓDULO FINANCEIRO (DASHBOARD)
// ==========================================
async function initDashboard() {
    atualizarOpcoesCategorias();
    renderChart();
    await buscarTransacoes();
}

// Buscar Transações do Usuário Logado
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
        updateChart();
    } catch (error) {
        console.error("Erro ao buscar transações:", error.message);
    }
}

// Lançamento de Transações
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
    } catch (error) {
        alert("Erro ao salvar transação: " + error.message);
    }
});

// Atualização dos KPI Cards
function updateCalculos() {
    const entradas = transacoes
        .filter(t => t.tipo === 'entrada')
        .reduce((acc, t) => acc + t.valor, 0);

    const saidas = transacoes
        .filter(t => t.tipo === 'saida')
        .reduce((acc, t) => acc + t.valor, 0);

    const saldo = entradas - saidas;

    document.getElementById('total-entradas').innerText = `R$ ${entradas.toFixed(2)}`;
    document.getElementById('total-saidas').innerText = `R$ ${saidas.toFixed(2)}`;
    document.getElementById('saldo-liquido').innerText = `R$ ${saldo.toFixed(2)}`;
}

// Renderizar Tabela
function renderTabela() {
    const tbody = document.getElementById('transacoes-list');
    tbody.innerHTML = '';

    transacoes.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.data}</td>
            <td><b style="color: ${t.tipo === 'entrada' ? 'green' : 'red'}">${t.tipo.toUpperCase()}</b></td>
            <td><strong>${t.categoria}</strong></td>
            <td>${t.descricao || '-'}</td>
            <td>R$ ${t.valor.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// GRÁFICOS (CHART.JS)
// ==========================================
function renderChart() {
    const ctx = document.getElementById('financeChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                label: 'Total (R$)',
                data: [0, 0],
                backgroundColor: ['#2ec4b6', '#e71d36']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateChart() {
    const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
    const saidas = transacoes.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + t.valor, 0);

    chartInstance.data.datasets[0].data = [entradas, saidas];
    chartInstance.update();
}

// ==========================================
// MÓDULO OCR (TESSERACT.JS)
// ==========================================
document.getElementById('btn-process-ocr').addEventListener('click', () => {
    const fileInput = document.getElementById('ocr-file-input');
    const statusDiv = document.getElementById('ocr-status');

    if (fileInput.files.length === 0) {
        alert('Por favor, selecione uma foto de nota fiscal.');
        return;
    }

    const file = fileInput.files[0];
    statusDiv.innerText = 'Lendo imagem... Aguarde.';

    Tesseract.recognize(
        file,
        'por',
        { logger: m => console.log(m) }
    ).then(({ data: { text } }) => {
        statusDiv.innerText = 'Leitura concluída!';
        alert('Texto extraído da Nota Fiscal:\n\n' + text);
    }).catch(err => {
        statusDiv.innerText = 'Erro ao processar imagem.';
        console.error(err);
    });
});

// ==========================================
// EXPORTAÇÃO (CSV & PDF)
// ==========================================
document.getElementById('btn-export-csv').addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,Data,Tipo,Categoria,Descricao,Valor\n";
    transacoes.forEach(t => {
        csvContent += `${t.data},${t.tipo},${t.categoria},"${t.descricao || ''}",${t.valor}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "climatize_relatorio.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Climatize - Relatório Financeiro", 10, 10);
    let y = 20;

    transacoes.forEach((t) => {
        doc.text(`${t.data} - [${t.tipo.toUpperCase()}] ${t.categoria}: R$ ${t.valor.toFixed(2)} (${t.descricao || ''})`, 10, y);
        y += 10;
    });

    doc.save("climatize_relatorio.pdf");
});