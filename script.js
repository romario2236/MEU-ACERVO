// ============================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÕES DO FIREBASE
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    onSnapshot,
    // ... (suas outras importações)
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyAH-7clKFuTdisyN4fNxGd1JTicX3ZWJnw",
  authDomain: "meu-acervo-b8eaf.firebaseapp.com",
  projectId: "meu-acervo-b8eaf",
  storageBucket: "meu-acervo-b8eaf.firebasestorage.app",
  messagingSenderId: "397695115084",
  appId: "1:397695115084:web:13b5ffc8ca61e1fe7879e9",
  measurementId: "G-CE6CSXTGMN"
};

// NOVO CÓDIGO ATUALIZADO:
const app = initializeApp(firebaseConfig);

// Inicializa o banco já com o cache offline ativado no padrão novo
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
const auth = getAuth(app);

// ============================================================================
// 2. VARIÁVEIS DE ESTADO E REFERÊNCIAS DO DOM
// ============================================================================
let acervo = [];
let idAbertoNoModal = "";
let resultadosAPI = [];
let fonteAtualAPI = "jikan";

const conteinerMangas = document.getElementById("lista-mangas");
const barraPesquisa = document.getElementById("barra-pesquisa");
const modalFundo = document.getElementById("modal-fundo");
const modalFormFundo = document.getElementById("modal-form-fundo");
const formulario = document.getElementById("form-nova-obra");

// ============================================================================
// 3. COMUNICAÇÃO COM O BANCO DE DADOS (CRUD)
// ============================================================================
let pausarRedraw = false; // A nossa nova trava de segurança

function carregarAcervo() {
    onSnapshot(collection(db, "mangas"), (snapshot) => {
        acervo = [];
        snapshot.forEach(doc => {
            let obra = doc.data();
            obra.idFirebase = doc.id;
            acervo.push(obra);
        });
        
        // Se foi um clique rápido de capítulo, atualiza o sistema mas NÃO apaga a tela
        if (pausarRedraw) {
            pausarRedraw = false;
            return; 
        }

        aplicarFiltros(); 
        if (idAbertoNoModal && modalFundo.style.display === "flex") window.abrirModal(idAbertoNoModal);
    });
}
// ============================================================================
// CONTROLE DE AUTENTICAÇÃO (O "Porteiro")
// ============================================================================
const telaLogin = document.getElementById("tela-login");
const formLogin = document.getElementById("form-login");
const loginErro = document.getElementById("login-erro");

// Fica escutando para ver se você tem a chave ou não
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logado: A tela preta some e o banco de dados é acionado!
        if(telaLogin) telaLogin.style.display = "none";
        carregarAcervo(); 
    } else {
        // Deslogado: A tela preta aparece e os dados são apagados da memória
        if(telaLogin) telaLogin.style.display = "flex";
        acervo = []; 
        aplicarFiltros();
    }
});

// Ação de clicar em "Entrar"
if(formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const senha = document.getElementById("login-senha").value;
        const btn = document.getElementById("btn-entrar");
        
        btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Entrando...';
        loginErro.style.display = "none";

        try {
            await signInWithEmailAndPassword(auth, email, senha);
            // Se der certo, o onAuthStateChanged ali em cima detecta e libera a tela automaticamente!
        } catch (error) {
            loginErro.innerText = "E-mail ou senha incorretos.";
            loginErro.style.display = "block";
            console.error(error);
        } finally {
            btn.innerHTML = '<i class="ph ph-sign-in"></i> Entrar';
        }
    });
}

// Função para o botão de Deslogar
window.fazerLogout = () => {
    signOut(auth);
};

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("input-id-firebase").value;
    const btn = formulario.querySelector('.btn-salvar');
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Salvando...';
    
    const linksArray = [];
    document.querySelectorAll('.link-row').forEach(row => {
        const nome = row.querySelector('.link-name-input').value.trim();
        const url = row.querySelector('.link-url-input').value.trim();
        if (url) linksArray.push(nome ? `${nome} | ${url}` : url);
    });

    // LÓGICA NOVA: Lendo o array de listas do input escondido
    let listasArray = ["Geral"];
    try {
        listasArray = JSON.parse(document.getElementById("input-lista").value);
    } catch(err) {
        listasArray = [document.getElementById("input-lista").value || "Geral"];
    }

    const obra = {
        titulo: document.getElementById("input-titulo").value || "",
        titulosAlternativos: document.getElementById("input-titulos-alt").value || "",
        generos: document.getElementById("input-generos").value || "",
        
        // Salvamos como Array (novo padrão) e a primeira lista como String (para não quebrar códigos antigos)
        listasPersonalizadas: listasArray, 
        listaPersonalizada: listasArray[0] || "Geral", 
        
        tipo: document.getElementById("input-tipo").value || "Mangá",
        capitulo: document.getElementById("input-capitulo").value || "0",
        status: document.getElementById("input-status").value || "Em Andamento",
        nota: parseFloat(document.getElementById("input-nota").value) || 5,
        capa: document.getElementById("input-capa").value || "",
        sinopse: document.getElementById("input-sinopse").value || "",
        linksLeitura: linksArray
    };
    
    try {
        if (id) {
            // Editando uma obra existente
            await updateDoc(doc(db, "mangas", id), obra);
            window.mostrarToast("Obra atualizada com sucesso!", "success");
            fecharModalForm();
            // Dá um milissegundo pro modal do formulário fechar e abre o de detalhes com as novidades
            setTimeout(() => { window.abrirModal(id); }, 100); 
        } else {
            // Criando uma obra nova
            const docRef = await addDoc(collection(db, "mangas"), obra);
            window.mostrarToast("Obra adicionada com sucesso!", "success");
            fecharModalForm();
            // Ao criar uma obra nova, abre ela imediatamente para você ver como ficou
            setTimeout(() => { window.abrirModal(docRef.id); }, 100);
        }
    } catch(err) {
        window.mostrarToast("Erro ao salvar no banco!", "error");
        console.error(err);
    } finally {
        btn.innerHTML = '<i class="ph ph-cloud-arrow-up"></i> Salvar na Nuvem';
    }
});

