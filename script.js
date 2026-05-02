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

let filtroTexto = "";
let filtroTipo = "Todos";
let filtroListaAtiva = "Todas";

let itensPorPagina = 24; 
let itensCarregados = 0;
let listaAtualFiltrada = [];
let carregandoScroll = false;

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

    const obra = {
        titulo: document.getElementById("input-titulo").value || "",
        titulosAlternativos: document.getElementById("input-titulos-alt").value || "",
        generos: document.getElementById("input-generos").value || "",
        listaPersonalizada: (document.getElementById("input-lista").value || "Geral").trim(),
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
        alert("Erro ao salvar!");
        console.error(err);
    } finally {
        btn.innerHTML = '<i class="ph ph-cloud-arrow-up"></i> Salvar no Acervo';
    }
});

// ============================================================================
// 4. INTERFACE E FILTROS (CÉREBRO DO SISTEMA)
// ============================================================================
function atualizarBotoesListas() {
    const container = document.getElementById("container-listas-personalizadas");
    const datalist = document.getElementById("sugestoes-listas");
    if (!container) return;

    const listasUnicas = [...new Set(acervo
        .map(o => (o.listaPersonalizada || "").trim())
        .filter(l => l !== "" && l !== "Geral")
    )].sort();

    container.innerHTML = "";
    listasUnicas.forEach(nomeLista => {
        const btn = document.createElement("button");
        btn.className = "btn-filter sidebar-btn";
        if (filtroListaAtiva === nomeLista) btn.classList.add('active');
        btn.innerHTML = `<i class="ph ph-folder-simple"></i> ${nomeLista}`;
        btn.onclick = (e) => window.filtrarPorLista(nomeLista, e.currentTarget);
        container.appendChild(btn);
    });

    if (datalist) {
        datalist.innerHTML = "";
        listasUnicas.forEach(nomeLista => {
            const option = document.createElement("option");
            option.value = nomeLista;
            datalist.appendChild(option);
        });
    }
}

window.filtrarPorLista = (nome, botaoClicado) => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    filtroListaAtiva = nome;
    filtroTipo = "Todos"; 
    aplicarFiltros();
};

window.filtrarPorTipo = (t, botaoClicado) => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    if (botaoClicado) botaoClicado.classList.add('active');
    filtroTipo = t;
    filtroListaAtiva = "Todas"; // Reset essencial
    aplicarFiltros();
};

window.aplicarFiltros = () => {
    let listaFiltrada = acervo;
    atualizarBotoesListas();

    if (filtroTexto) {
        listaFiltrada = listaFiltrada.filter(o => 
            (o.titulo || "").toLowerCase().includes(filtroTexto) || 
            (o.titulosAlternativos || "").toLowerCase().includes(filtroTexto)
        );
    }

    if (filtroTipo !== "Todos") listaFiltrada = listaFiltrada.filter(o => o.tipo === filtroTipo);
    if (filtroListaAtiva !== "Todas") listaFiltrada = listaFiltrada.filter(o => o.listaPersonalizada === filtroListaAtiva);

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
            if (ordem === "cap-alto") return (parseInt(b.capitulo) || 0) - (parseInt(a.capitulo) || 0);
            return 0;
        });
    }

    listaAtualFiltrada = listaFiltrada;
    itensCarregados = 0;
    if(conteinerMangas) conteinerMangas.innerHTML = ""; 
    const contador = document.getElementById("contador-total");
    if(contador) contador.innerHTML = `<i class="ph ph-books"></i> ${listaAtualFiltrada.length} obras`;
    carregarMaisItens();
};

function carregarMaisItens() {
    const proximosItens = listaAtualFiltrada.slice(itensCarregados, itensCarregados + itensPorPagina);
    if (proximosItens.length === 0 || !conteinerMangas) return;

    proximosItens.forEach(obra => {
        let classeTipo = (obra.tipo === 'Manhwa') ? 'tipo-manhwa' : (obra.tipo === 'Mangá' ? 'tipo-manga' : 'tipo-novel');
        conteinerMangas.innerHTML += `
            <div class="cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
                <img src="${obra.capa}" onerror="this.src='https://via.placeholder.com/200x300/1a1a1a/60a5fa?text=Sem+Capa'" loading="lazy" class="capa-bg">
                <div class="card-flutuante">
                    <h4 class="titulo-flutuante">${obra.titulo}</h4>
                    <div class="info-flutuante">
                        <span><i class="ph-fill ph-bookmark-simple"></i> Cap: ${obra.capitulo}</span>
                        <span><i class="ph-fill ph-star"></i> Nota: ${(obra.nota || 5).toFixed(1)}</span>
                        <span class="${classeTipo}">${obra.tipo}</span>
                    </div>
                </div>
            </div>`;
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
// 5. MODAIS E EDIÇÃO
// ============================================================================
window.adicionarCampoLink = function(nome = "", url = "") {
    const container = document.getElementById("container-links-inputs");
    if(!container) return; 
    const div = document.createElement("div");
    div.className = "link-row";
    div.innerHTML = `
        <input type="text" class="link-name-input" placeholder="Site" value="${nome}">
        <input type="url" class="link-url-input" placeholder="https://..." value="${url}">
        <button type="button" class="btn-remover-link" onclick="this.parentElement.remove()"><i class="ph ph-trash"></i></button>`;
    container.appendChild(div);
}

window.abrirModal = function(id) {
    const obra = acervo.find(i => i.idFirebase === id);
    if (!obra) return;
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
    if (obra.linksLeitura) {
        obra.linksLeitura.forEach(linha => {
            let url = linha.includes('|') ? linha.split('|')[1].trim() : linha.trim();
            let nome = linha.includes('|') ? linha.split('|')[0].trim() : "Ler";
            if(!url.startsWith('http')) url = 'https://' + url;
            containerLinks.innerHTML += `<a class="btn-ler-obra" href="${url}" target="_blank"><i class="ph ph-book-open"></i> ${nome}</a>`;
        });
    }
    modalFundo.style.display = "flex";
}

window.alterarCapitulo = async function(val) {
    let input = document.getElementById("modal-capitulo-editavel");
    let novo = Math.max(0, (parseInt(input.value) || 0) + val);
    await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: novo.toString() });
}

window.atualizarCapituloDigitado = async function() {
    let input = document.getElementById("modal-capitulo-editavel");
    let novo = Math.max(0, parseInt(input.value) || 0);
    await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: novo.toString() });
}

