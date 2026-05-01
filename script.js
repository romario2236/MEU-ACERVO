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
        acervo.sort((a, b) => a.titulo.localeCompare(b.titulo));
        renderizarMangas(acervo);
        
        if (idAbertoNoModal && modalFundo.style.display === "flex") {
            window.abrirModal(idAbertoNoModal);
        }
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
// 4. RENDERIZAÇÃO E INTERFACE (UI)
// ============================================================================
function renderizarMangas(lista) {
    conteinerMangas.innerHTML = "";
    document.getElementById("contador-total").innerHTML = `<i class="ph ph-books"></i> ${lista.length} obras`;
    
    lista.forEach(obra => {
        let classeTipo = (obra.tipo === 'Manhwa') ? 'tipo-manhwa' : (obra.tipo === 'Mangá' ? 'tipo-manga' : 'tipo-novel');
        let iconeStatus = (obra.status === 'Em Andamento') ? "▶" : (obra.status === 'Finalizado' ? "✔" : "⏸");

        conteinerMangas.innerHTML += `
            <div class="cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
                <img src="${obra.capa}" loading="lazy" alt="${obra.titulo}" class="capa-bg">
                <div class="cartao-overlay"></div>
                <div class="cartao-tags-topo">
                    <span class="tag-tipo-poster ${classeTipo}">${obra.tipo}</span>
                    <span class="tag-status-poster" title="${obra.status}">${iconeStatus}</span>
                </div>
                <div class="cartao-info-bottom">
                    <h3 class="titulo-poster">${obra.titulo}</h3>
                    <div class="cartao-meta">
                        <span>Cap. ${obra.capitulo}</span>
                        <span style="color:#fbbf24"><i class="ph-fill ph-star"></i> ${(obra.nota || 5).toFixed(1)}</span>
                    </div>
                </div>
            </div>`;
    });
}

window.filtrarPorTipo = (t) => {
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderizarMangas(t === 'Todos' ? acervo : acervo.filter(o => o.tipo === t));
};

