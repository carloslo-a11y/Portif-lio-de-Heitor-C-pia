-- =====================================================
--  Portfólio Heitor · SCRIPT DE SEGURANÇA E PERMISSÕES
--  Supabase Dashboard -> SQL Editor -> New query -> Run
--
--  ⚠ RODE ESTE SCRIPT PARA A ADMINISTRAÇÃO FUNCIONAR.
--  Sem ele, o site continua funcionando do jeito antigo
--  (senha em texto puro, todo mundo edita).
--
--  O QUE ESTE SCRIPT FAZ
--  ----------------------
--   1) Guarda a SENHA com hash (sha256) em vez de texto puro.
--   2) Trava a tabela `usuarios`: ninguém consegue mais ler
--      a lista de e-mails e senhas usando a chave do site.
--   3) Cria a conta do ADMINISTRADOR:
--        carlosheitorcostalo@gmail.com  /  123456
--      Ele é o ÚNICO que pode editar atividades.
--   4) Toda conta nova (aluno ou professor) nasce como
--      'viewer': pode ver o site inteiro, mas não editar.
--   5) O cadastro NÃO deixa mais ninguém escolher o papel
--      de administrador.
--
--  É SEGURO RODAR DE NOVO (não apaga nada, não quebra).
--  ⚠ Cada vez que rodar, a senha do admin volta a ser 123456.
-- =====================================================

-- -----------------------------------------------------
-- 0) Extensão para gerar o hash da senha
-- -----------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------
-- 1) Tabela de LOGIN (usuarios)
--    Mantém as contas que já existem.
-- -----------------------------------------------------
create table if not exists public.usuarios (
    id        serial primary key,
    nome      text not null,
    email     text not null unique,
    senha     text not null,
    tipo      text not null default 'aluno',
    criado_em timestamptz default now()
);

-- papel = 'admin' (pode editar) | 'viewer' (só olha)
alter table public.usuarios add column if not exists papel text not null default 'viewer';

-- -----------------------------------------------------
-- 2) Converte as senhas em texto puro para hash
--    O prefixo "sha256:" marca o que já foi convertido,
--    então rodar o script de novo não hasha duas vezes.
--    >>> Suas contas atuais continuam com a mesma senha.
-- -----------------------------------------------------
update public.usuarios
   set senha = 'sha256:' || encode(digest(senha, 'sha256'), 'hex')
 where senha is not null
   and senha not like 'sha256:%';

-- -----------------------------------------------------
-- 3) Conta do ADMINISTRADOR (a única que edita)
-- -----------------------------------------------------
insert into public.usuarios (nome, email, senha, tipo, papel)
values (
    'Carlos Heitor Costalo',
    'carlosheitorcostalo@gmail.com',
    'sha256:' || encode(digest('123456', 'sha256'), 'hex'),
    'aluno',
    'admin'
)
on conflict (email) do update
    set senha = excluded.senha,
        papel = 'admin',
        nome  = excluded.nome;

-- Garante que ninguém mais seja marcado como admin.
update public.usuarios
   set papel = 'viewer'
 where lower(email) <> 'carlosheitorcostalo@gmail.com'
   and papel = 'admin';

-- -----------------------------------------------------
-- 4) Tranca a tabela `usuarios`
--    Antes qualquer um com a chave do site lia o e-mail e
--    a senha de todo mundo. Agora não lê mais nada:
--    o acesso só acontece dentro das funções abaixo.
-- -----------------------------------------------------
alter table public.usuarios enable row level security;

drop policy if exists "usuarios_publico" on public.usuarios;

revoke all on public.usuarios from anon, authenticated;

