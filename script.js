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

let acervo = [];
const conteinerMangas = document.getElementById("lista-mangas");
const barraPesquisa = document.getElementById("barra-pesquisa");
const modalFundo = document.getElementById("modal-fundo");
const modalFormFundo = document.getElementById("modal-form-fundo");
const formulario = document.getElementById("form-nova-obra");

let idAbertoNoModal = "";
let resultadosAPI = [];

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

function renderizarMangas(lista) {
    conteinerMangas.innerHTML = "";
    document.getElementById("contador-total").innerHTML = `<i class="ph ph-books"></i> ${lista.length} obras`;
    lista.forEach(obra => {
        let classeTipo = (obra.tipo === 'Manhwa') ? 'tipo-manhwa' : (obra.tipo === 'Mangá' ? 'tipo-manga' : 'tipo-novel');
        conteinerMangas.innerHTML += `
            <div class="cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
                <div class="moldura-imagem">
                    <img src="${obra.capa}" loading="lazy">
                    <span class="tag-status">${obra.status}</span>
                    <span class="tag-tipo-poster">${obra.tipo}</span>
                    <span class="tag-capitulo">Cap. ${obra.capitulo}</span>
                </div>
                <h3 class="titulo-poster">${obra.titulo}</h3>
            </div>
        `;
    });
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
        document.getElementById("modal-status").innerText = obra.status;
        
        const containerLinks = document.getElementById("container-links-leitura");
        containerLinks.innerHTML = "";
        (obra.linksLeitura || []).forEach(l => {
            containerLinks.innerHTML += `<a class="btn-ler-obra" href="${l}" target="_blank"><i class="ph ph-book-open"></i> Ler Opção</a>`;
        });
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

window.prepararAdicao = function() {
    formulario.reset();
    document.getElementById("input-id-firebase").value = "";
    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("titulo-form").innerText = "Nova Obra";
    modalFormFundo.style.display = "flex";
}

window.prepararEdicao = function() {
    const o = acervo.find(i => i.idFirebase === idAbertoNoModal);
    if (o) {
        document.getElementById("input-titulo").value = o.titulo;
        document.getElementById("input-generos").value = o.generos;
        document.getElementById("input-tipo").value = o.tipo;
        document.getElementById("input-capitulo").value = o.capitulo;
        document.getElementById("input-capa").value = o.capa;
        document.getElementById("input-sinopse").value = o.sinopse;
        document.getElementById("input-link-leitura").value = (o.linksLeitura || []).join('\n');
        document.getElementById("input-id-firebase").value = o.idFirebase;
        document.getElementById("titulo-form").innerText = "Editar Obra";
        modalFundo.style.display = "none";
        modalFormFundo.style.display = "flex";
    }
}

window.excluirObra = async function() {
    if(confirm("Excluir definitivamente da nuvem?")) {
        await deleteDoc(doc(db, "mangas", idAbertoNoModal));
        modalFundo.style.display = "none";
    }
}

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("input-id-firebase").value;
    const btn = formulario.querySelector('.btn-salvar');
    btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Salvando...';
    
    const obra = {
        titulo: document.getElementById("input-titulo").value,
        generos: document.getElementById("input-generos").value,
        tipo: document.getElementById("input-tipo").value,
        capitulo: document.getElementById("input-capitulo").value,
        capa: document.getElementById("input-capa").value,
        sinopse: document.getElementById("input-sinopse").value,
        linksLeitura: document.getElementById("input-link-leitura").value.split('\n').filter(l => l.trim()),
        status: "Em Andamento", nota: 5
    };
    
    try {
        if (id) await updateDoc(doc(db, "mangas", id), obra);
        else await addDoc(collection(db, "mangas"), obra);
        modalFormFundo.style.display = "none";
    } catch(err) {
        alert("Erro ao salvar!");
    } finally {
        btn.innerHTML = '<i class="ph ph-cloud-arrow-up"></i> Salvar na Nuvem';
    }
});

// === BUSCA API JIKAN (CORRIGIDA E COMPLETA) ===
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

// === PREENCHIMENTO AUTOMÁTICO (CORRIGIDO) ===
window.preencherComAPI = function(i) {
    const m = resultadosAPI[i];
    
    // Título
    document.getElementById("input-titulo").value = m.title || "";
    
    // Gêneros
    let listaGeneros = [];
    if(m.genres) m.genres.forEach(g => listaGeneros.push(g.name));
    if(m.themes) m.themes.forEach(t => listaGeneros.push(t.name));
    document.getElementById("input-generos").value = listaGeneros.join(", ");

    // Conversão de Tipo
    let tipoFormatado = "Mangá";
    if(m.type === "Manhwa" || m.type === "Manhua") tipoFormatado = "Manhwa";
    if(m.type === "Light Novel" || m.type === "Novel") tipoFormatado = "Novel";
    document.getElementById("input-tipo").value = tipoFormatado;

    // Capítulos
    document.getElementById("input-capitulo").value = m.chapters || 0;
    
    // Capa (Pega a maior resolução possível)
    document.getElementById("input-capa").value = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || "";
    
    // Sinopse (Limpa aquela mensagem padrão do MyAnimeList)
    let sinopse = m.synopsis || "";
    sinopse = sinopse.replace("[Written by MAL Rewrite]", "").trim();
    document.getElementById("input-sinopse").value = sinopse;

    // Esconde a lista e limpa a busca
    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("input-busca-api").value = "";
}

// Backup JSON
window.exportarDados = () => {
    const blob = new Blob([JSON.stringify(acervo.map(({idFirebase, ...r}) => r), null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "backup.json"; a.click();
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

// Filtros e Fechar Modais
window.filtrarPorTipo = (t) => {
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText === t || (t === 'Todos' && btn.innerText === 'Todos')) {
            btn.classList.add('active');
        }
    });
    renderizarMangas(t === 'Todos' ? acervo : acervo.filter(o => o.tipo === t));
};

window.fecharModal = () => { modalFundo.style.display = "none"; };
window.fecharModalForm = () => { modalFormFundo.style.display = "none"; };
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) window.fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) window.fecharModalForm(); };