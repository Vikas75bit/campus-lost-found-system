-- ============================================================================
-- UNIVERSITY CAMPUS LOST & FOUND INTELLIGENCE SYSTEM
-- ADVANCED DBMS FEATURES: TRIGGERS, FUNCTIONS & STORED PROCEDURES (PostgreSQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers to relevant tables
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_lost_items_updated_at ON lost_items;
CREATE TRIGGER trg_lost_items_updated_at
BEFORE UPDATE ON lost_items
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_found_items_updated_at ON found_items;
CREATE TRIGGER trg_found_items_updated_at
BEFORE UPDATE ON found_items
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_claims_updated_at ON claims;
CREATE TRIGGER trg_claims_updated_at
BEFORE UPDATE ON claims
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ----------------------------------------------------------------------------
-- 2. TRIGGER FUNCTION: Automatic Status History Audit Recording
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_status_change()
RETURNS TRIGGER AS $$
DECLARE
    entity_val VARCHAR(30);
BEGIN
    IF TG_TABLE_NAME = 'lost_items' THEN
        entity_val := 'lost_item';
    ELSIF TG_TABLE_NAME = 'found_items' THEN
        entity_val := 'found_item';
    ELSIF TG_TABLE_NAME = 'claims' THEN
        entity_val := 'claim';
    ELSE
        entity_val := TG_TABLE_NAME;
    END IF;

    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO status_history (
            entity_type,
            entity_id,
            old_status,
            new_status,
            changed_by_user_id,
            change_reason
        ) VALUES (
            entity_val,
            NEW.id,
            OLD.status,
            NEW.status,
            NULL, -- Set in session context or application layer
            CONCAT('Status changed from ', OLD.status, ' to ', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to track status transitions
DROP TRIGGER IF EXISTS trg_audit_lost_status ON lost_items;
CREATE TRIGGER trg_audit_lost_status
AFTER UPDATE OF status ON lost_items
FOR EACH ROW EXECUTE FUNCTION audit_status_change();

DROP TRIGGER IF EXISTS trg_audit_found_status ON found_items;
CREATE TRIGGER trg_audit_found_status
AFTER UPDATE OF status ON found_items
FOR EACH ROW EXECUTE FUNCTION audit_status_change();

DROP TRIGGER IF EXISTS trg_audit_claim_status ON claims;
CREATE TRIGGER trg_audit_claim_status
AFTER UPDATE OF status ON claims
FOR EACH ROW EXECUTE FUNCTION audit_status_change();

-- ----------------------------------------------------------------------------
-- 3. CONSTRAINT TRIGGER: Prevent claims on items not available in custody
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_item_claimable()
RETURNS TRIGGER AS $$
DECLARE
    current_item_status VARCHAR(30);
BEGIN
    SELECT status INTO current_item_status FROM found_items WHERE id = NEW.found_item_id;
    
    IF current_item_status IS NULL THEN
        RAISE EXCEPTION 'Target found item % does not exist.', NEW.found_item_id;
    END IF;

    IF current_item_status IN ('returned', 'disposed') THEN
        RAISE EXCEPTION 'Cannot submit claim: Found item % is already % and cannot be claimed.', 
            NEW.found_item_id, current_item_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_claimable_item ON claims;
CREATE TRIGGER trg_check_claimable_item
BEFORE INSERT ON claims
FOR EACH ROW EXECUTE FUNCTION check_item_claimable();

-- ----------------------------------------------------------------------------
-- 4. STORED PROCEDURE: Atomic Physical Handover Transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE process_physical_handover(
    p_claim_id INTEGER,
    p_found_item_id INTEGER,
    p_recipient_user_id INTEGER,
    p_staff_id INTEGER,
    p_recipient_id_type VARCHAR(60),
    p_recipient_id_number VARCHAR(80),
    p_handover_notes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_claim_status VARCHAR(30);
    v_found_status VARCHAR(30);
    v_lost_item_id INTEGER;
BEGIN
    -- 1. Validate claim exists and is approved
    SELECT status, lost_item_id INTO v_claim_status, v_lost_item_id 
    FROM claims WHERE id = p_claim_id;

    IF v_claim_status IS NULL THEN
        RAISE EXCEPTION 'Claim % does not exist.', p_claim_id;
    END IF;

    IF v_claim_status != 'approved' THEN
        RAISE EXCEPTION 'Cannot execute handover: Claim % is in state %, but must be approved.', 
            p_claim_id, v_claim_status;
    END IF;

    -- 2. Validate found item is awaiting handover or in custody
    SELECT status INTO v_found_status FROM found_items WHERE id = p_found_item_id;
    
    IF v_found_status != 'awaiting_handover' AND v_found_status != 'claim_pending' THEN
        RAISE EXCEPTION 'Cannot execute handover: Found item % is currently %.', 
            p_found_item_id, v_found_status;
    END IF;

    -- 3. Insert handover audit record
    INSERT INTO handovers (
        claim_id,
        found_item_id,
        recipient_user_id,
        staff_id,
        handover_date_time,
        recipient_id_type,
        recipient_id_number,
        handover_notes,
        recipient_signature_acknowledged
    ) VALUES (
        p_claim_id,
        p_found_item_id,
        p_recipient_user_id,
        p_staff_id,
        CURRENT_TIMESTAMP,
        p_recipient_id_type,
        p_recipient_id_number,
        p_handover_notes,
        TRUE
    );

    -- 4. Update found item status to 'returned'
    UPDATE found_items
    SET status = 'returned',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_found_item_id;

    -- 5. If associated lost item exists, update its status to 'resolved'
    IF v_lost_item_id IS NOT NULL THEN
        UPDATE lost_items
        SET status = 'resolved',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_lost_item_id;
    END IF;

    -- 6. Insert notification for recipient
    INSERT INTO notifications (
        user_id,
        title,
        message,
        notification_type,
        reference_entity,
        reference_id
    ) VALUES (
        p_recipient_user_id,
        'Handover Completed',
        'Your item handover has been completed and verified by university staff. Case is marked resolved.',
        'handover_ready',
        'handovers',
        p_claim_id
    );

END;
$$;

