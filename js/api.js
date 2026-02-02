const url = 'https://graphql.anilist.co';
import { translations } from './languages.js';

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
    return { planning: [...new Set(planningCombinado)], todos: [...new Set(todosCombinados)] };
}

export async function buscarAnime(genero, scoreMin, scoreMax) {
    const lang = localStorage.getItem('preferred_lang') || 'pt';
    const t = translations[lang];
    const usuarioInput = document.getElementById('user-filter').value.trim();
    const origem = document.getElementById('source-filter')?.value || 'all';

    let includeIds = null;
    let excludeIds = null;

    if (usuarioInput !== "") {
        const listas = await obterListasMultiplosUsuarios(usuarioInput);
        if (!listas) return "USER_ERROR";

        if (origem === "PLANNING") {
            if (!listas.planning || listas.planning.length === 0) {
                window.openModal(t.errorEmptyListTitle, t.errorEmptyListMsg);
                return "USER_ERROR";
            }

            includeIds = listas.planning.sort(() => 0.5 - Math.random()).slice(0, 50);
        } else { 
            excludeIds = (listas.todos && listas.todos.length > 0) ? listas.todos.slice(0, 100) : null; 
        }
    }

    const paginaSorteada = includeIds ? 1 : Math.floor(Math.random() * 5) + 1;

    const query = `query ($page: Int, $genre: String, $min: Int, $max: Int, $in: [Int], $notIn: [Int]) {
        Page(page: $page, perPage: 50) {
            media(genre: $genre, averageScore_greater: $min, averageScore_lesser: $max, id_in: $in, id_not_in: $notIn, type: ANIME, sort: ID_DESC, format_not_in: [MUSIC]) {
                id title { romaji } description coverImage { extraLarge } averageScore siteUrl
            }
        }
    }`;

    const variables = {
        page: paginaSorteada,
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

        const lista = data.data?.Page?.media;
        
        if (!lista || lista.length === 0) {
            window.openModal(t.errorNotFoundTitle, t.errorNotFoundMsg);
            return null;
        }

        return lista[Math.floor(Math.random() * lista.length)];
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