// === IMPORTAÇÕES DO FIREBASE (Via CDN) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === AS SUAS CONFIGURAÇÕES REAIS DO FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyAH-7clKFuTdisyN4fNxGd1JTicX3ZWJnw",
  authDomain: "meu-acervo-b8eaf.firebaseapp.com",
  projectId: "meu-acervo-b8eaf",
  storageBucket: "meu-acervo-b8eaf.firebasestorage.app",
  messagingSenderId: "397695115084",
  appId: "1:397695115084:web:13b5ffc8ca61e1fe7879e9",
  measurementId: "G-CE6CSXTGMN"
};

// Inicializa o Firebase e o Banco de Dados (Firestore)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let acervo = [];
const conteinerMangas = document.getElementById("lista-mangas");
const barraPesquisa = document.getElementById("barra-pesquisa");
const contadorTotal = document.getElementById("contador-total"); 
const modalFundo = document.getElementById("modal-fundo");
const modalCapa = document.getElementById("modal-capa");
const modalTitulo = document.getElementById("modal-titulo");
const modalTipo = document.getElementById("modal-tipo");
const modalTitulosAlt = document.getElementById("modal-titulos-alt"); 
const modalGeneros = document.getElementById("modal-generos"); 
const modalStatus = document.getElementById("modal-status");
const modalCapituloEditavel = document.getElementById("modal-capitulo-editavel"); 
const modalSinopse = document.getElementById("modal-texto-sinopse");
const containerLinksLeitura = document.getElementById("container-links-leitura"); 
const modalFormFundo = document.getElementById("modal-form-fundo");
const formulario = document.getElementById("form-nova-obra");

let tituloAbertoNoModal = "";
let idAbertoNoModal = ""; 
let resultadosAPI = [];

// Carregar do Firebase
async function carregarAcervo() {
    conteinerMangas.innerHTML = "<p style='color:#888; text-align:center; width:100%;'>Carregando acervo da nuvem...</p>";
    try {
        const querySnapshot = await getDocs(collection(db, "mangas"));
        acervo = []; 
        querySnapshot.forEach((doc) => {
            let obra = doc.data();
            obra.idFirebase = doc.id; 
            acervo.push(obra);
        });
        renderizarMangas(acervo);
    } catch (erro) {
        console.error(erro);
        conteinerMangas.innerHTML = "<p style='color:#e74c3c;'>Erro ao carregar do banco de dados.</p>";
    }
}
carregarAcervo();

function criarCartaoPoster(obra) {
    let classeStatus = (obra.status === 'Em Andamento') ? 'status-andamento' : 'status-finalizado';
    let classeTipo = (obra.tipo === 'Manhwa') ? 'tipo-manhwa' : (obra.tipo === 'Mangá' ? 'tipo-manga' : 'tipo-novel');
    return `
        <div class="cartao cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
            <div class="moldura-imagem">
                <img src="${obra.capa}" class="capa-imagem-poster">
                <span class="tag-status ${classeStatus}">${obra.status}</span>
                <span class="tag-tipo-poster ${classeTipo}">${obra.tipo}</span>
                <span class="tag-capitulo">Cap. ${obra.capitulo}</span>
            </div>
            <h3 class="titulo-poster">${obra.titulo}</h3>
            <div class="metadados-poster">
                <span class="nota-poster"><span class="estrela-dourada">★</span> ${parseFloat(obra.nota).toFixed(1)}</span>
            </div>
        </div>
    `;
}

function renderizarMangas(lista) {
    conteinerMangas.innerHTML = ""; 
    contadorTotal.innerText = `${lista.length} obra${lista.length !== 1 ? 's' : ''}`;
    lista.forEach(obra => { conteinerMangas.innerHTML += criarCartaoPoster(obra); });
}

barraPesquisa.addEventListener("input", (e) => {
    const txt = e.target.value.toLowerCase();
    const filtrado = acervo.filter(o => o.titulo.toLowerCase().includes(txt) || (o.titulosAlternativos || "").toLowerCase().includes(txt));
    renderizarMangas(filtrado);
});

window.abrirModal = function(id) {
    const obra = acervo.find(item => item.idFirebase === id);
    if (obra) {
        tituloAbertoNoModal = obra.titulo; idAbertoNoModal = obra.idFirebase;
        modalCapa.src = obra.capa; modalTitulo.innerText = obra.titulo;
        modalTipo.innerText = obra.tipo; modalTitulosAlt.innerText = obra.titulosAlternativos || "Nenhum";
        modalGeneros.innerHTML = "";
        (obra.generos || "").split(',').forEach(g => { if(g.trim()) modalGeneros.innerHTML += `<span class="tag-genero">${g.trim()}</span>` });
        modalStatus.innerText = obra.status; modalCapituloEditavel.value = obra.capitulo;
        modalSinopse.innerText = obra.sinopse; containerLinksLeitura.innerHTML = ""; 
        (obra.linksLeitura || []).forEach((l, i) => {
            let nome = "📖 Ler Agora";
            try { nome = `📖 Ler em ${new URL(l).hostname.replace('www.', '')}`; } catch(e){}
            containerLinksLeitura.innerHTML += `<a class="btn-ler-obra" href="${l}" target="_blank">${nome}</a>`;
        });
        modalFundo.style.display = "flex";
    }
}