// ============================================================================
// 4. INTERFACE, BUSCA AVANÇADA E FILTROS
// ============================================================================
let filtroTexto = "";
let filtroTipo = "Todos";
let filtroListaAtiva = "Todas";

let itensPorPagina = 24; 
let itensCarregados = 0;
let listaAtualFiltrada = [];
let carregandoScroll = false;

// Função auxiliar para coletar todas as listas do banco (Arrays e Strings)
function obterTodasAsListas() {
    let todas = [];
    acervo.forEach(o => {
        if (Array.isArray(o.listasPersonalizadas)) todas.push(...o.listasPersonalizadas);
        else if (typeof o.listaPersonalizada === 'string') todas.push(o.listaPersonalizada);
    });
    return [...new Set(todas.map(l => l.trim()).filter(l => l !== "" && l !== "Geral" && l !== "_LIST_MARKER_"))].sort();
}

function atualizarBotoesListas() {
    const container = document.getElementById("container-listas-personalizadas");
    if (!container) return;

    const listasUnicas = obterTodasAsListas();

    container.innerHTML = "";
    listasUnicas.forEach(nomeLista => {
        const btn = document.createElement("button");
        btn.className = "sidebar-tag";
        if (filtroListaAtiva === nomeLista) btn.classList.add('active');
        
        // Desenhamos o nome da tag e o botão de excluir
        btn.innerHTML = `
            ${nomeLista}
            <span class="btn-excluir-lista" onclick="excluirLista('${nomeLista}', event)" title="Excluir Lista">
                <i class="ph ph-x"></i>
            </span>
        `;
        
        // O clique na tag em si (fora do X) faz o filtro
        btn.onclick = (e) => window.filtrarPorLista(nomeLista, e.currentTarget);
        container.appendChild(btn);
    });
}

// O NOVO MOTOR DE EXCLUSÃO DE LISTAS
window.excluirLista = async function(nomeLista, event) {
    // Impede que o clique ative o filtro da lista sem querer
    event.stopPropagation(); 
    
    if (!confirm(`Tem certeza que deseja excluir a lista "${nomeLista}"?\nAs obras não serão apagadas, apenas removidas desta lista.`)) return;

    try {
        // Varredura: Acha todos os mangás que têm essa lista salva
        const obrasAfetadas = acervo.filter(o => {
            const listas = Array.isArray(o.listasPersonalizadas) ? o.listasPersonalizadas : [o.listaPersonalizada || "Geral"];
            return listas.includes(nomeLista);
        });

        // Loop de atualização no banco de dados
        for (const obra of obrasAfetadas) {
            const docRef = doc(db, "mangas", obra.idFirebase);
            
            if (obra.titulo === "_LIST_MARKER_") {
                await deleteDoc(docRef); // É uma lista vazia, apaga direto
            } else {
                // É um mangá real, tira a lista da matriz (array) dele
                let novasListas = (Array.isArray(obra.listasPersonalizadas) ? obra.listasPersonalizadas : [obra.listaPersonalizada]).filter(l => l !== nomeLista);
                if (novasListas.length === 0) novasListas = ["Geral"]; // Proteção: se ficar sem lista, vai pro Geral
                
                await updateDoc(docRef, { 
                    listasPersonalizadas: novasListas,
                    listaPersonalizada: novasListas[0]
                });
            }
        }
        
        // Volta pro filtro "Geral" se você apagou a lista que estava aberta
        if (filtroListaAtiva === nomeLista) window.filtrarPorLista("Geral");
        
    } catch (err) {
        console.error("Erro ao deletar lista:", err);
        alert("Erro ao excluir a lista.");
    }
};

window.filtrarPorLista = (nome, botaoClicado) => {
    // Limpa o 'active' tanto das categorias principais quanto das tags
    document.querySelectorAll('.sidebar-btn, .sidebar-tag').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    
    filtroListaAtiva = nome;
    filtroTipo = "Todos"; 
    window.aplicarFiltros();
};

window.filtrarPorTipo = (t, botaoClicado) => {
    // Limpa o 'active' tanto das categorias principais quanto das tags
    document.querySelectorAll('.sidebar-btn, .sidebar-tag').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    
    filtroTipo = t;
    filtroListaAtiva = "Todas"; 
    window.aplicarFiltros();
};