-- -----------------------------------------------------
-- 5) Função de LOGIN
--    Compara o hash dentro do banco e devolve SÓ o básico
--    (nunca devolve a senha nem o hash).
--    Devolve nenhuma linha se o e-mail ou a senha estiver errado.
-- -----------------------------------------------------
create or replace function public.fazer_login(p_email text, p_senha text)
returns table (id int, nome text, email text, tipo text, papel text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_alvo text := lower(trim(coalesce(p_email, '')));
    v_hash text;
begin
    if v_alvo = '' or coalesce(p_senha, '') = '' then
        return;
    end if;

    select u.senha into v_hash
      from public.usuarios u
     where lower(u.email) = v_alvo;

    if v_hash is null then
        return;
    end if;

    if v_hash = 'sha256:' || encode(digest(p_senha, 'sha256'), 'hex') then
        return query
            select u.id, u.nome, u.email, u.tipo, u.papel
              from public.usuarios u
             where lower(u.email) = v_alvo;
    end if;
end;
$$;

-- -----------------------------------------------------
-- 6) Função de CADASTRO
--    O papel é SEMPRE 'viewer'. Não existe como pedir
--    'admin' no cadastro. O e-mail do admin é reservado.
--    Devolve 'ok' ou 'email_existente'.
-- -----------------------------------------------------
create or replace function public.criar_conta(
    p_nome  text,
    p_email text,
    p_senha text,
    p_tipo text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_alvo text := lower(trim(coalesce(p_email, '')));
begin
    if v_alvo = '' then
        raise exception 'E-mail inválido.';
    end if;

    if coalesce(trim(p_nome), '') = '' then
        raise exception 'Nome inválido.';
    end if;

    if length(coalesce(p_senha, '')) < 6 then
        raise exception 'A senha deve ter pelo menos 6 caracteres.';
    end if;

    -- e-mail do administrador não pode ser cadastro por outra pessoa
    if v_alvo = 'carlosheitorcostalo@gmail.com' then
        return 'email_existente';
    end if;

    if exists (select 1 from public.usuarios u where lower(u.email) = v_alvo) then
        return 'email_existente';
    end if;

    insert into public.usuarios (nome, email, senha, tipo, papel)
    values (
        trim(p_nome),
        v_alvo,
        'sha256:' || encode(digest(p_senha, 'sha256'), 'hex'),
        case when p_tipo = 'professor' then 'professor' else 'aluno' end,
        'viewer'
    );

    return 'ok';
end;
$$;

-- Só as duas funções podem ser chamadas de fora.
revoke all on function public.fazer_login(text, text) from public;
grant execute on function public.fazer_login(text, text) to anon, authenticated;

revoke all on function public.criar_conta(text, text, text, text) from public;
grant execute on function public.criar_conta(text, text, text, text) to anon, authenticated;

-- =====================================================
--  A PARTIR DAQUI É O QUE JÁ EXISTIA NO SEU BANCO
--  (atualidades, anexos, imagens e tempo real)
-- =====================================================

-- -----------------------------------------------------
-- 7) Tabela de ATIVIDADES (fotos das 5 áreas)
--    area: natureza | matematica | linguagens | humanas | senai
--    SÓ É SUBSTITUÍDA SE ESTIVER VAZIA.
-- -----------------------------------------------------
do $$
begin
    if to_regclass('public.atividades') is not null
       and exists (select 1 from public.atividades limit 1) then
        raise notice 'AVISO: public.atividades NÃO está vazia. Nada foi alterado nela.';
        return;
    end if;

    drop table if exists public.atividades;

    create table public.atividades (
        id        text primary key,
        area      text not null,
        eixo      int  not null default 1,
        nome      text not null,
        data      text,
        src       text not null,
        criado_em timestamptz default now()
    );

    alter table public.atividades enable row level security;

    drop policy if exists "atividades_publico" on public.atividades;
    create policy "atividades_publico"
        on public.atividades
        for all
        to anon, authenticated
        using (true)
        with check (true);
end $$;

-- -----------------------------------------------------
-- 8) Tabela de ANEXOS (um registro global, com JSON)
--    SÓ É SUBSTITUÍDA SE ESTIVER VAZIA.
-- -----------------------------------------------------
do $$
begin
    if to_regclass('public.anexos') is not null
       and exists (select 1 from public.anexos limit 1) then
        raise notice 'AVISO: public.anexos NÃO está vazia. Nada foi alterado nela.';
        return;
    end if;

    drop table if exists public.anexos;

    create table public.anexos (
        id        text primary key,
        dados     jsonb not null default '{}'::jsonb,
        criado_em timestamptz default now()
    );

    alter table public.anexos enable row level security;

    drop policy if exists "anexos_publico" on public.anexos;
    create policy "anexos_publico"
        on public.anexos
        for all
        to anon, authenticated
        using (true)
        with check (true);
end $$;

-- -----------------------------------------------------
-- 9) Bucket "portfolio" (público) para as imagens
-- -----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "portfolio_publico" on storage.objects;

create policy "portfolio_publico"
    on storage.objects
    for all
    to anon, authenticated
    using (bucket_id = 'portfolio')
    with check (bucket_id = 'portfolio');

-- -----------------------------------------------------
-- 10) REALTIME (sincronização ao vivo entre abas/dispositivos)
-- -----------------------------------------------------
do $$
begin
    alter publication supabase_realtime add table public.atividades;
exception
    when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.anexos;
exception
    when duplicate_object then null;
end $$;

-- -----------------------------------------------------
-- 11) Recarrega o schema na API (vale na hora, sem espera)
-- -----------------------------------------------------
notify pgrst, 'reload schema';

-- =====================================================
--  COMO FUNCIONA AGORA
--  --------------------
--  * carlosheitorcostalo@gmail.com / 123456
--      -> Administrador. Vê e EDITA (datas, adicionar,
--         excluir atividades e anexos).
--
--  * Qualquer outra conta (aluno ou professor)
--      -> Visualização. Abre o site inteiro, mas os
--         botões de editar/apagar não aparecem.
--
--  * Novo cadastro já nasce como 'viewer'. Não existe
--    como se cadastrar como administrador.
--
--  SENHAS
--  -----
--  * Agora são guardadas como hash. Nem o dono da conta
--    consegue recuperar a senha original.
--  * Para trocar a senha do admin: troque '123456' no
--    item 3 deste script e rode de novo.
--
--  LIMITES (leia com atenção)
--  -------------------------
--  * O login e o cadastro estão trancados no banco: a
--    senha nunca é lida pelo navegador.
--  * A tabela de usuários está fechada: com a chave do
--    site não dá para ler e-mails nem senhas de ninguém.
--  * A permissão de EDITAR é controlada na tela do site.
--    Como o site é feito só com HTML e a chave do
--    Supabase fica visível no código, alguém com o
--    console do navegador ainda consegue escrever
--    direto no banco.
--    Para fechar isso de vez seria preciso migrar para
--    o login oficial do Supabase (Supabase Auth), que dá
--    um token assinado e permite a regra valer no
--    próprio banco.
-- =====================================================
