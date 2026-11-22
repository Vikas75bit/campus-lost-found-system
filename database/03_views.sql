-- ============================================================================
-- UNIVERSITY CAMPUS LOST & FOUND INTELLIGENCE SYSTEM
-- ADVANCED DBMS FEATURES: RELATIONAL VIEWS FOR REPORTING & SECURITY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VIEW: Safe Public View of Found Items (Data Masking)
-- Masks confidential physical storage codes and finder details from students
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_public_found_items AS
SELECT 
    f.id,
    c.name AS category_name,
    f.found_location_description,
    f.item_description,
    f.brand,
    f.primary_color,
    f.secondary_color,
    f.found_date_time,
    f.status,
    f.image_url,
    f.created_at
FROM found_items f
JOIN categories c ON f.category_id = c.id
WHERE f.status IN ('in_custody', 'claim_pending');

-- ----------------------------------------------------------------------------
-- 2. VIEW: Staff Candidate Match Queue
-- High-priority queue joining lost and found items with similarity breakdown
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_staff_match_queue AS
SELECT 
    mc.id AS match_id,
    mc.lost_item_id,
    u_lost.full_name AS owner_name,
    u_lost.email AS owner_email,
    c.name AS category,
    l.item_description AS lost_description,
    l.approximate_location AS lost_location,
    l.lost_date_time,
    mc.found_item_id,
    f.item_description AS found_description,
    f.found_location_description AS found_location,
    f.found_date_time,
    f.storage_location,
    mc.match_score,
    mc.semantic_score,
    mc.structured_score,
    mc.keyword_score,
    mc.match_reasons,
    mc.staff_review_status,
    mc.staff_notes,
    mc.created_at AS matched_at
FROM match_candidates mc
JOIN lost_items l ON mc.lost_item_id = l.id
JOIN users u_lost ON l.user_id = u_lost.id
JOIN found_items f ON mc.found_item_id = f.id
JOIN categories c ON l.category_id = c.id
WHERE l.status IN ('open', 'matched')
  AND f.status IN ('in_custody', 'claim_pending');

-- ----------------------------------------------------------------------------
-- 3. VIEW: Pending Claims Verification Queue
-- Allows staff to audit claimant information, proof, and status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_claims_pending_review AS
SELECT 
    cl.id AS claim_id,
    cl.found_item_id,
    f.item_description AS item_description,
    f.storage_location,
    cl.claimant_user_id,
    u.full_name AS claimant_name,
    u.email AS claimant_email,
    u.phone AS claimant_phone,
    cl.claim_description,
    cl.proof_evidence_notes,
    cl.distinctive_proof,
    cl.status AS claim_status,
    cl.staff_reviewer_id,
    u_staff.full_name AS reviewer_name,
    cl.staff_decision_notes,
    cl.created_at AS submitted_at
FROM claims cl
JOIN found_items f ON cl.found_item_id = f.id
JOIN users u ON cl.claimant_user_id = u.id
LEFT JOIN users u_staff ON cl.staff_reviewer_id = u_staff.id
WHERE cl.status IN ('submitted', 'under_review', 'info_requested');

-- ----------------------------------------------------------------------------
-- 4. VIEW: Completed Physical Handover Audit View
-- Comprehensive record of handed over items, staff in charge, and recipient IDs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_handover_audit_summary AS
SELECT 
    h.id AS handover_id,
    h.handover_date_time,
    f.id AS found_item_id,
    c.name AS category,
    f.item_description,
    u_recip.full_name AS recipient_name,
    u_recip.email AS recipient_email,
    h.recipient_id_type,
    h.recipient_id_number,
    u_staff.full_name AS staff_officer_name,
    h.handover_notes
FROM handovers h
JOIN found_items f ON h.found_item_id = f.id
JOIN categories c ON f.category_id = c.id
JOIN users u_recip ON h.recipient_user_id = u_recip.id
JOIN users u_staff ON h.staff_id = u_staff.id;

-- ----------------------------------------------------------------------------
-- 5. VIEW: Operational Category Performance & Resolution Metrics
-- Aggregate metrics demonstrating GROUP BY, subqueries, and statistical summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_category_resolution_metrics AS
SELECT 
    c.id AS category_id,
    c.name AS category_name,
    COUNT(DISTINCT l.id) AS total_lost_reports,
    COUNT(DISTINCT f.id) AS total_found_items,
    COUNT(DISTINCT CASE WHEN f.status = 'returned' THEN f.id END) AS items_returned_to_owner,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT f.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN f.status = 'returned' THEN f.id END)::numeric / COUNT(DISTINCT f.id)::numeric) * 100 
            ELSE 0 
        END, 2
    ) AS return_rate_percentage
FROM categories c
LEFT JOIN lost_items l ON c.id = l.category_id
LEFT JOIN found_items f ON c.id = f.category_id
GROUP BY c.id, c.name;

