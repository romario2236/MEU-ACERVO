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

// Ativar Cache Offline
enableIndexedDbPersistence(db).catch(() => console.warn("Cache offline desativado."));

let acervo = [];
const conteinerMangas = document.getElementById("lista-mangas");
const barraPesquisa = document.getElementById("barra-pesquisa");
const modalFundo = document.getElementById("modal-fundo");
const modalFormFundo = document.getElementById("modal-form-fundo");
const formulario = document.getElementById("form-nova-obra");

let idAbertoNoModal = "";
let resultadosAPI = [];

// Ouvinte em Tempo Real
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

// Funções Globais (window.)
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
            containerLinks.innerHTML += `<a class="btn-ler-obra" href="${l}" target="_blank">📖 Ler</a>`;
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
        modalFundo.style.display = "none";
        modalFormFundo.style.display = "flex";
    }
}

window.excluirObra = async function() {
    if(confirm("Excluir definitivamente?")) {
        await deleteDoc(doc(db, "mangas", idAbertoNoModal));
        modalFundo.style.display = "none";
    }
}

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("input-id-firebase").value;
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
    if (id) await updateDoc(doc(db, "mangas", id), obra);
    else await addDoc(collection(db, "mangas"), obra);
    modalFormFundo.style.display = "none";
});

// Busca API Jikan
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value;
    const res = await fetch(`https://api.jikan.moe/v4/manga?q=${q}&limit=5`);
    const d = await res.json();
    resultadosAPI = d.data || [];
    const div = document.getElementById("resultado-busca-api");
    div.innerHTML = "";
    resultadosAPI.forEach((m, i) => {
        div.innerHTML += `<div class="item-api" onclick="preencherComAPI(${i})"><img src="${m.images.jpg.image_url}"><h4>${m.title}</h4></div>`;
    });
    div.style.display = "block";
}

window.preencherComAPI = function(i) {
    const m = resultadosAPI[i];
    document.getElementById("input-titulo").value = m.title;
    document.getElementById("input-capa").value = m.images.jpg.large_image_url;
    document.getElementById("input-sinopse").value = m.synopsis;
    document.getElementById("resultado-busca-api").style.display = "none";
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

// Filtros e Fechar Modais corrigidos
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