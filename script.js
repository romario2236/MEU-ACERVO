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

// Nossa lista na memória agora começa vazia e será preenchida pela nuvem
let acervo = [];

// Elementos da Tela
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
let idAbertoNoModal = ""; // Agora precisamos saber o ID real no banco
let resultadosAPI = [];

// === FUNÇÃO PARA CARREGAR OS DADOS DO FIREBASE ===
async function carregarAcervo() {
    conteinerMangas.innerHTML = "<p style='color:#888; text-align:center; width:100%;'>Conectando à nuvem e carregando seu acervo...</p>";
    
    try {
        const querySnapshot = await getDocs(collection(db, "mangas"));
        acervo = []; // Limpa a lista local
        querySnapshot.forEach((doc) => {
            // Guarda o ID que o Firebase gerou junto com os dados da obra
            let obra = doc.data();
            obra.idFirebase = doc.id; 
            acervo.push(obra);
        });
        renderizarMangas(acervo);
    } catch (erro) {
        console.error("Erro ao carregar do Firebase:", erro);
        conteinerMangas.innerHTML = "<p style='color:#e74c3c;'>Erro ao conectar com o Firebase. Verifique se o banco foi criado em 'Modo de Teste'.</p>";
    }
}

// Carrega os dados assim que o site abre
carregarAcervo();