window.aplicarFiltros = () => {
    let listaFiltrada = acervo.filter(o => o.titulo !== "_LIST_MARKER_");

    atualizarBotoesListas();

    if (filtroTexto) {
        listaFiltrada = listaFiltrada.filter(o => 
            (o.titulo || "").toLowerCase().includes(filtroTexto) || 
            (o.titulosAlternativos || "").toLowerCase().includes(filtroTexto)
        );
    }

    if (filtroTipo !== "Todos") {
        listaFiltrada = listaFiltrada.filter(o => o.tipo === filtroTipo);
    }

    // LÓGICA NOVA: Verifica se a lista clicada está dentro do Array de listas do mangá
    if (filtroListaAtiva !== "Todas") {
        listaFiltrada = listaFiltrada.filter(o => {
            const listasDoManga = Array.isArray(o.listasPersonalizadas) ? o.listasPersonalizadas : [o.listaPersonalizada || "Geral"];
            return listasDoManga.includes(filtroListaAtiva);
        });
    }

    const statusSelect = document.getElementById("select-status");
    if (statusSelect && statusSelect.value !== "Todos") {
        listaFiltrada = listaFiltrada.filter(o => o.status === statusSelect.value);
    }

    const ordemSelect = document.getElementById("select-ordem");
    if (ordemSelect) {
        const ordem = ordemSelect.value;
        listaFiltrada.sort((a, b) => {
            if (ordem === "az") return (a.titulo || "").localeCompare(b.titulo || "");
            if (ordem === "za") return (b.titulo || "").localeCompare(a.titulo || "");
            if (ordem === "nota-alta") return (b.nota || 0) - (a.nota || 0);
            if (ordem === "nota-baixa") return (a.nota || 0) - (b.nota || 0);
            if (ordem === "cap-alto") return (parseInt(b.capitulo) || 0) - (parseInt(a.capitulo) || 0);
            return 0;
        });
    }

    listaAtualFiltrada = listaFiltrada;
    itensCarregados = 0;
    const conteinerMangas = document.getElementById("lista-mangas");
    if(conteinerMangas) conteinerMangas.innerHTML = ""; 
    
    const contador = document.getElementById("contador-total");
    if(contador) contador.innerHTML = `<i class="ph ph-books"></i> ${listaAtualFiltrada.length} obras`;
    
    carregarMaisItens();
};

function carregarMaisItens() {
    const proximosItens = listaAtualFiltrada.slice(itensCarregados, itensCarregados + itensPorPagina);
    if (proximosItens.length === 0) return; 

    proximosItens.forEach(obra => {
        let classeTipo = (obra.tipo === 'Manhwa') ? 'tipo-manhwa' : (obra.tipo === 'Mangá' ? 'tipo-manga' : 'tipo-novel');
        
        conteinerMangas.innerHTML += `
            <div class="cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
                <img src="${obra.capa}" onerror="this.src='https://via.placeholder.com/200x300/1a1a1a/60a5fa?text=Sem+Capa'" loading="lazy" alt="${obra.titulo}" class="capa-bg">
                <div class="card-flutuante">
                    <h4 class="titulo-flutuante">${obra.titulo}</h4>
                    <div class="info-flutuante">
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span id="cap-rapido-${obra.idFirebase}" style="display: flex; align-items: center; gap: 6px;">
                                <i class="ph-fill ph-bookmark-simple" style="color: #3b82f6;"></i> Cap: ${obra.capitulo}
                            </span>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn-mini-cap" onclick="alterarCapituloRapido('${obra.idFirebase}', -1, event)"><i class="ph ph-minus"></i></button>
                                <button class="btn-mini-cap" onclick="alterarCapituloRapido('${obra.idFirebase}', 1, event)"><i class="ph ph-plus"></i></button>
                            </div>
                        </div>

                        <span><i class="ph-fill ph-star" style="color: #f59e0b;"></i> Nota: ${(obra.nota || 5).toFixed(1)}</span>
                        <span><i class="ph-fill ph-tag" style="color: #10b981;"></i> ${obra.status}</span>
                        <span class="${classeTipo}" style="margin-top: 5px; display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; text-align: center;">${obra.tipo}</span>
                    </div>
                </div>
            </div>
        `;
    });
    itensCarregados += proximosItens.length;
}

window.addEventListener('scroll', () => {
    if (carregandoScroll) return; 
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200) {
        carregandoScroll = true;
        carregarMaisItens();
        setTimeout(() => { carregandoScroll = false; }, 100);
    }
});

barraPesquisa.addEventListener("input", (e) => {
    filtroTexto = e.target.value.toLowerCase();
    aplicarFiltros();
});

// ============================================================================
// 5. MODAIS, EDIÇÃO E LINKS DINÂMICOS
// ============================================================================
window.adicionarCampoLink = function(nome = "", url = "") {
    const container = document.getElementById("container-links-inputs");
    if(!container) return; 
    const div = document.createElement("div");
    div.className = "link-row";
    div.innerHTML = `
        <input type="text" class="link-name-input" placeholder="Site (Ex: Scan)" value="${nome}">
        <input type="url" class="link-url-input" placeholder="https://..." value="${url}">
        <button type="button" class="btn-remover-link" onclick="this.parentElement.remove()" title="Remover link"><i class="ph ph-x"></i></button>
    `;
    container.appendChild(div);
}

