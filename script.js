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
// 2. VARIÁVEIS DE ESTADO
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
// 3. BANCO DE DADOS (CRUD)
// ============================================================================
function carregarAcervo() {
    onSnapshot(collection(db, "mangas"), (snapshot) => {
        acervo = [];
        snapshot.forEach(doc => {
            let obra = doc.data();
            obra.idFirebase = doc.id;
            acervo.push(obra);
        });
        acervo.sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
        renderizarMangas(acervo);
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
    } catch(err) { alert("Erro ao salvar!"); console.error(err); }
    finally { btn.innerHTML = '<i class="ph ph-cloud-arrow-up"></i> Salvar na Nuvem'; }
});

// ============================================================================
// 4. INTERFACE E BUSCA LOCAL
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
                    <span class="tag-status-poster">${iconeStatus}</span>
                </div>
                <div class="cartao-info-bottom">
                    <h3 class="titulo-poster">${obra.titulo}</h3>
                    <div class="cartao-meta"><span>Cap. ${obra.capitulo}</span><span><i class="ph-fill ph-star"></i> ${(obra.nota || 5).toFixed(1)}</span></div>
                </div>
            </div>`;
    });
}

barraPesquisa.addEventListener("input", (e) => {
    const txt = e.target.value.toLowerCase();
    renderizarMangas(acervo.filter(o => (o.titulo || "").toLowerCase().includes(txt) || (o.titulosAlternativos || "").toLowerCase().includes(txt)));
});

window.filtrarPorTipo = (t) => {
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderizarMangas(t === 'Todos' ? acervo : acervo.filter(o => o.tipo === t));
};

// ============================================================================
// 5. MODAIS E LINKS DINÂMICOS
// ============================================================================
window.adicionarCampoLink = function(nome = "", url = "") {
    const container = document.getElementById("container-links-inputs");
    if(!container) return;
    const div = document.createElement("div");
    div.className = "link-row";
    div.innerHTML = `<input type="text" class="link-name-input" placeholder="Site" value="${nome}"><input type="url" class="link-url-input" placeholder="https://..." value="${url}"><button type="button" class="btn-remover-link" onclick="this.parentElement.remove()"><i class="ph ph-x"></i></button>`;
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
        const areaG = document.getElementById("modal-generos");
        areaG.innerHTML = "";
        (obra.generos || "").split(',').forEach(g => { if(g.trim()) areaG.innerHTML += `<span class="tag-genero">${g.trim()}</span>`; });
        const cLinks = document.getElementById("container-links-leitura");
        cLinks.innerHTML = "";
        if (obra.linksLeitura) {
            obra.linksLeitura.forEach(linha => {
                let url = linha, nome = "Ler";
                if (linha.includes('|')) { const p = linha.split('|'); nome = p[0].trim(); url = p[1].trim(); }
                else { try { nome = new URL(url).hostname.replace('www.', ''); } catch(e) {} }
                cLinks.innerHTML += `<a class="btn-ler-obra" href="${url}" target="_blank"><i class="ph ph-book-open"></i> ${nome}</a>`;
            });
        }
        modalFundo.style.display = "flex";
    }
}

window.alterarCapitulo = async function(val) {
    let input = document.getElementById("modal-capitulo-editavel");
    let novo = (parseInt(input.value) || 0) + val;
    if(novo < 0) novo = 0;
    input.value = novo;
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
        document.getElementById("input-id-firebase").value = o.idFirebase;
        document.getElementById("input-titulo").value = o.titulo || "";
        document.getElementById("input-titulos-alt").value = o.titulosAlternativos || "";
        document.getElementById("input-generos").value = o.generos || "";
        document.getElementById("input-tipo").value = o.tipo || "Mangá";
        document.getElementById("input-capitulo").value = o.capitulo || 0;
        document.getElementById("input-status").value = o.status || "Em Andamento";
        document.getElementById("input-nota").value = o.nota || 5;
        document.getElementById("input-capa").value = o.capa || "";
        document.getElementById("input-sinopse").value = o.sinopse || "";
        const container = document.getElementById("container-links-inputs");
        container.innerHTML = "";
        if (o.linksLeitura) {
            o.linksLeitura.forEach(linha => {
                let n = "", u = linha;
                if (linha.includes('|')) { const p = linha.split('|'); n = p[0].trim(); u = p[1].trim(); }
                window.adicionarCampoLink(n, u);
            });
        } else window.adicionarCampoLink();
        fecharModal(); modalFormFundo.style.display = "flex";
    }
}

window.excluirObra = async function() { if(confirm("Excluir definitivamente?")) { await deleteDoc(doc(db, "mangas", idAbertoNoModal)); fecharModal(); } }
window.fecharModal = () => { modalFundo.style.display = "none"; idAbertoNoModal = ""; };
window.fecharModalForm = () => { modalFormFundo.style.display = "none"; };
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) window.fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) window.fecharModalForm(); };

// ============================================================================
// 6. INTEGRAÇÃO APIs (JIKAN + MANGADEX)
// ============================================================================
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value.trim();
    if(!q) return;
    const fonte = document.getElementById("select-fonte-api").value;
    fonteAtualAPI = fonte;
    const div = document.getElementById("resultado-busca-api");
    const btn = document.getElementById("btn-buscar-api");
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i>'; btn.disabled = true;
    try {
        div.innerHTML = ""; resultadosAPI = [];
        if (fonte === 'mangadex') {
            const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`);
            const d = await res.json(); resultadosAPI = d.data || [];
        } else {
            const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=5`);
            const d = await res.json(); resultadosAPI = d.data || [];
        }

        if(resultadosAPI.length === 0) div.innerHTML = "<p style='padding:15px; color:#aaa;'>Nada encontrado.</p>";
        else {
            resultadosAPI.forEach((m, i) => {
                let t = "", c = "", a = "N/A";
                if(fonte === 'mangadex') {
                    t = m.attributes.title.en || Object.values(m.attributes.title)[0];
                    let art = m.relationships.find(r => r.type === 'cover_art');
                    c = art ? `https://uploads.mangadex.org/covers/${m.id}/${art.attributes.fileName}` : "";
                    a = m.attributes.year || "N/A";
                    m.minhaCapaMangaDex = c;
                } else {
                    t = m.title; c = m.images.jpg.image_url; a = m.published?.prop?.from?.year || "N/A";
                }
                div.innerHTML += `<div class="item-api" onclick="preencherComAPI(${i})"><img src="${c}"><div><h4>${t}</h4><p>${a}</p></div></div>`;
            });
        }
        div.style.display = "block";
    } catch(err) { div.innerHTML = "<p style='padding:15px; color:#ef4444;'>Erro na conexão.</p>"; div.style.display = "block"; }
    finally { btn.innerHTML = '<i class="ph ph-magnifying-glass"></i>'; btn.disabled = false; }
}

