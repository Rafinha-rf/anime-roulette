const url = 'https://graphql.anilist.co';

/**
 * Busca todas as listas do usuário e separa por status
 */
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

/**
 * Função principal de busca com suporte ao novo filtro de origem
 */
export async function buscarAnime(genero, scoreMin, scoreMax) {
    const usuario = document.getElementById('user-filter').value.trim();
    const origem = document.getElementById('source-filter')?.value || 'all'; // Pega o novo select
    
    let includeIds = undefined;
    let excludeIds = undefined;

    if (usuario !== "") {
        const listas = await obterListasUsuario(usuario);
        if (listas === null) return null;

        if (origem === "PLANNING") {
            // Se quer Planning, forçamos a busca apenas nesses IDs
            if (listas.planning.length === 0) {
                window.openModal("Lista Vazia", "Sua lista de 'Planning' (Planejando) está vazia no AniList.");
                return null;
            }
            includeIds = listas.planning;
        } else {
            // Se quer Geral, apenas excluímos o que já está na lista dele (Vistos/Planning/etc)
            excludeIds = listas.todos;
        }
    }

    // Query atualizada para suportar inclusão específica (id_in)
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
        in: includeIds,    // Se definido, sorteia APENAS entre esses
        notIn: excludeIds  // Se definido, ignora esses
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
    const animeImg = document.getElementById('anime-img');
    const animeTitle = document.getElementById('anime-title');
    const animeDesc = document.getElementById('anime-desc');
    const animeScore = document.getElementById('anime-score');
    const anilistLink = document.getElementById('anilist-link');

    animeImg.style.backgroundImage = `url('${anime.coverImage.extraLarge}')`;
    animeTitle.innerText = anime.title.romaji;
    animeScore.innerText = (anime.averageScore / 10).toFixed(1);
    animeDesc.innerText = anime.description ? anime.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";

    anilistLink.onclick = () => window.open(anime.siteUrl, '_blank');

    resultCard.classList.remove('opacity-0', 'translate-y-10');
    resultCard.classList.add('opacity-100', 'translate-y-0', 'animate-glow');
}