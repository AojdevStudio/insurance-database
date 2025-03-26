-- Drop existing tables if they exist
drop table if exists public.document_procedures cascade;
drop table if exists public.document_pages cascade;
drop table if exists public.carrier_documents cascade;
drop table if exists public.insurance_carriers cascade;

-- Create base tables if they don't exist

-- 1. Carriers table
create table if not exists public.insurance_carriers (
    id bigint generated always as identity primary key,
    name text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.insurance_carriers is 'Insurance carriers and their basic information';

-- 2. Carrier Documents Table
create table if not exists public.carrier_documents (
    id bigint generated always as identity primary key,
    carrier_id bigint references public.insurance_carriers(id),
    filename text not null,
    metadata jsonb default '{}'::jsonb,
    total_pages integer default 0,
    processed_date timestamp with time zone default current_timestamp,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

comment on table public.carrier_documents is 'Documents from insurance carriers containing policy information and procedures';

-- 3. Document Pages Table
create table if not exists public.document_pages (
    id bigint generated always as identity primary key,
    document_id bigint references public.carrier_documents(id) on delete cascade,
    page_number integer not null,
    content text not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,
    unique(document_id, page_number)
);

comment on table public.document_pages is 'Individual pages of carrier documents with extracted text content';

-- 4. Document Procedures Table
create table if not exists public.document_procedures (
    id bigint generated always as identity primary key,
    document_id bigint references public.carrier_documents(id) on delete cascade,
    procedure_code text not null,
    description text,
    submission_requirements text,
    documentation_required boolean default false,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,
    unique(document_id, procedure_code)
);

comment on table public.document_procedures is 'Dental procedures extracted from carrier documents';

-- Create updated_at trigger function if it doesn't exist
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Drop existing triggers if they exist
drop trigger if exists update_carrier_documents_updated_at on public.carrier_documents;
drop trigger if exists update_document_pages_updated_at on public.document_pages;
drop trigger if exists update_document_procedures_updated_at on public.document_procedures;
drop trigger if exists update_carriers_updated_at on public.insurance_carriers;

-- Apply updated_at triggers
create trigger update_carrier_documents_updated_at
    before update on public.carrier_documents
    for each row execute function public.update_updated_at();

create trigger update_document_pages_updated_at
    before update on public.document_pages
    for each row execute function public.update_updated_at();

create trigger update_document_procedures_updated_at
    before update on public.document_procedures
    for each row execute function public.update_updated_at();

create trigger update_carriers_updated_at
    before update on public.insurance_carriers
    for each row execute function public.update_updated_at();

-- Drop existing functions if they exist
drop function if exists public.upsert_carrier_document(bigint, text, jsonb, integer);
drop function if exists public.insert_document_page(bigint, integer, text);
drop function if exists public.insert_document_procedure(bigint, text, text, text, boolean);

-- Create or replace RPC functions for document operations
create or replace function public.upsert_carrier_document(
    p_carrier_id bigint,
    p_filename text,
    p_metadata jsonb,
    p_total_pages integer
) returns bigint 
language plpgsql
security invoker
set search_path = ''
as $$
declare
    doc_id bigint;
begin
    -- Try to find existing document
    select id into doc_id
    from public.carrier_documents
    where carrier_id = p_carrier_id and filename = p_filename;
    
    -- If found, update it
    if doc_id is not null then
        update public.carrier_documents
        set 
            metadata = p_metadata,
            total_pages = p_total_pages,
            processed_date = current_timestamp,
            updated_at = current_timestamp
        where id = doc_id;
    -- Otherwise insert new record
    else
        insert into public.carrier_documents (
            carrier_id, filename, metadata, total_pages
        ) values (
            p_carrier_id, p_filename, p_metadata, p_total_pages
        ) returning id into doc_id;
    end if;
    
    return doc_id;
end;
$$;

create or replace function public.insert_document_page(
    p_document_id bigint,
    p_page_number integer,
    p_content text
) returns bigint 
language plpgsql
security invoker
set search_path = ''
as $$
declare
    page_id bigint;
begin
    insert into public.document_pages (
        document_id, page_number, content
    ) values (
        p_document_id, p_page_number, p_content
    )
    on conflict (document_id, page_number) do update
    set content = p_content, updated_at = current_timestamp
    returning id into page_id;
    
    return page_id;
end;
$$;

create or replace function public.insert_document_procedure(
    p_document_id bigint,
    p_procedure_code text,
    p_description text,
    p_submission_requirements text,
    p_documentation_required boolean
) returns bigint 
language plpgsql
security invoker
set search_path = ''
as $$
declare
    proc_id bigint;
begin
    insert into public.document_procedures (
        document_id, procedure_code, description, 
        submission_requirements, documentation_required
    ) values (
        p_document_id, p_procedure_code, p_description, 
        p_submission_requirements, p_documentation_required
    )
    on conflict (document_id, procedure_code) do update
    set 
        description = p_description,
        submission_requirements = p_submission_requirements,
        documentation_required = p_documentation_required,
        updated_at = current_timestamp
    returning id into proc_id;
    
    return proc_id;
    
    exception when others then
        -- If the conflict is not due to our unique constraint, try again with a new insertion
        begin
            delete from public.document_procedures 
            where document_id = p_document_id and procedure_code = p_procedure_code;
            
            insert into public.document_procedures (
                document_id, procedure_code, description, 
                submission_requirements, documentation_required
            ) values (
                p_document_id, p_procedure_code, p_description, 
                p_submission_requirements, p_documentation_required
            )
            returning id into proc_id;
            
            return proc_id;
        end;
end;
$$;

-- Enable RLS
alter table public.insurance_carriers enable row level security;
alter table public.carrier_documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_procedures enable row level security;

-- Create policies for service role
create policy "Enable all access for service role" on public.insurance_carriers
    using (true)
    with check (true);

create policy "Enable all access for service role" on public.carrier_documents
    using (true)
    with check (true);

create policy "Enable all access for service role" on public.document_pages
    using (true)
    with check (true);

create policy "Enable all access for service role" on public.document_procedures
    using (true)
    with check (true);
