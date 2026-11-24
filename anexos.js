(function () {
    'use strict';

    const MAX_SIZE = 5 * 1024 * 1024;
    const STORAGE_KEY = 'anexos-portfolio-2026';

    let containers = [];
    let passos = [];
    let descPadrao = [];
    let editavel = false;
    let existiaRemoto = false;
    let toastEl = null;
    let syncPendente = false;
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
            mapa[numero] = {
                passo: numero,
                desc: typeof dados.desc === 'string' ? dados.desc : descPadrao[numero - 1],
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

    function montarDados(indice) {
        const desc = containers[indice].querySelector('.step-desc');
        return {
            desc: desc ? desc.innerHTML : (passos[indice] ? passos[indice].desc : ''),
            fotos: (passos[indice] && passos[indice].fotos) || []
        };
    }

    function salvarPasso(indice) {
        if (!editavel || !window.SB || !SB.ready()) return Promise.resolve();
        const passo = indice + 1;
        return SB.client().from('anexos').upsert({
            id: 'passo-' + passo,
            passo: passo,
            dados: montarDados(indice),
            atualizado_em: agora()
        }, { onConflict: 'id' }).then(function (res) {
            if (res && res.error) throw res.error;
            return true;
        });
    }

    function salvarComDebounce(indice) {
        clearTimeout(timers[indice]);
        timers[indice] = setTimeout(function () {
            salvarPasso(indice).catch(function (err) { showToast(SB.msgErro(err)); });
        }, 600);
    }

    function persistir(indice, mensagem) {
        return salvarPasso(indice)
            .then(loadFromCloud)
            .then(render)
            .then(function () {
                if (mensagem) showToast(mensagem);
                return true;
            });
    }

    function uploadPath(passo, id, ext) {
        return 'anexos/passo-' + passo + '/' + SB.sanitize(id) + '.' + SB.extensao(ext, '');
    }

    function adicionar(indice, texto, file) {
        const passo = indice + 1;
        const id = SB.nowId('anexo');
        const path = uploadPath(passo, id, SB.extensao(file.name, file.type));
        return SB.uploadFile(file, path, true).then(function (url) {
            passos[indice].fotos.push({ id: id, src: url, caption: texto });
            return persistir(indice, 'Anexo salvo na nuvem ✓');
        });
    }

    function trocarArquivo(indice, foto, file) {
        const anterior = foto.src;
        const path = uploadPath(indice + 1, foto.id, SB.extensao(file.name, file.type));
        return SB.uploadFile(file, path, true).then(function (url) {
            foto.src = url;
            return persistir(indice, 'Imagem trocada ✓');
        }).then(function () {
            if (anterior !== foto.src) SB.removeByUrl(anterior);
        });
    }

    function alterarTexto(indice, foto, texto) {
        foto.caption = texto;
        return persistir(indice, 'Texto atualizado ✓');
    }

    function remover(indice, foto) {
        passos[indice].fotos = passos[indice].fotos.filter(function (item) {
            return item.id !== foto.id;
        });
        return persistir(indice, 'Anexo removido.').then(function () {
            SB.removeByUrl(foto.src);
        });
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
                    return SB.client().from('anexos').upsert({
                        id: 'passo-' + (indice + 1),
                        passo: indice + 1,
                        dados: {
                            desc: typeof bloco.desc === 'string' ? bloco.desc : descPadrao[indice],
                            fotos: enviadas
                        },
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
        SB.subscribe('anexos', function () {
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
        passos = descPadrao.map(function (desc, i) {
            return { passo: i + 1, desc: desc, fotos: [] };
        });
        editavel = !!(window.SB && SB.ready() && SB.podeEditar());

        bindDescricoes();
        buildHeaderAndNav();
        if (editavel) buildForm();
        buildLightbox();
        scrollReveal();

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

    function bindDescricoes() {
        containers.forEach(function (container, indice) {
            const desc = container.querySelector('.step-desc');
            if (desc) {
                desc.addEventListener('input', function () { salvarComDebounce(indice); });
            }
        });
    }

    function buildHeaderAndNav() {
        const header = document.createElement('div');
        header.className = 'hive-header';
        header.innerHTML =
            '<div class="eyebrow">Área de Anexos <span>·</span> Portfólio 2026</div>' +
            '<h2>' + esc(document.title || 'Anexos') + '</h2>';
        const atividades = document.querySelector('.atividades');
        document.body.insertBefore(header, atividades);

        const navLinks = containers.map(function (container) {
            const num = container.dataset.step || '1';
            const id = 'anexo-' + num;
            container.id = id;

            const h1 = container.querySelector('h1');
            if (h1 && !h1.querySelector('.eixo-badge')) {
                const badge = document.createElement('span');
                badge.className = 'eixo-badge';
                badge.textContent = String(num).padStart(2, '0');
                h1.insertBefore(badge, h1.firstChild);
            }
            return '<a href="#' + id + '"><span class="dot"></span>Anexo ' + num + '</a>';
        });

        const nav = document.createElement('nav');
        nav.className = 'hive-nav';
        nav.innerHTML = navLinks.join('');
        document.body.insertBefore(nav, document.querySelector('.atividades'));
    }

    function buildForm() {
        const form = document.createElement('div');
        form.className = 'anexo-form';
        form.innerHTML =
            '<h3>🐝 Adicionar anexo</h3>' +
            '<p class="form-hint">Escolha a imagem, escreva um texto sobre o anexo e selecione o anexo. Tudo é salvo na nuvem.</p>' +
            '<div class="form-row">' +
            '  <div class="field">' +
            '    <label for="anexo-texto">Texto do anexo</label>' +
            '    <input id="anexo-texto" type="text" placeholder="Ex.: Foto da maquete do bairro" autocomplete="off">' +
            '  </div>' +
            '  <div class="field">' +
            '    <label for="anexo-numero">Anexo</label>' +
            '    <select id="anexo-numero">' +
            '      <option value="1">Anexo 1</option>' +
            '      <option value="2">Anexo 2</option>' +
            '      <option value="3">Anexo 3</option>' +
            '      <option value="4">Anexo 4</option>' +
            '      <option value="5">Anexo 5</option>' +
            '      <option value="6">Anexo 6</option>' +
            '    </select>' +
            '  </div>' +
            '</div>' +
            '<div class="field">' +
            '  <label for="anexo-file">Imagem do anexo</label>' +
            '  <label class="file-btn" for="anexo-file">📁 Escolher imagem…</label>' +
            '  <input id="anexo-file" type="file" accept="image/*">' +
            '  <div class="file-name"></div>' +
            '</div>' +
            '<button class="add-btn" type="button">+ Adicionar anexo</button>';

        const textoInput = form.querySelector('#anexo-texto');
        const anexoSelect = form.querySelector('#anexo-numero');
        const fileInput = form.querySelector('#anexo-file');
        const fileName = form.querySelector('.file-name');
        const addBtn = form.querySelector('.add-btn');
        let arquivo = null;

        fileInput.addEventListener('change', function () {
            const file = fileInput.files && fileInput.files[0];
            arquivo = null;
            if (!file) {
                fileName.textContent = '';
                return;
            }
            if (file.size > MAX_SIZE) {
                showToast('Imagem muito grande. Use até 5 MB.');
                fileInput.value = '';
                fileName.textContent = '';
                return;
            }
            arquivo = file;
            fileName.textContent = '✅ ' + file.name;
        });

        addBtn.addEventListener('click', function () {
            const texto = textoInput.value.trim();
            if (!texto) {
                showToast('Digite um texto para o anexo.');
                textoInput.focus();
                return;
            }
            if (!arquivo) {
                showToast('Escolha a imagem do anexo.');
                fileInput.click();
                return;
            }
            addBtn.disabled = true;
            addBtn.textContent = 'Enviando...';
            adicionar(parseInt(anexoSelect.value, 10) - 1, texto, arquivo)
                .then(function () {
                    textoInput.value = '';
                    fileInput.value = '';
                    fileName.textContent = '';
                    arquivo = null;
                    anexoSelect.value = '1';
                })
                .catch(function (err) { showToast(SB.msgErro(err)); })
                .then(function () {
                    addBtn.disabled = false;
                    addBtn.textContent = '+ Adicionar anexo';
                });
        });

        const target = document.querySelector('.center') || document.querySelector('.atividades');
        target.insertBefore(form, target.firstChild);
    }

    function render() {
        containers.forEach(function (container, indice) {
            const bloco = passos[indice];
            if (!bloco) return;

            const desc = container.querySelector('.step-desc');
            if (desc) {
                desc.innerHTML = bloco.desc || '';
                desc.contentEditable = editavel ? 'true' : 'false';
            }

            const gallery = container.querySelector('.image-gallery');
            gallery.innerHTML = '';
            if (!bloco.fotos.length) {
                const empty = document.createElement('p');
                empty.className = 'gallery-empty';
                empty.textContent = editavel
                    ? '🐝 Nenhum anexo. Use o formulário acima!'
                    : '🐝 Nenhum anexo cadastrado.';
                gallery.appendChild(empty);
                return;
            }
            bloco.fotos.forEach(function (foto) {
                gallery.appendChild(buildItem(indice, foto));
            });
        });
    }

    function buildItem(indice, foto) {
        const item = document.createElement('div');
        item.className = 'anexo-item';
        item.innerHTML =
            '<div class="anexo-frame"><img src="' + esc(foto.src) + '" alt="' + esc(foto.caption || 'Anexo') + '"></div>' +
            (editavel
                ? '<button type="button" class="edit-btn" aria-label="Alterar texto">&#9998;</button>' +
                  '<button type="button" class="replace-btn" aria-label="Trocar imagem">&#8635;</button>' +
                  '<button type="button" class="remove-btn" aria-label="Remover anexo">&times;</button>'
                : '') +
            '<div class="anexo-texto">' + esc(foto.caption || 'Sem texto') + '</div>';

        item.querySelector('img').addEventListener('click', function () {
            openLightbox(foto.src, foto.caption);
        });

        if (editavel) {
            item.querySelector('.edit-btn').addEventListener('click', function () {
                const textEl = item.querySelector('.anexo-texto');
                if (!textEl) return;
                const editor = document.createElement('div');
                editor.className = 'anexo-texto-ed';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = foto.caption || '';
                input.placeholder = 'Texto do anexo';

                const save = document.createElement('button');
                save.type = 'button';
                save.className = 'text-ok';
                save.setAttribute('aria-label', 'Salvar texto');
                save.textContent = '✓';

                function confirmar() {
                    const novo = input.value.trim();
                    if (!novo) {
                        showToast('Digite um texto para o anexo.');
                        input.focus();
                        return;
                    }
                    alterarTexto(indice, foto, novo)
                        .catch(function (err) { showToast(SB.msgErro(err)); });
                }

                save.addEventListener('click', confirmar);
                input.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') confirmar();
                    if (e.key === 'Escape') render();
                });

                textEl.replaceWith(editor);
                editor.appendChild(input);
                editor.appendChild(save);
                input.focus();
            });

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
                        showToast('Imagem muito grande. Use até 5 MB.');
                        return;
                    }
                    trocarArquivo(indice, foto, file)
                        .catch(function (err) { showToast(SB.msgErro(err)); });
                });
                picker.click();
            });

            item.querySelector('.remove-btn').addEventListener('click', function () {
                remover(indice, foto).catch(function (err) { showToast(SB.msgErro(err)); });
            });
        }
        return item;
    }

    let lightbox = null;
    let lightboxImg = null;

    function buildLightbox() {
        lightbox = document.createElement('div');
        lightbox.className = 'hive-lightbox';
        lightbox.innerHTML = '<button class="close-btn" aria-label="Fechar" type="button">&times;</button><img alt="">';
        document.body.appendChild(lightbox);
        lightboxImg = lightbox.querySelector('img');

        lightbox.querySelector('.close-btn').addEventListener('click', closeLightbox);
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
            containers.forEach(function (c) { observer.observe(c); });
        } else {
            containers.forEach(function (c) { c.classList.add('in-view'); });
        }
    }
})();
