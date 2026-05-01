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
// 2. VARIÁVEIS DE ESTADO E REFERÊNCIAS DO DOM (TELA)
// ============================================================================
let acervo = [];
let idAbertoNoModal = "";
let resultadosAPI = [];

const conteinerMangas = document.getElementById("lista-mangas");
const barraPesquisa = document.getElementById("barra-pesquisa");
const modalFundo = document.getElementById("modal-fundo");
const modalFormFundo = document.getElementById("modal-form-fundo");
const formulario = document.getElementById("form-nova-obra");

// ============================================================================
// 3. COMUNICAÇÃO COM O BANCO DE DADOS (FIREBASE CRUD)
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
    });
}
carregarAcervo();

window.alterarCapitulo = async function(val) {
    let input = document.getElementById("modal-capitulo-editavel");
    let novo = (parseInt(input.value) || 0) + val;
    if(novo < 0) novo = 0;
    input.value = novo;
    await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: novo.toString() });
}

window.excluirObra = async function() {
    if(confirm("Tem certeza que deseja excluir definitivamente da nuvem?")) {
        await deleteDoc(doc(db, "mangas", idAbertoNoModal));
        fecharModal();
    }
}

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("input-id-firebase").value;
    const btn = formulario.querySelector('.btn-salvar');
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Salvando...';
    
    // Processar os links dinâmicos da nova UI
    const linksArray = [];
    document.querySelectorAll('.link-row').forEach(row => {
        const nome = row.querySelector('.link-name-input').value.trim();
        const url = row.querySelector('.link-url-input').value.trim();
        
        if (url) {
            if (nome) {
                linksArray.push(`${nome} | ${url}`);
            } else {
                linksArray.push(url);
            }
        }
    });

    const obra = {
        titulo: document.getElementById("input-titulo").value,
        titulosAlternativos: document.getElementById("input-titulos-alt").value,
        generos: document.getElementById("input-generos").value,
        tipo: document.getElementById("input-tipo").value,
        capitulo: document.getElementById("input-capitulo").value,
        status: document.getElementById("input-status").value,
        nota: parseFloat(document.getElementById("input-nota").value) || 5,
        capa: document.getElementById("input-capa").value,
        sinopse: document.getElementById("input-sinopse").value,
        linksLeitura: linksArray
    };
    
    try {
        if (id) {
            await updateDoc(doc(db, "mangas", id), obra);
        } else {
            await addDoc(collection(db, "mangas"), obra);
        }
        fecharModalForm();
    } catch(err) {
        alert("Erro ao salvar no banco de dados!");
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
        
        let iconeStatus = "";
        if(obra.status === 'Em Andamento') iconeStatus = "▶";
        else if(obra.status === 'Finalizado') iconeStatus = "✔";
        else iconeStatus = "⏸";

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
                        <span class="tag-capitulo-poster">Cap. ${obra.capitulo}</span>
                        <span class="tag-nota-poster"><i class="ph-fill ph-star"></i> ${(obra.nota || 5).toFixed(1)}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

window.filtrarPorTipo = (t) => {
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText === t || (t === 'Todos' && btn.innerText === 'Todos')) {
            btn.classList.add('active');
        }
    });
    renderizarMangas(t === 'Todos' ? acervo : acervo.filter(o => o.tipo === t));
};

barraPesquisa.addEventListener("input", (e) => {
    const txt = e.target.value.toLowerCase();
    const filtrado = acervo.filter(o => o.titulo.toLowerCase().includes(txt));
    renderizarMangas(filtrado);
});

// ============================================================================
// 5. CONTROLE DE MODAIS E LINKS DINÂMICOS
// ============================================================================

window.adicionarCampoLink = function(nome = "", url = "") {
    const container = document.getElementById("container-links-inputs");
    const div = document.createElement("div");
    div.className = "link-row";
    div.innerHTML = `
        <input type="text" class="link-name-input" placeholder="Nome (Ex: TMO)" value="${nome}">
        <input type="url" class="link-url-input" placeholder="https://..." value="${url}">
        <button type="button" class="btn-remover-link" onclick="this.parentElement.remove()" title="Remover link">
            <i class="ph ph-x"></i>
        </button>
    `;
    container.appendChild(div);
}

window.abrirModal = function(id) {
    const obra = acervo.find(i => i.idFirebase === id);
    if (obra) {
        idAbertoNoModal = id;
        document.getElementById("modal-capa").src = obra.capa;
        document.getElementById("modal-titulo").innerText = obra.titulo;
        document.getElementById("modal-tipo").innerText = obra.tipo;
        document.getElementById("modal-titulos-alt").innerText = obra.titulosAlternativos || "Nenhum";
        document.getElementById("modal-texto-sinopse").innerText = obra.sinopse;
        document.getElementById("modal-capitulo-editavel").value = obra.capitulo;
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
        
        (obra.linksLeitura || []).forEach(linha => {
            let url = linha.trim();
            let nomeBotao = "Ler";

            if (linha.includes('|')) {
                const partes = linha.split('|');
                nomeBotao = partes[0].trim();
                url = partes[1].trim();
            } else {
                try { nomeBotao = new URL(url).hostname.replace('www.', ''); } catch(e) {}
            }

            if(url && !url.startsWith('http')) url = 'https://' + url;

            containerLinks.innerHTML += `<a class="btn-ler-obra" href="${url}" target="_blank"><i class="ph ph-book-open"></i> ${nomeBotao}</a>`;
        });
        
        modalFundo.style.display = "flex";
    }
}

