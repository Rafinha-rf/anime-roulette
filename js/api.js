const url = 'https://graphql.anilist.co';
import { translations } from './languages.js';

const CACHE_EXPIRATION_MS = 10 * 60 * 1000;
const GLOBAL_CACHE_KEY = 'cache_busca_global';

async function obterDadosUsuarioIndividual(userName) {
    const query = `query ($userName: String) { MediaListCollection(userName: $userName, type: ANIME) { lists { status entries { mediaId } } } }`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { userName } })
        });
        const data = await response.json();
        if (data.errors || !data.data?.MediaListCollection) return null;

        const planningIds = [];
        const todosIdsNaLista = [];
        data.data.MediaListCollection.lists.forEach(list => {
            list.entries.forEach(entry => {
                todosIdsNaLista.push(entry.mediaId);
                if (list.status === "PLANNING") planningIds.push(entry.mediaId);
            });
        });
        return { planning: planningIds, todos: todosIdsNaLista };
    } catch (e) { return null; }
}

async function obterListasMultiplosUsuarios(inputNomes) {
    const lang = localStorage.getItem('preferred_lang') || 'pt';
    const t = translations[lang];
    const nomes = inputNomes.split(',').map(n => n.trim()).filter(n => n !== "");
    
    const cacheKey = `cache_listas_${nomes.join('_').toLowerCase()}`;
    

    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
            return data;
        }
    }

    let planningCombinado = [];
    let todosCombinados = [];

    for (const nome of nomes) {
        const dados = await obterDadosUsuarioIndividual(nome);
        if (!dados) {
            window.openModal(t.errorUserTitle, `${t.errorUserMsg} (${nome})`);
            return null;
        }
        planningCombinado = [...planningCombinado, ...dados.planning];
        todosCombinados = [...todosCombinados, ...dados.todos];
    }

    const resultadoFinal = { 
        planning: [...new Set(planningCombinado)], 
        todos: [...new Set(todosCombinados)] 
    };

    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: resultadoFinal
        }));
    } catch (e) {
        Object.keys(localStorage)
            .filter(key => key.startsWith('cache_listas_'))
            .forEach(key => localStorage.removeItem(key));
    }

    return resultadoFinal;
}

export async function buscarAnime(genero, scoreMin, scoreMax, tentativas = 0) {
    const lang = localStorage.getItem('preferred_lang') || 'pt';
    const t = translations[lang];
    const usuarioInput = document.getElementById('user-filter').value.trim();
    const origem = document.getElementById('source-filter')?.value || 'all';

    if (tentativas > 5) {
        window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
        return null;
    }

    if (usuarioInput === "") {
        const cachedGlobal = localStorage.getItem(GLOBAL_CACHE_KEY);
        if (cachedGlobal) {
            const { timestamp, data, filters } = JSON.parse(cachedGlobal);
            const mesmosFiltros = filters.genre === genero && filters.min === scoreMin && filters.max === scoreMax;
            if (mesmosFiltros && (Date.now() - timestamp < 5 * 60 * 1000)) {
                return data[Math.floor(Math.random() * data.length)];
            }
        }
    }

    let includeIds = null;
    let excludeIds = null;
    let listaCompletaJaVistos = [];

    if (usuarioInput !== "") {
        const listas = await obterListasMultiplosUsuarios(usuarioInput);
        if (!listas) return "USER_ERROR";

        listaCompletaJaVistos = listas.todos || [];

        if (origem === "PLANNING") {
            if (!listas.planning || listas.planning.length === 0) {
                window.openModal(t.errorEmptyListTitle, t.errorEmptyListMsg);
                return "USER_ERROR";
            }

            includeIds = listas.planning.sort(() => 0.5 - Math.random()).slice(0, 50);
        } else { 
            excludeIds = listaCompletaJaVistos.slice(0, 100); 
        }
    }

    const notaMuitoAlta = parseInt(scoreMin) >= 9;
    const paginaInicial = (includeIds || notaMuitoAlta) ? 1 : Math.floor(Math.random() * 5) + 1;
    const paginaFinal = paginaInicial + tentativas;

    const query = `query ($page: Int, $genre: String, $min: Int, $max: Int, $in: [Int], $notIn: [Int]) {
        Page(page: $page, perPage: 50) {
            media(genre: $genre, averageScore_greater: $min, averageScore_lesser: $max, id_in: $in, id_not_in: $notIn, type: ANIME, sort: ID_DESC, format_not_in: [MUSIC]) {
                id title { romaji } description coverImage { extraLarge } averageScore siteUrl
            }
        }
    }`;

    const variables = {
        page: paginaFinal,
        genre: genero || undefined,
        min: parseInt(scoreMin) * 10,
        max: parseInt(scoreMax) * 10
    };

    if (includeIds) variables.in = includeIds;
    if (excludeIds) variables.notIn = excludeIds;

    try {
        const response = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ query, variables }) 
        });

        const data = await response.json();

        if (data.errors) {
            console.error("Erro técnico AniList:", data.errors);
            return "USER_ERROR"; 
        }

        const listaBruta = data.data?.Page?.media || [];

        if (listaBruta.length === 0) {
            if (includeIds) {
                window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
                return null;
            }
            if (tentativas < 5) {
                return buscarAnime(genero, scoreMin, scoreMax, tentativas + 1);
            }
            window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
            return null;
        }

        let listaFiltrada = listaBruta.filter(anime => {
            const notaMinimaReal = parseInt(scoreMin) * 10;
            const score = anime.averageScore || 0;
            return score >= notaMinimaReal && !listaCompletaJaVistos.includes(anime.id);
        });

        if (listaFiltrada.length === 0 && includeIds) {
            console.warn("Filtro rigoroso falhou no Planning. Ignorando nota/vistos para garantir resultado.");
            listaFiltrada = listaBruta; 
        }

        if (listaFiltrada.length === 0) {
            if (tentativas < 5) {
                return buscarAnime(genero, scoreMin, scoreMax, tentativas + 1);
            }
            window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
            return null;
        }

        if (usuarioInput === "") {
            localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                filters: { genre: genero, min: scoreMin, max: scoreMax },
                data: listaFiltrada
            }));
        }

        return listaFiltrada[Math.floor(Math.random() * listaFiltrada.length)];

    } catch (error) { 
        console.error("Erro crítico:", error);
        return "USER_ERROR"; 
    }
}

export function atualizarInterface(anime) {
    if (!anime) return;
    const imgTag = document.getElementById('anime-img-tag');
    if (imgTag && anime.coverImage) imgTag.src = anime.coverImage.extraLarge || anime.coverImage.large;

    document.getElementById('anime-title').innerText = anime.title.romaji;
    document.getElementById('anime-score').innerText = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "0.0";
    const desc = document.getElementById('anime-desc');
    desc.innerText = anime.description ? anime.description.replace(/<[^>]*>?/gm, '') : "";
    desc.scrollTop = 0;
    document.getElementById('anilist-link').onclick = () => window.open(anime.siteUrl, '_blank');

    const resultCard = document.getElementById('result-card');
    resultCard.classList.remove('hidden');
    resultCard.style.display = 'flex';
    setTimeout(() => {
        resultCard.classList.remove('opacity-0', 'translate-y-10');
        resultCard.classList.add('opacity-100', 'translate-y-0', 'animate-glow');
    }, 50);
}