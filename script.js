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
// 4. INTERFACE, BUSCA AVANÇADA E PAGINAÇÃO (Scroll Infinito)
// ============================================================================
let filtroTexto = "";
let filtroTipo = "Todos";

// Variáveis de Controle do Scroll Infinito
let itensPorPagina = 24; // Quantidade de obras carregadas por vez
let itensCarregados = 0;
let listaAtualFiltrada = [];
let carregandoScroll = false;

// O CÉREBRO: Analisa todos os filtros de uma vez
window.aplicarFiltros = () => {
    let listaFiltrada = acervo;

    // Função para mostrar/esconder a caixa de filtros extras
window.toggleFiltros = () => {
    const caixa = document.getElementById("caixa-filtros");
    if (caixa.style.display === "none") {
        caixa.style.display = "flex"; // Mostra os filtros
    } else {
        caixa.style.display = "none"; // Esconde os filtros
    }
};

    // Filtro de Texto
    if (filtroTexto) {
        listaFiltrada = listaFiltrada.filter(o => 
            (o.titulo || "").toLowerCase().includes(filtroTexto) || 
            (o.titulosAlternativos || "").toLowerCase().includes(filtroTexto)
        );
    }

    // Filtro de Tipo
    if (filtroTipo !== "Todos") {
        listaFiltrada = listaFiltrada.filter(o => o.tipo === filtroTipo);
    }

    // Filtro de Status
    const statusSelect = document.getElementById("select-status");
    if (statusSelect && statusSelect.value !== "Todos") {
        listaFiltrada = listaFiltrada.filter(o => o.status === statusSelect.value);
    }

    // Ordenação
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

    // Prepara os dados para o Scroll Infinito
    listaAtualFiltrada = listaFiltrada;
    itensCarregados = 0;
    conteinerMangas.innerHTML = ""; // Limpa a tela para aplicar o novo filtro do zero
    document.getElementById("contador-total").innerHTML = `<i class="ph ph-books"></i> ${listaAtualFiltrada.length} obras`;
    
    // Chama o primeiro lote de capas
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
                <img src="${obra.capa}" onerror="this.src='https://via.placeholder.com/200x300/1a1a1a/60a5fa?text=Sem+Capa'" loading="lazy" alt="${obra.titulo}" class="capa-bg">
                <div class="cartao-overlay"></div>
                <div class="cartao-tags-topo">
                    <span class="tag-tipo-poster ${classeTipo}">${obra.tipo}</span>
                    <span class="tag-status-poster">${iconeStatus}</span>
                </div>
                <div class="cartao-info-bottom">
                    <h3 class="titulo-poster">${obra.titulo}</h3>
                    <div class="cartao-meta"><span>Cap. ${obra.capitulo}</span><span><i class="ph-fill ph-star"></i> ${(obra.nota || 5).toFixed(1)}</span></div>
                </div>
            </div>`;
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