window.prepararAdicao = function() {
    formulario.reset();
    document.getElementById("input-id-firebase").value = "";
    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("titulo-form").innerText = "Nova Obra";
    
    document.getElementById("container-links-inputs").innerHTML = "";
    window.adicionarCampoLink();
    
    modalFormFundo.style.display = "flex";
}

window.prepararEdicao = function() {
    const o = acervo.find(i => i.idFirebase === idAbertoNoModal);
    if (o) {
        document.getElementById("input-titulo").value = o.titulo;
        document.getElementById("input-titulos-alt").value = o.titulosAlternativos || "";
        document.getElementById("input-generos").value = o.generos;
        document.getElementById("input-tipo").value = o.tipo;
        document.getElementById("input-capitulo").value = o.capitulo;
        document.getElementById("input-status").value = o.status || "Em Andamento";
        document.getElementById("input-nota").value = o.nota || 5;
        document.getElementById("input-capa").value = o.capa;
        document.getElementById("input-sinopse").value = o.sinopse;
        document.getElementById("input-id-firebase").value = o.idFirebase;
        document.getElementById("titulo-form").innerText = "Editar Obra";
        
        const containerLinks = document.getElementById("container-links-inputs");
        containerLinks.innerHTML = "";
        if (o.linksLeitura && o.linksLeitura.length > 0) {
            o.linksLeitura.forEach(linha => {
                let nome = "";
                let url = linha;
                if (linha.includes('|')) {
                    const partes = linha.split('|');
                    nome = partes[0].trim();
                    url = partes[1].trim();
                }
                window.adicionarCampoLink(nome, url);
            });
        } else {
            window.adicionarCampoLink();
        }

        fecharModal();
        modalFormFundo.style.display = "flex";
    }
}

window.fecharModal = () => { modalFundo.style.display = "none"; };
window.fecharModalForm = () => { modalFormFundo.style.display = "none"; };
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) window.fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) window.fecharModalForm(); };

// ============================================================================
// 6. INTEGRAÇÃO COM API EXTERNA (MYANIMELIST / JIKAN)
// ============================================================================
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value;
    const div = document.getElementById("resultado-busca-api");
    const btn = document.getElementById("btn-buscar-api");
    
    if(!q.trim()) return;
    
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Buscando...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`https://api.jikan.moe/v4/manga?q=${q}&limit=5`);
        const d = await res.json();
        resultadosAPI = d.data || [];
        div.innerHTML = "";
        
        if(resultadosAPI.length === 0) {
            div.innerHTML = "<p style='padding:15px; color:#94a3b8;'>Nenhum resultado encontrado.</p>";
        } else {
            resultadosAPI.forEach((m, i) => {
                let ano = m.published?.prop?.from?.year || "N/A";
                let tipo = m.type || "Mangá";
                div.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${i})">
                        <img src="${m.images.jpg.image_url}" alt="${m.title}">
                        <div>
                            <h4>${m.title}</h4>
                            <p>${tipo} • Lançamento: ${ano}</p>
                        </div>
                    </div>`;
            });
        }
        div.style.display = "block";
    } catch(err) {
        div.innerHTML = "<p style='padding:15px; color:#ef4444;'>Erro na conexão com a API.</p>";
        div.style.display = "block";
    } finally {
        btn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Buscar';
        btn.disabled = false;
    }
}

window.preencherComAPI = function(i) {
    const m = resultadosAPI[i];
    
    document.getElementById("input-titulo").value = m.title || "";
    
    let arrayAlt = [];
    if (m.title_english) arrayAlt.push(m.title_english);
    if (m.title_japanese) arrayAlt.push(m.title_japanese);
    if (m.title_synonyms) arrayAlt = arrayAlt.concat(m.title_synonyms);
    document.getElementById("input-titulos-alt").value = arrayAlt.join(", ");
    
    let listaGeneros = [];
    if(m.genres) m.genres.forEach(g => listaGeneros.push(g.name));
    if(m.themes) m.themes.forEach(t => listaGeneros.push(t.name));
    document.getElementById("input-generos").value = listaGeneros.join(", ");

    let tipoFormatado = "Mangá";
    if(m.type === "Manhwa" || m.type === "Manhua") tipoFormatado = "Manhwa";
    if(m.type === "Light Novel" || m.type === "Novel") tipoFormatado = "Novel";
    document.getElementById("input-tipo").value = tipoFormatado;
    
    let statusFormatado = "Em Andamento";
    if(m.status === "Finished") statusFormatado = "Finalizado";
    if(m.status === "On Hiatus" || m.status === "Discontinued") statusFormatado = "Hiato";
    document.getElementById("input-status").value = statusFormatado;
    
    document.getElementById("input-nota").value = m.score ? (m.score / 2).toFixed(1) : 5;

    document.getElementById("input-capitulo").value = m.chapters || 0;
    document.getElementById("input-capa").value = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || "";
    
    let sinopse = m.synopsis || "";
    document.getElementById("input-sinopse").value = sinopse.replace("[Written by MAL Rewrite]", "").trim();

    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("input-busca-api").value = "";
}

// ============================================================================
// 7. FERRAMENTAS DE BACKUP (JSON)
// ============================================================================
window.exportarDados = () => {
    const blob = new Blob([JSON.stringify(acervo.map(({idFirebase, ...r}) => r), null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = "backup.json"; 
    a.click();
};

window.importarDados = (e) => {
    const reader = new FileReader();
    reader.onload = async (f) => {
        const lista = JSON.parse(f.target.result);
        for (const o of lista) {
            if(!acervo.some(i => i.titulo === o.titulo)) {
                await addDoc(collection(db, "mangas"), o);
            }
        }
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};