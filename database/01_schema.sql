-- ============================================================================
-- UNIVERSITY CAMPUS LOST & FOUND INTELLIGENCE SYSTEM
-- RELATIONAL + VECTOR DBMS SCHEMA (PostgreSQL 16 + pgvector)
-- ============================================================================

-- Enable pgvector extension for persistent dense vector storage & similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop tables if existing (in reverse dependency order)
DROP TABLE IF EXISTS password_reset_requests CASCADE;
DROP TABLE IF EXISTS revoked_tokens CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS status_history CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS handovers CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS match_candidates CASCADE;
DROP TABLE IF EXISTS found_items CASCADE;
DROP TABLE IF EXISTS lost_items CASCADE;
DROP TABLE IF EXISTS campus_locations CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ----------------------------------------------------------------------------
-- 1. USERS & ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'staff', 'admin')),
    phone VARCHAR(20),
    department VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 2. ITEM CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    icon_name VARCHAR(50) DEFAULT 'box',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. CAMPUS LOCATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE campus_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    zone VARCHAR(60) NOT NULL, -- e.g. Academic, Residential, Sports, Library, Cafeteria
    building VARCHAR(100),
    floor VARCHAR(30),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_locations_zone ON campus_locations(zone);

-- ----------------------------------------------------------------------------
-- 4. LOST ITEM REPORTS
-- ----------------------------------------------------------------------------
CREATE TABLE lost_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    location_id INTEGER REFERENCES campus_locations(id) ON DELETE SET NULL,
    approximate_location VARCHAR(200) NOT NULL,
    item_description TEXT NOT NULL,
    distinctive_details TEXT, -- Optional prompted characteristics
    brand VARCHAR(80),
    primary_color VARCHAR(40),
    secondary_color VARCHAR(40),
    lost_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    lost_time_range VARCHAR(50), -- e.g. 'Morning (9am-12pm)', 'Afternoon'
    status VARCHAR(30) NOT NULL DEFAULT 'open' 
        CHECK (status IN ('open', 'claim_pending', 'matched', 'resolved', 'cancelled')),
    image_url VARCHAR(500),
    embedding vector(384), -- all-MiniLM-L6-v2 384-dim dense sentence embedding
    embedding_model VARCHAR(100) DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lost_items_user ON lost_items(user_id);