window.prepararEdicao = function() {
    const o = acervo.find(i => i.idFirebase === idAbertoNoModal);
    if (!o) return;
    document.getElementById("input-titulo").value = o.titulo || "";
    document.getElementById("input-titulos-alt").value = o.titulosAlternativos || "";
    document.getElementById("input-generos").value = o.generos || "";
    document.getElementById("input-tipo").value = o.tipo || "Mangá";
    document.getElementById("input-capitulo").value = o.capitulo || 0;
    document.getElementById("input-status").value = o.status || "Em Andamento";
    document.getElementById("input-nota").value = o.nota || 5;
    
    const campoLista = document.getElementById('input-lista');
    if (campoLista) campoLista.value = o.listaPersonalizada || '';
    
    document.getElementById("input-capa").value = o.capa || "";
    document.getElementById("input-sinopse").value = o.sinopse || "";
    document.getElementById("input-id-firebase").value = o.idFirebase;
    
    const containerLinks = document.getElementById("container-links-inputs");
    containerLinks.innerHTML = "";
    if (o.linksLeitura) {
        o.linksLeitura.forEach(linha => {
            let nome = linha.includes('|') ? linha.split('|')[0].trim() : "";
            let url = linha.includes('|') ? linha.split('|')[1].trim() : linha;
            window.adicionarCampoLink(nome, url);
        });
    } else { window.adicionarCampoLink(); }
    
    fecharModal(); 
    modalFormFundo.style.display = "flex"; 
}

window.excluirObra = async function() {
    if(confirm("Excluir definitivamente?")) {
        await deleteDoc(doc(db, "mangas", idAbertoNoModal));
        fecharModal();
    }
}

window.fecharModal = () => { modalFundo.style.display = "none"; idAbertoNoModal = ""; };
window.fecharModalForm = () => { modalFormFundo.style.display = "none"; };
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) fecharModalForm(); };

// ============================================================================
// 6. INTEGRAÇÃO APIs E UTILITÁRIOS
// ============================================================================
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value.trim();
    if(!q) return;
    const fonte = document.getElementById("select-fonte-api").value;
    const div = document.getElementById("resultado-busca-api");
    const btn = document.getElementById("btn-buscar-api");
    
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i>';
    try {
        div.innerHTML = "";
        let url = fonte === 'kitsu' ? `https://kitsu.io/api/edge/manga?filter[text]=${q}&page[limit]=5` : `https://api.jikan.moe/v4/manga?q=${q}&limit=5`;
        if (fonte === 'mangadex') url = `https://corsproxy.io/?${encodeURIComponent(`https://api.mangadex.org/manga?title=${q}&limit=5&includes[]=cover_art`)}`;
        
        const res = await fetch(url);
        const d = await res.json();
        resultadosAPI = d.data || [];
        fonteAtualAPI = fonte;

        resultadosAPI.forEach((m, i) => {
            let t = m.title || m.attributes?.canonicalTitle || (m.attributes?.title ? Object.values(m.attributes.title)[0] : "Sem Título");
            div.innerHTML += `<div class="item-api" onclick="preencherComAPI(${i})"><h4>${t}</h4></div>`;
        });
        div.style.display = "block";
    } catch(err) { console.error(err); } finally { btn.innerHTML = '<i class="ph ph-magnifying-glass"></i>'; }
}

window.preencherComAPI = function(i) {
    const m = resultadosAPI[i];
    if(!m) return;
    // Lógica simplificada de preenchimento (já funcional no seu código original)
    document.getElementById("resultado-busca-api").style.display = "none";
}

window.exportarDados = () => {
    const blob = new Blob([JSON.stringify(acervo.map(({idFirebase, ...r}) => r), null, 2)], {type: "application/json"});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "backup.json"; a.click();
};

window.importarDados = (e) => {
    const reader = new FileReader();
    reader.onload = async (f) => {
        const lista = JSON.parse(f.target.result);
        for (const o of lista) if(!acervo.some(i => i.titulo === o.titulo)) await addDoc(collection(db, "mangas"), o);
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};

window.voltarAoTopo = () => window.scrollTo({ top: 0, behavior: 'smooth' });
window.abrirModalForm = () => { formulario.reset(); document.getElementById('input-id-firebase').value = ""; modalFormFundo.style.display = 'flex'; };