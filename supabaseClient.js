(function () {
    'use strict';

    // Configuração pode vir de duas fontes:
    //  1) env-config.js estático (site em hospedagem estática) -> globals diretos;
    //  2) server.js injetando /env-config.js com as variáveis do .env.
    // Em ambos os casos as globals são window.__SUPABASE_URL__ e __SUPABASE_ANON_KEY__.
    function getConfig() {
        var url = window.__SUPABASE_URL__;
        var anonKey = window.__SUPABASE_ANON_KEY__;
        if (url && anonKey) return { url: url, anonKey: anonKey };
        return null;
    }

    function loadScript(src, onOk, onFail) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = onOk;
        s.onerror = onFail;
        document.head.appendChild(s);
    }

    function initClient(cfg) {
        if (!window.supabase) {
            // SDK ausente (CDN bloqueado) -> tenta um CDN alternativo.
            loadScript(
                'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js',
                function () {
                    window._supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
                },
                function () {
                    window._supabaseError = 'Não foi possível carregar o SDK do Supabase (bloqueio de CDN/Internet).';
                }
            );
            return;
        }
        window._supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
    }

    function boot() {
        var cfg = getConfig();
        if (cfg) {
            initClient(cfg);
            return;
        }

        // Fallback: carrega env-config.js dinamicamente (caso o <script> não tenha carregado).
        loadScript(
            'env-config.js',
            function () {
                var again = getConfig();
                if (again) {
                    initClient(again);
                } else {
                    window._supabaseError = 'env-config.js carregou, mas sem credenciais válidas.';
                }
            },
            function () {
                window._supabaseError =
                    'Credenciais do Supabase ausentes (env-config.js não encontrado no deploy).';
            }
        );
    }

    boot();
})();