-- Enable pgvector extension
create extension if not exists vector;

-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Embeddings table
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  content text not null,
  embedding vector(1536), -- Dimension for text-embedding-3-small
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Search function
create or replace function match_embeddings (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    embeddings.id,
    embeddings.content,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from embeddings
  where 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  and project_id = p_id
  order by embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;
