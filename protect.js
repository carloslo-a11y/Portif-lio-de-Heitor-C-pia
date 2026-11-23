(function () {
    var user = window.SB && window.SB.ready()
        ? window.SB.usuario()
        : (function () {
            try {
                var raw = localStorage.getItem('user');
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        })();

    if (!user) {
        window.location.replace('login.html');
        return;
    }

    var papel = window.SB && window.SB.ready() ? window.SB.papel() : 'viewer';
    document.body.classList.add(papel === 'admin' ? 'sb-admin' : 'sb-viewer');

    var style = document.createElement('style');
    style.textContent =
        'body.sb-viewer .activity-form,body.sb-viewer .add-item-btn,body.sb-viewer .edit-btn,' +
        'body.sb-viewer .remove-btn,body.sb-viewer .replace-btn{display:none !important;}' +
        '.pf-home-bar{position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;gap:10px;align-items:center;}' +
        '.pf-home-bar .pf-btn{font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.05em;text-decoration:none;border:none;cursor:pointer;' +
        'clip-path:polygon(12% 0%,88% 0%,100% 50%,88% 100%,12% 100%,0% 50%);padding:10px 20px;transition:transform .15s ease,filter .15s ease;box-shadow:0 8px 22px rgba(0,0,0,.4);}' +
        '.pf-home-bar .pf-btn:hover{transform:translateY(-2px);filter:brightness(1.1);}' +
        '.pf-home-bar .pf-inicio{background:linear-gradient(160deg,#FFC93C,#E6A233);color:#170F09;}' +
        '.pf-home-bar .pf-sair{background:rgba(46,29,12,.92);border:1px solid #5A3A16;color:#F6E7C6;}' +
        '.pf-home-bar .pf-papel{font-family:"Space Mono",monospace;font-size:10px;letter-spacing:.06em;' +
        'text-transform:uppercase;color:#C9AE83;background:rgba(23,15,9,.86);border:1px solid #5A3A16;' +
        'border-radius:999px;padding:8px 12px;}';

    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'pf-home-bar';
    bar.innerHTML =
        '<span class="pf-papel">' + (papel === 'admin' ? 'Admin · sincronizado' : 'Somente leitura') + '</span>' +
        '<a class="pf-btn pf-inicio" href="index.html">In&iacute;cio</a>' +
        '<button type="button" class="pf-btn pf-sair">Sair</button>';

    bar.querySelector('.pf-sair').addEventListener('click', function () {
        if (window.SB && window.SB.ready()) window.SB.sair();
        else localStorage.removeItem('user');
        window.location.replace('login.html');
    });

    document.body.appendChild(bar);
})();