window.alterarCapitulo = async function(mudanca) {
    let valor = (parseInt(modalCapituloEditavel.value) || 0) + mudanca;
    if (valor < 0) valor = 0; 
    modalCapituloEditavel.value = valor;
    const index = acervo.findIndex(i => i.idFirebase === idAbertoNoModal);
    if (index !== -1) {
        acervo[index].capitulo = valor.toString();
        renderizarMangas(acervo);
        await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: valor.toString() });
    }
}

window.atualizarCapituloDigitado = async function() {
    let valor = parseInt(modalCapituloEditavel.value) || 0;
    const index = acervo.findIndex(i => i.idFirebase === idAbertoNoModal);
    if (index !== -1) {
        acervo[index].capitulo = valor.toString();
        renderizarMangas(acervo);
        await updateDoc(doc(db, "mangas", idAbertoNoModal), { capitulo: valor.toString() });
    }
}

window.prepararAdicao = function() {
    formulario.reset(); 
    document.getElementById("input-id-firebase").value = ""; 
    document.getElementById("titulo-form").innerText = "Adicionar Nova Obra"; 
    document.getElementById("resultado-busca-api").style.display = "none";
    abrirModalForm();
}

window.prepararEdicao = function() {
    const o = acervo.find(i => i.idFirebase === idAbertoNoModal);
    if (o) {
        document.getElementById("input-titulo").value = o.titulo;
        document.getElementById("input-titulos-alt").value = o.titulosAlternativos || "";
        document.getElementById("input-generos").value = o.generos || "";
        document.getElementById("input-tipo").value = o.tipo;
        document.getElementById("input-status").value = o.status;
        document.getElementById("input-capitulo").value = o.capitulo;
        document.getElementById("input-nota").value = o.nota;
        document.getElementById("input-capa").value = o.capa;
        document.getElementById("input-link-leitura").value = (o.linksLeitura || []).join('\n');
        document.getElementById("input-sinopse").value = o.sinopse;
        document.getElementById("input-id-firebase").value = o.idFirebase;
        document.getElementById("titulo-form").innerText = "Editar Obra";
        fecharModal(); abrirModalForm(); 
    }
}

window.excluirObra = async function() {
    if (confirm("Excluir obra permanentemente?")) {
        await deleteDoc(doc(db, "mangas", idAbertoNoModal));
        acervo = acervo.filter(i => i.idFirebase !== idAbertoNoModal);
        renderizarMangas(acervo); fecharModal();
    }
}

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("input-id-firebase").value;
    const obra = {
        titulo: document.getElementById("input-titulo").value,
        titulosAlternativos: document.getElementById("input-titulos-alt").value,
        generos: document.getElementById("input-generos").value,
        tipo: document.getElementById("input-tipo").value,
        status: document.getElementById("input-status").value,
        capitulo: document.getElementById("input-capitulo").value,
        nota: parseFloat(document.getElementById("input-nota").value),
        capa: document.getElementById("input-capa").value,
        linksLeitura: document.getElementById("input-link-leitura").value.split('\n').filter(l => l.trim()),
        sinopse: document.getElementById("input-sinopse").value
    };

    if (id === "") {
        const ref = await addDoc(collection(db, "mangas"), obra);
        obra.idFirebase = ref.id; acervo.unshift(obra);
    } else {
        await updateDoc(doc(db, "mangas", id), obra);
        const idx = acervo.findIndex(i => i.idFirebase === id);
        obra.idFirebase = id; acervo[idx] = obra;
    }
    renderizarMangas(acervo); fecharModalForm();
});

// Backup
window.exportarDados = function() {
    const dados = acervo.map(({ idFirebase, ...r }) => r);
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup-acervo.json`;
    a.click(); URL.revokeObjectURL(url);
};

window.importarDados = function(e) {
    const reader = new FileReader();
    reader.onload = async (f) => {
        const lista = JSON.parse(f.target.result);
        for (const o of lista) {
            if (!acervo.some(i => i.titulo === o.titulo)) await addDoc(collection(db, "mangas"), o);
        }
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};

// API
window.buscarNaAPI = async function() {
    const q = document.getElementById("input-busca-api").value;
    const res = await fetch(`https://api.jikan.moe/v4/manga?q=${q}&limit=5`);
    const d = await res.json();
    resultadosAPI = d.data;
    const div = document.getElementById("resultado-busca-api");
    div.innerHTML = "";
    resultadosAPI.forEach((m, i) => {
        div.innerHTML += `<div class="item-api" onclick="preencherComAPI(${i})"><img src="${m.images.jpg.image_url}"><div><h4>${m.title}</h4></div></div>`;
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

window.abrirModalForm = () => modalFormFundo.style.display = "flex";
window.fecharModalForm = () => modalFormFundo.style.display = "none";
window.fecharModal = () => modalFundo.style.display = "none";
window.fecharModalPeloFundo = (e) => { if (e.target === modalFundo) fecharModal(); };
window.fecharModalFormPeloFundo = (e) => { if (e.target === modalFormFundo) fecharModalForm(); };
window.filtrarPorTipo = (t) => {
    const f = (t === 'Todos') ? acervo : acervo.filter(o => o.tipo === t);
    renderizarMangas(f);
};