(function () {
    'use strict';

    var SUPABASE_URL = 'https://yhbpdtooknnvpevhxtvt.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_QcfBILqMhKgv064PjrXW-w_NHxAy5Kb';
    var BUCKET = 'portfolio';

    (function injetarApikey() {
        var originalFetch = window.fetch;
        if (!originalFetch) return;
        window.fetch = function (input, init) {
            var url = '';
            if (typeof input === 'string') url = input;
            else if (input && input.url) url = input.url;
            if (url.indexOf(SUPABASE_URL) === 0) {
                try {
                    var headers;
                    if (init && init.headers) {
                        headers = new Headers(init.headers);
                    } else if (typeof Request !== 'undefined' && input instanceof Request && input.headers) {
                        headers = new Headers(input.headers);
                    } else {
                        headers = new Headers();
                    }
                    if (!headers.has('apikey')) {
                        headers.set('apikey', SUPABASE_ANON_KEY);
                        headers.set('Authorization', 'Bearer ' + SUPABASE_ANON_KEY);
                    }
                    init = init || {};
                    init.headers = headers;
                } catch (e) { /* segue sem injetar */ }
            }
            return originalFetch.call(this, input, init);
        };
    })();

    function dataUrlToBlob(dataUrl) {
        var parts = String(dataUrl).split(',');
        var mime = (parts[0].match(/:(.*?);/) || [, 'application/octet-stream'])[1];
        var bin = atob(parts[1]);
        var len = bin.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    if (!window.supabase) {
        console.error('supabaseClient.js: inclua o CDN do Supabase ANTES deste arquivo.');
    } else {
        window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    window.SB = {
        client: function () { return window._supabase; },
        ready: function () { return !!window._supabase; },
        bucket: BUCKET,
        msgErro: function (err) {
            var msg = '';
            try {
                msg = (err && (err.message || err.error_description)) || '';
            } catch (e) { msg = ''; }
            var low = String(msg).toLowerCase();
            if (err && (err.code === '42703' || low.indexOf('does not exist') !== -1
                || low.indexOf('could not find') !== -1 || low.indexOf('invalid input') !== -1)) {
                return 'Banco desatualizado: rode o supabase.sql no SQL Editor do Supabase.';
            }
            if (low.indexOf('failed to fetch') !== -1 || low.indexOf('fetch failed') !== -1
                || low.indexOf('network') !== -1 || low.indexOf('load failed') !== -1
                || low.indexOf('cors') !== -1 || low.indexOf('typeerror') !== -1) {
                return 'Não foi possível conectar com o Cloud. Verifique a internet.';
            }
            return msg || 'Não foi possível conectar com o Cloud. Tente novamente.';
        },
        // A função nova do banco ainda não existe? (o site funciona nos dois formatos)
        // PGRST202 = função não encontrada | PGRST203 = assinatura diferente
        // 42883    = undefined_function ( Postgres )
        funcaoAusente: function (err) {
            if (!err) return false;
            var code = String(err.code || '');
            var low = String(err.message || '').toLowerCase();
            if (code === 'PGRST202' || code === 'PGRST203' || code === '42883') return true;
            return low.indexOf('could not find the function') !== -1
                || low.indexOf('undefined_function') !== -1
                || low.indexOf('does not exist') !== -1
                || low.indexOf('not found') !== -1
                || low.indexOf('failed to load') !== -1;
        },
        email: function () {
            try {
                var u = window.PSS ? window.PSS.getUser() : null;
                return (u && u.email) ? u.email : '';
            } catch (e) { return ''; }
        },
        publicUrl: function (path) {
            var r = window._supabase.storage.from(BUCKET).getPublicUrl(path);
            return (r && r.data && r.data.publicUrl) || '';
        },
        uploadBase64: function (dataUrl, path) {
            var blob = dataUrlToBlob(dataUrl);
            return window._supabase.storage.from(BUCKET)
                .upload(path, blob, { upsert: true })
                .then(function (res) {
                    if (res.error) throw res.error;
                    return SB.publicUrl(path);
                });
        },
        pathFromUrl: function (u) {
            var prefix = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/';
            if (String(u).indexOf(prefix) === 0) return String(u).substring(prefix.length);
            return '';
        },
        subscribe: function (table, column, value, callback) {
            if (!window._supabase) return null;
            var channel = window._supabase
                .channel('realtime-' + table + '-' + (column ? String(value) : 'all'))
                .on('postgres_changes', { event: '*', schema: 'public', table: table }, function (payload) {
                    if (column) {
                        var row = payload.new || payload.old || {};
                        var cell = row[column];
                        if (cell === undefined || cell === null) return;
                        if (String(cell).toLowerCase() !== String(value).toLowerCase()) return;
                    }
                    callback(payload);
                })
                .subscribe();
            return channel;
        }
    };
})();