window.abrirModal = function(id) {
    const obra = acervo.find(i => i.idFirebase === id);
    if (obra) {
        idAbertoNoModal = id;
        document.getElementById("modal-capa").src = obra.capa || "";
        document.getElementById("modal-titulo").innerText = obra.titulo || "Sem Título";
        
        // 1. Tag de Status (Mostra apenas o status atual com cor dinâmica)
        const statusContainer = document.getElementById("modal-status-tags");
        if (statusContainer) {
            let corStatus = "#3b82f6"; // Azul para Em Andamento
            if (obra.status === "Finalizado") corStatus = "#10b981"; // Verde
            if (obra.status === "Hiato") corStatus = "#f59e0b"; // Laranja
            
            statusContainer.innerHTML = `<span style="background: ${corStatus}20; color: ${corStatus}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${corStatus}40; display: inline-block;">${obra.status || 'N/A'}</span>`;
        }

        // 2. Tags das Listas Personalizadas (Design limpo)
        const listasContainer = document.getElementById("modal-listas-tags");
        if (listasContainer) {
            const listasArray = Array.isArray(obra.listasPersonalizadas) ? obra.listasPersonalizadas : (obra.listaPersonalizada ? [obra.listaPersonalizada] : ["Geral"]);
            listasContainer.innerHTML = listasArray.map(l => 
                `<span style="background: #3b82f6; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; border: none; display: inline-block; margin: 2px;">${l}</span>`
            ).join('');
        }

        // 3. Preenche os campos de texto
        document.getElementById("modal-capitulo-editavel").value = obra.capitulo || "0";
        // Pega a string de gêneros e transforma em tags visuais
        const generosContainer = document.getElementById("modal-generos-texto");
        if (generosContainer) {
            generosContainer.innerHTML = "";
            if (obra.generos) {
                const listaGeneros = obra.generos.split(',').map(g => g.trim()).filter(g => g);
                listaGeneros.forEach(gen => {
                    generosContainer.innerHTML += `<span class="tag-genero">${gen}</span>`;
                });
            } else {
                generosContainer.innerHTML = `<span style="color: #666; font-size: 0.85rem;">Nenhum gênero cadastrado</span>`;
            }
        }
        // Transforma os Nomes Alternativos em tags discretas
        const altContainer = document.getElementById("modal-titulos-alt");
        if (altContainer) {
            altContainer.innerHTML = "";
            if (obra.titulosAlternativos) {
                // Divide a string nas vírgulas, limpa os espaços e ignora vazios
                const listaAlt = obra.titulosAlternativos.split(',').map(t => t.trim()).filter(t => t);
                listaAlt.forEach(alt => {
                    altContainer.innerHTML += `<span class="tag-alt">${alt}</span>`;
                });
            } else {
                altContainer.innerHTML = `<span style="color: #555; font-size: 0.8rem; font-style: italic;">Nenhum nome alternativo</span>`;
            }
        }
        document.getElementById("modal-texto-sinopse").innerText = obra.sinopse || "Nenhuma sinopse disponível.";

        // 4. Constrói os links de leitura
        const containerLinks = document.getElementById("container-links-leitura");
        containerLinks.innerHTML = "";
        if (obra.linksLeitura && Array.isArray(obra.linksLeitura)) {
            obra.linksLeitura.forEach(linha => {
                if (typeof linha === 'string') {
                    let url = linha.trim(), nomeBotao = "Ler";
                    if (linha.includes('|')) {
                        const partes = linha.split('|');
                        nomeBotao = partes[0].trim(); url = partes[1].trim();
                    } else {
                        try { nomeBotao = new URL(url).hostname.replace('www.', ''); } catch(e) {}
                    }
                    if(url && !url.startsWith('http')) url = 'https://' + url;
                    containerLinks.innerHTML += `<a class="btn-ler-obra" href="${url}" target="_blank"><i class="ph ph-book-open"></i> ${nomeBotao}</a>`;
                }
            });
        }
        modalFundo.style.display = "flex";
    }
}

window.alterarCapitulo = async function(val) {
    let input = document.getElementById("modal-capitulo-editavel");
    let novo = (parseInt(input.value) || 0) + val;
    if(novo < 0) novo = 0;
    await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: novo.toString() });
}

window.atualizarCapituloDigitado = async function() {
    let input = document.getElementById("modal-capitulo-editavel");
    let novo = parseInt(input.value) || 0;
    if(novo < 0) novo = 0;
    await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: novo.toString() });
}

window.prepararAdicao = function() {
    formulario.reset();
    document.getElementById("input-id-firebase").value = "";
    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("container-links-inputs").innerHTML = "";
    window.adicionarCampoLink();
    modalFormFundo.style.display = "flex";
}

window.prepararEdicao = function() {
    const o = acervo.find(i => i.idFirebase === idAbertoNoModal);
    if (o) {
        // LÓGICA NOVA: Puxa o array de listas
        const listasDoManga = o.listasPersonalizadas || (o.listaPersonalizada ? [o.listaPersonalizada] : ["Geral"]);
        renderizarTagsSelecao(listasDoManga);
        
        document.getElementById("input-titulo").value = o.titulo || "";
        document.getElementById("input-titulos-alt").value = o.titulosAlternativos || "";
        document.getElementById("input-generos").value = o.generos || "";
        document.getElementById("input-tipo").value = o.tipo || "Mangá";
        document.getElementById("input-capitulo").value = o.capitulo || 0;
        document.getElementById("input-status").value = o.status || "Em Andamento";
        document.getElementById("input-nota").value = o.nota || 5;
        document.getElementById("input-capa").value = o.capa || "";
        document.getElementById("input-sinopse").value = o.sinopse || "";
        document.getElementById("input-id-firebase").value = o.idFirebase;
        
        const containerLinks = document.getElementById("container-links-inputs");
        containerLinks.innerHTML = "";
        if (o.linksLeitura && Array.isArray(o.linksLeitura) && o.linksLeitura.length > 0) {
            o.linksLeitura.forEach(linha => {
                if (typeof linha === 'string') {
                    let nome = "", url = linha;
                    if (linha.includes('|')) {
                        const partes = linha.split('|');
                        nome = partes[0].trim(); url = partes[1].trim();
                    }
                    window.adicionarCampoLink(nome, url);
                }
            });
        } else { 
            window.adicionarCampoLink(); 
        }
        
        fecharModal(); 
        document.getElementById('titulo-form').innerText = "Editar Obra"; 
        modalFormFundo.style.display = "flex"; 
    }
}

