import { buscarAnime, atualizarInterface } from './api.js';
import { translations } from './languages.js';

window.setLanguage = function(lang) {
    localStorage.setItem('preferred_lang', lang);
    applyLanguage(lang);
    renderizarHistorico();
}

window.openModal = function(titulo, mensagem) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-message').innerText = mensagem;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeModal = () => document.getElementById('custom-modal').classList.add('hidden');

function applyLanguage(lang) {
    const t = translations[lang];
    document.querySelector('h1').innerText = t.title;
    document.querySelector('header p').innerText = t.subtitle;
    document.getElementById('spin-button').querySelector('span').innerText = t.spinBtn;
    
    const labels = document.querySelectorAll('label');
    labels[0].innerText = t.userLabel;
    labels[1].innerText = t.sourceLabel;
    labels[2].innerText = t.genreLabel;
    labels[3].innerText = t.scoreMin;
    labels[4].innerText = t.scoreMax;

    document.getElementById('user-filter').placeholder = lang === 'pt' ? 'Nick Anilist' : 'Anilist Nick';
    document.getElementById('clear-history').innerHTML = `<span class="material-symbols-outlined text-sm">delete_sweep</span> ${t.clearHistory}`;
    document.querySelector('#history-section h2').innerText = t.historyTitle;

    const sourceSelect = document.getElementById('source-filter');
    sourceSelect.options[0].text = t.sourceGlobal;
    sourceSelect.options[1].text = t.sourcePlanning;
    document.getElementById('genre-filter').options[0].text = t.any;

    const detailsBtn = document.getElementById('anilist-link');
    if (detailsBtn) {
        detailsBtn.innerText = t.detailsBtn + " ";
        const span = document.createElement('span');
        span.className = "material-symbols-outlined text-lg";
        span.innerText = "arrow_outward";
        detailsBtn.appendChild(span);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferred_lang') || 'pt';
    applyLanguage(savedLang);
    renderizarHistorico();

    const spinBtn = document.getElementById('spin-button');
    const wheel = document.getElementById('wheel');
    const resultCard = document.getElementById('result-card');
    let currentRotation = 0;

    spinBtn.addEventListener('click', async () => {
        const lang = localStorage.getItem('preferred_lang') || 'pt';
        const t = translations[lang];
        const sMin = document.getElementById('score-min').value;
        const sMax = document.getElementById('score-max').value;

        if (parseInt(sMin) > parseInt(sMax)) {
            window.openModal(t.errorFilterTitle, t.errorFilterMsg);
            return;
        }

        spinBtn.disabled = true;
        const anime = await buscarAnime(document.getElementById('genre-filter').value, sMin, sMax);

        if (!anime) {
            spinBtn.disabled = false;
            return;
        }

        currentRotation += Math.floor(Math.random() * 360) + 1440;
        wheel.style.transform = `rotate(${currentRotation}deg)`;
        resultCard.classList.add('opacity-0', 'translate-y-10');

        setTimeout(() => {
            wheel.classList.add('wheel-flash');
            atualizarInterface(anime);
            salvarNoHistorico(anime);
            
            if (typeof confetti === 'function') {
                const cores = ['#8b5cf6', '#a78bfa', '#00b894', '#fd79a8', '#0984e3', '#fdcb6e'];
                const duration = 3000;
                const end = Date.now() + duration;
                (function frame() {
                    confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: cores });
                    confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: cores });
                    if (Date.now() < end) requestAnimationFrame(frame);
                }());
            }
            
            spinBtn.disabled = false;
            setTimeout(() => wheel.classList.remove('wheel-flash'), 500);
        }, 4000);
    });

    document.getElementById('clear-history').addEventListener('click', () => {
        localStorage.removeItem('anime_history');
        renderizarHistorico();
    });
});

function renderizarHistorico() {
    const container = document.getElementById('history-list');
    const historico = JSON.parse(localStorage.getItem('anime_history')) || [];
    const t = translations[localStorage.getItem('preferred_lang') || 'pt'];

    if (historico.length === 0) {
        container.innerHTML = `<p class="text-slate-600 italic text-sm col-span-full">${t.noHistory}</p>`;
        return;
    }
    container.innerHTML = historico.map(anime => `
        <a href="${anime.url}" target="_blank" class="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-[#16161e] hover:border-primary/50 transition-all shadow-2xl">
            <img src="${anime.cover}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity">
            <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            <div class="absolute top-3 right-3 bg-[#00b894] text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg">
                <span class="material-symbols-outlined text-xs fill-current">star</span> ${anime.score}
            </div>
            <div class="absolute bottom-4 left-4 right-4">
                <p class="text-xs sm:text-sm text-white font-black uppercase leading-tight line-clamp-2">${anime.title}</p>
            </div>
        </a>`).join('');
}

function salvarNoHistorico(anime) {
    let historico = JSON.parse(localStorage.getItem('anime_history')) || [];
    const novoItem = { id: anime.id, title: anime.title.romaji, cover: anime.coverImage.extraLarge, url: anime.siteUrl, score: (anime.averageScore / 10).toFixed(1) };
    historico = [novoItem, ...historico.filter(item => item.id !== anime.id)].slice(0, 5);
    localStorage.setItem('anime_history', JSON.stringify(historico));
    renderizarHistorico();
}