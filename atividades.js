(function () {
    'use strict';

    const SPECIAL_CHARS = /[\u0300-\u036f]/g;
    const MAX_SIZE = 5 * 1024 * 1024;

    const AREA_KEY = (document.title || 'atividades')
        .toLowerCase()
        .normalize('NFD')
        .replace(SPECIAL_CHARS, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'atividades';

    const DB_NAME = 'PortfolioAtividades';
    const STORE_NAME = 'registros';
    const DB_VERSION = 1;

    let state = [];

    function esc(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(iso) {
        const p = String(iso).split('-');
        if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
        return iso;
    }

    function toIso(br) {
        const p = String(br).split('/');
        if (p.length === 3) return p[2] + '-' + p[1] + '-' + p[0];
        return '';
    }

    function openDB() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'area' });
                }
            };
            req.onsuccess = function (e) { resolve(e.target.result); };
            req.onerror = function (e) { reject(e.target.error); };
        });
    }

    function loadFromDB() {
        return openDB().then(function (db) {
            return new Promise(function (resolve) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var req = store.get(AREA_KEY);
                req.onsuccess = function () {
                    var data = req.result;
                    if (data && Array.isArray(data.atividades)) {
                        resolve(data.atividades);
                    } else {
                        resolve([]);
                    }
                };
                req.onerror = function () { resolve([]); };
            });
        }).catch(function () { return []; });
    }

    function saveToDB() {
        return openDB().then(function (db) {
            return new Promise(function (resolve) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                store.put({ area: AREA_KEY, atividades: state });
                tx.oncomplete = function () { resolve(true); };
                tx.onerror = function () { resolve(false); };
            });
        }).catch(function () { return false; });
    }

    function migrateFromLocalStorage() {
        try {
            var STORAGE_KEY = 'atividades-' + AREA_KEY;
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (data && Array.isArray(data.atividades) && data.atividades.length > 0) {
                localStorage.removeItem(STORAGE_KEY);
                return data.atividades;
            }
        } catch (e) { }
        return null;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const atividades = document.querySelector('.atividades');
        if (!atividades) return;

        const center = document.querySelector('.center');
        const eixos = Array.from(document.querySelectorAll('.eixo-container'));

        let lightbox, lightboxImg, lightboxClose;

        init();

        function init() {
            loadFromDB().then(function (loaded) {
                const legacy = migrateFromLocalStorage();
                if (legacy && legacy.length > loaded.length) {
                    state = legacy;
                    saveToDB();
                } else {
                    state = loaded;
                }
                injectStyles();
                buildHeaderAndNav();
                buildForm();
                render();
                buildLightbox();
                scrollReveal();
            });
        }

        function buildHeaderAndNav() {
            const header = document.createElement('div');
            header.className = 'hive-header';
            header.innerHTML =
                '<div class="eyebrow">Área de Atividades <span>·</span> Colmeia</div>' +
                '<h2>' + esc(document.title || 'Atividades') + '</h2>';
            atividades.parentNode.insertBefore(header, atividades);

            const navLinks = eixos.map(function (container, i) {
                const h1 = container.querySelector('h1');
                const label = h1 ? h1.textContent.trim() : 'Eixo ' + (i + 1);
                const num = (label.match(/\d+/) || [String(i + 1)])[0];
                const id = 'eixo-' + num;
                container.id = id;

                if (h1 && !h1.querySelector('.eixo-badge')) {
                    h1.innerHTML = '';
                    const badge = document.createElement('span');
                    badge.className = 'eixo-badge';
                    badge.textContent = num.padStart(2, '0');
                    const text = document.createElement('span');
                    text.textContent = label;
                    h1.appendChild(badge);
                    h1.appendChild(text);
                }
                return '<a href="#' + id + '"><span class="dot"></span>' + esc(label) + '</a>';
            });

            const nav = document.createElement('nav');
            nav.className = 'hive-nav';
            nav.innerHTML = navLinks.join('');
            atividades.parentNode.insertBefore(nav, atividades);

            const home = document.createElement('a');
            home.className = 'home-fab';
            home.href = './index.html';
            home.textContent = '← Início';
            document.body.appendChild(home);
        }

        function buildForm() {
            const form = document.createElement('div');
            form.className = 'activity-form';
            form.innerHTML =
                '<h3>🐝 Adicionar atividade</h3>' +
                '<p class="form-hint">Escolha o arquivo direto do seu computador, dê um nome e selecione o eixo.</p>' +
                '<div class="form-row">' +
                '  <div class="field">' +
                '    <label for="act-nome">Nome da atividade</label>' +
                '    <input id="act-nome" type="text" placeholder="Ex.: Mapa mental — Modernismo" autocomplete="off">' +
                '  </div>' +
                '  <div class="field">' +
                '    <label for="act-data">Data da atividade</label>' +
                '    <input id="act-data" type="date">' +
                '  </div>' +
                '  <div class="field">' +
                '    <label for="act-eixo">Eixo da atividade</label>' +
                '    <select id="act-eixo">' +
                '      <option value="1">Eixo 1</option>' +
                '      <option value="2">Eixo 2</option>' +
                '      <option value="3">Eixo 3</option>' +
                '      <option value="4">Eixo 4</option>' +
                '    </select>' +
                '  </div>' +
                '</div>' +
                '<div class="field">' +
                '  <label for="act-file">Arquivo da atividade (buscar no computador)</label>' +
                '  <label class="file-btn" for="act-file">📁 Escolher arquivo…</label>' +
                '  <input id="act-file" type="file" accept="image/*">' +
                '  <div class="file-name"></div>' +
                '</div>' +
                '<button class="add-btn" type="button">+ Adicionar atividade</button>';

            const nomeInput = form.querySelector('#act-nome');
            const eixoSelect = form.querySelector('#act-eixo');
            const dateInput = form.querySelector('#act-data');
            const fileInput = form.querySelector('#act-file');
            const fileName = form.querySelector('.file-name');
            const addBtn = form.querySelector('.add-btn');
            const chosen = { src: null };

            fileInput.addEventListener('change', function () {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                if (file.size > MAX_SIZE) {
                    toast('Imagem muito grande. Use até 5 MB.');
                    fileInput.value = '';
                    fileName.textContent = '';
                    return;
                }
                fileName.textContent = '✅ ' + file.name;
                const reader = new FileReader();
                reader.onload = function () {
                    chosen.src = reader.result;
                };
                reader.readAsDataURL(file);
            });

            addBtn.addEventListener('click', function () {
                const nome = nomeInput.value.trim();
                if (!nome) {
                    toast('Digite um nome para a atividade.');
                    nomeInput.focus();
                    return;
                }
                if (!chosen.src) {
                    toast('Escolha o arquivo da atividade.');
                    fileInput.click();
                    return;
                }
                const dataVal = dateInput.value;
                state.push({
                    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                    nome: nome,
                    eixo: parseInt(eixoSelect.value, 10),
                    src: chosen.src,
                    data: dataVal ? formatDate(dataVal) : new Date().toLocaleDateString('pt-BR')
                });
                saveToDB().then(function (ok) {
                    if (!ok) toast('Erro ao salvar. Tente novamente.');
                });
                render();
                nomeInput.value = '';
                fileInput.value = '';
                fileName.textContent = '';
                chosen.src = null;
                eixoSelect.value = '1';
                dateInput.value = '';
                toast('Atividade adicionada e salva ✓');
            });

            const target = center || atividades;
            target.insertBefore(form, target.firstChild);
        }

        function render() {
            eixos.forEach(function (container) {
                const gallery = container.querySelector('.image-gallery');
                if (!gallery) return;
                const h1 = container.querySelector('h1');
                const label = h1 ? h1.textContent.trim() : '0';
                const num = parseInt((label.match(/\d+/) || ['0'])[0], 10);

                gallery.innerHTML = '';

                const items = state.filter(function (a) { return a.eixo === num; });
                if (!items.length) {
                    const empty = document.createElement('p');
                    empty.className = 'gallery-empty';
                    empty.textContent = '🐝 Nenhuma atividade. Use o formulário acima!';
                    gallery.appendChild(empty);
                    return;
                }
                items.forEach(function (a) {
                    gallery.appendChild(buildItem(a));
                });
            });
        }

        function buildItem(a) {
            const item = document.createElement('div');
            item.className = 'act-item';
            item.innerHTML =
                '<div class="act-frame">' +
                '  <img src="' + esc(a.src) + '" alt="' + esc(a.nome) + '">' +
                '</div>' +
                '<button type="button" class="edit-btn" aria-label="Alterar data">&#9998;</button>' +
                '<button type="button" class="remove-btn" aria-label="Remover atividade">&times;</button>' +
                '<div class="act-name">' + esc(a.nome) + '<span class="act-date">' + esc(a.data) + '</span></div>';

            item.querySelector('.edit-btn').addEventListener('click', function () {
                const dateEl = item.querySelector('.act-date');
                const editor = document.createElement('span');
                editor.className = 'act-date act-date-ed';

                const input = document.createElement('input');
                input.type = 'date';
                input.value = toIso(a.data);

                const save = document.createElement('button');
                save.type = 'button';
                save.className = 'date-ok';
                save.setAttribute('aria-label', 'Salvar data');
                save.textContent = '✓';
                save.addEventListener('click', function () {
                    const novo = input.value ? formatDate(input.value) : a.data;
                    if (novo !== a.data) {
                        a.data = novo;
                        saveToDB();
                        render();
                        toast('Data atualizada ✓');
                    }
                });

                editor.appendChild(input);
                editor.appendChild(save);
                dateEl.replaceWith(editor);
                input.focus();
            });
            item.querySelector('img').addEventListener('click', function () {
                openLightbox(a.src, a.nome);
            });
            item.querySelector('.remove-btn').addEventListener('click', function () {
                state = state.filter(function (x) { return x.id !== a.id; });
                saveToDB();
                render();
                toast('Atividade removida.');
            });
            return item;
        }

        const toastEl = document.createElement('div');
        toastEl.className = 'hive-toast';
        document.body.appendChild(toastEl);

        function toast(text) {
            toastEl.textContent = text;
            toastEl.classList.add('show');
            clearTimeout(toastEl._t);
            toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
        }

        function buildLightbox() {
            lightbox = document.createElement('div');
            lightbox.className = 'hive-lightbox';
            lightbox.innerHTML = '<button class="close-btn" aria-label="Fechar" type="button">&times;</button><img alt="">';
            document.body.appendChild(lightbox);
            lightboxImg = lightbox.querySelector('img');
            lightboxClose = lightbox.querySelector('.close-btn');
            lightboxClose.addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', function (e) {
                if (e.target === lightbox) closeLightbox();
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeLightbox();
            });
        }

        function openLightbox(src, alt) {
            lightboxImg.src = src;
            lightboxImg.alt = alt || '';
            lightbox.classList.add('open');
        }

        function closeLightbox() {
            lightbox.classList.remove('open');
        }

        function scrollReveal() {
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('in-view');
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.15 });
                eixos.forEach(function (c) { observer.observe(c); });
            } else {
                eixos.forEach(function (c) { c.classList.add('in-view'); });
            }
        }

        function injectStyles() {
            const style = document.createElement('style');
            style.textContent = [
                '.activity-form{max-width:760px;margin:34px auto 6px;padding:20px 22px 22px;' +
                'background:rgba(46,29,12,.72);border:1px solid var(--comb-line);border-radius:14px;' +
                'backdrop-filter:blur(6px);box-shadow:0 18px 40px rgba(0,0,0,.3)}',
                '.activity-form h3{margin:0 0 4px;display:flex;align-items:center;gap:8px;' +
                'font-family:"Fraunces",serif;font-size:1.2rem;color:var(--honey-bright)}',
                '.activity-form .form-hint{margin:0 0 16px;color:var(--text-muted);font-size:12.5px;' +
                'font-family:"Space Mono",monospace}',
                '.activity-form .form-row{display:flex;gap:12px;flex-wrap:wrap}',
                '.activity-form .field{flex:1 1 230px;display:flex;flex-direction:column;gap:6px;margin-top:6px}',
                '.activity-form label{font-family:"Space Mono",monospace;font-size:10.5px;letter-spacing:.08em;' +
                'text-transform:uppercase;color:var(--text-muted)}',
                '.activity-form input[type="text"],.activity-form input[type="date"],.activity-form select{background:var(--hive-black);' +
                'border:1px solid var(--comb-line);color:var(--text-light);border-radius:8px;padding:10px 12px;' +
                'font:500 14px "Work Sans",sans-serif;outline:none}',
                '.activity-form input[type="text"]:focus,.activity-form input[type="date"]:focus,.activity-form select:focus{border-color:var(--honey-gold)}',
                '.activity-form input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(.85) sepia(1) saturate(3) hue-rotate(5deg)}',
                '.activity-form input[type="file"]{display:none}',
                '.activity-form .file-btn{display:flex;align-items:center;justify-content:center;gap:8px;' +
                'background:var(--hive-brown-2);border:1px dashed var(--honey-gold);color:var(--text-light);' +
                'border-radius:8px;padding:11px 12px;cursor:pointer;text-align:center;' +
                'font:500 13.5px "Work Sans",sans-serif}',
                '.activity-form .file-btn:hover{background:var(--hive-brown)}',
                '.activity-form .file-name{font-size:12px;color:var(--honey-bright);word-break:break-word;' +
                'min-height:15px;font-family:"Space Mono",monospace}',
                '.activity-form .add-btn{margin-top:14px;width:100%;border:none;cursor:pointer;' +
                'font-family:"Space Mono",monospace;font-weight:700;letter-spacing:.05em;font-size:14px;' +
                'background:linear-gradient(160deg,var(--honey-bright),var(--honey-deep));color:var(--hive-black);' +
                'padding:13px 18px;border-radius:8px;clip-path:polygon(6% 0,94% 0,100% 50%,94% 100%,6% 100%,0 50%);' +
                'transition:transform .18s ease,filter .18s ease}',
                '.activity-form .add-btn:hover{transform:translateY(-2px);filter:brightness(1.06)}',
                '.act-item{position:relative;width:320px}',
                '.act-frame{position:relative;width:320px;aspect-ratio:16/10;padding:12px;overflow:hidden;' +
                'background:linear-gradient(160deg,var(--honey-bright),var(--honey-deep));' +
                'border-radius:14px;' +
                'box-shadow:0 10px 24px rgba(0,0,0,.38),' +
                '0 0 0 1px var(--comb-line),' +
                'inset 0 0 0 1px rgba(255,201,60,.25);' +
                'transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}',
                '.act-frame::before{content:"";position:absolute;inset:6px;' +
                'border:1px dashed rgba(23,15,9,.45);border-radius:9px;pointer-events:none;z-index:1}',
                '.act-frame::after{content:"";position:absolute;top:5px;right:5px;width:16px;height:16px;' +
                'background:var(--hive-black);clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);' +
                'opacity:.35;z-index:2}',
                '.act-frame img{display:block;width:100%;height:100%;' +
                'border-radius:7px;background:var(--hive-black);object-fit:contain;' +
                'box-shadow:0 0 0 1px rgba(255,255,255,.08)}',
                '.act-item:hover .act-frame{transform:translateY(-5px);box-shadow:0 16px 34px rgba(0,0,0,.45),' +
                '0 0 0 1px var(--honey-gold),inset 0 0 0 1px rgba(255,201,60,.3);filter:brightness(1.04)}',
                '.act-item .remove-btn{position:absolute;top:-10px;right:-10px;width:26px;height:26px;' +
                'border-radius:50%;border:1px solid var(--comb-line);background:var(--hive-black);' +
                'color:var(--honey-bright);cursor:pointer;font-size:15px;line-height:1;opacity:.55;' +
                'transition:opacity .15s ease;z-index:3}',
                '.act-item .edit-btn{position:absolute;top:-10px;left:-10px;width:26px;height:26px;' +
                'border-radius:50%;border:1px solid var(--honey-gold);background:var(--hive-black);' +
                'color:var(--honey-bright);cursor:pointer;font-size:13px;line-height:1;opacity:.55;' +
                'transition:opacity .15s ease;z-index:3}',
                '.act-item:hover .edit-btn{opacity:1}',
                '.act-item .act-date-ed{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:3px}',
                '.act-item .act-date-ed input[type="date"]{background:var(--hive-black);border:1px solid var(--honey-gold);' +
                'color:var(--text-light);border-radius:6px;padding:4px 6px;font:500 11px "Work Sans",sans-serif;outline:none}',
                '.act-item .act-date-ed .date-ok{width:24px;height:24px;border-radius:50%;border:1px solid var(--comb-line);' +
                'background:linear-gradient(160deg,var(--honey-bright),var(--honey-deep));color:var(--hive-black);' +
                'cursor:pointer;font-size:13px;line-height:1;flex-shrink:0}',
                '.act-item .act-name{width:320px;font-family:"Work Sans",sans-serif;font-size:12.5px;' +
                'color:var(--text-light);margin-top:10px;text-align:center;line-height:1.4}',
                '.act-item .act-date{display:block;font-family:"Space Mono",monospace;font-size:10.5px;' +
                'color:var(--text-muted);margin-top:4px}',
                '.gallery-empty{width:100%;justify-content:center !important}',
                '.hive-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,24px);z-index:120;' +
                'background:var(--hive-brown-2);border:1px solid var(--honey-gold);color:var(--text-light);' +
                'padding:10px 18px;border-radius:8px;font-family:"Space Mono",monospace;font-size:12.5px;' +
                'opacity:0;pointer-events:none;transition:opacity .22s ease,transform .22s ease;' +
                'box-shadow:0 12px 30px rgba(0,0,0,.4)}',
                '.hive-toast.show{opacity:1;transform:translate(-50%,0)}',
                '.image-gallery{column-gap:28px !important;row-gap:46px !important}',
                '.home-fab{position:fixed;bottom:calc(1.1rem + env(safe-area-inset-bottom));left:1.1rem;' +
                'z-index:60;display:inline-flex;align-items:center;gap:8px;' +
                'background:var(--hive-brown-2);border:1px solid var(--comb-line);color:var(--honey-bright);' +
                'font-family:"Space Mono",monospace;font-weight:700;font-size:11.5px;letter-spacing:.04em;' +
                'padding:11px 16px;border-radius:999px;text-decoration:none;' +
                'box-shadow:0 10px 26px rgba(0,0,0,.35);' +
                'transition:background .18s ease,transform .18s ease}',
                '.home-fab:hover{background:var(--honey-gold);color:var(--hive-black);transform:translateY(-2px)}',
                '@media(max-width:640px){.act-item{width:130px}' +
                '.act-frame{width:130px;padding:8px}' +
                '.act-item .act-name{width:130px;font-size:11.5px}' +
                '.act-item .remove-btn{width:22px;height:22px;font-size:13px}' +
                '.act-item .edit-btn{width:22px;height:22px;font-size:11px}' +
                '.activity-form{padding:16px}}'
            ].join('\n');
            document.head.appendChild(style);
        }
    });
})();