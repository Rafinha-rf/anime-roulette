const url = 'https://graphql.anilist.co';

async function obterListasUsuario(userName) {
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
            window.openModal("Usuário Inválido", `Não encontramos o perfil "${userName}". Verifique o nick ou a privacidade da conta.`);
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


export async function buscarAnime(genero, scoreMin, scoreMax) {
    const usuario = document.getElementById('user-filter').value.trim();
    const origem = document.getElementById('source-filter')?.value || 'all';
    
    let includeIds = undefined;
    let excludeIds = undefined;

    if (usuario !== "") {
        const listas = await obterListasUsuario(usuario);
        if (listas === null) return null;

        if (origem === "PLANNING") {
           
            if (listas.planning.length === 0) {
                window.openModal("Lista Vazia", "Sua lista de 'Planning' (Planejando) está vazia no AniList.");
                return null;
            }
            includeIds = listas.planning;
        } else {
            
            excludeIds = listas.todos;
        }
    }

    
    const query = `
    query ($genre: String, $min: Int, $max: Int, $in: [Int], $notIn: [Int]) {
      Page(page: 1, perPage: 50) {
        media(genre: $genre, averageScore_greater: $min, averageScore_lesser: $max, id_in: $in, id_not_in: $notIn, type: ANIME, sort: SCORE_DESC) {
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