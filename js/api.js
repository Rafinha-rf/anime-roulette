const url = 'https://graphql.anilist.co';
import { translations } from './languages.js';

const CACHE_EXPIRATION_MS = 10 * 60 * 1000;
const GLOBAL_CACHE_KEY = 'cache_busca_global';

async function obterDadosUsuarioIndividual(nome) {
    const query =`query ($userName: String) {
        MediaListCollection(userName: $userName, type: ANIME) {
            lists {
                status
                entries {
                    mediaId
                    media { countryOfOrigin }
                }
            }
        }
    }`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { userName: nome } })
        });

        const data = await response.json();
        if (!data.data) return null;

        const dados = { planning: [], todos: [] };

        data.data.MediaListCollection.lists.forEach(lista => {
            lista.entries.forEach(entry => {
                const info = { 
                    id: entry.mediaId, 
                    country: entry.media.countryOfOrigin 
                };
                
                dados.todos.push(info);
                if (lista.status === 'PLANNING') {
                    dados.planning.push(info);
                }
            });
        });

        return dados;
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

    const removerDuplicados = (arr) => {
        const uniqueIds = new Set();
        return arr.filter(item => {
            if (uniqueIds.has(item.id)) return false;
            uniqueIds.add(item.id);
            return true;
        });
    };

    const resultadoFinal = { 
        planning: removerDuplicados(planningCombinado), 
        todos: removerDuplicados(todosCombinados) 
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
    const esconderAdulto = document.getElementById('nsfw-filter')?.checked ?? true;
    const paisAtual = document.getElementById('country-filter')?.value || undefined;

    if (tentativas > 5) {
        window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
        return null;
    }

    if (usuarioInput === "") {
        const cachedGlobal = localStorage.getItem(GLOBAL_CACHE_KEY);
        if (cachedGlobal) {
            const { timestamp, data, filters } = JSON.parse(cachedGlobal);
            const mesmosFiltros = 
                filters.genre === genero && 
                filters.min === scoreMin && 
                filters.max === scoreMax && 
                filters.nsfw === esconderAdulto && 
                filters.country === paisAtual;

            if (mesmosFiltros && (Date.now() - timestamp < 5 * 60 * 1000)) {
                return data[Math.floor(Math.random() * data.length)];
            }
        }
    }

    let includeIds = null;
    let excludeIds = null;
    let listaCompletaJaVistosIds = [];

    if (usuarioInput !== "") {
        const listas = await obterListasMultiplosUsuarios(usuarioInput);
        if (!listas) return "USER_ERROR";

        listaCompletaJaVistosIds = listas.todos.map(item => item.id);

        if (origem === "PLANNING") {
            const planningFiltrado = listas.planning
                .filter(item => !paisAtual || item.country === paisAtual)
                .map(item => item.id);

            if (planningFiltrado.length === 0) {
                window.openModal(t.errorEmptyListTitle, t.errorEmptyListMsg);
                return "USER_ERROR";
            }
            
            includeIds = planningFiltrado.sort(() => 0.5 - Math.random()).slice(0, 50);
        } else {
            const idsParaIgnorarNoServidor = listas.todos
                .filter(item => !paisAtual || item.country === paisAtual)
                .map(item => item.id)
                .slice(0, 100);

            excludeIds = idsParaIgnorarNoServidor.length > 0 ? idsParaIgnorarNoServidor : undefined;
        }
    }

    const notaMuitoAlta = parseInt(scoreMin) >= 9;
    const paginaInicial = (includeIds || notaMuitoAlta) ? 1 : Math.floor(Math.random() * 5) + 1;
    const paginaFinal = paginaInicial + tentativas;

    const query = `query ($page: Int, $genre: String, $min: Int, $max: Int, $in: [Int], $notIn: [Int], $isAdult: Boolean, $country: CountryCode) {
        Page(page: $page, perPage: 50) {
            media(genre: $genre, averageScore_greater: $min, averageScore_lesser: $max, id_in: $in, id_not_in: $notIn, isAdult: $isAdult, countryOfOrigin: $country, type: ANIME, sort: ID_DESC, format_not_in: [MUSIC]) {
                id title { romaji } description coverImage { extraLarge large } averageScore siteUrl
            }
        }
    }`;

    const variables = {
        page: paginaFinal,
        genre: genero || undefined,
        min: parseInt(scoreMin) * 10,
        max: parseInt(scoreMax) * 10,
        isAdult: esconderAdulto ? false : undefined,
        country: paisAtual
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
        if (data.errors) return "USER_ERROR"; 

        let listaBruta = data.data?.Page?.media || [];

        if (listaBruta.length === 0 && variables.genre && (paisAtual === 'CN' || paisAtual === 'KR')) {
            const fallbackVariables = { ...variables };
            delete fallbackVariables.genre;
            
            const responseFallback = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ query, variables: fallbackVariables }) 
            });
            const dataFallback = await responseFallback.json();
            listaBruta = dataFallback.data?.Page?.media || [];
        }

        if (listaBruta.length === 0) {
            if (tentativas < 5 && !includeIds) {
                return await buscarAnime(genero, scoreMin, scoreMax, tentativas + 1);
            }
            window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
            return null;
        }

        let listaFiltrada = listaBruta.filter(anime => {
            const notaMinimaReal = listaBruta.length < 5 ? 0 : parseInt(scoreMin) * 10;
            return (anime.averageScore || 0) >= notaMinimaReal && !listaCompletaJaVistosIds.includes(anime.id);
        });

        if (listaFiltrada.length === 0) {
            if (includeIds) {
                listaFiltrada = listaBruta;
            } else if (tentativas < 5) {
                return await buscarAnime(genero, scoreMin, scoreMax, tentativas + 1);
            } else {
                window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
                return null;
            }
        }

        if (usuarioInput === "") {
            localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                filters: { genre: genero, min: scoreMin, max: scoreMax, nsfw: esconderAdulto, country: paisAtual || "" },
                data: listaFiltrada
            }));
        }

        return listaFiltrada[Math.floor(Math.random() * listaFiltrada.length)];

    } catch (error) { return "USER_ERROR"; }
}

