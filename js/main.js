import { buscarAnime, atualizarInterface } from './api.js';
import { translations } from './languages.js';


window.setLanguage = function(lang) {
    localStorage.setItem('preferred_lang', lang);
    applyLanguage(lang);
}

window.openModal = function(titulo, mensagem) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-message').innerText = mensagem;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeModal = function() {
    const modal = document.getElementById('custom-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function applyLanguage(lang) {
    const t = translations[lang];
    

    document.querySelector('h1').innerText = t.title;
    document.querySelector('header p').innerText = t.subtitle;
    document.getElementById('spin-button').querySelector('span').innerText = t.spinBtn;
    

    const labels = document.querySelectorAll('label');
    if(labels.length >= 5) {
        labels[0].innerText = t.userLabel;
        labels[1].innerText = t.sourceLabel;
        labels[2].innerText = t.genreLabel;
        labels[3].innerText = t.scoreMin;
        labels[4].innerText = t.scoreMax;
    }


    document.getElementById('user-filter').placeholder = lang === 'pt' ? 'Nick AniList' : 'AniList Nick';

    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
        const label = lang === 'pt' ? "Limpar" : "Clear All";
        clearBtn.innerHTML = `<span class="material-symbols-outlined text-sm">delete_sweep</span> ${label}`;
    }
    
    const historyTitle = document.querySelector('#history-section h2');
    if (historyTitle) {
        historyTitle.innerText = lang === 'pt' ? "Sorteios Recentes" : "Recent Spins";
    }

    const sourceSelect = document.getElementById('source-filter');
    sourceSelect.options[0].text = t.sourceGlobal;
    sourceSelect.options[1].text = t.sourcePlanning;

    const genreSelect = document.getElementById('genre-filter');
    genreSelect.options[0].text = t.any;


    const detailsBtn = document.getElementById('anilist-link');
    if (detailsBtn) {

        const icon = detailsBtn.querySelector('.material-symbols-outlined');
        detailsBtn.innerText = t.detailsBtn + " ";
        if(icon) detailsBtn.appendChild(icon);
    }
}


document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('clear-history').addEventListener('click', () => {

        localStorage.removeItem('anime_history');
        
        renderizarHistorico();
    
        console.log("Histórico limpo!");
    });


    const savedLang = localStorage.getItem('preferred_lang') || 'pt';
    applyLanguage(savedLang);

    renderizarHistorico();


    const spinBtn = document.getElementById('spin-button');
    const wheel = document.getElementById('wheel');
    const resultCard = document.getElementById('result-card');
    let currentRotation = 0;

    if (!spinBtn) return;

    spinBtn.addEventListener('click', async () => {

        const lang = localStorage.getItem('preferred_lang') || 'pt';
        const t = translations[lang];

        const sMin = document.getElementById('score-min').value;
        const sMax = document.getElementById('score-max').value;
        const genero = document.getElementById('genre-filter').value;


        if (parseInt(sMin) > parseInt(sMax)) {
            const erroTitulo = lang === 'pt' ? "Erro de Filtro" : "Filter Error";
            const erroMsg = lang === 'pt' ? "A nota mínima não pode ser maior que a máxima." : "Min score cannot be higher than max score.";
            window.openModal(erroTitulo, erroMsg);
            return;
        }

        spinBtn.disabled = true;
        const anime = await buscarAnime(genero, sMin, sMax);

        if (!anime) {
            spinBtn.disabled = false;
            const erroTitulo = lang === 'pt' ? "Nenhum anime encontrado" : "No anime found";
            const erroMsg = lang === 'pt' 
                ? "Não encontramos nada com esses filtros. Tente mudar o gênero ou buscar no catálogo geral!" 
                : "We couldn't find anything with these filters. Try changing the genre or searching the general catalog!";
            
            window.openModal(erroTitulo, erroMsg);
            spinBtn.disabled = false;
            return;
        }

        currentRotation += Math.floor(Math.random() * 360) + 1440;
        wheel.style.transform = `rotate(${currentRotation}deg)`;
        

        resultCard.classList.add('opacity-0', 'translate-y-10');

        setTimeout(() => {
            if (anime) {
                if (typeof confetti === 'function') {
                    const duration = 3 * 1000;
                    const end = Date.now() + duration;

                    (function frame() {
                        confetti({
                            particleCount: 2,
                            angle: 60,
                            spread: 55,
                            origin: { x: 0 },
                            colors: ['#8b5cf6', '#ffffff']
                        });
                        confetti({
                            particleCount: 2,
                            angle: 120,
                            spread: 55,
                            origin: { x: 1 },
                            colors: ['#8b5cf6', '#ffffff']
                        });

                        if (Date.now() < end) requestAnimationFrame(frame);
                    }());
                }

                wheel.classList.add('wheel-flash');
                atualizarInterface(anime);

                salvarNoHistorico(anime);
                
                setTimeout(() => wheel.classList.remove('wheel-flash'), 500);
            }
            spinBtn.disabled = false;
        }, 4000);
    });
});

function salvarNoHistorico(anime) {
    let historico = JSON.parse(localStorage.getItem('anime_history')) || [];
    
    const notaFormatada = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "??";

    const novoItem = {
        id: anime.id,
        title: anime.title.romaji,
        
        cover: anime.coverImage.extraLarge || anime.coverImage.large,
        url: anime.siteUrl,
        score: notaFormatada
    };

    historico = historico.filter(item => item.id !== anime.id);
    historico.unshift(novoItem);
    historico = historico.slice(0, 5);

    localStorage.setItem('anime_history', JSON.stringify(historico));
    renderizarHistorico();
}

function renderizarHistorico() {
    const container = document.getElementById('history-list');
    const historico = JSON.parse(localStorage.getItem('anime_history')) || [];
    const lang = localStorage.getItem('preferred_lang') || 'pt';

    if (historico.length === 0) {
        container.innerHTML = `<p class="text-slate-600 italic text-sm col-span-full">${lang === 'pt' ? 'Nenhum sorteio ainda' : 'No spins yet'}</p>`;
        return;
    }

    container.innerHTML = historico.map(anime => `
        <a href="${anime.url}" target="_blank" class="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-[#16161e] hover:border-primary/50 transition-all shadow-2xl">
            <img src="${anime.cover}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
            
            <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            
            <div class="absolute top-3 right-3 bg-[#00b894] text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg">
                <span class="material-symbols-outlined text-xs fill-current">star</span>
                ${anime.score}
            </div>

            <div class="absolute bottom-4 left-4 right-4">
                <p class="text-xs sm:text-sm text-white font-black uppercase tracking-tight leading-tight line-clamp-2 drop-shadow-md">
                    ${anime.title}
                </p>
            </div>
        </a>
    `).join('');
}