window.excluirObra = async function() {
    if(confirm("Excluir definitivamente?")) {
        await deleteDoc(doc(db, "mangas", idAbertoNoModal));
        fecharModal();
    }
}

window.fecharModal = () => { modalFundo.style.display = "none"; idAbertoNoModal = ""; };
window.fecharModalForm = () => { 
    // 1. Esconde a janela do formulário
    modalFormFundo.style.display = "none"; 
    
    // 2. Limpa o texto que foi digitado na barra de busca da API
    const inputBuscaApi = document.getElementById("input-busca-api");
    if (inputBuscaApi) inputBuscaApi.value = "";
    
    // 3. Apaga a lista de resultados e esconde a caixa preta
    const divResultadosApi = document.getElementById("resultado-busca-api");
    if (divResultadosApi) {
        divResultadosApi.style.display = "none";
        divResultadosApi.innerHTML = "";
    }
    
    // 4. Zera a memória do sistema para não misturar dados
    resultadosAPI = [];
};
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) window.fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) window.fecharModalForm(); };

// ============================================================================
// 6. INTEGRAÇÃO COM MÚLTIPLAS APIs (BUSCA SIMULTÂNEA E MODULAR)
// ============================================================================
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value.trim();
    if(!q) return;

    const div = document.getElementById("resultado-busca-api");
    const btn = document.getElementById("btn-buscar-api");
    
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i>';
    btn.disabled = true;
    div.innerHTML = "<p style='padding:15px; color:#aaa; text-align:center;'>Consultando 4 bases de dados...</p>";
    div.style.display = "block";
    
    try {
        resultadosAPI = []; 

        // ---------------------------------------------------------
        // ⚙️ 1. KITSU API
        // ---------------------------------------------------------
        const kitsuPromise = fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(q)}&page[limit]=5`)
            .then(res => res.ok ? res.json() : Promise.reject("Kitsu falhou"))
            .then(d => {
                return (d.data || []).map(m => {
                    const t = m.attributes?.canonicalTitle || "Sem Título";
                    let altArr = [];
                    if(m.attributes?.titles) {
                        Object.values(m.attributes.titles).forEach(val => { if(val && val !== t) altArr.push(val); });
                    }
                    let st = "Em Andamento";
                    if (m.attributes?.status === "finished") st = "Finalizado";
                    else if (m.attributes?.status !== "current") st = "Hiato";

                    let tipo = "Mangá";
                    let mangaType = (m.attributes?.mangaType || "").toLowerCase();
                    if (mangaType === "manhwa") tipo = "Manhwa";
                    else if (mangaType === "novel") tipo = "Novel";

                    return {
                        fonteNome: "Kitsu", ano: m.attributes?.startDate ? m.attributes.startDate.substring(0,4) : "N/A",
                        t: t, alts: altArr.join(", "), capa: m.attributes?.posterImage?.original || "",
                        sin: m.attributes?.synopsis || "", gen: "", cap: m.attributes?.chapterCount || 0,
                        nota: m.attributes?.averageRating ? (m.attributes.averageRating / 20).toFixed(1) : 5,
                        st: st, tipo: tipo
                    };
                });
            });

        // ---------------------------------------------------------
        // ⚙️ 2. MANGADEX API
        // ---------------------------------------------------------
        const urlMD = `https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlMD)}`;
        const mangadexPromise = fetch(proxyUrl)
            .then(res => res.ok ? res.json() : Promise.reject("MangaDex falhou"))
            .then(d => {
                return (d.data || []).map(m => {
                    const titles = m.attributes?.title || {};
                    const t = titles.en || titles['pt-br'] || Object.values(titles)[0] || "Sem Título";
                    let altArr = [];
                    (m.attributes?.altTitles || []).forEach(at => {
                        let val = Object.values(at)[0]; if(val) altArr.push(val);
                    });
                    const art = (m.relationships || []).find(rel => rel.type === 'cover_art');
                    const capa = art ? `https://uploads.mangadex.org/covers/${m.id}/${art.attributes?.fileName}` : "";
                    const descriptions = m.attributes?.description || {};
                    let st = "Em Andamento";
                    if(m.attributes?.status === "completed") st = "Finalizado";
                    else if (m.attributes?.status === "hiatus" || m.attributes?.status === "cancelled") st = "Hiato";

                    return {
                        fonteNome: "MangaDex", ano: m.attributes?.year || "N/A",
                        t: t, alts: altArr.join(", "), capa: capa,
                        sin: descriptions.en || descriptions['pt-br'] || Object.values(descriptions)[0] || "",
                        gen: (m.attributes?.tags || []).filter(tg => tg.attributes?.group === 'genre').map(tg => tg.attributes?.name?.en).filter(Boolean).join(", "),
                        cap: m.attributes?.lastChapter || 0, nota: 5, st: st, tipo: "Mangá"
                    };
                });
            });

        // ---------------------------------------------------------
        // ⚙️ 3. JIKAN API (MYANIMELIST)
        // ---------------------------------------------------------
        const jikanPromise = fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=5`)
            .then(res => res.ok ? res.json() : Promise.reject("Jikan falhou"))
            .then(d => {
                return (d.data || []).map(m => {
                    const t = m.title || "Sem Título";
                    let altArr = [];
                    if(m.title_english && m.title_english !== t) altArr.push(m.title_english);
                    if(m.title_japanese && m.title_japanese !== t) altArr.push(m.title_japanese);
                    if(m.title_synonyms) altArr = altArr.concat(m.title_synonyms);
                    let st = "Em Andamento";
                    if(m.status === "Finished") st = "Finalizado";
                    else if (m.status === "On Hiatus" || m.status === "Discontinued") st = "Hiato";

                    return {
                        fonteNome: "MyAnimeList", ano: m.published?.prop?.from?.year || "N/A",
                        t: t, alts: altArr.join(", "), capa: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || "",
                        sin: (m.synopsis || "").replace("[Written by MAL Rewrite]", "").trim(),
                        gen: (m.genres || []).map(g => g.name).join(", "), cap: m.chapters || 0,
                        nota: m.score ? (m.score / 2).toFixed(1) : 5, st: st, tipo: "Mangá"
                    };
                });
            });

        // ---------------------------------------------------------
        // ⚙️ 4. ANILIST API (Nova Gigante)
        // ---------------------------------------------------------
        const queryAniList = `
        query ($search: String) {
          Page(page: 1, perPage: 5) {
            media(search: $search, type: MANGA) {
              title { romaji english native }
              synonyms
              startDate { year }
              coverImage { extraLarge }
              description(asHtml: false)
              genres
              chapters
              averageScore
              status
              countryOfOrigin
              format
            }
          }
        }`;

        const anilistPromise = fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: queryAniList, variables: { search: q } })
        })
        .then(res => res.ok ? res.json() : Promise.reject("AniList falhou"))
        .then(d => {
            return (d.data?.Page?.media || []).map(m => {
                const t = m.title?.romaji || m.title?.english || m.title?.native || "Sem Título";
                let altArr = [];
                if (m.title?.english && m.title.english !== t) altArr.push(m.title.english);
                if (m.title?.native && m.title.native !== t) altArr.push(m.title.native);
                if (m.synonyms) altArr = altArr.concat(m.synonyms);
                
                let st = "Em Andamento";
                if(m.status === "FINISHED") st = "Finalizado";
                else if(m.status === "HIATUS" || m.status === "CANCELLED") st = "Hiato";

                // AniList sabe exatamente de onde veio a obra (Coreia, China, Japão)
                let tipo = "Mangá";
                if (m.format === "NOVEL") tipo = "Novel";
                else if (m.countryOfOrigin === "KR") tipo = "Manhwa";
                else if (m.countryOfOrigin === "CN") tipo = "Manhua";

                // Limpa marcações HTML que a AniList às vezes joga na sinopse
                let sinopseLimpa = (m.description || "").replace(/<[^>]*>?/gm, '').trim();

                return {
                    fonteNome: "AniList", ano: m.startDate?.year || "N/A",
                    t: t, alts: altArr.join(", "), capa: m.coverImage?.extraLarge || "",
                    sin: sinopseLimpa, gen: (m.genres || []).join(", "), cap: m.chapters || 0,
                    nota: m.averageScore ? (m.averageScore / 20).toFixed(1) : 5, st: st, tipo: tipo
                };
            });
        });

        // =========================================================
        // DISPARA AS 4 APIS AO MESMO TEMPO
        // =========================================================
        const respostas = await Promise.allSettled([kitsuPromise, mangadexPromise, jikanPromise, anilistPromise]);
        
        respostas.forEach(resposta => {
            if (resposta.status === "fulfilled") resultadosAPI = resultadosAPI.concat(resposta.value);
        });

        // DESENHANDO A INTERFACE MODULAR
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #2a2a2a; border-radius: 8px 8px 0 0;">
                <span style="color: #ddd; font-size: 0.85rem; font-weight: bold;">Resultados (${resultadosAPI.length})</span>
                <button type="button" onclick="document.getElementById('resultado-busca-api').style.display='none'" style="background: transparent; color: #ef4444; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: bold;"><i class="ph ph-x"></i> Fechar</button>
            </div>
        `;

        if(resultadosAPI.length === 0) {
            div.innerHTML += "<p style='padding:15px;color:#94a3b8;'>Nenhum resultado encontrado.</p>";
        } else {
            resultadosAPI.forEach((obra, i) => {
                let corFonte = "#3b82f6"; // MyAnimeList (Azul)
                if (obra.fonteNome === "MangaDex") corFonte = "#f97316"; // Laranja
                if (obra.fonteNome === "Kitsu") corFonte = "#ec4899"; // Rosa
                if (obra.fonteNome === "AniList") corFonte = "#0284c7"; // Azul Escuro vibrante

                div.innerHTML += `
                    <div class="item-api" style="position: relative; display: flex; flex-direction: column; padding: 12px; border-bottom: 1px solid #333; gap: 10px;">
                        
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <img src="${obra.capa}" onerror="this.src='https://via.placeholder.com/50x75/1a1a1a/60a5fa?text=Sem+Capa'" style="width: 55px; height: 80px; object-fit: cover; border-radius: 4px;">
                            <div style="width: 100%;">
                                <h4 style="margin-bottom: 4px; padding-right: 70px; font-size: 1rem; color: #fff;">${obra.t}</h4>
                                <p style="font-size: 0.75rem; color: #888;">Ano: ${obra.ano}</p>
                                <span style="position: absolute; top: 12px; right: 12px; background: ${corFonte}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">
                                    ${obra.fonteNome}
                                </span>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; margin-top: 5px;">
                            <button type="button" onclick="preencherComAPI(${i}, 'tudo')" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; font-weight: bold;"><i class="ph ph-check-square"></i> Tudo</button>
                            <button type="button" onclick="preencherComAPI(${i}, 'info')" style="flex: 1; background: #475569; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; font-weight: bold;"><i class="ph ph-text-aa"></i> Textos</button>
                            <button type="button" onclick="preencherComAPI(${i}, 'capa')" style="flex: 1; background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; font-weight: bold;"><i class="ph ph-image"></i> Capa</button>
                        </div>
                    </div>`;
            });
        }
        
    } catch(err) {
        console.error("Erro fatal no motor de busca:", err);
        div.innerHTML = `<p style='padding:15px; color:#ef4444;'>Erro na conexão com as APIs.</p>`;
    } finally {
        btn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Buscar';
        btn.disabled = false;
    }
}

