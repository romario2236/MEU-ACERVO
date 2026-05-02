// ============================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÕES DO FIREBASE
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAH-7clKFuTdisyN4fNxGd1JTicX3ZWJnw",
  authDomain: "meu-acervo-b8eaf.firebaseapp.com",
  projectId: "meu-acervo-b8eaf",
  storageBucket: "meu-acervo-b8eaf.firebasestorage.app",
  messagingSenderId: "397695115084",
  appId: "1:397695115084:web:13b5ffc8ca61e1fe7879e9",
  measurementId: "G-CE6CSXTGMN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => console.warn("Cache offline desativado."));

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
function carregarAcervo() {
    onSnapshot(collection(db, "mangas"), (snapshot) => {
        acervo = [];
        snapshot.forEach(doc => {
            let obra = doc.data();
            obra.idFirebase = doc.id;
            acervo.push(obra);
        });
        // Removido o sort e renderizarMangas daqui. O cérebro faz isso agora:
        aplicarFiltros(); 
        
        if (idAbertoNoModal && modalFundo.style.display === "flex") window.abrirModal(idAbertoNoModal);
    });
}
carregarAcervo();

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("input-id-firebase").value;
    const btn = formulario.querySelector('.btn-salvar');
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Salvando...';
    
    // Lê os links dinâmicos
    const linksArray = [];
    document.querySelectorAll('.link-row').forEach(row => {
        const nome = row.querySelector('.link-name-input').value.trim();
        const url = row.querySelector('.link-url-input').value.trim();
        if (url) linksArray.push(nome ? `${nome} | ${url}` : url);
    });

    const obra = {
        titulo: document.getElementById("input-titulo").value || "",
        titulosAlternativos: document.getElementById("input-titulos-alt").value || "",
        generos: document.getElementById("input-generos").value || "",
        listaPersonalizada: document.getElementById("input-lista").value || "Geral", // LINHA NOVA!
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
            await updateDoc(doc(db, "mangas", id), obra);
            fecharModalForm();
            window.abrirModal(id); 
        } else {
            await addDoc(collection(db, "mangas"), obra);
            fecharModalForm();
        }
    } catch(err) {
        alert("Erro ao salvar no banco!");
        console.error(err);
    } finally {
        btn.innerHTML = '<i class="ph ph-cloud-arrow-up"></i> Salvar na Nuvem';
    }
});

// ============================================================================
// 4. INTERFACE, BUSCA AVANÇADA E FILTROS (Versão Final Corrigida)
// ============================================================================
let filtroTexto = "";
let filtroTipo = "Todos";
let filtroListaAtiva = "Todas"; 

let itensPorPagina = 24; 
let itensCarregados = 0;
let listaAtualFiltrada = [];
let carregandoScroll = false;

// Função que desenha os botões das suas listas na barra lateral
function atualizarBotoesListas() {
    const container = document.getElementById("container-listas-personalizadas");
    if (!container) return;

    const listasUnicas = [...new Set(acervo
        .map(o => o.listaPersonalizada)
        .filter(l => l && l !== "Geral" && l !== "")
    )].sort();

    container.innerHTML = "";
    listasUnicas.forEach(nomeLista => {
        const btn = document.createElement("button");
        btn.className = "btn-filter sidebar-btn";
        // Mantém o botão aceso se for a lista ativa
        if (filtroListaAtiva === nomeLista) btn.classList.add('active');
        btn.innerText = nomeLista;
        btn.onclick = (e) => window.filtrarPorLista(nomeLista, e.target);
        container.appendChild(btn);
    });
}

// Filtro para quando você clica em uma lista (ex: "Favoritos")
window.filtrarPorLista = (nome, botaoClicado) => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    
    filtroListaAtiva = nome;
    filtroTipo = "Todos"; // Reseta Mangá/Manhwa para mostrar tudo daquela lista
    window.aplicarFiltros();
};

// Filtro para quando você clica em Mangá, Manhwa ou "Todos"
window.filtrarPorTipo = (t, botaoClicado) => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    
    filtroTipo = t;
    
    // CORREÇÃO: Se clicou em "Todos" ou em um Tipo, a lista personalizada é resetada
    filtroListaAtiva = "Todas"; 
    
    window.aplicarFiltros();
};