barraPesquisa.addEventListener("input", (e) => {
    const txt = e.target.value.toLowerCase();
    const filtrados = acervo.filter(o => 
        (o.titulo || "").toLowerCase().includes(txt) || 
        (o.titulosAlternativos || "").toLowerCase().includes(txt)
    );
    renderizarMangas(filtrados);
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
// 6. INTEGRAÇÃO COM MÚLTIPLAS APIs EXTERNAS
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

        // BUSCA MANGADEX
        if (fonte === 'mangadex') {
            const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`);
            if(!res.ok) throw new Error("MangaDex fora do ar");
            const d = await res.json();
            resultadosAPI = d.data || [];
            
            if(resultadosAPI.length === 0) div.innerHTML = "<p style='padding:15px;color:#94a3b8;'>Nenhum resultado no MangaDex.</p>";

            resultadosAPI.forEach((m, i) => {
                let titleObj = m.attributes?.title || {};
                let titulo = titleObj.en || titleObj["pt-br"] || Object.values(titleObj)[0] || "Sem Título";
                let ano = m.attributes?.year || "N/A";
                
                let coverArt = (m.relationships || []).find(rel => rel.type === 'cover_art');
                let coverUrl = coverArt ? `https://uploads.mangadex.org/covers/${m.id}/${coverArt.attributes?.fileName}` : "";
                
                m.minhaCapaMangaDex = coverUrl;

                div.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${i})">
                        <img src="${coverUrl}">
                        <div><h4>${titulo}</h4><p>MangaDex • ${ano}</p></div>
                    </div>`;
            });
        }
        // BUSCA MYANIMELIST (JIKAN)
        else {
            const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=5`);
            if(!res.ok) throw new Error("Jikan fora do ar");
            const d = await res.json();
            resultadosAPI = d.data || [];
            
            if(resultadosAPI.length === 0) div.innerHTML = "<p style='padding:15px;color:#94a3b8;'>Nenhum resultado no MyAnimeList.</p>";

            resultadosAPI.forEach((m, i) => {
                let ano = m.published?.prop?.from?.year || "N/A";
                let capaUrl = m.images?.jpg?.image_url || "";
                
                div.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${i})">
                        <img src="${capaUrl}">
                        <div><h4>${m.title}</h4><p>MyAnimeList • ${ano}</p></div>
                    </div>`;
            });
        }
        div.style.display = "block";
    } catch(err) {
        console.error("Erro da API:", err);
        div.innerHTML = "<p style='padding:15px; color:#ef4444;'>Erro na conexão com o banco de dados.</p>";
        div.style.display = "block";
    } finally {
        btn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Buscar';
        btn.disabled = false;
    }
}

window.preencherComAPI = function(i) {
    const m = resultadosAPI[i];
    if(!m) return;
    
    let titulo = "", titulosAlt = "", capa = "", sinopse = "", generos = "", status = "Em Andamento", capitulos = 0, nota = 5, tipo = "Mangá";

    try {
        if (fonteAtualAPI === 'mangadex') {
            let titleObj = m.attributes?.title || {};
            titulo = titleObj.en || titleObj["pt-br"] || Object.values(titleObj)[0] || "";
            
            let altArray = [];
            (m.attributes?.altTitles || []).forEach(t => {
                let val = Object.values(t)[0];
                if(val) altArray.push(val);
            });
            titulosAlt = altArray.join(", ");
            capa = m.minhaCapaMangaDex || "";
            
            let descObj = m.attributes?.description || {};
            sinopse = descObj["pt-br"] || descObj.en || "";
            
            let tags = [];
            (m.attributes?.tags || []).forEach(tag => {
                if(tag.attributes?.name?.en) tags.push(tag.attributes.name.en);
            });
            generos = tags.join(", ");
            capitulos = m.attributes?.lastChapter || 0;
            if (m.attributes?.status === "completed") status = "Finalizado";
            else if (m.attributes?.status === "hiatus" || m.attributes?.status === "cancelled") status = "Hiato";
        }
        else {
            titulo = m.title || "";
            let altArray = [];
            if (m.title_english) altArray.push(m.title_english);
            if (m.title_japanese) altArray.push(m.title_japanese);
            if (m.title_synonyms) altArray = altArray.concat(m.title_synonyms);
            titulosAlt = altArray.join(", ");
            
            capa = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || "";
            sinopse = (m.synopsis || "").replace("[Written by MAL Rewrite]", "").trim();
            
            let tags = [];
            if(m.genres) m.genres.forEach(g => tags.push(g.name));
            if(m.themes) m.themes.forEach(t => tags.push(t.name));
            generos = tags.join(", ");
            
            capitulos = m.chapters || 0;
            nota = m.score ? (m.score / 2).toFixed(1) : 5;
            if (m.status === "Finished") status = "Finalizado";
            else if (m.status === "On Hiatus" || m.status === "Discontinued") status = "Hiato";
        }

        // Reconhecimento de Tipo (Manhwa, Novel)
        let textoJunto = (generos + " " + (m.type || m.attributes?.publicationDemographic || "")).toLowerCase();
        if (textoJunto.includes("manhwa") || textoJunto.includes("webtoon")) tipo = "Manhwa";
        else if (textoJunto.includes("novel") || textoJunto.includes("light novel")) tipo = "Novel";

        // Preenchendo os campos na tela
        document.getElementById("input-titulo").value = titulo;
        document.getElementById("input-titulos-alt").value = titulosAlt;
        document.getElementById("input-capa").value = capa;
        document.getElementById("input-sinopse").value = sinopse;
        document.getElementById("input-generos").value = generos;
        document.getElementById("input-capitulo").value = capitulos;
        document.getElementById("input-nota").value = nota;
        document.getElementById("input-status").value = status;
        document.getElementById("input-tipo").value = tipo;

        document.getElementById("resultado-busca-api").style.display = "none";
        document.getElementById("input-busca-api").value = "";
        
    } catch(e) {
        console.error("Erro ao preencher dados:", e);
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