// O NOVO PREENCHEDOR MODULAR
window.preencherComAPI = function(i, modo = 'tudo') {
    const m = resultadosAPI[i];
    if(!m) return;
    
    // Se escolheu 'tudo' ou 'info', ele puxa os textos
    if (modo === 'tudo' || modo === 'info') {
        document.getElementById("input-titulo").value = m.t || "";
        document.getElementById("input-titulos-alt").value = m.alts || "";
        document.getElementById("input-sinopse").value = m.sin || "";
        if(m.gen) document.getElementById("input-generos").value = m.gen;
        document.getElementById("input-capitulo").value = m.cap || 0;
        document.getElementById("input-nota").value = m.nota || 5;
        document.getElementById("input-status").value = m.st || "Em Andamento";
        document.getElementById("input-tipo").value = m.tipo || "Mangá";
    }
    
    // Se escolheu 'tudo' ou 'capa', ele puxa a URL da imagem
    if (modo === 'tudo' || modo === 'capa') {
        document.getElementById("input-capa").value = m.capa || "";
    }
    
    // Dispara a nossa notificação elegante verde (Toast) avisando o que ele fez
    if (modo === 'capa') {
        window.mostrarToast('Capa inserida com sucesso!', 'success');
    } else if (modo === 'info') {
        window.mostrarToast('Textos inseridos com sucesso!', 'success');
    } else {
        window.mostrarToast('Obra preenchida completamente!', 'success');
        // Se o usuário clicar em "Tudo", a gente entende que ele já terminou, então fecha a janela automaticamente
        document.getElementById("resultado-busca-api").style.display = "none";
        document.getElementById("input-busca-api").value = "";
    }
}

