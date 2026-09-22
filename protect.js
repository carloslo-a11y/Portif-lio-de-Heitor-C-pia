(function () {
    var userRaw = localStorage.getItem('user');
    var user = null;
    try { user = userRaw ? JSON.parse(userRaw) : null; } catch (e) { user = null; }

    if (!user) {
        window.location.replace('login.html');
        return;
    }

    var style = document.createElement('style');
    style.textContent =
        '.pf-home-bar{position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;gap:10px;align-items:center;}' +
        '.pf-home-bar .pf-btn{font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.05em;text-decoration:none;border:none;cursor:pointer;' +
        'clip-path:polygon(12% 0%,88% 0%,100% 50%,88% 100%,12% 100%,0% 50%);padding:10px 20px;transition:transform .15s ease,filter .15s ease;box-shadow:0 8px 22px rgba(0,0,0,.4);}' +
        '.pf-home-bar .pf-btn:hover{transform:translateY(-2px);filter:brightness(1.1);}' +
        '.pf-home-bar .pf-inicio{background:linear-gradient(160deg,#FFC93C,#E6A233);color:#170F09;}' +
        '.pf-home-bar .pf-sair{background:rgba(46,29,12,.92);border:1px solid #5A3A16;color:#F6E7C6;}';

    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'pf-home-bar';
    bar.innerHTML =
        '<a class="pf-btn pf-inicio" href="index.html">In&iacute;cio</a>' +
        '<button type="button" class="pf-btn pf-sair">Sair</button>';

    bar.querySelector('.pf-sair').addEventListener('click', function () {
        localStorage.removeItem('user');
        window.location.replace('login.html');
    });

    document.body.appendChild(bar);
})();