-- Database schema for Dental Insurance Networks Management System

/*
This schema defines the structure for managing dental insurance networks,
carriers, and their relationships, along with supporting tables for
Medicare Advantage plans, credentialing requirements, and more.
*/

-- 1. Networks table
create table public.insurance_networks (
    id bigint generated always as identity primary key,
    network_name text not null,
    
    contact_phone text,
    contact_email text,
    resource_url text,
    notes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.insurance_networks is 'Master list of insurance networks and their contact information';

-- 2. Carriers table
create table public.insurance_carriers (
    id bigint generated always as identity primary key,
    carrier_name text not null,
    carrier_type text check (carrier_type in ('National', 'Medicare Advantage', 'TPA', 'Other')),
    payer_id text,
    claims_address text,
    phone_number text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.insurance_carriers is 'Insurance carriers and their basic information';

-- 3. Network-Carrier relationships
create table public.network_carrier_relationships (
    id bigint generated always as identity primary key,
    network_id bigint references public.insurance_networks(id),
    carrier_id bigint references public.insurance_carriers(id),
    effective_date date,
    termination_date date,
    special_notes text,
    verification_required boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(network_id, carrier_id)
);

comment on table public.network_carrier_relationships is 'Mapping table that connects insurance networks with carriers and their relationship details';

-- 4. Medicare Advantage Plans
create table public.medicare_advantage_plans (
    id bigint generated always as identity primary key,
    carrier_id bigint references public.insurance_carriers(id),
    plan_name text not null,
    states_covered text, -- Comma-separated list of state abbreviations
    effective_date date,
    notes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.medicare_advantage_plans is 'Medicare Advantage plans offered by carriers and their coverage details';

-- 5. Credentialing Requirements
create table public.credentialing_requirements (
    id bigint generated always as identity primary key,
    network_id bigint references public.insurance_networks(id),
    carrier_id bigint references public.insurance_carriers(id),
    requirement_type text,
    description text not null,
    documentation_needed text,
    timeframe text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.credentialing_requirements is 'Documentation and timeline requirements for credentialing with networks and carriers';

-- 6. Processing Caveats
create table public.processing_caveats (
    id bigint generated always as identity primary key,
    network_id bigint references public.insurance_networks(id),
    carrier_id bigint references public.insurance_carriers(id),
    caveat_type text,
    description text not null,
    impact_level text check (impact_level in ('Low', 'Medium', 'High', 'Critical')),
    workaround text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.processing_caveats is 'Special processing rules and exceptions for specific network-carrier combinations';

-- 7. Carrier Aliases
create table public.carrier_aliases (
    id bigint generated always as identity primary key,
    carrier_id bigint references public.insurance_carriers(id),
    alias_name text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(alias_name)
);

comment on table public.carrier_aliases is 'Alternative names and variations for insurance carriers to assist in matching';

-- 8. Insurance Plans
create table public.insurance_plans (
    id bigint generated always as identity primary key,
    carrier_id bigint references public.insurance_carriers(id),
    plan_name text not null,
    plan_type text,
    is_medicare_advantage boolean default false,
    notes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.insurance_plans is 'Specific insurance plans offered by carriers';

-- 9. Procedures
create table public.procedures (
    id bigint generated always as identity primary key,
    procedure_code text not null,
    description text not null,
    category text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(procedure_code)
);

comment on table public.procedures is 'Dental procedures and their categorization';

-- 10. Carrier Procedure Requirements
create table public.carrier_procedure_requirements (
    id bigint generated always as identity primary key,
    carrier_id bigint references public.insurance_carriers(id),
    procedure_id bigint references public.procedures(id),
    documentation_required text,
    frequency_limitation text,
    age_restrictions text,
    other_limitations text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(carrier_id, procedure_id)
);

comment on table public.carrier_procedure_requirements is 'Specific requirements and limitations for procedures by carrier';

-- Create updated_at trigger function
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

-- Apply updated_at trigger to all tables
create trigger update_updated_at_insurance_networks
    before update on public.insurance_networks
    for each row execute function public.update_updated_at();

create trigger update_updated_at_insurance_carriers
    before update on public.insurance_carriers
    for each row execute function public.update_updated_at();

create trigger update_updated_at_network_carrier_relationships
    before update on public.network_carrier_relationships
    for each row execute function public.update_updated_at();

create trigger update_updated_at_medicare_advantage_plans
    before update on public.medicare_advantage_plans
    for each row execute function public.update_updated_at();

create trigger update_updated_at_credentialing_requirements
    before update on public.credentialing_requirements
    for each row execute function public.update_updated_at();

create trigger update_updated_at_processing_caveats
    before update on public.processing_caveats
    for each row execute function public.update_updated_at();

create trigger update_updated_at_carrier_aliases
    before update on public.carrier_aliases
    for each row execute function public.update_updated_at();

create trigger update_updated_at_insurance_plans
    before update on public.insurance_plans
    for each row execute function public.update_updated_at();

create trigger update_updated_at_procedures
    before update on public.procedures
    for each row execute function public.update_updated_at();

create trigger update_updated_at_carrier_procedure_requirements
    before update on public.carrier_procedure_requirements
    for each row execute function public.update_updated_at();