// ============================================================================
// 7. BACKUP JSON, PDF E EXTRAS
// ============================================================================
window.exportarDados = () => {
    const blob = new Blob([JSON.stringify(acervo.map(({idFirebase, ...r}) => r), null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = "backup.json"; a.click();
};

window.importarDados = (e) => {
    const reader = new FileReader();
    reader.onload = async (f) => {
        const lista = JSON.parse(f.target.result);
        for (const o of lista) {
            if(!acervo.some(i => i.titulo === o.titulo)) await addDoc(collection(db, "mangas"), o);
        }
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};

window.abrirModalForm = () => {
    renderizarTagsSelecao(["Geral"]);
    const modalForm = document.getElementById('modal-form-fundo');
    const form = document.getElementById('form-nova-obra');
    if (form) form.reset(); 
    document.getElementById('input-id-firebase').value = ""; 
    document.getElementById('titulo-form').innerText = "Nova Obra"; 
    if (modalForm) modalForm.style.display = 'flex'; 
};

window.limparBusca = () => {
    const inputBusca = document.getElementById('barra-pesquisa');
    if (inputBusca) {
        inputBusca.value = ''; 
        document.getElementById('btn-limpar-busca').style.display = 'none'; 
        inputBusca.dispatchEvent(new Event('input')); 
    }
};

const inputBuscaEvent = document.getElementById('barra-pesquisa');
if (inputBuscaEvent) {
    inputBuscaEvent.addEventListener('input', (e) => {
        const btnLimpar = document.getElementById('btn-limpar-busca');
        if (e.target.value.length > 0) btnLimpar.style.display = 'flex';
        else btnLimpar.style.display = 'none';
    });
}

window.voltarAoTopo = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };

window.addEventListener('scroll', () => {
    const btnTopo = document.getElementById('btn-topo');
    if (btnTopo) {
        if (window.scrollY > 300) btnTopo.style.display = 'flex';
        else btnTopo.style.display = 'none';
    }
});

window.gerarPDF = () => {
    if (!acervo || acervo.length === 0) {
        alert("Seu acervo está vazio! Adicione algumas obras antes de gerar o PDF.");
        return;
    }
    alert("Preparando o seu PDF... Isso pode levar alguns segundos.");
    const elemento = document.createElement('div');
    elemento.style.padding = '20px';
    elemento.style.fontFamily = 'Arial, sans-serif';
    elemento.style.color = '#000'; 
    elemento.style.background = '#fff'; 
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    let html = `
        <h1 style="text-align: center; color: #111; margin-bottom: 5px;">Meu Acervo de Obras</h1>
        <p style="text-align: center; color: #555; margin-bottom: 30px;">Gerado em: ${dataHoje} | Total de Obras: ${acervo.length}</p>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
                <tr style="background-color: #f2f2f2;">
                    <th style="padding: 12px; border: 1px solid #ddd; width: 40%;">Título</th>
                    <th style="padding: 12px; border: 1px solid #ddd; width: 15%;">Tipo</th>
                    <th style="padding: 12px; border: 1px solid #ddd; width: 15%;">Status</th>
                    <th style="padding: 12px; border: 1px solid #ddd; width: 15%;">Capítulo</th>
                    <th style="padding: 12px; border: 1px solid #ddd; width: 15%;">Nota</th>
                </tr>
            </thead>
            <tbody>
    `;
    const acervoOrdenado = [...acervo].sort((a, b) => a.titulo.localeCompare(b.titulo));
    acervoOrdenado.forEach(obra => {
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>${obra.titulo}</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${obra.tipo || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${obra.status || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${obra.capitulo || '0'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">⭐ ${obra.nota || '5'}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    elemento.innerHTML = html;
    const opcoes = {
        margin:       10,
        filename:     `Meu_Acervo_${dataHoje.replace(/\//g, '-')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opcoes).from(elemento).save().then(() => {
        console.log("PDF gerado com sucesso!");
    });
};

window.criarListaVazia = async function() {
    const input = document.getElementById("input-nova-lista-sidebar");
    const nomeLista = input.value.trim();
    if (!nomeLista) return;
    try {
        await addDoc(collection(db, "mangas"), {
            titulo: "_LIST_MARKER_", 
            listaPersonalizada: nomeLista,
            listasPersonalizadas: [nomeLista],
            tipo: "Sistema"
        });
        input.value = ""; 
    } catch (err) {
        console.error("Erro ao criar lista:", err);
    }
};

// LÓGICA NOVA: Gerencia a seleção de múltiplas tags
window.renderizarTagsSelecao = function(valoresAtuais) {
    const container = document.getElementById("container-tags-selecao");
    if (!container) return;

    // Transforma a entrada em um Array válido
    let selecionadas = Array.isArray(valoresAtuais) ? [...valoresAtuais] : (valoresAtuais ? [valoresAtuais] : ["Geral"]);
    if (selecionadas.length === 0) selecionadas = ["Geral"];

    const listasUnicas = obterTodasAsListas();
    listasUnicas.unshift("Geral");

    container.innerHTML = "";

    listasUnicas.forEach(nome => {
        const tag = document.createElement("span");
        tag.innerText = nome;
        
        const isSelecionada = selecionadas.includes(nome);

        tag.style.cssText = `
            padding: 6px 12px; border-radius: 20px; border: 1px solid #333;
            cursor: pointer; font-size: 0.85rem; transition: 0.2s;
            background: ${isSelecionada ? '#3b82f6' : '#1a1a1a'};
            color: ${isSelecionada ? '#fff' : '#aaa'};
        `;

        tag.onclick = () => {
            if (nome === "Geral") {
                selecionadas = ["Geral"];
            } else {
                selecionadas = selecionadas.filter(l => l !== "Geral"); // Remove "Geral"
                if (selecionadas.includes(nome)) {
                    selecionadas = selecionadas.filter(l => l !== nome); // Desmarca se já estiver clicada
                } else {
                    selecionadas.push(nome); // Marca a nova lista
                }
                // Se desmarcou todas as tags, volta o "Geral" automaticamente
                if (selecionadas.length === 0) selecionadas = ["Geral"]; 
            }
            
            // Salva o Array transformado em texto escondido no input
            document.getElementById("input-lista").value = JSON.stringify(selecionadas);
            renderizarTagsSelecao(selecionadas); 
        };

        container.appendChild(tag);
    });

    // Garante que o input escondido sempre atualize quando a janela abre
    document.getElementById("input-lista").value = JSON.stringify(selecionadas);
};

// ============================================================================
// 8. NOTIFICAÇÕES TOAST E ATUALIZAÇÃO RÁPIDA
// ============================================================================
window.mostrarToast = function(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    // Define o ícone de acordo com o tipo (sucesso, erro ou normal)
    let icone = '<i class="ph-fill ph-check-circle" style="color: #10b981; font-size: 1.5rem;"></i>';
    if (tipo === 'error') icone = '<i class="ph-fill ph-warning-circle" style="color: #ef4444; font-size: 1.5rem;"></i>';
    else if (tipo === 'info') icone = '<i class="ph-fill ph-info" style="color: #3b82f6; font-size: 1.5rem;"></i>';

    toast.innerHTML = `${icone} <span>${mensagem}</span>`;
    container.appendChild(toast);

    // Entrada animada
    setTimeout(() => toast.classList.add('show'), 10);

    // Saída animada após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); // Remove o elemento do HTML depois de sumir
    }, 3000);
};

window.alterarCapituloRapido = async function(id, val, event) {
    event.stopPropagation(); 
    
    const obra = acervo.find(i => i.idFirebase === id);
    if (!obra) return;
    
    let novo = (parseInt(obra.capitulo) || 0) + val;
    if (novo < 0) novo = 0;
    
    // 1. Atualiza visualmente na MESMA HORA na tela do usuário (Sem piscar)
    const spanCapitulo = document.getElementById(`cap-rapido-${id}`);
    if (spanCapitulo) {
        spanCapitulo.innerHTML = `<i class="ph-fill ph-bookmark-simple" style="color: #3b82f6;"></i> Cap: ${novo}`;
    }
    
    // 2. Aciona a trava para o Firebase não destruir o card flutuante
    pausarRedraw = true;
    
    try {
        await updateDoc(doc(db, "mangas", id), { capitulo: novo.toString() });
        window.mostrarToast(`Capítulo atualizado para ${novo}!`, 'success');
    } catch(err) {
        window.mostrarToast('Erro ao atualizar capítulo!', 'error');
        console.error(err);
    }
};

