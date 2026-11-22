-- ============================================================================
-- UNIVERSITY CAMPUS LOST & FOUND INTELLIGENCE SYSTEM
-- ADVANCED DBMS DEMONSTRATION QUERIES (PostgreSQL / ANSI SQL)
-- Demonstrating: Joins, Aggregations, Window Functions, CTEs, Subqueries & FTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPLEX MULTI-TABLE JOIN (4+ Tables)
-- Retrieves complete traceability of returned items: Claim, Claimant, Staff, Location
-- ----------------------------------------------------------------------------
SELECT 
    h.id AS handover_id,
    h.handover_date_time,
    f.item_description AS item_name,
    c.name AS category,
    loc.name AS found_location_name,
    u_recip.full_name AS recipient_name,
    u_recip.email AS recipient_email,
    u_staff.full_name AS verifying_staff,
    cl.proof_evidence_notes
FROM handovers h
JOIN found_items f ON h.found_item_id = f.id
JOIN categories c ON f.category_id = c.id
LEFT JOIN campus_locations loc ON f.location_id = loc.id
JOIN users u_recip ON h.recipient_user_id = u_recip.id
JOIN users u_staff ON h.staff_id = u_staff.id
JOIN claims cl ON h.claim_id = cl.id
ORDER BY h.handover_date_time DESC;

-- ----------------------------------------------------------------------------
-- 2. AGGREGATION WITH GROUP BY AND HAVING
-- Identifies campus high-loss zones with at least 1 unresolved lost item
-- ----------------------------------------------------------------------------
SELECT 
    COALESCE(loc.zone, 'Unassigned / General') AS campus_zone,
    COUNT(l.id) AS total_lost_reports,
    COUNT(CASE WHEN l.status = 'open' THEN 1 END) AS currently_open_reports,
    ROUND(AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - l.lost_date_time))/86400)::numeric, 1) AS avg_days_since_lost
FROM lost_items l
LEFT JOIN campus_locations loc ON l.location_id = loc.id
GROUP BY loc.zone
HAVING COUNT(l.id) >= 1
ORDER BY currently_open_reports DESC;

-- ----------------------------------------------------------------------------
-- 3. SUBQUERY DEMONSTRATION
-- Finds match candidates whose score exceeds the average score of their category
-- ----------------------------------------------------------------------------
SELECT 
    mc.id,
    mc.lost_item_id,
    mc.found_item_id,
    c.name AS category_name,
    mc.match_score,
    (
        SELECT ROUND(AVG(inner_mc.match_score), 2)
        FROM match_candidates inner_mc
        JOIN lost_items inner_l ON inner_mc.lost_item_id = inner_l.id
        WHERE inner_l.category_id = l.category_id
    ) AS category_avg_score
FROM match_candidates mc
JOIN lost_items l ON mc.lost_item_id = l.id
JOIN categories c ON l.category_id = c.id
WHERE mc.match_score > (
    SELECT AVG(inner_mc.match_score)
    FROM match_candidates inner_mc
    JOIN lost_items inner_l ON inner_mc.lost_item_id = inner_l.id
    WHERE inner_l.category_id = l.category_id
)
ORDER BY mc.match_score DESC;

-- ----------------------------------------------------------------------------
-- 4. WINDOW FUNCTION (RANK() & ROW_NUMBER() OVER PARTITION)
-- Ranks top 3 matching candidates for each lost item by match score
-- ----------------------------------------------------------------------------
WITH RankedMatches AS (
    SELECT 
        l.id AS lost_id,
        l.item_description AS lost_item,
        f.id AS found_id,
        f.item_description AS found_item,
        mc.match_score,
        mc.semantic_score,
        mc.structured_score,
        RANK() OVER (
            PARTITION BY l.id 
            ORDER BY mc.match_score DESC
        ) AS match_rank
    FROM match_candidates mc
    JOIN lost_items l ON mc.lost_item_id = l.id
    JOIN found_items f ON mc.found_item_id = f.id
)
SELECT *
FROM RankedMatches
WHERE match_rank <= 3;

-- ----------------------------------------------------------------------------
-- 5. COMMON TABLE EXPRESSIONS (CTE) FOR OPERATIONAL RECOVERY PIPELINE
-- Breaks down lifecycle funnel: Reports -> Matches -> Claims -> Handovers
-- ----------------------------------------------------------------------------
WITH LostStats AS (
    SELECT COUNT(*) AS total_lost, COUNT(CASE WHEN status = 'resolved' THEN 1 END) AS resolved_lost
    FROM lost_items
),
FoundStats AS (
    SELECT COUNT(*) AS total_found, COUNT(CASE WHEN status = 'returned' THEN 1 END) AS returned_found
    FROM found_items
),
ClaimStats AS (
    SELECT 
        COUNT(*) AS total_claims,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_claims,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_claims
    FROM claims
),
HandoverStats AS (
    SELECT COUNT(*) AS completed_handovers
    FROM handovers
)
SELECT 
    ls.total_lost,
    fs.total_found,
    cs.total_claims,
    cs.approved_claims,
    cs.rejected_claims,
    hs.completed_handovers,
    ROUND((hs.completed_handovers::numeric / NULLIF(fs.total_found, 0)::numeric) * 100, 1) AS campus_recovery_rate_pct
FROM LostStats ls, FoundStats fs, ClaimStats cs, HandoverStats hs;

-- ----------------------------------------------------------------------------
-- 6. FULL-TEXT SEARCH (PostgreSQL tsvector / GIN Index simulation)
-- Searches lost items description and distinctive details using stemming
-- ----------------------------------------------------------------------------
SELECT 
    id,
    item_description,
    distinctive_details,
    brand,
    status
FROM lost_items
WHERE to_tsvector('english', item_description || ' ' || COALESCE(distinctive_details, '') || ' ' || COALESCE(brand, '')) 
      @@ to_tsquery('english', 'laptop | headphones | wallet');

-- ----------------------------------------------------------------------------
-- 7. ACID TRANSACTION DEMONSTRATION WITH SAVEPOINT
-- Demonstrates atomic claim assessment with rollback protection
-- ----------------------------------------------------------------------------
BEGIN;

-- Step 1: Update claim status to 'approved'
UPDATE claims 
SET status = 'approved',
    staff_reviewer_id = 2,
    staff_decision_notes = 'Ownership credentials validated during in-person interview',
    reviewed_at = CURRENT_TIMESTAMP
WHERE id = 2 AND status = 'submitted';

-- Step 2: Update found item to 'awaiting_handover' (NOT returned yet!)
UPDATE found_items
SET status = 'awaiting_handover',
    updated_at = CURRENT_TIMESTAMP
WHERE id = (SELECT found_item_id FROM claims WHERE id = 2);

-- Step 3: Verify consistency
SAVEPOINT approval_step;

-- If checks pass, commit
COMMIT;