// O CÉREBRO: Processa todas as regras de exibição
window.aplicarFiltros = () => {
    let listaFiltrada = acervo;

    atualizarBotoesListas();

    // 1. Busca por texto
    if (filtroTexto) {
        listaFiltrada = listaFiltrada.filter(o => 
            (o.titulo || "").toLowerCase().includes(filtroTexto) || 
            (o.titulosAlternativos || "").toLowerCase().includes(filtroTexto)
        );
    }

    // 2. Filtro de Categorias (Tipo)
    if (filtroTipo !== "Todos") {
        listaFiltrada = listaFiltrada.filter(o => o.tipo === filtroTipo);
    }

    // 3. Filtro de Listas Personalizadas
    if (filtroListaAtiva !== "Todas") {
        listaFiltrada = listaFiltrada.filter(o => o.listaPersonalizada === filtroListaAtiva);
    }

    // 4. Filtro de Status (Select)
    const statusSelect = document.getElementById("select-status");
    if (statusSelect && statusSelect.value !== "Todos") {
        listaFiltrada = listaFiltrada.filter(o => o.status === statusSelect.value);
    }

    // 5. Ordenação
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

    // Reinicia a grade com o resultado final
    listaAtualFiltrada = listaFiltrada;
    itensCarregados = 0;
    const conteinerMangas = document.getElementById("lista-mangas");
    if(conteinerMangas) conteinerMangas.innerHTML = ""; 
    
    const contador = document.getElementById("contador-total");
    if(contador) contador.innerHTML = `<i class="ph ph-books"></i> ${listaAtualFiltrada.length} obras`;
    
    carregarMaisItens();
};

// FUNÇÃO QUE DESENHA AS CAPAS AOS POUCOS
function carregarMaisItens() {
    // Recorta apenas o próximo lote de obras da lista filtrada
    const proximosItens = listaAtualFiltrada.slice(itensCarregados, itensCarregados + itensPorPagina);
    
    if (proximosItens.length === 0) return; // Se não tem mais nada, ignora

    proximosItens.forEach(obra => {
        let classeTipo = (obra.tipo === 'Manhwa') ? 'tipo-manhwa' : (obra.tipo === 'Mangá' ? 'tipo-manga' : 'tipo-novel');
        let iconeStatus = (obra.status === 'Em Andamento') ? "▶" : (obra.status === 'Finalizado' ? "✔" : "⏸");
        
        // Adicionamos o atributo loading="lazy" nativo para economizar ainda mais a rede
        conteinerMangas.innerHTML += `
            <div class="cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
                <!-- 1. Apenas a imagem limpa -->
                <img src="${obra.capa}" onerror="this.src='https://via.placeholder.com/200x300/1a1a1a/60a5fa?text=Sem+Capa'" loading="lazy" alt="${obra.titulo}" class="capa-bg">
                
                <!-- 2. O Card Flutuante (invisível por padrão) -->
                <div class="card-flutuante">
                    <h4 class="titulo-flutuante">${obra.titulo}</h4>
                    <div class="info-flutuante">
                        <span><i class="ph-fill ph-bookmark-simple" style="color: #3b82f6;"></i> Cap: ${obra.capitulo}</span>
                        <span><i class="ph-fill ph-star" style="color: #f59e0b;"></i> Nota: ${(obra.nota || 5).toFixed(1)}</span>
                        <span><i class="ph-fill ph-tag" style="color: #10b981;"></i> ${obra.status}</span>
                        <span class="${classeTipo}" style="margin-top: 5px; display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; text-align: center;">${obra.tipo}</span>
                    </div>
                </div>
            </div>
        `;
    });

    // Atualiza a contagem de quantos já desenhamos na tela
    itensCarregados += proximosItens.length;
}

// O VIGIA DA BARRA DE ROLAGEM
window.addEventListener('scroll', () => {
    if (carregandoScroll) return; // Evita que o navegador chame a função dezenas de vezes seguidas
    
    // Calcula se o usuário chegou perto (200px) do fim da página
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200) {
        carregandoScroll = true;
        carregarMaisItens();
        
        // Libera o vigia após 100 milissegundos
        setTimeout(() => {
            carregandoScroll = false;
        }, 100);
    }
});

// Eventos dos inputs e botões
barraPesquisa.addEventListener("input", (e) => {
    filtroTexto = e.target.value.toLowerCase();
    aplicarFiltros();
});

