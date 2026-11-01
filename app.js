// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://ditkzuoqdgxkziwjkege.supabase.co";
const SUPABASE_KEY = "sb_publishable_XRwRbPVyeDggyeYcbA0fQQ_ImSkKoi6";
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
            <td><button onclick="deletarTransacao('${t.id}')" class="btn-delete" style="background: #e71d36; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function deletarTransacao(id) {
    if (!confirm("Tens a certeza de que queres apagar este lançamento?")) return;

    try {
        const { error } = await supabase10
            .from('transacoes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await buscarTransacoes();
    } catch (error) {
        alert("Erro ao apagar transação: " + error.message);
    }
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
// MÓDULO OCR INTELIGENTE (BOTÃO ÚNICO)
// ==========================================
const btnTriggerOcr = document.getElementById('btn-trigger-ocr');
const ocrFileInput = document.getElementById('ocr-file-input');

btnTriggerOcr.addEventListener('click', () => {
    ocrFileInput.click();
});

ocrFileInput.addEventListener('change', (e) => {
    const statusDiv = document.getElementById('ocr-status');

    if (e.target.files.length === 0) return;

    const file = e.target.files[0];
    statusDiv.innerText = 'Lendo imagem e extraindo dados... Aguarde.';

    Tesseract.recognize(
        file,
        'por',
        { logger: m => console.log(m) }
    ).then(({ data: { text } }) => {
        statusDiv.innerText = 'Leitura concluída! Revise e ajuste os dados no formulário abaixo.';
        
        const regexValores = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
        let match;
        let maioresValores = [];
        while ((match = regexValores.exec(text)) !== null) {
            let num = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
            maioresValores.push(num);
        }

        if (maioresValores.length > 0) {
            const maiorValor = Math.max(...maioresValores);
            document.getElementById('t-valor').value = maiorValor.toFixed(2);
        }

        const descricaoResumida = text.replace(/[\n\r]+/g, ' ').substring(0, 60).trim();
        document.getElementById('t-descricao').value = descricaoResumida || "Nota Fiscal Escaneada";
        
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('t-data').value = hoje;

        alert('Dados extraídos! Revise os campos e clique em "Adicionar Lançamento".');
    }).catch(err => {
        statusDiv.innerText = 'Erro ao processar imagem.';
        console.error(err);
    });
});

// ==========================================
// EXPORTAÇÃO (CSV & PDF COM LOGO)
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

document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const getBase64ImageFromUrl = async (imageUrl) => {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    };

    try {
        const logoData = await getBase64ImageFromUrl('img/climatize.png');
        doc.addImage(logoData, 'PNG', 14, 10, 35, 12);
    } catch (e) {
        console.log("Logo não encontrada, gerando PDF sem imagem.");
    }

    doc.setFontSize(16);
    doc.setTextColor(30, 77, 84);
    doc.text("Climatize - Relatório Financeiro", 55, 18);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 55, 24);

    doc.setDrawColor(200);
    doc.line(14, 30, 196, 30);

    let y = 38;
    doc.setFontSize(10);
    doc.setTextColor(0);

    transacoes.forEach((t) => {
        if (y > 275) {
            doc.addPage();
            y = 20;
        }

        const tipoFormatado = t.tipo.toUpperCase();
        doc.text(`${t.data} | [${tipoFormatado}] ${t.categoria} - R$ ${t.valor.toFixed(2)}`, 14, y);
        y += 6;
        if (t.descricao) {
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Descrição: ${t.descricao}`, 14, y);
            doc.setFontSize(10);
            doc.setTextColor(0);
            y += 7;
        } else {
            y += 4;
        }
    });

    doc.save("climatize_relatorio.pdf");
});

// ==========================================
// ALTERAÇÃO DE SENHA SEGURA
// ==========================================
document.getElementById('btn-alterar-senha').addEventListener('click', async () => {
    const senhaAntiga = prompt("Digite a sua senha atual:");
    if (!senhaAntiga) return;

    const novaSenha = prompt("Digite a nova senha:");
    if (!novaSenha) return;

    const confirmaSenha = prompt("Confirme a nova senha:");
    if (!confirmaSenha) return;

    if (novaSenha !== confirmaSenha) {
        alert("As senhas novas não coincidem. Tente novamente.");
        return;
    }

    try {
        const { data: { user } } = await supabase10.auth.getUser();
        if (!user || !user.email) throw new Error("Usuário não identificado.");

        const { error: authError } = await supabase10.auth.signInWithPassword({
            email: user.email,
            password: senhaAntiga
        });

        if (authError) throw new Error("A senha atual está incorreta.");

        const { error: updateError } = await supabase10.auth.updateUser({ password: novaSenha });
        if (updateError) throw updateError;

        alert("Senha alterada com sucesso!");
    } catch (error) {
        alert("Erro ao alterar senha: " + error.message);
    }
});