export function atualizarInterface(anime) {
    if (!anime) return;
    
    const resultCard = document.getElementById('result-card');
    const imgTag = document.getElementById('anime-img-tag');
    const infoContent = document.getElementById('anime-info-content');
    const placeholderIcon = document.getElementById('placeholder-icon');
    const placeholderText = document.getElementById('placeholder-text');
    const mysteryOverlay = document.getElementById('mystery-overlay');
    const contentLayout = document.getElementById('content-layout');


    if (placeholderIcon) placeholderIcon.classList.add('hidden');
    if (placeholderText) placeholderText.classList.add('hidden');
    if (imgTag) imgTag.classList.remove('hidden');
    if (infoContent) infoContent.classList.remove('hidden');

    if (imgTag && anime.coverImage) {
        imgTag.src = anime.coverImage.extraLarge || anime.coverImage.large;
    }

    if (mysteryOverlay) {   
        mysteryOverlay.classList.add('opacity-0', 'pointer-events-none'); 
    }

    if (contentLayout) {
        contentLayout.classList.remove('hidden');
        requestAnimationFrame(() => {
            contentLayout.classList.remove('opacity-0');
        });
    }

    document.getElementById('anime-title').innerText = anime.title.romaji;
    document.getElementById('anime-score').innerText = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "0.0";
    
    const desc = document.getElementById('anime-desc');
    desc.innerText = anime.description ? anime.description.replace(/<[^>]*>?/gm, '') : "";
    desc.scrollTop = 0;
    
    const detailsBtn = document.getElementById('anilist-link');
    detailsBtn.classList.add('animate-pulse-purple');
    detailsBtn.onclick = () => {
        detailsBtn.classList.remove('animate-pulse-purple');
        window.open(anime.siteUrl, '_blank');
    };

    resultCard.classList.remove('opacity-100', 'translate-y-0', 'animate-glow', 'border-primary/50', 'shadow-primary/20');
    resultCard.classList.add('opacity-0', 'translate-y-4', 'border-white/10');

    requestAnimationFrame(() => {
        setTimeout(() => {
            resultCard.classList.remove('opacity-0', 'translate-y-4', 'border-white/10');
            
            resultCard.classList.add(
                'opacity-100',
                'translate-y-0',
                'animate-glow',
                'border-primary/50',
                'shadow-2xl'
            );
        }, 50);
    });
}