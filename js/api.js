const url = 'https://graphql.anilist.co';
import { translations } from './languages.js';

async function obterDadosUsuarioIndividual(userName) {
    const query = `
    query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists {
          status
          entries {
            mediaId
          }
        }
      }
    }`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { userName } })
        });
        const data = await response.json();

        if (data.errors || !data.data || !data.data.MediaListCollection) {
            return null;
        }

        const planningIds = [];
        const todosIdsNaLista = [];

        data.data.MediaListCollection.lists.forEach(list => {
            list.entries.forEach(entry => {
                todosIdsNaLista.push(entry.mediaId);
                if (list.status === "PLANNING") {
                    planningIds.push(entry.mediaId);
                }
            });
        });

        return { planning: planningIds, todos: todosIdsNaLista };
    } catch (e) {
        return null;
    }
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


    return {
        planning: [...new Set(planningCombinado)],
        todos: [...new Set(todosCombinados)]
    };
}


export async function buscarAnime(genero, scoreMin, scoreMax) {
    const usuarioInput = document.getElementById('user-filter').value.trim();
    const origem = document.getElementById('source-filter')?.value || 'all';
    const lang = localStorage.getItem('preferred_lang') || 'pt';
    const t = translations[lang];

    let includeIds = undefined;
    let excludeIds = undefined;

    if (usuarioInput !== "") {

        const listas = await obterListasMultiplosUsuarios(usuarioInput);
        if (listas === null) return null;

        if (origem === "PLANNING") {
            if (listas.planning.length === 0) {
                window.openModal(t.errorEmptyListTitle, t.errorEmptyListMsg);
                return null;
            }
            includeIds = listas.planning;
        } else {
            excludeIds = listas.todos;
        }
    }

    const query = `
    query ($page: Int, $genre: String, $min: Int, $max: Int, $in: [Int], $notIn: [Int]) {
    Page(page: $page, perPage: 50) { 
        media(
        genre: $genre, 
        averageScore_greater: $min, 
        averageScore_lesser: $max, 
        id_in: $in, 
        id_not_in: $notIn, 
        type: ANIME, 
        sort: ID_DESC,
        format_not_in: [MUSIC]
        ) {
        id
        title { romaji }
        description
        coverImage { extraLarge }
        averageScore
        siteUrl
        }
    }
    }`;

    const variables = {
        page: Math.floor(Math.random() * 5) + 1,
        genre: genero || undefined,
        min: parseInt(scoreMin) * 10,
        max: parseInt(scoreMax) * 10,
        in: includeIds,
        notIn: excludeIds
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        const data = await response.json();
        const lista = data.data.Page.media;
        return lista && lista.length > 0 ? lista[Math.floor(Math.random() * lista.length)] : null;
    } catch (error) {
        return null;
    }
}


export function atualizarInterface(anime) {
    if (!anime) return;
    const resultCard = document.getElementById('result-card');
    const imgTag = document.getElementById('anime-img-tag');

    if (imgTag && anime.coverImage) {
        imgTag.src = anime.coverImage.extraLarge || anime.coverImage.large;
    }

    document.getElementById('anime-title').innerText = anime.title.romaji;
    document.getElementById('anime-score').innerText = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "0.0";
    
    const desc = document.getElementById('anime-desc');
    desc.innerText = anime.description ? anime.description.replace(/<[^>]*>?/gm, '') : "";
    desc.scrollTop = 0; 

    document.getElementById('anilist-link').onclick = () => window.open(anime.siteUrl, '_blank');

    if (resultCard) {
        resultCard.classList.remove('hidden');
        resultCard.style.display = 'flex';
        
        setTimeout(() => {
            resultCard.classList.remove('opacity-0', 'translate-y-10');
            resultCard.classList.add('opacity-100', 'translate-y-0', 'animate-glow');
        }, 50);
    }
}