// Evento dos botões de tipo
window.filtrarPorTipo = (t, botaoClicado) => {
    // 1. Apaga a luz (tira a classe active) de todos os botões da barra lateral
    document.querySelectorAll('.sidebar-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    // 2. Acende a luz apenas no botão que você acabou de clicar
    if (botaoClicado) {
        botaoClicado.classList.add('active');
    }
    
    // 3. Aplica o filtro na lista de mangás
    filtroTipo = t;
    aplicarFiltros();
};
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
        document.getElementById("modal-tipo").innerText = obra.tipo || "Mangá";
        document.getElementById("modal-titulos-alt").innerText = obra.titulosAlternativos || "Nenhum";
        document.getElementById("modal-texto-sinopse").innerText = obra.sinopse || "";
        document.getElementById("modal-capitulo-editavel").value = obra.capitulo || "0";
        document.getElementById("modal-status").innerText = obra.status || "Em Andamento";
        document.getElementById("modal-nota-texto").innerText = (obra.nota || 5).toFixed(1);
        
        const areaGeneros = document.getElementById("modal-generos");
        areaGeneros.innerHTML = "";
        if (obra.generos) {
            obra.generos.split(',').forEach(g => {
                if(g.trim()) areaGeneros.innerHTML += `<span class="tag-genero">${g.trim()}</span>`;
            });
        }
        
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

// local das edições e dados do formulario de edição

window.prepararEdicao = function() {
    const o = acervo.find(i => i.idFirebase === idAbertoNoModal);
    if (o) {
        document.getElementById("input-titulo").value = o.titulo || "";
        document.getElementById("input-titulos-alt").value = o.titulosAlternativos || "";
        document.getElementById("input-generos").value = o.generos || "";
        document.getElementById("input-tipo").value = o.tipo || "Mangá";
        document.getElementById("input-capitulo").value = o.capitulo || 0;
        document.getElementById("input-status").value = o.status || "Em Andamento";
        document.getElementById("input-nota").value = o.nota || 5;
        
        // Preenche o campo da lista personalizada
        document.getElementById('input-lista').value = o.listaPersonalizada || '';
        
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
        } else { window.adicionarCampoLink(); }
        
        fecharModal(); 
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
window.fecharModalForm = () => { modalFormFundo.style.display = "none"; };
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) window.fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) window.fecharModalForm(); };

