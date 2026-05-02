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
        btn.className = "btn-filter sidebar-btn";
        if (filtroListaAtiva === nomeLista) btn.classList.add('active');
        
        btn.innerHTML = `<i class="ph ph-folder-simple"></i> ${nomeLista}`;
        btn.onclick = (e) => window.filtrarPorLista(nomeLista, e.currentTarget);
        container.appendChild(btn);
    });
}

window.filtrarPorLista = (nome, botaoClicado) => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    
    filtroListaAtiva = nome;
    filtroTipo = "Todos"; 
    window.aplicarFiltros();
};

window.filtrarPorTipo = (t, botaoClicado) => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
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
                        <span><i class="ph-fill ph-bookmark-simple" style="color: #3b82f6;"></i> Cap: ${obra.capitulo}</span>
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
window.fecharModalForm = () => { modalFormFundo.style.display = "none"; };
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) window.fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) window.fecharModalForm(); };

// ============================================================================
// 6. INTEGRAÇÃO COM MÚLTIPLAS APIs
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
        else if (fonte === 'mangadex') {
            const urlMD = `https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`;
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
            gen = (m.attributes?.tags || []).filter(tg => tg.attributes?.group === 'genre').map(tg => tg.attributes?.name?.en).filter(Boolean).join(", ");
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