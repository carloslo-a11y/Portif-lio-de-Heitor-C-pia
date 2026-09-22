const STORAGE_KEY = 'anexos-portfolio-2026';

document.addEventListener('DOMContentLoaded', () => {
    const containers = Array.from(document.querySelectorAll('.eixo-container'));
    const saveToast = document.getElementById('save-toast');
    let saveTimer;

    function showToast(text) {
        saveToast.textContent = text || '✓ Salvo';
        saveToast.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => saveToast.classList.remove('show'), 2000);
    }

    // ---------- header ----------
    const header = document.createElement('div');
    header.className = 'hive-header';
    header.innerHTML =
        '<div class="eyebrow">Anexos <span>·</span> Portfólio 2026</div>' +
        '<h2>' + (document.title || 'Anexos') + '</h2>';
    const atividades = document.querySelector('.atividades');
    document.body.insertBefore(header, atividades);

    // ---------- badges + sticky nav ----------
    const navLinks = containers.map((container) => {
        const num = container.dataset.step || '1';
        const id = 'passo-' + num;
        container.id = id;

        const h1 = container.querySelector('h1');
        const badge = document.createElement('span');
        badge.className = 'eixo-badge';
        badge.textContent = String(num).padStart(2, '0');
        h1.insertBefore(badge, h1.firstChild);

        return '<a href="#' + id + '"><span class="dot"></span>Passo ' + num + '</a>';
    });

    const nav = document.createElement('nav');
    nav.className = 'hive-nav';
    nav.innerHTML = navLinks.join('');
    document.body.insertBefore(nav, document.querySelector('.atividades'));

    // ---------- restore saved state ----------
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

    function buildItem(src, caption) {
        const item = document.createElement('div');
        item.className = 'attach-item';
        item.innerHTML =
            '<img src="' + src + '" alt="Anexo">' +
            '<button type="button" class="remove-btn" aria-label="Remover anexo">&times;</button>' +
            '<div class="caption" contenteditable="true"></div>';
        const img = item.querySelector('img');
        const cap = item.querySelector('.caption');
        cap.textContent = caption || 'Legenda do anexo…';

        img.addEventListener('click', () => openLightbox(img.src));
        item.querySelector('.remove-btn').addEventListener('click', () => {
            item.remove();
            showToast('Anexo removido.');
            saveState();
        });
        cap.addEventListener('input', debouncedSave);
        return item;
    }

    function restoreState() {
        if (!saved || !Array.isArray(saved.passos)) return;
        saved.passos.forEach((data, i) => {
            const container = containers[i];
            if (!container) return;
            if (data.desc) container.querySelector('.step-desc').innerHTML = data.desc;
            const gallery = container.querySelector('.image-gallery');
            (data.fotos || []).forEach(foto => {
                if (foto.src) gallery.appendChild(buildItem(foto.src, foto.caption));
            });
        });
    }

    restoreState();

    // ---------- save ----------
    function saveState() {
        const state = {
            passos: containers.map(container => ({
                desc: container.querySelector('.step-desc').innerHTML,
                fotos: Array.from(container.querySelectorAll('.attach-item')).map(item => ({
                    src: item.querySelector('img').src,
                    caption: item.querySelector('.caption').textContent
                }))
            }))
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            showToast('Armazenamento cheio. Use imagens menores.');
        }
    }

    function debouncedSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveState, 600);
    }

    containers.forEach(container => {
        const desc = container.querySelector('.step-desc');
        desc.addEventListener('input', debouncedSave);
    });

    // ---------- add image buttons ----------
    containers.forEach(container => {
        const addBtn = container.querySelector('.add-item-btn');
        const fileInput = container.querySelector('.file-input');
        const gallery = container.querySelector('.image-gallery');

        addBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showToast('Imagem muito grande. Use até 2 MB.');
                fileInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                gallery.appendChild(buildItem(reader.result, ''));
                showToast('Anexo adicionado.');
                saveState();
            };
            reader.readAsDataURL(file);
            fileInput.value = '';
        });
    });

    // ---------- lightbox ----------
    const lightbox = document.createElement('div');
    lightbox.className = 'hive-lightbox';
    lightbox.innerHTML = '<button class="close-btn" aria-label="Fechar" type="button">&times;</button><img alt="">';
    document.body.appendChild(lightbox);
    const lightboxImg = lightbox.querySelector('img');
    const closeBtn = lightbox.querySelector('.close-btn');

    function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add('open');
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
    }

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    // ---------- scroll reveal ----------
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        containers.forEach(c => observer.observe(c));
    } else {
        containers.forEach(c => c.classList.add('in-view'));
    }
});