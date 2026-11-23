(function () {
    'use strict';

    const MAX_SIZE = 2 * 1024 * 1024;
    const STORAGE_KEY = 'anexos-portfolio-2026';

    let containers = [];
    let passos = [];
    let descPadrao = [];
    let editavel = false;
    let existiaRemoto = false;
    let canal = null;
    let syncPendente = false;
    let toastEl = null;
    const timers = [];

    function agora() {
        return new Date().toISOString();
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showToast(text) {
        if (!toastEl) return;
        toastEl.textContent = text || '✓ Salvo';
        toastEl.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
    }

    function extFromDataUrl(value) {
        const match = String(value).match(/^data:([^;]+);/);
        const mime = match ? match[1] : 'application/octet-stream';
        return SB.extensao('arquivo.' + (mime.split('/')[1] || 'bin'), mime);
    }

    function normalizar(rows) {
        const mapa = {};
        rows.forEach(function (row) {
            let numero = Number(row.passo);
            if (!numero && /^passo-\d+$/.test(String(row.id || ''))) {
                numero = parseInt(String(row.id).replace('passo-', ''), 10);
            }
            if (!numero || numero < 1 || numero > 6) return;
            const dados = row.dados || {};
            const fotos = Array.isArray(dados.fotos) ? dados.fotos.map(function (foto) {
                return {
                    id: foto.id || SB.nowId('anexo'),
                    src: foto.src || '',
                    caption: foto.caption || ''
                };
            }) : [];
            const temDesc = typeof dados.desc === 'string';
            mapa[numero] = {
                passo: numero,
                desc: temDesc ? dados.desc : descPadrao[numero - 1],
                fotos: fotos
            };
        });
        return Array.from({ length: 6 }, function (_, i) {
            const numero = i + 1;
            return mapa[numero] || { passo: numero, desc: descPadrao[i], fotos: [] };
        });
    }

    function loadFromCloud() {
        return SB.client()
            .from('anexos')
            .select('id, passo, dados, atualizado_em')
            .gte('passo', 1)
            .lte('passo', 6)
            .then(function (res) {
                if (res.error) throw res.error;
                const rows = res.data || [];
                existiaRemoto = rows.some(function (row) {
                    const dados = row.dados || {};
                    return !!dados.desc || (Array.isArray(dados.fotos) && dados.fotos.length > 0);
                });
                passos = normalizar(rows);
                return passos;
            });
    }

    function coletar(indice) {
        const container = containers[indice];
        const desc = container.querySelector('.step-desc');
        const fotos = Array.from(container.querySelectorAll('.attach-item')).map(function (item) {
            return {
                id: item.dataset.id || SB.nowId('anexo'),
                src: item.dataset.src || item.querySelector('img').src,
                caption: item.querySelector('.caption').textContent
            };
        });
        return { desc: desc.innerHTML, fotos: fotos };
    }

    function salvar(indice) {
        if (!editavel || !window.SB || !SB.ready()) return Promise.resolve();
        const passo = indice + 1;
        return SB.client().from('anexos').upsert({
            id: 'passo-' + passo,
            passo: passo,
            dados: coletar(indice),
            atualizado_em: agora()
        }, { onConflict: 'id' }).then(function (res) {
            if (res && res.error) throw res.error;
            passos[indice] = Object.assign({ passo: passo }, coletar(indice));
            return true;
        });
    }

    function salvarComDebounce(indice) {
        clearTimeout(timers[indice]);
        timers[indice] = setTimeout(function () {
            salvar(indice).catch(function (err) { showToast(SB.msgErro(err)); });
        }, 600);
    }

    function uploadPath(passo, id, ext) {
        return 'anexos/passo-' + passo + '/' + SB.sanitize(id) + '.' + SB.extensao(ext, '');
    }

    function adicionar(indice, file) {
        const passo = indice + 1;
        const id = SB.nowId('anexo');
        const path = uploadPath(passo, id, SB.extensao(file.name, file.type));
        return SB.uploadFile(file, path, true).then(function (url) {
            const atual = coletar(indice);
            passos[indice] = {
                passo: passo,
                desc: atual.desc,
                fotos: atual.fotos.concat([{ id: id, src: url, caption: '' }])
            };
            render();
            return salvar(indice);
        }).then(function () {
            showToast('Anexo enviado para a nuvem ✓');
        });
    }

    function trocar(indice, foto, file) {
        const passo = indice + 1;
        const anterior = foto.src;
        const path = uploadPath(passo, foto.id, SB.extensao(file.name, file.type));
        return SB.uploadFile(file, path, true).then(function (url) {
            const item = Array.from(containers[indice].querySelectorAll('.attach-item'))
                .find(function (node) { return node.dataset.id === foto.id; });
            if (item) {
                item.dataset.src = url;
                item.querySelector('img').src = url;
            }
            foto.src = url;
            return salvar(indice);
        }).then(function () {
            if (anterior !== foto.src) SB.removeByUrl(anterior);
            showToast('Anexo trocado ✓');
        });
    }

    function remover(indice, foto) {
        const items = passos[indice].fotos;
        const posicao = items.findIndex(function (item) { return item.id === foto.id; });
        if (posicao !== -1) items.splice(posicao, 1);
        const item = Array.from(containers[indice].querySelectorAll('.attach-item'))
            .find(function (node) { return node.dataset.id === foto.id; });
        if (item) item.remove();
        SB.removeByUrl(foto.src);
        return salvar(indice).then(function () { showToast('Anexo removido.'); });
    }

    function lerLegado() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : null;
            return data && Array.isArray(data.passos) ? data.passos : [];
        } catch (e) {
            return [];
        }
    }

    function migrarLegado() {
        if (!editavel || existiaRemoto) return Promise.resolve();
        const antigos = lerLegado();
        if (!antigos.length) return Promise.resolve();
        return antigos.reduce(function (chain, bloco, indice) {
            return chain.then(function () {
                const fotos = Array.isArray(bloco && bloco.fotos) ? bloco.fotos : [];
                return fotos.reduce(function (fchain, foto) {
                    return fchain.then(function () {
                        if (!SB.isDataUrl(foto.src)) return foto;
                        const id = foto.id || SB.nowId('anexo');
                        const path = uploadPath(indice + 1, id, extFromDataUrl(foto.src));
                        return SB.uploadDataUrl(foto.src, path, true).then(function (url) {
                            return { id: id, src: url, caption: foto.caption || '' };
                        });
                    });
                }, Promise.resolve()).then(function (enviadas) {
                    const dados = {
                        desc: typeof bloco.desc === 'string' ? bloco.desc : descPadrao[indice],
                        fotos: enviadas
                    };
                    return SB.client().from('anexos').upsert({
                        id: 'passo-' + (indice + 1),
                        passo: indice + 1,
                        dados: dados,
                        atualizado_em: agora()
                    }, { onConflict: 'id' });
                });
            });
        }, Promise.resolve()).then(function () {
            localStorage.removeItem(STORAGE_KEY);
            showToast('Anexos antigos enviados para a nuvem.');
        });
    }

    function migrarImagensAntigas() {
        if (!editavel) return Promise.resolve();
        return passos.reduce(function (chain, bloco, indice) {
            return chain.then(function () {
                return bloco.fotos.reduce(function (fchain, foto) {
                    return fchain.then(function () {
                        if (!SB.isDataUrl(foto.src)) return null;
                        const path = uploadPath(bloco.passo, foto.id, extFromDataUrl(foto.src));
                        return SB.uploadDataUrl(foto.src, path, true).then(function (url) {
                            foto.src = url;
                            return null;
                        });
                    });
                }, Promise.resolve()).then(function () {
                    if (bloco.fotos.some(function (foto) { return !SB.isDataUrl(foto.src); })) {
                        return SB.client().from('anexos').upsert({
                            id: 'passo-' + bloco.passo,
                            passo: bloco.passo,
                            dados: { desc: bloco.desc, fotos: bloco.fotos },
                            atualizado_em: agora()
                        }, { onConflict: 'id' });
                    }
                    return null;
                });
            });
        }, Promise.resolve());
    }

    function observar() {
        canal = SB.subscribe('anexos', function () {
            if (document.activeElement && document.activeElement.isContentEditable) {
                syncPendente = true;
                return;
            }
            loadFromCloud().then(render).catch(function (err) {
                showToast(SB.msgErro(err));
            });
        });
        document.addEventListener('focusout', function () {
            if (!syncPendente) return;
            syncPendente = false;
            loadFromCloud().then(render).catch(function () { });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        toastEl = document.getElementById('save-toast');
        containers = Array.from(document.querySelectorAll('.eixo-container'));
        if (!containers.length) return;

        descPadrao = containers.map(function (container) {
            const desc = container.querySelector('.step-desc');
            return desc ? desc.innerHTML : '';
        });
        editavel = !!(window.SB && SB.ready() && SB.podeEditar());

        injectStyles();
        buildHeaderAndNav();
        bindEdicoes();
        buildLightbox();

        if (!window.SB || !SB.ready()) {
            const antigos = lerLegado();
            passos = normalizar(antigos.map(function (bloco, i) {
                return { passo: i + 1, dados: bloco };
            }));
            render();
            showToast(window._supabaseError || 'Supabase offline. Exibindo anexos salvos neste dispositivo.');
            return;
        }

        loadFromCloud()
            .then(migrarLegado)
            .then(migrarImagensAntigas)
            .then(loadFromCloud)
            .then(function () {
                render();
                observar();
            })
            .catch(function (err) {
                showToast(SB.msgErro(err));
                const antigos = lerLegado();
                passos = normalizar(antigos.map(function (bloco, i) {
                    return { passo: i + 1, dados: bloco };
                }));
                render();
            });
    });

    function bindEdicoes() {
        containers.forEach(function (container, indice) {
            const desc = container.querySelector('.step-desc');
            desc.addEventListener('input', function () { salvarComDebounce(indice); });

            const addBtn = container.querySelector('.add-item-btn');
            const fileInput = container.querySelector('.file-input');
            if (addBtn) {
                addBtn.addEventListener('click', function () { fileInput.click(); });
                fileInput.addEventListener('change', function () {
                    const file = fileInput.files && fileInput.files[0];
                    fileInput.value = '';
                    if (!file) return;
                    if (file.size > MAX_SIZE) {
                        showToast('Imagem muito grande. Use até 2 MB.');
                        return;
                    }
                    adicionar(indice, file).catch(function (err) { showToast(SB.msgErro(err)); });
                });
            }
        });
    }

    function render() {
        containers.forEach(function (container, indice) {
            const bloco = passos[indice];
            if (!bloco) return;
            const desc = container.querySelector('.step-desc');
            desc.innerHTML = bloco.desc || '';
            desc.contentEditable = editavel ? 'true' : 'false';

            const gallery = container.querySelector('.image-gallery');
            gallery.innerHTML = '';
            bloco.fotos.forEach(function (foto) {
                gallery.appendChild(buildItem(indice, foto));
            });

            const addBtn = container.querySelector('.add-item-btn');
            if (addBtn) addBtn.hidden = !editavel;
        });
    }

    function buildItem(indice, foto) {
        const item = document.createElement('div');
        item.className = 'attach-item';
        item.dataset.id = foto.id;
        item.dataset.src = foto.src;
        item.innerHTML =
            '<img src="' + esc(foto.src) + '" alt="Anexo">' +
            (editavel
                ? '<button type="button" class="replace-btn" aria-label="Trocar anexo">&#8635;</button>' +
                  '<button type="button" class="remove-btn" aria-label="Remover anexo">&times;</button>'
                : '') +
            '<div class="caption" contenteditable="' + (editavel ? 'true' : 'false') + '"></div>';

        const cap = item.querySelector('.caption');
        cap.textContent = foto.caption || 'Legenda do anexo…';
        cap.addEventListener('input', function () { salvarComDebounce(indice); });
        item.querySelector('img').addEventListener('click', function () { openLightbox(foto.src); });

        if (editavel) {
            item.querySelector('.replace-btn').addEventListener('click', function () {
                const picker = document.createElement('input');
                picker.type = 'file';
                picker.accept = 'image/*';
                picker.hidden = true;
                document.body.appendChild(picker);
                picker.addEventListener('change', function () {
                    const file = picker.files && picker.files[0];
                    picker.remove();
                    if (!file) return;
                    if (file.size > MAX_SIZE) {
                        showToast('Imagem muito grande. Use até 2 MB.');
                        return;
                    }
                    trocar(indice, foto, file).catch(function (err) { showToast(SB.msgErro(err)); });
                });
                picker.click();
            });
            item.querySelector('.remove-btn').addEventListener('click', function () {
                remover(indice, foto).catch(function (err) { showToast(SB.msgErro(err)); });
            });
        }
        return item;
    }

    function buildHeaderAndNav() {
        const header = document.createElement('div');
        header.className = 'hive-header';
        header.innerHTML =
            '<div class="eyebrow">Anexos <span>·</span> Portfólio 2026</div>' +
            '<h2>' + esc(document.title || 'Anexos') + '</h2>';
        const atividades = document.querySelector('.atividades');
        document.body.insertBefore(header, atividades);

        const navLinks = containers.map(function (container) {
            const num = container.dataset.step || '1';
            const id = 'passo-' + num;
            container.id = id;

            const h1 = container.querySelector('h1');
            if (h1 && !h1.querySelector('.eixo-badge')) {
                const badge = document.createElement('span');
                badge.className = 'eixo-badge';
                badge.textContent = String(num).padStart(2, '0');
                h1.insertBefore(badge, h1.firstChild);
            }
            return '<a href="#' + id + '"><span class="dot"></span>Passo ' + num + '</a>';
        });

        const nav = document.createElement('nav');
        nav.className = 'hive-nav';
        nav.innerHTML = navLinks.join('');
        document.body.insertBefore(nav, document.querySelector('.atividades'));
    }

    function buildLightbox() {
        const lightbox = document.createElement('div');
        lightbox.className = 'hive-lightbox';
        lightbox.innerHTML = '<button class="close-btn" aria-label="Fechar" type="button">&times;</button><img alt="">';
        document.body.appendChild(lightbox);
        const img = lightbox.querySelector('img');
        const close = function () { lightbox.classList.remove('open'); };
        lightbox.querySelector('.close-btn').addEventListener('click', close);
        lightbox.addEventListener('click', function (e) { if (e.target === lightbox) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
        openLightbox = function (src) {
            img.src = src;
            lightbox.classList.add('open');
        };
    }

    let openLightbox = function () { };

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent =
            '.attach-item .replace-btn{position:absolute;top:8px;left:8px;width:30px;height:30px;' +
            'clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%);' +
            'background:var(--honey-gold);color:var(--hive-black);border:none;font-size:15px;' +
            'cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;' +
            'transition:opacity .18s ease;z-index:2}' +
            '.attach-item:hover .replace-btn{opacity:1}' +
            '.attach-item .caption[contenteditable="false"]{cursor:default}';
        document.head.appendChild(style);
    }
})();