// ============================================================================
// 6. INTEGRAÇÃO COM MÚLTIPLAS APIs (Jikan, MangaDex e Kitsu)
// ============================================================================
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value.trim();
    if(!q) return;

    const fonteSelect = document.getElementById("select-fonte-api");
    const fonte = fonteSelect ? fonteSelect.value : 'jikan'; 
    fonteAtualAPI = fonte; 
    
    const div = document.getElementById("resultado-busca-api");
    const btn = document.getElementById("btn-buscar-api");
    
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i>';
    btn.disabled = true;
    
    try {
        div.innerHTML = "";
        resultadosAPI = [];

        // --- BUSCA KITSU (Acesso Direto, Rápido e Sem Erros) ---
        if (fonte === 'kitsu') {
            const res = await fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(q)}&page[limit]=5`);
            if(!res.ok) throw new Error("Kitsu fora do ar");
            const d = await res.json();
            resultadosAPI = d.data || [];

            if(resultadosAPI.length === 0) div.innerHTML = "<p style='padding:15px;color:#94a3b8;'>Nenhum resultado no Kitsu.</p>";

            resultadosAPI.forEach((m, i) => {
                const t = m.attributes?.canonicalTitle || "Sem Título";
                const c = m.attributes?.posterImage?.small || m.attributes?.posterImage?.original || "";
                const ano = m.attributes?.startDate ? m.attributes.startDate.substring(0,4) : "N/A";
                
                div.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${i})">
                        <img src="${c}">
                        <div><h4>${t}</h4><p>Kitsu • ${ano}</p></div>
                    </div>`;
            });
        }
       // --- BUSCA MANGADEX (REST com Nova Ponte Proxy) ---
        else if (fonte === 'mangadex') {
            const urlMD = `https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`;
            
            // Trocamos o 'allorigins' (que caiu) pelo 'corsproxy.io' (mais estável)
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlMD)}`;
            
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error("A ponte de conexão falhou ao acessar o MangaDex.");
            const d = await res.json();
            resultadosAPI = d.data || [];

            if(resultadosAPI.length === 0) div.innerHTML = "<p style='padding:15px;color:#94a3b8;'>Nenhum resultado no MangaDex.</p>";

            resultadosAPI.forEach((m, i) => {
                const titles = m.attributes?.title || {};
                const t = titles.en || titles['pt-br'] || Object.values(titles)[0] || "Sem Título";
                const art = (m.relationships || []).find(rel => rel.type === 'cover_art');
                const capa = art ? `https://uploads.mangadex.org/covers/${m.id}/${art.attributes?.fileName}` : "";
                m.minhaCapaMangaDex = capa;
                
                div.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${i})">
                        <img src="${capa}">
                        <div><h4>${t}</h4><p>MangaDex • ${m.attributes?.year || 'N/A'}</p></div>
                    </div>`;
            });
        }
        // --- BUSCA MYANIMELIST (Jikan Direto) ---
        else {
            const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=5`);
            if (!res.ok) throw new Error("Jikan fora do ar");
            const d = await res.json();
            resultadosAPI = d.data || [];

            if(resultadosAPI.length === 0) div.innerHTML = "<p style='padding:15px;color:#94a3b8;'>Nenhum resultado no MyAnimeList.</p>";
            
            resultadosAPI.forEach((m, i) => {
                const t = m.title || "Sem Título";
                const c = m.images?.jpg?.image_url || "";
                const a = m.published?.prop?.from?.year || "N/A";
                div.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${i})">
                        <img src="${c}">
                        <div><h4>${t}</h4><p>MyAnimeList • ${a}</p></div>
                    </div>`;
            });
        }

        div.style.display = "block";

    } catch(err) {
        console.error("Erro na API:", err);
        div.innerHTML = `<p style='padding:15px; color:#ef4444;'>Erro na conexão: ${err.message}</p>`;
        div.style.display = "block";
    } finally {
        btn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Buscar';
        btn.disabled = false;
    }
}

window.preencherComAPI = function(i) {
    const m = resultadosAPI[i];
    if(!m) return;
    
    let t = "", alts = "", capa = "", sin = "", gen = "", st = "Em Andamento", cap = 0, nota = 5, tipo = "Mangá";

    try {
        if (fonteAtualAPI === 'kitsu') {
            t = m.attributes?.canonicalTitle || "";
            
            let altArr = [];
            if(m.attributes?.titles) {
                Object.values(m.attributes.titles).forEach(val => {
                    if(val && val !== t) altArr.push(val);
                });
            }
            alts = altArr.join(", ");
            
            capa = m.attributes?.posterImage?.original || "";
            sin = m.attributes?.synopsis || "";
            
            // O Kitsu pede uma busca extra só para gêneros, então deixamos para o usuário digitar
            gen = ""; 
            
            cap = m.attributes?.chapterCount || 0;
            nota = m.attributes?.averageRating ? (m.attributes.averageRating / 20).toFixed(1) : 5;
            
            if (m.attributes?.status === "finished") st = "Finalizado";
            else if (m.attributes?.status === "current") st = "Em Andamento";
            else st = "Hiato";

            let mangaType = (m.attributes?.mangaType || "").toLowerCase();
            if (mangaType === "manhwa") tipo = "Manhwa";
            else if (mangaType === "novel") tipo = "Novel";
            else tipo = "Mangá";
        } 
        else if (fonteAtualAPI === 'mangadex') {
            const titles = m.attributes?.title || {};
            t = titles.en || titles['pt-br'] || Object.values(titles)[0] || "";
            let altArr = [];
            (m.attributes?.altTitles || []).forEach(at => {
                let val = Object.values(at)[0];
                if(val) altArr.push(val);
            });
            alts = altArr.join(", ");
            
            capa = m.minhaCapaMangaDex || "";
            const descriptions = m.attributes?.description || {};
            sin = descriptions.en || descriptions['pt-br'] || Object.values(descriptions)[0] || "";
            
            gen = (m.attributes?.tags || [])
                .filter(tg => tg.attributes?.group === 'genre')
                .map(tg => tg.attributes?.name?.en)
                .filter(Boolean)
                .join(", ");
            
            cap = m.attributes?.lastChapter || 0;
            if(m.attributes?.status === "completed") st = "Finalizado";
            else if (m.attributes?.status === "hiatus" || m.attributes?.status === "cancelled") st = "Hiato";
        }
        else {
            t = m.title || "";
            let altArr = [];
            if(m.title_english && m.title_english !== t) altArr.push(m.title_english);
            if(m.title_japanese && m.title_japanese !== t) altArr.push(m.title_japanese);
            if(m.title_synonyms) altArr = altArr.concat(m.title_synonyms);
            alts = altArr.join(", ");
            
            capa = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || "";
            sin = (m.synopsis || "").replace("[Written by MAL Rewrite]", "").trim();
            gen = (m.genres || []).map(g => g.name).join(", ");
            cap = m.chapters || 0;
            nota = m.score ? (m.score / 2).toFixed(1) : 5;
            
            if(m.status === "Finished") st = "Finalizado";
            else if (m.status === "On Hiatus" || m.status === "Discontinued") st = "Hiato";
        }

        // Preenchendo a tela
        document.getElementById("input-titulo").value = t;
        document.getElementById("input-titulos-alt").value = alts;
        document.getElementById("input-capa").value = capa;
        document.getElementById("input-sinopse").value = sin;
        if(gen) document.getElementById("input-generos").value = gen;
        document.getElementById("input-capitulo").value = cap;
        document.getElementById("input-nota").value = nota;
        document.getElementById("input-status").value = st;
        document.getElementById("input-tipo").value = tipo;
        
        document.getElementById("resultado-busca-api").style.display = "none";
        document.getElementById("input-busca-api").value = "";
        
    } catch(e) {
        console.error("Erro ao jogar os dados na tela:", e);
    }
}
// ============================================================================
// 7. BACKUP JSON
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

// ==========================================
// CONTROLE DO MODAL DE FORMULÁRIO (NOVA OBRA)
// ==========================================

// Função para ABRIR a janela
window.abrirModalForm = () => {
    const modalForm = document.getElementById('modal-form-fundo');
    const form = document.getElementById('form-nova-obra');
    const tituloForm = document.getElementById('titulo-form');
    const inputId = document.getElementById('input-id-firebase');

    if (form) form.reset(); // Limpa os campos de texto
    if (inputId) inputId.value = ""; // Garante que é uma obra nova (não edição)
    if (tituloForm) tituloForm.innerText = "Nova Obra"; // Reseta o título principal

    if (modalForm) modalForm.style.display = 'flex'; // Exibe a tela preta de fundo
};

// Função para FECHAR a janela no botão X
window.fecharModalForm = () => {
    const modalForm = document.getElementById('modal-form-fundo');
    if (modalForm) modalForm.style.display = 'none';
};

// Função para FECHAR a janela clicando fora dela (no fundo preto)
window.fecharModalFormPeloFundo = (event) => {
    if (event.target.id === 'modal-form-fundo') {
        window.fecharModalForm();
    }
};
// ==========================================
// MELHORIAS DE INTERFACE (BUSCA E SCROLL)
// ==========================================

// 1. Botão Limpar Busca
window.limparBusca = () => {
    const inputBusca = document.getElementById('barra-pesquisa');
    if (inputBusca) {
        inputBusca.value = ''; // Limpa o texto
        document.getElementById('btn-limpar-busca').style.display = 'none'; // Esconde o botão X
        
        // Simula que você apagou o texto para o filtro ser aplicado automaticamente
        inputBusca.dispatchEvent(new Event('input')); 
    }
};

// 2. Lógica para mostrar/esconder o "X" enquanto você digita
const inputBuscaEvent = document.getElementById('barra-pesquisa');
if (inputBuscaEvent) {
    inputBuscaEvent.addEventListener('input', (e) => {
        const btnLimpar = document.getElementById('btn-limpar-busca');
        if (e.target.value.length > 0) {
            btnLimpar.style.display = 'flex'; // Mostra o X se tiver texto
        } else {
            btnLimpar.style.display = 'none'; // Esconde se estiver vazio
        }
    });
}

// 3. Função para Voltar ao Topo com animação suave
window.voltarAoTopo = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 4. Lógica para mostrar o botão de Topo só quando rolar para baixo
window.addEventListener('scroll', () => {
    const btnTopo = document.getElementById('btn-topo');
    if (btnTopo) {
        if (window.scrollY > 300) {
            btnTopo.style.display = 'flex'; // Mostra quando descer 300px
        } else {
            btnTopo.style.display = 'none'; // Esconde quando estiver lá no alto
        }
    }
});

// ==========================================
// GERADOR DE PDF (EXPORTAÇÃO DO ACERVO)
// ==========================================
window.gerarPDF = () => {
    // Verifica se existem obras no acervo
    if (!acervo || acervo.length === 0) {
        alert("Seu acervo está vazio! Adicione algumas obras antes de gerar o PDF.");
        return;
    }

    alert("Preparando o seu PDF... Isso pode levar alguns segundos.");

    // 1. Cria um contêiner invisível na memória para desenhar o documento
    const elemento = document.createElement('div');
    elemento.style.padding = '20px';
    elemento.style.fontFamily = 'Arial, sans-serif';
    elemento.style.color = '#000'; // Letra preta para o PDF
    elemento.style.background = '#fff'; // Fundo branco estilo papel

    // 2. Monta o cabeçalho do documento
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

    // 3. Preenche a tabela com as suas obras organizadas em ordem alfabética
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

    // 4. Configurações da biblioteca PDF
    const opcoes = {
        margin:       10,
        filename:     `Meu_Acervo_${dataHoje.replace(/\//g, '-')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 }, // Melhora a resolução do texto
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // 5. Gera o arquivo e força o download
    html2pdf().set(opcoes).from(elemento).save().then(() => {
        console.log("PDF gerado com sucesso!");
    });
};