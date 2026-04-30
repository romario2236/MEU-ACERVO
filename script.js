const acervoPadrao = [
    { 
        titulo: "Solo Leveling", 
        titulosAlternativos: "Na Honjaman Rebeleop, Only I Level Up",
        generos: "Ação, Fantasia, Sistema, Shounen",
        tipo: "Manhwa", capa: "https://placehold.co/300x450/333333/FFFFFF/png?text=Solo+Leveling",
        status: "Finalizado", capitulo: "179", nota: 4.9, 
        linksLeitura: ["https://google.com/search?q=ler+solo+leveling"], 
        sinopse: "Dez anos atrás, o 'Portal' surgiu, conectando o mundo real com o reino da magia e dos monstros."
    },
    { 
        titulo: "Berserk", 
        titulosAlternativos: "Bereseruku",
        generos: "Ação, Fantasia Sombria, Seinen, Tragédia",
        tipo: "Mangá", capa: "https://placehold.co/300x450/333333/FFFFFF/png?text=Berserk",
        status: "Em Andamento", capitulo: "375", nota: 4.8, 
        linksLeitura: [], 
        sinopse: "Guts, conhecido como o Espadachim Negro, busca santuário de forças demoníacas..."
    }
];

let acervo = JSON.parse(localStorage.getItem('meuAcervoMangas')) || acervoPadrao;
function salvarNoNavegador() { localStorage.setItem('meuAcervoMangas', JSON.stringify(acervo)); }

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
let resultadosAPI = [];

