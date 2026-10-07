-- Value Investing · estructura de la base de datos
-- Copia TODO este texto en Supabase → SQL Editor → New query → Run.
-- Solo hay que ejecutarlo una vez.

-- Empresas (cada una guarda todos sus datos, hipótesis y resultado)
create table if not exists public.empresas (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null default '',
  datos       jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Histórico: una fila cada vez que cambia tu valor intrínseco
create table if not exists public.valoraciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  fecha       timestamptz not null default now(),
  valor       numeric,
  precio      numeric,
  moneda      text,
  detalle     jsonb not null default '{}'::jsonb
);

create index if not exists valoraciones_empresa_idx on public.valoraciones (empresa_id, fecha);

-- Seguridad: cada usuario solo ve y modifica sus propios datos
alter table public.empresas     enable row level security;
alter table public.valoraciones enable row level security;

drop policy if exists "empresas propias" on public.empresas;
create policy "empresas propias" on public.empresas
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "valoraciones propias" on public.valoraciones;
create policy "valoraciones propias" on public.valoraciones
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
