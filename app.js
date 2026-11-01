// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://ditkzuoqdgxkziwjkege.supabase.co";
const SUPABASE_KEY = "sb_publishable_XRwRbPVyeDggyeYcbA0fQQ_ImSkKoi6";
const supabase10 = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Categorias específicas fornecidas pelo usuário
const CATEGORIAS = {
    entrada: ["Instalação", "Higienização", "Manutenção corretiva", "Infraestrutura", "Desinstalação"],
    saida: ["Tubulação", "Suporte", "Kit instalação", "Fita PVC", "Aluminizada", "Fita isolante", "Silver tape", "Ferramenta", "Gasolina", "Ajudante"]
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
        alert("Lançamento adicionado com sucesso!");
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
            <td><b style="color: ${t.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">${t.tipo.toUpperCase()}</b></td>
            <td><strong>${t.categoria}</strong></td>
            <td>${t.descricao || '-'}</td>
            <td>R$ ${t.valor.toFixed(2)}</td>
            <td><button onclick="deletarTransacao('${t.id}')" style="background: var(--danger); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function deletarTransacao(id) {
    if (!confirm("Tem certeza de que deseja apagar este lançamento?")) return;

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
                backgroundColor: ['var(--success)', 'var(--danger)']
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

        // Quebra o texto por linhas para isolar itens e valores associados
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
            // Filtra linhas úteis que parecem itens de compra
            if (linha.length > 3 && !/total|cnpj|cpf|data|rua|fone|caixa|operador|dinheiro|troco/i.test(linha)) {
                itensEncontrados.push({ 
                    texto: linha, 
                    valor: achouValorNaLinha ? valoresExtraidos[valoresExtraidos.length - 1] || 0 : 0 
                });
            }
        });

        // Define o total geral estimado
        if (valoresExtraidos.length > 0) {
            ocrPrevTotal.value = Math.max(...valoresExtraidos).toFixed(2);
        } else {
            ocrPrevTotal.value = '0.00';
        }

        ocrPrevDesc.value = itensEncontrados[0]?.texto || "Nota Fiscal Escaneada";
        ocrPrevTipo.value = 'saida'; // Padrão para compras de materiais

        // Renderiza dinamicamente cada item na tela de confirmação
        ocrItensList.innerHTML = '';
        if (itensEncontrados.length === 0) {
            itensEncontrados.push({ texto: "Item geral da nota", valor: ocrPrevTotal.value });
        }

        itensEncontrados.forEach((item, index) => {
            const divItem = document.createElement('div');
            divItem.style.cssText = "display: flex; gap: 8px; align-items: center;";
            divItem.innerHTML = `
                <span style="font-size: 0.8rem; font-weight: bold; min-width: 45px;">Item ${index + 1}:</span>
                <input type="text" class="item-desc" value="${item.texto}" style="flex: 2; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;">
                <input type="number" step="0.01" class="item-val" value="${item.valor || ''}" placeholder="Valor R$" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;">
            `;
            ocrItensList.appendChild(divItem);
        });

        // Exibe o painel intermediário de revisão detalhada
        ocrPreviewContainer.style.display = 'block';

    } catch (err) {
        statusDiv.innerText = 'Erro ao processar imagem.';
        console.error(err);
        alert("Erro no OCR: " + err.message);
    }
});

// Botão Confirmar OCR: Salva os itens revisados diretamente no Supabase
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

        // Se nenhum item foi preenchido com valor, utiliza o valor total geral informado
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
        alert("Erro ao salvar lançamentos: " + error.message);
    }
});

// Botão Cancelar OCR: Descarta a leitura
btnCancelOcr.addEventListener('click', () => {
    ocrPreviewContainer.style.display = 'none';
    statusDiv.innerText = 'Leitura descartada. Tire outra foto quando desejar.';
    ocrFileInput.value = '';
});

// ==========================================
// EXPORTAÇÃO (CSV & PDF COM LOGO NA RAIZ)
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
        const logoData = await getBase64ImageFromUrl('climatize.png');
        doc.addImage(logoData, 'PNG', 14, 10, 35, 12);
    } catch (e) {
        console.log("Logo não encontrada na raiz, gerando PDF sem imagem.");
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