function criarCartaoPoster(obra) {
    let classeStatus = (obra.status === 'Em Andamento') ? 'status-andamento' : 'status-finalizado';
    let classeTipo = '';
    if (obra.tipo === 'Manhwa') classeTipo = 'tipo-manhwa';
    else if (obra.tipo === 'Mangá') classeTipo = 'tipo-manga';
    else classeTipo = 'tipo-novel';

    return `
        <div class="cartao cartao-poster" onclick="abrirModal('${obra.idFirebase}')">
            <div class="moldura-imagem">
                <img src="${obra.capa}" alt="Capa de ${obra.titulo}" class="capa-imagem-poster">
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

barraPesquisa.addEventListener("input", (evento) => {
    const textoDigitado = evento.target.value.toLowerCase();
    const listaFiltrada = acervo.filter(obra => {
        const tituloPrincipal = obra.titulo.toLowerCase();
        const titulosAlt = (obra.titulosAlternativos || "").toLowerCase();
        return tituloPrincipal.includes(textoDigitado) || titulosAlt.includes(textoDigitado);
    });
    renderizarMangas(listaFiltrada);
});

window.abrirModal = function(idSelecionado) {
    const obra = acervo.find(item => item.idFirebase === idSelecionado);
    if (obra) {
        tituloAbertoNoModal = obra.titulo; 
        idAbertoNoModal = obra.idFirebase; 

        modalCapa.src = obra.capa;
        modalTitulo.innerText = obra.titulo;
        modalTipo.innerText = obra.tipo;
        modalTitulosAlt.innerText = obra.titulosAlternativos || "Nenhum";

        modalGeneros.innerHTML = "";
        if (obra.generos) {
            const listaGeneros = obra.generos.split(',');
            listaGeneros.forEach(genero => {
                if(genero.trim() !== "") modalGeneros.innerHTML += `<span class="tag-genero">${genero.trim()}</span>`;
            });
        }

        modalStatus.innerText = obra.status;
        modalCapituloEditavel.value = obra.capitulo;
        modalSinopse.innerText = obra.sinopse;

        containerLinksLeitura.innerHTML = ""; 
        if (obra.linksLeitura && obra.linksLeitura.length > 0) {
            obra.linksLeitura.forEach((link, index) => {
                let nomeBotao = `📖 Ler Opção ${index + 1}`;
                try {
                    const dominio = new URL(link).hostname.replace('www.', '');
                    nomeBotao = `📖 Ler em ${dominio}`;
                } catch(e) {}
                containerLinksLeitura.innerHTML += `<a class="btn-ler-obra" href="${link}" target="_blank">${nomeBotao}</a>`;
            });
        }
        modalFundo.style.display = "flex";
    }
}

window.alterarCapitulo = function(mudanca) {
    let novoValor = (parseInt(modalCapituloEditavel.value) || 0) + mudanca;
    if (novoValor < 0) novoValor = 0; 
    modalCapituloEditavel.value = novoValor;
    salvarCapituloNoAcervo(novoValor);
}

window.atualizarCapituloDigitado = function() {
    let novoValor = parseInt(modalCapituloEditavel.value) || 0;
    if (novoValor < 0) novoValor = 0;
    modalCapituloEditavel.value = novoValor;
    salvarCapituloNoAcervo(novoValor);
}

async function salvarCapituloNoAcervo(novoValor) {
    const index = acervo.findIndex(item => item.idFirebase === idAbertoNoModal);
    if (index !== -1) {
        acervo[index].capitulo = novoValor.toString(); 
        barraPesquisa.dispatchEvent(new Event('input')); 
        
        try {
            const obraRef = doc(db, "mangas", idAbertoNoModal);
            await updateDoc(obraRef, { capitulo: novoValor.toString() });
        } catch (e) {
            console.error("Erro ao atualizar capítulo no banco:", e);
        }
    }
}

window.prepararAdicao = function() {
    formulario.reset(); 
    document.getElementById("input-titulo-original").value = ""; 
    document.getElementById("input-id-firebase").value = ""; 
    document.getElementById("titulo-form").innerText = "Adicionar Nova Obra"; 
    
    document.getElementById("input-busca-api").value = "";
    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("area-busca-api").style.display = "block"; 
    document.getElementById("divisor-api").style.display = "block";
    
    abrirModalForm();
}

window.prepararEdicao = function() {
    const obra = acervo.find(item => item.idFirebase === idAbertoNoModal);
    if (obra) {
        document.getElementById("input-titulo").value = obra.titulo;
        document.getElementById("input-titulos-alt").value = obra.titulosAlternativos || "";
        document.getElementById("input-generos").value = obra.generos || "";
        document.getElementById("input-tipo").value = obra.tipo;
        document.getElementById("input-status").value = obra.status;
        document.getElementById("input-capitulo").value = obra.capitulo;
        document.getElementById("input-nota").value = obra.nota;
        document.getElementById("input-capa").value = obra.capa;
        document.getElementById("input-link-leitura").value = (obra.linksLeitura || []).join('\n');
        document.getElementById("input-sinopse").value = obra.sinopse;

        document.getElementById("input-titulo-original").value = obra.titulo;
        document.getElementById("input-id-firebase").value = obra.idFirebase; 
        document.getElementById("titulo-form").innerText = "Editar Obra";

        document.getElementById("area-busca-api").style.display = "none";
        document.getElementById("divisor-api").style.display = "none";

        fecharModal(); 
        abrirModalForm(); 
    }
}

window.excluirObra = async function() {
    if (confirm(`Tem certeza que deseja excluir "${tituloAbertoNoModal}" do seu acervo?`)) {
        const idParaDeletar = idAbertoNoModal;
        fecharModal();
        
        try {
            await deleteDoc(doc(db, "mangas", idParaDeletar));
            const index = acervo.findIndex(item => item.idFirebase === idParaDeletar);
            if (index !== -1) acervo.splice(index, 1);
            renderizarMangas(acervo);
        } catch (e) {
            alert("Erro ao excluir do banco de dados.");
            console.error(e);
        }
    }
}

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const btnSalvar = formulario.querySelector('.btn-salvar');
    btnSalvar.innerText = "Salvando na Nuvem...";
    btnSalvar.disabled = true;

    const idFirebase = document.getElementById("input-id-firebase").value;
    const titulo = document.getElementById("input-titulo").value.trim();
    const tituloOriginal = document.getElementById("input-titulo-original").value;
    
    if (tituloOriginal === "") {
        if (acervo.some(item => item.titulo.toLowerCase() === titulo.toLowerCase())) {
            alert(`Atenção: A obra "${titulo}" já está adicionada ao seu acervo!`);
            btnSalvar.innerText = "Salvar Obra";
            btnSalvar.disabled = false;
            return;
        }
    } else {
        if (titulo.toLowerCase() !== tituloOriginal.toLowerCase()) {
            if (acervo.some(item => item.titulo.toLowerCase() === titulo.toLowerCase())) {
                alert(`Atenção: Já existe outra obra chamada "${titulo}" no seu acervo!`);
                btnSalvar.innerText = "Salvar Obra";
                btnSalvar.disabled = false;
                return;
            }
        }
    }

    const textoLinks = document.getElementById("input-link-leitura").value;
    const arrayLinks = textoLinks.split('\n').map(link => link.trim()).filter(link => link !== "");

    const obraParaSalvar = {
        titulo: titulo, 
        titulosAlternativos: document.getElementById("input-titulos-alt").value, 
        generos: document.getElementById("input-generos").value, 
        tipo: document.getElementById("input-tipo").value, 
        status: document.getElementById("input-status").value, 
        capitulo: document.getElementById("input-capitulo").value,
        nota: parseFloat(document.getElementById("input-nota").value), 
        capa: document.getElementById("input-capa").value, 
        linksLeitura: arrayLinks, 
        sinopse: document.getElementById("input-sinopse").value
    };

    try {
        if (idFirebase === "") {
            const docRef = await addDoc(collection(db, "mangas"), obraParaSalvar);
            obraParaSalvar.idFirebase = docRef.id; 
            acervo.unshift(obraParaSalvar);
        } else {
            const obraRef = doc(db, "mangas", idFirebase);
            await updateDoc(obraRef, obraParaSalvar);
            const index = acervo.findIndex(item => item.idFirebase === idFirebase);
            if (index !== -1) {
                obraParaSalvar.idFirebase = idFirebase;
                acervo[index] = obraParaSalvar;
            }
        }
        renderizarMangas(acervo); 
        fecharModalForm(); 
    } catch (e) {
        alert("Erro ao salvar no banco de dados.");
        console.error(e);
    } finally {
        btnSalvar.innerText = "Salvar Obra";
        btnSalvar.disabled = false;
    }
});

// === FUNÇÕES DA API (Jikan) ===
window.buscarNaAPI = async function() {
    const textoBusca = document.getElementById("input-busca-api").value;
    const divResultados = document.getElementById("resultado-busca-api");
    const botaoBusca = document.getElementById("btn-buscar-api");

    if(textoBusca.trim() === "") return;
    botaoBusca.innerText = "⏳ Buscando...";
    botaoBusca.disabled = true;

    try {
        const resposta = await fetch(`https://api.jikan.moe/v4/manga?q=${textoBusca}&limit=5`);
        const dados = await resposta.json();
        
        resultadosAPI = dados.data;
        divResultados.innerHTML = "";

        if(resultadosAPI.length === 0) {
            divResultados.innerHTML = "<p style='padding:10px; color:#aaa; font-size:13px;'>Nenhuma obra encontrada.</p>";
        } else {
            resultadosAPI.forEach((manga, index) => {
                let tipo = manga.type || "Mangá";
                let ano = manga.published?.prop?.from?.year || "N/A";
                let tituloIngles = manga.title_english ? manga.title_english : "";
                let tituloJapones = manga.title_japanese ? manga.title_japanese : "";
                let sinonimoPrincipal = manga.title_synonyms && manga.title_synonyms.length > 0 ? manga.title_synonyms[0] : "";
                let listaAlternativos = [tituloIngles, tituloJapones, sinonimoPrincipal].filter(t => t !== "").join(" / ");
                let htmlAlternativos = listaAlternativos ? `<p style="color: #0984e3; font-size: 11px; margin-bottom: 3px;">${listaAlternativos}</p>` : "";
                
                divResultados.innerHTML += `
                    <div class="item-api" onclick="preencherComAPI(${index})">
                        <img src="${manga.images.jpg.image_url}" alt="${manga.title}">
                        <div class="item-api-info">
                            <h4>${manga.title}</h4>
                            ${htmlAlternativos}
                            <p>${tipo} • ${ano}</p>
                        </div>
                    </div>
                `;
            });
        }
        divResultados.style.display = "block";
    } catch (erro) {
        divResultados.innerHTML = "<p style='padding:10px; color:#e74c3c; font-size:13px;'>Erro ao buscar. Tente novamente.</p>";
        divResultados.style.display = "block";
    } finally {
        botaoBusca.innerText = "🔍 Buscar";
        botaoBusca.disabled = false;
    }
}

