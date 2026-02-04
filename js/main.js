import { buscarAnime, atualizarInterface } from './api.js';
import { translations } from './languages.js';


const somGiro = new Audio('./assets/sounds/roulette-sound.mp3');
somGiro.loop = true;
somGiro.volume = 0.2;

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
    if (!t) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const path = el.getAttribute('data-i18n');
        
       
        const translation = path.split('.').reduce((obj, key) => obj && obj[key], t);

        if (translation) {
            if (el.id === 'spin-button' && el.querySelector('span')) {
                el.querySelector('span').innerText = translation;
            } else {
                el.innerText = translation;
            }
        }
    });

    const userFilter = document.getElementById('user-filter');
    if (userFilter) {
        userFilter.placeholder = lang === 'pt' ? 'Nick AniList' : 'AniList Nick';
    }

    const helpText = document.getElementById('user-help-text');
    if (helpText) helpText.innerText = t.userHelp;

    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
        clearBtn.innerHTML = `<span class="material-symbols-outlined text-sm">delete_sweep</span> ${t.clearHistory}`;
    }

    const detailsBtn = document.getElementById('anilist-link');
    if (detailsBtn) {
        detailsBtn.innerHTML = `${t.detailsBtn} <span class="material-symbols-outlined text-lg">arrow_outward</span>`;
    }

    const sourceSelect = document.getElementById('source-filter');
    if (sourceSelect && sourceSelect.options.length >= 2) {
        sourceSelect.options[0].text = t.sourceGlobal;
        sourceSelect.options[1].text = t.sourcePlanning;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferred_lang') || 'pt';
    applyLanguage(savedLang);
    renderizarHistorico();

    const muteBtn = document.getElementById('mute-btn');
    const muteIcon = document.getElementById('mute-icon');

    let isMuted = localStorage.getItem('audio_muted') === 'true';

    function atualizarEstadoAudio() {
        somGiro.muted = isMuted;
        if (muteIcon) muteIcon.innerText = isMuted ? 'volume_off' : 'volume_up';
        if (muteBtn) muteBtn.classList.toggle('text-slate-500', isMuted);
    }
    
    atualizarEstadoAudio();

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('audio_muted', isMuted);
            atualizarEstadoAudio();
        });
    }


    const nsfwSwitch = document.getElementById('nsfw-filter');
    if (nsfwSwitch) {
        nsfwSwitch.addEventListener('change', () => {
            localStorage.removeItem('cache_busca_global');
            console.log("Filtro NSFW alterado: Cache limpo.");
        });
    }

    const userFilter = document.getElementById('user-filter');
    let debounceTimer;
    if (userFilter) {
        userFilter.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (e.target.value.trim() === "") {
                    localStorage.removeItem('cache_busca_global');
                }
            }, 500);
        });
    }


    const spinBtn = document.getElementById('spin-button');
    const wheel = document.getElementById('wheel');
    const resultCard = document.getElementById('result-card');
    let currentRotation = 0;

    spinBtn.addEventListener('click', async () => {
        const lang = localStorage.getItem('preferred_lang') || 'pt';
        const t = translations[lang];
        const sMin = document.getElementById('score-min').value;
        const sMax = document.getElementById('score-max').value;
        const genero = document.getElementById('genre-filter').value;

        if (parseInt(sMin) > parseInt(sMax)) {
            window.openModal(t.errorFilterTitle, t.errorFilterMsg);
            return;
        }

        const originalContent = spinBtn.innerHTML;

        spinBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-xl">sync</span>`;
        spinBtn.disabled = true;

        const anime = await buscarAnime(genero, sMin, sMax);

        if (anime === "USER_ERROR" || !anime) {
            spinBtn.innerHTML = originalContent;
            spinBtn.disabled = false;
            return;
        }

        wheel.classList.remove('wheel-glow', 'wheel-flash');

        const imgPreloader = new Image();
        imgPreloader.src = anime.coverImage.extraLarge;


        imgPreloader.onload = () => {
            somGiro.currentTime = 0;
            somGiro.play().catch(e => console.warn("Som bloqueado: requer interação."));

            currentRotation += Math.floor(Math.random() * 360) + 1440;
            wheel.style.transform = `rotate(${currentRotation}deg)`;
            

            resultCard.classList.add('opacity-0', 'translate-y-10');

            setTimeout(() => {
                somGiro.pause();
                wheel.classList.add('wheel-glow', 'wheel-flash');
                
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

                spinBtn.innerHTML = originalContent;
                spinBtn.disabled = false;
                setTimeout(() => wheel.classList.remove('wheel-flash'), 500);
            }, 4000);
        };

        imgPreloader.onerror = () => {
            console.error("Erro ao carregar imagem do anime.");
            spinBtn.innerHTML = originalContent;
            spinBtn.disabled = false;
        };
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
    const novoItem = { id: anime.id, title: anime.title.romaji, cover: anime.coverImage.large, url: anime.siteUrl, score: (anime.averageScore / 10).toFixed(1) };
    historico = [novoItem, ...historico.filter(item => item.id !== anime.id)].slice(0, 5);
    localStorage.setItem('anime_history', JSON.stringify(historico));
    renderizarHistorico();
}