(function () {
    'use strict';

    // Credenciais injetadas pelo servidor (server.js -> /env-config.js),
    // que le as variaveis do arquivo .env via dotenv.
    var url = window.__SUPABASE_URL__;
    var anonKey = window.__SUPABASE_ANON_KEY__;

    if (!window.supabase) {
        console.error(
            'supabaseClient.js: o SDK do Supabase não foi carregado. ' +
            'Inclua o script do Supabase CDN antes deste arquivo.'
        );
        return;
    }

    if (!url || !anonKey) {
        console.error(
            'supabaseClient.js: credenciais do Supabase ausentes. ' +
            'Abra o site através do servidor (node server.js) para que as ' +
            'variáveis do .env sejam injetadas no navegador.'
        );
        return;
    }

    // Instancia única usada em toda a aplicação (login.js, cadastro.js, etc.)
    window._supabase = window.supabase.createClient(url, anonKey);
})();