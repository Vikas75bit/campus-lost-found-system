# Relational Database Design & DBMS Concepts
## Lost & Found Intelligence System for a University Campus

### 1. Relational Schema & Normalization Analysis

The database schema has been engineered to satisfy **Third Normal Form (3NF)**, eliminating data redundancy, update anomalies, insertion anomalies, and deletion anomalies.

#### 1.1 First Normal Form (1NF) Compliance
- Every attribute contains only atomic (indivisible) values. No multi-valued attributes or repeating groups exist.
- Each table possesses a designated Primary Key (`id SERIAL PRIMARY KEY` or integer synthetic key).
- Unique identification of each row is guaranteed.

#### 1.2 Second Normal Form (2NF) Compliance
- The schema satisfies 1NF.
- Every non-key attribute is fully functionally dependent on the entire Primary Key.
- Because all primary keys are single-column surrogate keys (`id`), no partial key dependencies can exist ($X \to Y$ where $X \subset \text{PK}$ is impossible).

#### 1.3 Third Normal Form (3NF) Compliance
- The schema satisfies 2NF.
- No transitive dependencies exist between non-key attributes ($X \to Y$ and $Y \to Z$ where $Z$ is non-prime).
- **Proof:**
  - `lost_items`: `category_name` and `icon_name` are not stored in `lost_items`; instead, a normalized foreign key `category_id \to categories(id)` is used.
  - `found_items`: Location zone and building details are not repeated; they reside in `campus_locations(id)`.
  - `claims`: User names and email addresses are not duplicated; they reference `users(id)`.
  - `handovers`: Contains only direct transaction attributes (`recipient_id_type`, `recipient_id_number`, `handover_date_time`), referencing `claims(id)` and `users(id)`.

---

### 2. Constraints & Data Integrity

```sql
-- Role Domain Enforcement
CHECK (role IN ('student', 'staff', 'admin'))

-- Lost Item Lifecycle States
CHECK (status IN ('open', 'claim_pending', 'matched', 'resolved', 'cancelled'))

-- Found Item Lifecycle States
CHECK (status IN ('in_custody', 'claim_pending', 'awaiting_handover', 'returned', 'disposed'))

-- Claim Lifecycle States
CHECK (status IN ('submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'withdrawn'))

-- Quantitative Bounds
CHECK (match_score >= 0 AND match_score <= 100)

-- Strict 1:1 Handover Guarantee (Prevents double return)
CONSTRAINT uq_handover_claim UNIQUE (claim_id)
CONSTRAINT uq_handover_found_item UNIQUE (found_item_id)

-- Prevent duplicate match pairs
CONSTRAINT uq_lost_found_match UNIQUE (lost_item_id, found_item_id)
```

---

### 3. Advanced DBMS Concepts Implemented

#### 3.1 PostgreSQL Triggers & Functions
1. **Timestamp Maintenance Trigger (`update_timestamp_column`):**
   - Automatically maintains `updated_at = CURRENT_TIMESTAMP` before any update on `users`, `lost_items`, `found_items`, and `claims`.
2. **Automated Status Transition Audit Trigger (`audit_status_change`):**
   - Fires `AFTER UPDATE OF status` on `lost_items`, `found_items`, or `claims`.
   - Compares `OLD.status` and `NEW.status`. When distinct, automatically appends a record into `status_history`.
3. **Integrity Guard Trigger (`check_item_claimable`):**
   - Fires `BEFORE INSERT ON claims`.
   - Inspects the current status of the target `found_items` record.
   - Raises an explicit SQL exception if the item has already been marked `returned` or `disposed`.

#### 3.2 Relational Views for Operational Reporting & Data Masking
1. `vw_public_found_items`:
   - Masks internal storage locker coordinates (`storage_location`) and finder personal contact details from ordinary students, protecting physical custody security.
2. `vw_staff_match_queue`:
   - Joins `match_candidates`, `lost_items`, `found_items`, and `users` to provide a consolidated triage cockpit for staff.
3. `vw_claims_pending_review`:
   - Joins claims with claimant user profiles and storage coordinates for pending claims.
4. `vw_handover_audit_summary`:
   - Joins handovers with recipient profiles, verifying staff, and claim details for administrative audits.
5. `vw_category_resolution_metrics`:
   - Computes real-time recovery metrics per category using `COUNT(DISTINCT ...)`, `CASE WHEN`, and percentage calculations.

#### 3.3 Stored Procedure & ACID Transactions
- Stored procedure `process_physical_handover(...)` executes the entire resolution lifecycle inside an atomic database transaction:
  1. Validates that the claim is in `approved` status.
  2. Validates that the found item is in `awaiting_handover` status.
  3. Inserts the physical handover record with recipient ID card credentials.
  4. Updates the found item status to `returned`.
  5. Updates any linked lost item status to `resolved`.
  6. Dispatches an automated in-app resolution notification to the student.
  - If any constraint or step fails, the entire transaction is rolled back (`ROLLBACK`), preventing orphan handovers or partially returned inventory.

#### 3.4 Indexing & Performance Optimisation Strategy
- **B-Tree Indexes:**
  - `idx_users_email` on `users(email)` for sub-millisecond authentication lookups.
  - `idx_lost_items_user` on `lost_items(user_id)` for rapid student dashboard rendering.
  - `idx_found_items_status` on `found_items(status)` for custody filtering.
  - `idx_match_score` on `match_candidates(match_score DESC)` for high-confidence ranking queries.
  - Composite index `idx_notifications_user` on `notifications(user_id, is_read)` for notification badge counts.