CREATE INDEX idx_lost_items_category ON lost_items(category_id);
CREATE INDEX idx_lost_items_status ON lost_items(status);
CREATE INDEX idx_lost_items_date ON lost_items(lost_date_time);
CREATE INDEX idx_lost_items_fts ON lost_items USING GIN (
    to_tsvector('english', coalesce(item_description, '') || ' ' || coalesce(distinctive_details, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(approximate_location, ''))
);
CREATE INDEX idx_lost_items_embedding_hnsw ON lost_items USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 5. FOUND ITEMS (Physically received into university custody)
-- ----------------------------------------------------------------------------
CREATE TABLE found_items (
    id SERIAL PRIMARY KEY,
    recorded_by_staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    location_id INTEGER REFERENCES campus_locations(id) ON DELETE SET NULL,
    found_location_description VARCHAR(200) NOT NULL,
    item_description TEXT NOT NULL,
    distinctive_details TEXT,
    brand VARCHAR(80),
    primary_color VARCHAR(40),
    secondary_color VARCHAR(40),
    found_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    physical_custody_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    storage_location VARCHAR(120) NOT NULL, -- e.g. 'Lost & Found Room 104, Locker 3-B'
    finder_name VARCHAR(120),
    finder_contact VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'in_custody'
        CHECK (status IN ('in_custody', 'claim_pending', 'awaiting_handover', 'returned', 'disposed')),
    image_url VARCHAR(500),
    embedding vector(384), -- all-MiniLM-L6-v2 384-dim dense sentence embedding
    embedding_model VARCHAR(100) DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_found_items_category ON found_items(category_id);
CREATE INDEX idx_found_items_status ON found_items(status);
CREATE INDEX idx_found_items_storage ON found_items(storage_location);
CREATE INDEX idx_found_items_date ON found_items(found_date_time);
CREATE INDEX idx_found_items_fts ON found_items USING GIN (
    to_tsvector('english', coalesce(item_description, '') || ' ' || coalesce(distinctive_details, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(found_location_description, ''))
);
CREATE INDEX idx_found_items_embedding_hnsw ON found_items USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 6. MATCH CANDIDATES (Suggestions generated by intelligent engine)
-- ----------------------------------------------------------------------------
CREATE TABLE match_candidates (
    id SERIAL PRIMARY KEY,
    lost_item_id INTEGER NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
    found_item_id INTEGER NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
    match_score NUMERIC(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    semantic_score NUMERIC(5,2) DEFAULT 0.0 CHECK (semantic_score >= 0 AND semantic_score <= 100),
    structured_score NUMERIC(5,2) DEFAULT 0.0 CHECK (structured_score >= 0 AND structured_score <= 100),
    keyword_score NUMERIC(5,2) DEFAULT 0.0 CHECK (keyword_score >= 0 AND keyword_score <= 100),
    match_reasons TEXT, -- Structured JSON or readable explanation string
    staff_review_status VARCHAR(30) NOT NULL DEFAULT 'unreviewed'
        CHECK (staff_review_status IN ('unreviewed', 'relevant', 'rejected', 'investigating')),
    staff_notes TEXT,
    reviewed_by_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lost_found_match UNIQUE (lost_item_id, found_item_id)
);

CREATE INDEX idx_match_lost ON match_candidates(lost_item_id);
CREATE INDEX idx_match_found ON match_candidates(found_item_id);
CREATE INDEX idx_match_score ON match_candidates(match_score DESC);

-- ----------------------------------------------------------------------------
-- 7. CLAIMS & VERIFICATION
-- ----------------------------------------------------------------------------
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    found_item_id INTEGER NOT NULL REFERENCES found_items(id) ON DELETE RESTRICT,
    claimant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lost_item_id INTEGER REFERENCES lost_items(id) ON DELETE SET NULL,
    claim_description TEXT NOT NULL,
    proof_evidence_notes TEXT NOT NULL,
    distinctive_proof TEXT, -- Sensitive details submitted to verify ownership
    status VARCHAR(30) NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'withdrawn')),
    staff_reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    staff_decision_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claims_found ON claims(found_item_id);
CREATE INDEX idx_claims_claimant ON claims(claimant_user_id);
CREATE INDEX idx_claims_status ON claims(status);

-- ----------------------------------------------------------------------------
-- 8. PHYSICAL HANDOVER & RESOLUTION
-- ----------------------------------------------------------------------------
CREATE TABLE handovers (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL UNIQUE REFERENCES claims(id) ON DELETE RESTRICT,
    found_item_id INTEGER NOT NULL UNIQUE REFERENCES found_items(id) ON DELETE RESTRICT,
    recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    handover_date_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recipient_id_type VARCHAR(60) NOT NULL, -- e.g. 'Student ID Card', 'National ID'
    recipient_id_number VARCHAR(80) NOT NULL,
    handover_notes TEXT,
    recipient_signature_acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_handovers_found ON handovers(found_item_id);
CREATE INDEX idx_handovers_recipient ON handovers(recipient_user_id);
CREATE INDEX idx_handovers_staff ON handovers(staff_id);

-- ----------------------------------------------------------------------------
-- 9. IN-APP NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(40) NOT NULL, -- 'match_found', 'claim_update', 'handover_ready', 'general'
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_entity VARCHAR(50), -- 'claims', 'match_candidates', 'lost_items'
    reference_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- 10. AUDIT LOGS & STATUS HISTORY (DBMS Auditability)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(60) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT,
    new_values TEXT,
    changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

CREATE TABLE status_history (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('lost_item', 'found_item', 'claim')),
    entity_id INTEGER NOT NULL,
    old_status VARCHAR(40),
    new_status VARCHAR(40) NOT NULL,
    changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_status_history_entity ON status_history(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- 11. SECURITY & SESSION MANAGEMENT TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE revoked_tokens (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(128) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revoked_tokens_jti ON revoked_tokens(jti);

CREATE TABLE password_reset_requests (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    reset_token VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