window.preencherComAPI = function(index) {
    const manga = resultadosAPI[index];
    document.getElementById("input-titulo").value = manga.title || "";
    
    let arrayAlt = [];
    if (manga.title_english) arrayAlt.push(manga.title_english);
    if (manga.title_japanese) arrayAlt.push(manga.title_japanese);
    if (manga.title_synonyms) arrayAlt = arrayAlt.concat(manga.title_synonyms);
    document.getElementById("input-titulos-alt").value = arrayAlt.join(", ");
    
    let listaGeneros = [];
    if(manga.genres) manga.genres.forEach(g => listaGeneros.push(g.name));
    if(manga.themes) manga.themes.forEach(t => listaGeneros.push(t.name));
    document.getElementById("input-generos").value = listaGeneros.join(", ");

    let tipoFormatado = "Mangá";
    if(manga.type === "Manhwa" || manga.type === "Manhua") tipoFormatado = "Manhwa";
    if(manga.type === "Light Novel" || manga.type === "Novel") tipoFormatado = "Novel";
    document.getElementById("input-tipo").value = tipoFormatado;

    let statusFormatado = "Em Andamento";
    if(manga.status === "Finished") statusFormatado = "Finalizado";
    if(manga.status === "On Hiatus" || manga.status === "Discontinued") statusFormatado = "Hiato";
    document.getElementById("input-status").value = statusFormatado;

    document.getElementById("input-capitulo").value = manga.chapters || 0;
    document.getElementById("input-nota").value = manga.score ? (manga.score / 2).toFixed(1) : 0;
    document.getElementById("input-capa").value = manga.images.jpg.large_image_url || manga.images.jpg.image_url || "";
    
    let sinopse = manga.synopsis || "";
    sinopse = sinopse.replace("[Written by MAL Rewrite]", "").trim();
    document.getElementById("input-sinopse").value = sinopse;

    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("input-busca-api").value = "";
}

window.abrirModalForm = function() { modalFormFundo.style.display = "flex"; }
window.fecharModalForm = function() { modalFormFundo.style.display = "none"; }
window.fecharModalFormPeloFundo = function(evento) { if (evento.target === modalFormFundo) window.fecharModalForm(); }
window.fecharModal = function() { modalFundo.style.display = "none"; }
window.fecharModalPeloFundo = function(evento) { if (evento.target === modalFundo) window.fecharModal(); }
window.filtrarPorTipo = function(tipoSelecionado) {
    if (tipoSelecionado === 'Todos') { renderizarMangas(acervo); } 
    else { const listaFiltrada = acervo.filter(obra => obra.tipo === tipoSelecionado); renderizarMangas(listaFiltrada); }
}