window.preencherComAPI = function(i) {
    const m = resultadosAPI[i]; if(!m) return;
    let t = "", alts = "", c = "", s = "", g = "", st = "Em Andamento", cap = 0, n = 5, tp = "Mangá";
    if (fonteAtualAPI === 'mangadex') {
        t = m.attributes.title.en || Object.values(m.attributes.title)[0];
        let altArr = []; (m.attributes.altTitles || []).forEach(at => altArr.push(Object.values(at)[0])); alts = altArr.join(", ");
        c = m.minhaCapaMangaDex; s = m.attributes.description.en || m.attributes.description["pt-br"] || "";
        let tags = []; (m.attributes.tags || []).forEach(tg => tags.push(tp === "Mangá" ? tg.attributes.name.en : tg.attributes.name.en)); g = tags.join(", ");
        cap = m.attributes.lastChapter || 0; if (m.attributes.status === "completed") st = "Finalizado";
    } else {
        t = m.title; let altArr = []; if(m.title_english) altArr.push(m.title_english); if(m.title_japanese) altArr.push(m.title_japanese); alts = altArr.join(", ");
        c = m.images.jpg.large_image_url || m.images.jpg.image_url; s = (m.synopsis || "").replace("[Written by MAL Rewrite]", "").trim();
        let tags = (m.genres || []).map(tg => tg.name); g = tags.join(", "); cap = m.chapters || 0; n = m.score ? (m.score / 2).toFixed(1) : 5;
        if (m.status === "Finished") st = "Finalizado";
    }
    let textoTipo = (g + " " + (m.type || m.attributes?.publicationDemographic || "")).toLowerCase();
    if (textoTipo.includes("manhwa") || textoTipo.includes("webtoon")) tp = "Manhwa"; else if (textoTipo.includes("novel")) tp = "Novel";
    document.getElementById("input-titulo").value = t; document.getElementById("input-titulos-alt").value = alts;
    document.getElementById("input-capa").value = c; document.getElementById("input-sinopse").value = s;
    document.getElementById("input-generos").value = g; document.getElementById("input-capitulo").value = cap;
    document.getElementById("input-nota").value = n; document.getElementById("input-status").value = st; document.getElementById("input-tipo").value = tp;
    document.getElementById("resultado-busca-api").style.display = "none";
}

// ============================================================================
// 7. BACKUP JSON
// ============================================================================
window.exportarDados = () => {
    const blob = new Blob([JSON.stringify(acervo.map(({idFirebase, ...r}) => r), null, 2)], {type: "application/json"});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "backup.json"; a.click();
};

window.importarDados = (e) => {
    const reader = new FileReader();
    reader.onload = async (f) => {
        const lista = JSON.parse(f.target.result);
        for (const o of lista) { if(!acervo.some(i => i.titulo === o.titulo)) await addDoc(collection(db, "mangas"), o); }
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};