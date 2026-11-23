(function () {
    'use strict';

    var url = String(window.__SUPABASE_URL__ || '').replace(/\/+$/, '');
    var key = String(window.__SUPABASE_ANON_KEY__ || '');
    var bucket = 'portfolio';

    function msgErro(err) {
        var msg = '';
        var code = '';
        try {
            msg = (err && (err.message || err.error_description || err.details)) || '';
            code = String((err && err.code) || '');
        } catch (e) {
            msg = '';
        }
        var low = String(msg).toLowerCase();
        if (code === 'PGRST202' || code === 'PGRST203' || code === '42883' ||
            low.indexOf('could not find the function') !== -1 ||
            low.indexOf('undefined_function') !== -1) {
            return 'Banco desatualizado: rode o supabase.sql no SQL Editor do Supabase.';
        }
        if (low.indexOf('row-level security') !== -1 || low.indexOf('permission denied') !== -1 ||
            code === '42501') {
            return 'Acesso negado pelo Supabase. Rode o supabase.sql e verifique as policies.';
        }
        if (low.indexOf('does not exist') !== -1 || low.indexOf('could not find') !== -1 ||
            low.indexOf('schema cache') !== -1) {
            return 'Banco desatualizado: rode o supabase.sql no SQL Editor do Supabase.';
        }
        if (low.indexOf('failed to fetch') !== -1 || low.indexOf('fetch failed') !== -1 ||
            low.indexOf('network') !== -1 || low.indexOf('load failed') !== -1 ||
            low.indexOf('cors') !== -1 || low.indexOf('typeerror') !== -1) {
            return 'Não foi possível conectar com o Cloud. Verifique a internet.';
        }
        if (low.indexOf('payload too large') !== -1 || low.indexOf('exceeded') !== -1) {
            return 'Arquivo muito grande para o Storage. Use uma imagem menor.';
        }
        return msg || 'Não foi possível conectar com o Cloud. Tente novamente.';
    }

    function funcaoAusente(err) {
        if (!err) return false;
        var code = String(err.code || '');
        var low = String(err.message || '').toLowerCase();
        return code === 'PGRST202' || code === 'PGRST203' || code === '42883' ||
            low.indexOf('could not find the function') !== -1 ||
            low.indexOf('undefined_function') !== -1;
    }

    function client() {
        return window._supabase || null;
    }

    function ready() {
        return !!window._supabase;
    }

    function semConexao() {
        return new Error(window._supabaseError || 'Supabase não configurado neste dispositivo.');
    }

    if (!url || !key) {
        window._supabaseError = 'Configuração do Supabase ausente. Rode npm run env:generate ou publique env-config.js.';
    } else if (!window.supabase) {
        window._supabaseError = 'A biblioteca do Supabase não carregou. Verifique a conexão e recarregue a página.';
    } else {
        try {
            window._supabase = window.supabase.createClient(url, key, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
        } catch (err) {
            window._supabaseError = msgErro(err);
        }
    }

    function guardarSessao(user) {
        if (!user) return null;
        var session = {
            id: user.id,
            nome: user.nome || '',
            email: user.email || '',
            tipo: user.tipo || 'aluno',
            papel: user.papel === 'admin' ? 'admin' : 'viewer'
        };
        localStorage.setItem('user', JSON.stringify(session));
        return session;
    }

    function usuario() {
        try {
            var raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function papel() {
        var user = usuario();
        return user && user.papel === 'admin' ? 'admin' : 'viewer';
    }

    function podeEditar() {
        return papel() === 'admin';
    }

    function sair() {
        localStorage.removeItem('user');
    }

    function login(email, senha) {
        var c = client();
        if (!c) return Promise.reject(semConexao());
        return c.rpc('fazer_login', { p_email: email, p_senha: senha }).then(function (res) {
            if (res.error) {
                if (funcaoAusente(res.error)) return loginLegado(email, senha);
                throw res.error;
            }
            var rows = Array.isArray(res.data) ? res.data : [];
            var user = rows[0] || null;
            if (!user) return null;
            return guardarSessao(user);
        });
    }

    function loginLegado(email, senha) {
        return client().from('usuarios').select('*')
            .eq('email', email)
            .eq('senha', senha)
            .maybeSingle()
            .then(function (res) {
                if (res.error) throw res.error;
                return res.data ? guardarSessao(res.data) : null;
            });
    }

    function cadastrar(nome, email, senha, tipo) {
        var c = client();
        if (!c) return Promise.reject(semConexao());
        return c.rpc('criar_conta', {
            p_nome: nome,
            p_email: email,
            p_senha: senha,
            p_tipo: tipo
        }).then(function (res) {
            if (res.error) {
                if (funcaoAusente(res.error)) return cadastroLegado(nome, email, senha, tipo);
                throw res.error;
            }
            return res.data;
        });
    }

    function cadastroLegado(nome, email, senha, tipo) {
        var c = client();
        return c.from('usuarios').select('id').eq('email', email).maybeSingle().then(function (res) {
            if (res.error) throw res.error;
            if (res.data) return 'email_existente';
            return c.from('usuarios').insert([{ nome: nome, email: email, senha: senha, tipo: tipo }])
                .then(function (r) {
                    if (r.error) throw r.error;
                    return 'ok';
                });
        });
    }

    function dataUrlToBlob(dataUrl) {
        var parts = String(dataUrl).split(',');
        var match = parts[0].match(/:(.*?);/);
        var mime = match ? match[1] : 'application/octet-stream';
        var bin = atob(parts[1] || '');
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    function isDataUrl(value) {
        return typeof value === 'string' && value.indexOf('data:') === 0;
    }

    function sanitize(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'arquivo';
    }

    function extensao(name, mime) {
        var base = sanitize(name || '').split('.').pop();
        if (base && base.length <= 5 && base.indexOf('arquivo') !== 0) return base;
        var map = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'application/pdf': 'pdf'
        };
        return map[String(mime || '').toLowerCase()] || 'bin';
    }

    function publicUrl(path) {
        var c = client();
        if (!c || !path) return '';
        var res = c.storage.from(bucket).getPublicUrl(path);
        return (res && res.data && res.data.publicUrl) || '';
    }

    function pathFromUrl(value) {
        var source = String(value || '');
        var marker = '/storage/v1/object/public/' + bucket + '/';
        var index = source.indexOf(marker);
        if (index === -1) return '';
        try {
            return decodeURIComponent(source.substring(index + marker.length).split('?')[0]);
        } catch (e) {
            return source.substring(index + marker.length).split('?')[0];
        }
    }

    function uploadFile(file, path, upsert) {
        var c = client();
        if (!c) return Promise.reject(semConexao());
        return c.storage.from(bucket).upload(path, file, {
            upsert: upsert !== false,
            contentType: file.type || 'application/octet-stream'
        }).then(function (res) {
            if (res.error) throw res.error;
            return publicUrl(path);
        });
    }

    function uploadDataUrl(dataUrl, path, upsert) {
        return uploadFile(dataUrlToBlob(dataUrl), path, upsert);
    }

    function removeByUrl(url) {
        var path = pathFromUrl(url);
        var c = client();
        if (!c || !path) return Promise.resolve(false);
        return c.storage.from(bucket).remove([path]).then(function (res) {
            return !res.error;
        }).catch(function () {
            return false;
        });
    }

    function nowId(prefix) {
        return String(prefix || 'id') + '-' + Date.now().toString(36) + '-' +
            Math.random().toString(36).slice(2, 8);
    }

    function subscribe(table, callback) {
        var c = client();
        if (!c || typeof callback !== 'function') return null;
        return c.channel('realtime-' + table + '-' + nowId('canal'))
            .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
            .subscribe();
    }

    window.SB = {
        client: client,
        ready: ready,
        bucket: bucket,
        msgErro: msgErro,
        funcaoAusente: funcaoAusente,
        guardarSessao: guardarSessao,
        usuario: usuario,
        papel: papel,
        podeEditar: podeEditar,
        sair: sair,
        login: login,
        cadastrar: cadastrar,
        isDataUrl: isDataUrl,
        sanitize: sanitize,
        extensao: extensao,
        publicUrl: publicUrl,
        pathFromUrl: pathFromUrl,
        uploadFile: uploadFile,
        uploadDataUrl: uploadDataUrl,
        removeByUrl: removeByUrl,
        nowId: nowId,
        subscribe: subscribe
    };
})();