function criarCartaoPoster(obra) {
    let classeStatus = (obra.status === 'Em Andamento') ? 'status-andamento' : 'status-finalizado';
    let classeTipo = '';
    if (obra.tipo === 'Manhwa') classeTipo = 'tipo-manhwa';
    else if (obra.tipo === 'Mangá') classeTipo = 'tipo-manga';
    else classeTipo = 'tipo-novel';

    return `
        <div class="cartao cartao-poster" onclick="abrirModal('${obra.titulo}')">
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

renderizarMangas(acervo);

barraPesquisa.addEventListener("input", (evento) => {
    const textoDigitado = evento.target.value.toLowerCase();
    const listaFiltrada = acervo.filter(obra => {
        const tituloPrincipal = obra.titulo.toLowerCase();
        const titulosAlt = (obra.titulosAlternativos || "").toLowerCase();
        return tituloPrincipal.includes(textoDigitado) || titulosAlt.includes(textoDigitado);
    });
    renderizarMangas(listaFiltrada);
});

function filtrarPorTipo(tipoSelecionado) {
    if (tipoSelecionado === 'Todos') { renderizarMangas(acervo); } 
    else { const listaFiltrada = acervo.filter(obra => obra.tipo === tipoSelecionado); renderizarMangas(listaFiltrada); }
}

function abrirModal(tituloSelecionado) {
    const obra = acervo.find(item => item.titulo === tituloSelecionado);
    if (obra) {
        tituloAbertoNoModal = obra.titulo; 
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

function fecharModal() { modalFundo.style.display = "none"; }
function fecharModalPeloFundo(evento) { if (evento.target === modalFundo) fecharModal(); }

function alterarCapitulo(mudanca) {
    let novoValor = (parseInt(modalCapituloEditavel.value) || 0) + mudanca;
    if (novoValor < 0) novoValor = 0; 
    modalCapituloEditavel.value = novoValor;
    salvarCapituloNoAcervo(novoValor);
}
function atualizarCapituloDigitado() {
    let novoValor = parseInt(modalCapituloEditavel.value) || 0;
    if (novoValor < 0) novoValor = 0;
    modalCapituloEditavel.value = novoValor;
    salvarCapituloNoAcervo(novoValor);
}
function salvarCapituloNoAcervo(novoValor) {
    const index = acervo.findIndex(item => item.titulo === tituloAbertoNoModal);
    if (index !== -1) {
        acervo[index].capitulo = novoValor.toString();
        salvarNoNavegador();
        barraPesquisa.dispatchEvent(new Event('input'));
    }
}

function abrirModalForm() { modalFormFundo.style.display = "flex"; }
function fecharModalForm() { modalFormFundo.style.display = "none"; }
function fecharModalFormPeloFundo(evento) { if (evento.target === modalFormFundo) fecharModalForm(); }

function prepararAdicao() {
    formulario.reset(); 
    document.getElementById("input-titulo-original").value = ""; 
    document.getElementById("titulo-form").innerText = "Adicionar Nova Obra"; 
    
    document.getElementById("input-busca-api").value = "";
    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("area-busca-api").style.display = "block"; 
    document.getElementById("divisor-api").style.display = "block";
    
    abrirModalForm();
}

function prepararEdicao() {
    const obra = acervo.find(item => item.titulo === tituloAbertoNoModal);
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
        document.getElementById("titulo-form").innerText = "Editar Obra";

        document.getElementById("area-busca-api").style.display = "none";
        document.getElementById("divisor-api").style.display = "none";

        fecharModal(); 
        abrirModalForm(); 
    }
}

function excluirObra() {
    if (confirm(`Tem certeza que deseja excluir "${tituloAbertoNoModal}" do seu acervo?`)) {
        const index = acervo.findIndex(item => item.titulo === tituloAbertoNoModal);
        if (index !== -1) {
            acervo.splice(index, 1);
            salvarNoNavegador();
            renderizarMangas(acervo);
            fecharModal();
        }
    }
}

async function buscarNaAPI() {
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

function preencherComAPI(index) {
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
    
    let nota = manga.score ? (manga.score / 2).toFixed(1) : 0;
    document.getElementById("input-nota").value = nota;

    document.getElementById("input-capa").value = manga.images.jpg.large_image_url || manga.images.jpg.image_url || "";
    
    let sinopse = manga.synopsis || "";
    sinopse = sinopse.replace("[Written by MAL Rewrite]", "").trim();
    document.getElementById("input-sinopse").value = sinopse;

    document.getElementById("resultado-busca-api").style.display = "none";
    document.getElementById("input-busca-api").value = "";
}

formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();

    // Removemos os espaços extras do início e do fim do título digitado
    const titulo = document.getElementById("input-titulo").value.trim();
    const tituloOriginal = document.getElementById("input-titulo-original").value;
    
    // --- NOVO: TRAVA DE SEGURANÇA CONTRA DUPLICATAS ---
    if (tituloOriginal === "") {
        // Se for uma obra nova, verificamos se o nome já existe no acervo
        const obraJaExiste = acervo.some(item => item.titulo.toLowerCase() === titulo.toLowerCase());
        
        if (obraJaExiste) {
            alert(`Atenção: A obra "${titulo}" já está adicionada ao seu acervo!`);
            return; // O 'return' para a função aqui, impedindo que ela seja salva
        }
    } else {
        // Se for uma edição e o usuário mudou o título, verificamos se o novo nome não pertence a outra obra
        if (titulo.toLowerCase() !== tituloOriginal.toLowerCase()) {
            const obraJaExiste = acervo.some(item => item.titulo.toLowerCase() === titulo.toLowerCase());
            if (obraJaExiste) {
                alert(`Atenção: Já existe outra obra chamada "${titulo}" no seu acervo!`);
                return;
            }
        }
    }
    // ----------------------------------------------------

    const titulosAlt = document.getElementById("input-titulos-alt").value;
    const generos = document.getElementById("input-generos").value;
    const tipo = document.getElementById("input-tipo").value;
    const status = document.getElementById("input-status").value;
    const capitulo = document.getElementById("input-capitulo").value;
    const nota = document.getElementById("input-nota").value;
    const capa = document.getElementById("input-capa").value;
    const sinopse = document.getElementById("input-sinopse").value;

    const textoLinks = document.getElementById("input-link-leitura").value;
    const arrayLinks = textoLinks.split('\n').map(link => link.trim()).filter(link => link !== "");

    if (tituloOriginal === "") {
        const novaObra = {
            titulo: titulo, titulosAlternativos: titulosAlt, generos: generos, 
            tipo: tipo, status: status, capitulo: capitulo,
            nota: parseFloat(nota), capa: capa, linksLeitura: arrayLinks, sinopse: sinopse
        };
        acervo.unshift(novaObra);
    } else {
        const index = acervo.findIndex(item => item.titulo === tituloOriginal);
        if (index !== -1) {
            acervo[index] = {
                titulo: titulo, titulosAlternativos: titulosAlt, generos: generos, 
                tipo: tipo, status: status, capitulo: capitulo,
                nota: parseFloat(nota), capa: capa, linksLeitura: arrayLinks, sinopse: sinopse
            };
        }
    }

    salvarNoNavegador(); 
    renderizarMangas(acervo); 
    fecharModalForm(); 
});