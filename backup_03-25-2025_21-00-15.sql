--
-- PostgreSQL database cluster dump
--

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Drop databases (except postgres and template1)
--

DROP DATABASE insurance_db;




--
-- Drop roles
--

DROP ROLE anon;
DROP ROLE authenticated;
DROP ROLE postgres;
DROP ROLE service_role;


--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:Rxlnoi2AvivFnDQKfWuqFw==$8sE9MSdRGgyIIGLQ7buFm6zqcwWJ8DsOjfe7KqRGHj4=:zQVXz2hxzZ2ohS41SSzbCEAkNRLiuNzkKqZiQPZ9jw4=';
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;

--
-- User Configurations
--








--
-- Databases
--

--
-- Database "template1" dump
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-1.pgdg120+1)
-- Dumped by pg_dump version 15.12 (Debian 15.12-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

UPDATE pg_catalog.pg_database SET datistemplate = false WHERE datname = 'template1';
DROP DATABASE template1;
--
-- Name: template1; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE template1 WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE template1 OWNER TO postgres;

\connect template1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE template1; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE template1 IS 'default template for new databases';


--
-- Name: template1; Type: DATABASE PROPERTIES; Schema: -; Owner: postgres
--

ALTER DATABASE template1 IS_TEMPLATE = true;


\connect template1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE template1; Type: ACL; Schema: -; Owner: postgres
--

REVOKE CONNECT,TEMPORARY ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE template1 TO PUBLIC;


--
-- PostgreSQL database dump complete
--

--
-- Database "insurance_db" dump
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-1.pgdg120+1)
-- Dumped by pg_dump version 15.12 (Debian 15.12-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: insurance_db; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE insurance_db WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE insurance_db OWNER TO postgres;

\connect insurance_db

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: carrier_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_aliases (
    id bigint NOT NULL,
    carrier_id bigint,
    alias_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_aliases OWNER TO postgres;

--
-- Name: TABLE carrier_aliases; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.carrier_aliases IS 'Alternative names and variations for insurance carriers to assist in matching';


--
-- Name: carrier_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.carrier_aliases ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.carrier_aliases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: carrier_procedure_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_procedure_requirements (
    id bigint NOT NULL,
    carrier_id bigint,
    procedure_id bigint,
    documentation_required text,
    frequency_limitation text,
    age_restrictions text,
    other_limitations text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_procedure_requirements OWNER TO postgres;

--
-- Name: TABLE carrier_procedure_requirements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.carrier_procedure_requirements IS 'Specific requirements and limitations for procedures by carrier';


--
-- Name: carrier_procedure_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.carrier_procedure_requirements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.carrier_procedure_requirements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: credentialing_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credentialing_requirements (
    id bigint NOT NULL,
    network_id bigint,
    carrier_id bigint,
    requirement_type text,
    description text NOT NULL,
    documentation_needed text,
    timeframe text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.credentialing_requirements OWNER TO postgres;

--
-- Name: TABLE credentialing_requirements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.credentialing_requirements IS 'Documentation and timeline requirements for credentialing with networks and carriers';


--
-- Name: credentialing_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.credentialing_requirements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.credentialing_requirements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insurance_carriers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_carriers (
    id bigint NOT NULL,
    carrier_name text NOT NULL,
    carrier_type text,
    payer_id text,
    claims_address text,
    phone_number text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT insurance_carriers_carrier_type_check CHECK ((carrier_type = ANY (ARRAY['National'::text, 'Medicare Advantage'::text, 'TPA'::text, 'Other'::text])))
);


ALTER TABLE public.insurance_carriers OWNER TO postgres;

--
-- Name: TABLE insurance_carriers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.insurance_carriers IS 'Insurance carriers and their basic information';


--
-- Name: insurance_carriers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.insurance_carriers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.insurance_carriers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insurance_networks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_networks (
    id bigint NOT NULL,
    network_name text NOT NULL,
    contact_phone text,
    contact_email text,
    resource_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.insurance_networks OWNER TO postgres;

--
-- Name: TABLE insurance_networks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.insurance_networks IS 'Master list of insurance networks and their contact information';


--
-- Name: insurance_networks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.insurance_networks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.insurance_networks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insurance_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_plans (
    id bigint NOT NULL,
    carrier_id bigint,
    plan_name text NOT NULL,
    plan_type text,
    is_medicare_advantage boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.insurance_plans OWNER TO postgres;

--
-- Name: TABLE insurance_plans; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.insurance_plans IS 'Specific insurance plans offered by carriers';


--
-- Name: insurance_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.insurance_plans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.insurance_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: json_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.json_uploads (
    id bigint NOT NULL,
    file_name text NOT NULL,
    content jsonb NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.json_uploads OWNER TO postgres;

--
-- Name: json_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.json_uploads ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.json_uploads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medicare_advantage_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medicare_advantage_plans (
    id bigint NOT NULL,
    carrier_id bigint,
    plan_name text NOT NULL,
    states_covered text,
    effective_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.medicare_advantage_plans OWNER TO postgres;

--
-- Name: TABLE medicare_advantage_plans; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.medicare_advantage_plans IS 'Medicare Advantage plans offered by carriers and their coverage details';


--
-- Name: medicare_advantage_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.medicare_advantage_plans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medicare_advantage_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: network_carrier_relationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.network_carrier_relationships (
    id bigint NOT NULL,
    network_id bigint,
    carrier_id bigint,
    effective_date date,
    termination_date date,
    special_notes text,
    verification_required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.network_carrier_relationships OWNER TO postgres;

--
-- Name: TABLE network_carrier_relationships; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.network_carrier_relationships IS 'Mapping table that connects insurance networks with carriers and their relationship details';


--
-- Name: network_carrier_relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.network_carrier_relationships ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.network_carrier_relationships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: procedures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.procedures (
    id bigint NOT NULL,
    procedure_code text NOT NULL,
    description text NOT NULL,
    category text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.procedures OWNER TO postgres;

--
-- Name: TABLE procedures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.procedures IS 'Dental procedures and their categorization';


--
-- Name: procedures_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.procedures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.procedures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: processing_caveats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processing_caveats (
    id bigint NOT NULL,
    network_id bigint,
    carrier_id bigint,
    caveat_type text,
    description text NOT NULL,
    impact_level text,
    workaround text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT processing_caveats_impact_level_check CHECK ((impact_level = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])))
);


ALTER TABLE public.processing_caveats OWNER TO postgres;

--
-- Name: TABLE processing_caveats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.processing_caveats IS 'Special processing rules and exceptions for specific network-carrier combinations';


--
-- Name: processing_caveats_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.processing_caveats ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.processing_caveats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: carrier_aliases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_aliases (id, carrier_id, alias_name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: carrier_procedure_requirements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_procedure_requirements (id, carrier_id, procedure_id, documentation_required, frequency_limitation, age_restrictions, other_limitations, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: credentialing_requirements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credentialing_requirements (id, network_id, carrier_id, requirement_type, description, documentation_needed, timeframe, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_carriers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_carriers (id, carrier_name, carrier_type, payer_id, claims_address, phone_number, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_networks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_networks (id, network_name, contact_phone, contact_email, resource_url, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_plans (id, carrier_id, plan_name, plan_type, is_medicare_advantage, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: json_uploads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.json_uploads (id, file_name, content, uploaded_at, updated_at) FROM stdin;
1	Principal.json	{"documents": [{"pages": [{"content": "Below is a link to Principal’s provider portal training videos. These videos offer guidance on \\nregistration, accessing the portal, and utilizing its features.  \\n���� Training Videos: How to view plan information  \\nThe \\"How to View Plan Information\\" video speciﬁcally demonstrates how to identify the network \\nutilized.  \\n \\n \\n", "page_number": 1}], "filename": "Principal Portal.pdf", "metadata": {"/Title": "", "/Author": "Dercher, Crystal", "/Company": "GEHA, Inc.", "/Creator": "Acrobat PDFMaker 24 for Word", "/ModDate": "D:20250226183926-06'00'", "/Subject": "", "/Comments": "", "/Keywords": "", "/Producer": "Adobe PDF Library 24.5.197", "/CreationDate": "D:20250226183923-06'00'", "/SourceModified": "D:20250227003840"}, "total_pages": 1}], "provider_name": "Principal", "processed_date": "2025-03-21T18:28:48.667680", "total_documents": 1}	2025-03-26 01:14:39.128515+00	2025-03-26 01:14:39.128515+00
2	Principal.json	{"documents": [{"pages": [{"content": "Below is a link to Principal’s provider portal training videos. These videos offer guidance on \\nregistration, accessing the portal, and utilizing its features.  \\n���� Training Videos: How to view plan information  \\nThe \\"How to View Plan Information\\" video speciﬁcally demonstrates how to identify the network \\nutilized.  \\n \\n \\n", "page_number": 1}], "filename": "Principal Portal.pdf", "metadata": {"/Title": "", "/Author": "Dercher, Crystal", "/Company": "GEHA, Inc.", "/Creator": "Acrobat PDFMaker 24 for Word", "/ModDate": "D:20250226183926-06'00'", "/Subject": "", "/Comments": "", "/Keywords": "", "/Producer": "Adobe PDF Library 24.5.197", "/CreationDate": "D:20250226183923-06'00'", "/SourceModified": "D:20250227003840"}, "total_pages": 1}], "provider_name": "Principal", "processed_date": "2025-03-21T18:28:48.667680", "total_documents": 1}	2025-03-26 01:27:36.05012+00	2025-03-26 01:27:36.05012+00
\.


--
-- Data for Name: medicare_advantage_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medicare_advantage_plans (id, carrier_id, plan_name, states_covered, effective_date, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: network_carrier_relationships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.network_carrier_relationships (id, network_id, carrier_id, effective_date, termination_date, special_notes, verification_required, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: procedures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.procedures (id, procedure_code, description, category, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: processing_caveats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.processing_caveats (id, network_id, carrier_id, caveat_type, description, impact_level, workaround, created_at, updated_at) FROM stdin;
\.


--
-- Name: carrier_aliases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carrier_aliases_id_seq', 1, false);


--
-- Name: carrier_procedure_requirements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carrier_procedure_requirements_id_seq', 1, false);


--
-- Name: credentialing_requirements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.credentialing_requirements_id_seq', 1, false);


--
-- Name: insurance_carriers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.insurance_carriers_id_seq', 1, false);


--
-- Name: insurance_networks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.insurance_networks_id_seq', 1, false);


--
-- Name: insurance_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.insurance_plans_id_seq', 1, false);


--
-- Name: json_uploads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.json_uploads_id_seq', 2, true);


--
-- Name: medicare_advantage_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.medicare_advantage_plans_id_seq', 1, false);


--
-- Name: network_carrier_relationships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_carrier_relationships_id_seq', 1, false);


--
-- Name: procedures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.procedures_id_seq', 1, false);


--
-- Name: processing_caveats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.processing_caveats_id_seq', 1, false);


--
-- Name: carrier_aliases carrier_aliases_alias_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_aliases
    ADD CONSTRAINT carrier_aliases_alias_name_key UNIQUE (alias_name);


--
-- Name: carrier_aliases carrier_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_aliases
    ADD CONSTRAINT carrier_aliases_pkey PRIMARY KEY (id);


--
-- Name: carrier_procedure_requirements carrier_procedure_requirements_carrier_id_procedure_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_procedure_requirements
    ADD CONSTRAINT carrier_procedure_requirements_carrier_id_procedure_id_key UNIQUE (carrier_id, procedure_id);


--
-- Name: carrier_procedure_requirements carrier_procedure_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_procedure_requirements
    ADD CONSTRAINT carrier_procedure_requirements_pkey PRIMARY KEY (id);


--
-- Name: credentialing_requirements credentialing_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentialing_requirements
    ADD CONSTRAINT credentialing_requirements_pkey PRIMARY KEY (id);


--
-- Name: insurance_carriers insurance_carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_carriers
    ADD CONSTRAINT insurance_carriers_pkey PRIMARY KEY (id);


--
-- Name: insurance_networks insurance_networks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_networks
    ADD CONSTRAINT insurance_networks_pkey PRIMARY KEY (id);


--
-- Name: insurance_plans insurance_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_pkey PRIMARY KEY (id);


--
-- Name: json_uploads json_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.json_uploads
    ADD CONSTRAINT json_uploads_pkey PRIMARY KEY (id);


--
-- Name: medicare_advantage_plans medicare_advantage_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medicare_advantage_plans
    ADD CONSTRAINT medicare_advantage_plans_pkey PRIMARY KEY (id);


--
-- Name: network_carrier_relationships network_carrier_relationships_network_id_carrier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_carrier_relationships
    ADD CONSTRAINT network_carrier_relationships_network_id_carrier_id_key UNIQUE (network_id, carrier_id);


--
-- Name: network_carrier_relationships network_carrier_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_carrier_relationships
    ADD CONSTRAINT network_carrier_relationships_pkey PRIMARY KEY (id);


--
-- Name: procedures procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_pkey PRIMARY KEY (id);


--
-- Name: procedures procedures_procedure_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_procedure_code_key UNIQUE (procedure_code);


--
-- Name: processing_caveats processing_caveats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_caveats
    ADD CONSTRAINT processing_caveats_pkey PRIMARY KEY (id);


--
-- Name: carrier_aliases update_updated_at_carrier_aliases; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_carrier_aliases BEFORE UPDATE ON public.carrier_aliases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: carrier_procedure_requirements update_updated_at_carrier_procedure_requirements; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_carrier_procedure_requirements BEFORE UPDATE ON public.carrier_procedure_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: credentialing_requirements update_updated_at_credentialing_requirements; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_credentialing_requirements BEFORE UPDATE ON public.credentialing_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: insurance_carriers update_updated_at_insurance_carriers; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_insurance_carriers BEFORE UPDATE ON public.insurance_carriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: insurance_networks update_updated_at_insurance_networks; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_insurance_networks BEFORE UPDATE ON public.insurance_networks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: insurance_plans update_updated_at_insurance_plans; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_insurance_plans BEFORE UPDATE ON public.insurance_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: json_uploads update_updated_at_json_uploads; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_json_uploads BEFORE UPDATE ON public.json_uploads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: medicare_advantage_plans update_updated_at_medicare_advantage_plans; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_medicare_advantage_plans BEFORE UPDATE ON public.medicare_advantage_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: network_carrier_relationships update_updated_at_network_carrier_relationships; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_network_carrier_relationships BEFORE UPDATE ON public.network_carrier_relationships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: procedures update_updated_at_procedures; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_procedures BEFORE UPDATE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: processing_caveats update_updated_at_processing_caveats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_updated_at_processing_caveats BEFORE UPDATE ON public.processing_caveats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: carrier_aliases carrier_aliases_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_aliases
    ADD CONSTRAINT carrier_aliases_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: carrier_procedure_requirements carrier_procedure_requirements_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_procedure_requirements
    ADD CONSTRAINT carrier_procedure_requirements_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: carrier_procedure_requirements carrier_procedure_requirements_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_procedure_requirements
    ADD CONSTRAINT carrier_procedure_requirements_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.procedures(id);


--
-- Name: credentialing_requirements credentialing_requirements_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentialing_requirements
    ADD CONSTRAINT credentialing_requirements_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: credentialing_requirements credentialing_requirements_network_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentialing_requirements
    ADD CONSTRAINT credentialing_requirements_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.insurance_networks(id);


--
-- Name: insurance_plans insurance_plans_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: medicare_advantage_plans medicare_advantage_plans_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medicare_advantage_plans
    ADD CONSTRAINT medicare_advantage_plans_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: network_carrier_relationships network_carrier_relationships_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_carrier_relationships
    ADD CONSTRAINT network_carrier_relationships_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: network_carrier_relationships network_carrier_relationships_network_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_carrier_relationships
    ADD CONSTRAINT network_carrier_relationships_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.insurance_networks(id);


--
-- Name: processing_caveats processing_caveats_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_caveats
    ADD CONSTRAINT processing_caveats_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.insurance_carriers(id);


--
-- Name: processing_caveats processing_caveats_network_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_caveats
    ADD CONSTRAINT processing_caveats_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.insurance_networks(id);


--
-- PostgreSQL database dump complete
--

--
-- Database "postgres" dump
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-1.pgdg120+1)
-- Dumped by pg_dump version 15.12 (Debian 15.12-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE postgres;
--
-- Name: postgres; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE postgres WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE postgres OWNER TO postgres;

\connect postgres

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE postgres; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE postgres IS 'default administrative connection database';


--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database cluster dump complete
--

