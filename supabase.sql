create extension if not exists pgcrypto with schema extensions;

create table if not exists public.usuarios (
    id        serial primary key,
    nome      text not null,
    email     text not null unique,
    senha     text not null,
    tipo      text not null default 'aluno',
    criado_em timestamptz default now()
);

alter table public.usuarios add column if not exists papel text not null default 'viewer';

update public.usuarios
   set senha = 'sha256:' || encode(digest(senha, 'sha256'), 'hex')
 where senha is not null
   and senha not like 'sha256:%';

insert into public.usuarios (nome, email, senha, tipo, papel)
values (
    'Carlos Heitor Costalo',
    'carlosheitorcostalo@gmail.com',
    'sha256:' || encode(digest('123456', 'sha256'), 'hex'),
    'aluno',
    'admin'
)
on conflict (email) do update
    set nome = excluded.nome,
        papel = 'admin';

update public.usuarios
   set papel = 'viewer'
 where lower(email) <> 'carlosheitorcostalo@gmail.com'
   and papel = 'admin';

alter table public.usuarios enable row level security;

drop policy if exists "usuarios_publico" on public.usuarios;

revoke all on public.usuarios from anon, authenticated;

drop function if exists public.fazer_login(text, text);

create or replace function public.fazer_login(p_email text, p_senha text)
returns table (id bigint, nome text, email text, tipo text, papel text)
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

create or replace function public.criar_conta(
    p_nome  text,
    p_email text,
    p_senha text,
    p_tipo  text
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

revoke all on function public.fazer_login(text, text) from public;
grant execute on function public.fazer_login(text, text) to anon, authenticated;

revoke all on function public.criar_conta(text, text, text, text) from public;
grant execute on function public.criar_conta(text, text, text, text) to anon, authenticated;

create table if not exists public.atividades (
    id           text primary key,
    area         text not null,
    eixo         int  not null default 1,
    nome         text not null,
    data         text,
    src          text not null,
    criado_em    timestamptz default now(),
    atualizado_em timestamptz default now()
);

alter table public.atividades add column if not exists atualizado_em timestamptz default now();
alter table public.atividades enable row level security;
alter table public.atividades replica identity full;

drop policy if exists "atividades_publico" on public.atividades;
create policy "atividades_publico"
    on public.atividades
    for all
    to anon, authenticated
    using (true)
    with check (true);

grant select, insert, update, delete on public.atividades to anon, authenticated;

create table if not exists public.anexos (
    id           text primary key,
    passo        int,
    dados        jsonb not null default '{}'::jsonb,
    criado_em    timestamptz default now(),
    atualizado_em timestamptz default now()
);

alter table public.anexos add column if not exists passo int;
alter table public.anexos add column if not exists atualizado_em timestamptz default now();
alter table public.anexos enable row level security;
alter table public.anexos replica identity full;

insert into public.anexos (id, passo, dados, criado_em, atualizado_em)
select 'passo-' || (p.ordem + 1)::text,
       (p.ordem + 1)::int,
       coalesce(p.item, '{}'::jsonb),
       now(),
       now()
  from public.anexos a
  cross join lateral jsonb_array_elements(a.dados->'passos') with ordinality as p(item, ordem)
 where a.dados ? 'passos'
   and jsonb_typeof(a.dados->'passos') = 'array'
   and not exists (
       select 1 from public.anexos x
        where x.id = 'passo-' || (p.ordem + 1)::text
   )
on conflict (id) do nothing;

delete from public.anexos where dados ? 'passos';

insert into public.anexos (id, passo, dados, criado_em, atualizado_em)
select 'passo-' || n::text,
       n::int,
       jsonb_build_object('desc', '', 'fotos', '[]'::jsonb),
       now(),
       now()
  from generate_series(1, 6) as n
on conflict (id) do nothing;

drop policy if exists "anexos_publico" on public.anexos;
create policy "anexos_publico"
    on public.anexos
    for all
    to anon, authenticated
    using (true)
    with check (true);

grant select, insert, update, delete on public.anexos to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

drop policy if exists "portfolio_publico" on storage.objects;
create policy "portfolio_publico"
    on storage.objects
    for all
    to anon, authenticated
    using (bucket_id = 'portfolio')
    with check (bucket_id = 'portfolio');

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

notify pgrst, 'reload schema';
