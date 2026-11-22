# Deep-Dive DBMS Concepts & Architecture Audit
## University Campus Lost & Found Intelligence System

> **Verification Basis:** Every table, column, constraint, SQL statement, index, trigger, view, transaction, and vector query below was verified directly against `database/*.sql` and `backend/app/**/*.py`. Where a syllabus concept is **not implemented** in the current repository, it is explicitly marked **"Not implemented in current codebase"** along with the exact SQL that would implement it.

---

## 1. Relational Schema, Keys & Referential Integrity

### 1.1 Complete Table, Key, and Referential Action Map
Source of truth: `database/01_schema.sql` (lines 27–280) and `backend/app/models.py` (lines 13–294).

| Table | Primary Key | Foreign Keys & Referential Actions (`ON DELETE`) | `NOT NULL`, `UNIQUE`, and `CHECK` Constraints |
| --- | --- | --- | --- |
| `users` (`01_schema.sql:27-38`) | `id SERIAL` | — | `email VARCHAR(255) NOT NULL UNIQUE`, `password_hash NOT NULL`, `full_name NOT NULL`, `role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'staff', 'admin'))`, `is_active BOOLEAN NOT NULL DEFAULT TRUE` |
| `categories` (`01_schema.sql:46-53`) | `id SERIAL` | — | `name VARCHAR(80) NOT NULL UNIQUE`, `is_active BOOLEAN NOT NULL DEFAULT TRUE` |
| `campus_locations` (`01_schema.sql:58-66`) | `id SERIAL` | — | `name VARCHAR(120) NOT NULL UNIQUE`, `zone VARCHAR(60) NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT TRUE` |
| `lost_items` (`01_schema.sql:73-93`) | `id SERIAL` | `user_id -> users(id) ON DELETE CASCADE`, `category_id -> categories(id) ON DELETE RESTRICT`, `location_id -> campus_locations(id) ON DELETE SET NULL` | `approximate_location NOT NULL`, `item_description NOT NULL`, `lost_date_time NOT NULL`, `status CHECK (status IN ('open', 'claim_pending', 'matched', 'resolved', 'cancelled'))`, `embedding vector(384)` |
| `found_items` (`01_schema.sql:107-130`) | `id SERIAL` | `recorded_by_staff_id -> users(id) ON DELETE RESTRICT`, `category_id -> categories(id) ON DELETE RESTRICT`, `location_id -> campus_locations(id) ON DELETE SET NULL` | `found_location_description NOT NULL`, `item_description NOT NULL`, `found_date_time NOT NULL`, `physical_custody_confirmed NOT NULL`, `storage_location NOT NULL`, `status CHECK (status IN ('in_custody', 'claim_pending', 'awaiting_handover', 'returned', 'disposed'))`, `embedding vector(384)` |
| `match_candidates` (`01_schema.sql:144-160`) | `id SERIAL` | `lost_item_id -> lost_items(id) ON DELETE CASCADE`, `found_item_id -> found_items(id) ON DELETE CASCADE`, `reviewed_by_staff_id -> users(id) ON DELETE SET NULL` | `CONSTRAINT uq_lost_found_match UNIQUE (lost_item_id, found_item_id)`, `match_score/semantic_score/structured_score/keyword_score CHECK (>= 0 AND <= 100)`, `staff_review_status CHECK (staff_review_status IN ('unreviewed', 'relevant', 'rejected', 'investigating'))` |
| `claims` (`01_schema.sql:169-184`) | `id SERIAL` | `found_item_id -> found_items(id) ON DELETE RESTRICT`, `claimant_user_id -> users(id) ON DELETE CASCADE`, `lost_item_id -> lost_items(id) ON DELETE SET NULL`, `staff_reviewer_id -> users(id) ON DELETE SET NULL` | `claim_description NOT NULL`, `proof_evidence_notes NOT NULL`, `status CHECK (status IN ('submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'withdrawn'))` |
| `handovers` (`01_schema.sql:193-205`) | `id SERIAL` | `claim_id -> claims(id) ON DELETE RESTRICT`, `found_item_id -> found_items(id) ON DELETE RESTRICT`, `recipient_user_id -> users(id) ON DELETE RESTRICT`, `staff_id -> users(id) ON DELETE RESTRICT` | `claim_id UNIQUE NOT NULL`, `found_item_id UNIQUE NOT NULL`, `recipient_id_type NOT NULL`, `recipient_id_number NOT NULL`, `recipient_signature_acknowledged NOT NULL` |
| `notifications` (`01_schema.sql:214-224`) | `id SERIAL` | `user_id -> users(id) ON DELETE CASCADE` | `title NOT NULL`, `message NOT NULL`, `notification_type NOT NULL`, `is_read NOT NULL` |
| `audit_logs` (`01_schema.sql:231-241`) | `id SERIAL` | `changed_by_user_id -> users(id) ON DELETE SET NULL` | `table_name NOT NULL`, `record_id NOT NULL`, `action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))` |
| `status_history` (`01_schema.sql:246-255`) | `id SERIAL` | `changed_by_user_id -> users(id) ON DELETE SET NULL` | `entity_type CHECK (entity_type IN ('lost_item', 'found_item', 'claim'))`, `entity_id NOT NULL`, `new_status NOT NULL` |
| `revoked_tokens` (`01_schema.sql:262-268`) | `id SERIAL` | `user_id -> users(id) ON DELETE CASCADE` | `jti VARCHAR(128) NOT NULL UNIQUE`, `expires_at NOT NULL` |
| `password_reset_requests` (`01_schema.sql:272-279`) | `id SERIAL` | — | `email NOT NULL`, `reset_token VARCHAR(128) NOT NULL UNIQUE`, `expires_at NOT NULL`, `used BOOLEAN NOT NULL DEFAULT FALSE` |

*Note on `ON UPDATE` actions:* Explicit `ON UPDATE` clauses are **not implemented in current codebase** (PostgreSQL defaults to `ON UPDATE NO ACTION`), which is safe because all primary keys are immutable surrogate `SERIAL` integers.

### 1.2 Why Database-Layer Constraints & How PostgreSQL Enforces Them
- **Why not Pydantic/FastAPI alone?** FastAPI/Pydantic only validates HTTP payloads entering the API. Direct SQL scripts, migrations, admin `psql` fixes, or future background workers bypass FastAPI. Enforcing `CHECK (status IN (...))` and `UNIQUE` constraints in PostgreSQL guarantees **domain and entity integrity** regardless of the writer.
- **How PostgreSQL enforces FK & CHECK during writes:**
  1. On `INSERT`/`UPDATE` of a child row (e.g., `claims`), PostgreSQL executes an internal **RI (Referential Integrity) trigger** that probes the parent PK index (`found_items_pkey`) with a `KEY SHARE` row lock so the parent cannot be concurrently deleted mid-transaction.
  2. On `DELETE` of a parent row (e.g., `categories`), PostgreSQL checks child FK indexes; `ON DELETE RESTRICT` aborts immediately if child rows exist, `ON DELETE CASCADE` deletes dependent rows (`match_candidates`, `notifications`), and `ON DELETE SET NULL` preserves historical records (`lost_items.location_id`, `audit_logs.changed_by_user_id`) even if a location or user is removed.

---

## 2. Normalization & Schema Decomposition

### 2.1 Step-by-Step Normal Form Proof
- **1NF (Atomicity & No Repeating Groups):** Every attribute holds a single atomic value (`brand`, `primary_color`, `secondary_color`), and every table has a primary key (`id`). Multi-valued relationships (multiple claims per item, multiple matches per lost item) are decomposed into separate child tables (`claims`, `match_candidates`) rather than comma-separated ID lists.
- **2NF (No Partial Dependencies):** All 13 tables use single-column surrogate primary keys (`id`), so no non-key attribute can depend on a proper subset of a primary key. Even in the associative table `match_candidates`, `(lost_item_id, found_item_id)` is a `UNIQUE` candidate key, and `match_score`, `semantic_score`, `staff_review_status` depend on the *entire* `(lost_item_id, found_item_id)` pair.
- **3NF (No Transitive Dependencies):**
  - `lost_items` and `found_items` store `category_id` rather than `(category_name, category_description)` — eliminating `id -> category_id -> category_description`.
  - `lost_items` and `found_items` store `location_id` rather than `(zone, building, floor)` — eliminating `id -> location_id -> zone, building`.
  - `claims` and `handovers` store `claimant_user_id` / `recipient_user_id` / `staff_id` rather than repeating `full_name`, `email`, or `department`.
- **BCNF (Every Determinant is a Candidate Key):** In all core entities (`users`, `categories`, `campus_locations`, `lost_items`, `found_items`, `match_candidates`, `claims`, `handovers`), every non-trivial functional dependency has a superkey on the left-hand side (`id`, `email`, `categories.name`, `campus_locations.name`, `(lost_item_id, found_item_id)`, `handovers.claim_id`, `handovers.found_item_id`).

### 2.2 Intentional Denormalization & Pragmatic Trade-offs
1. **`approximate_location` / `found_location_description` alongside `location_id` (`lost_items`, `found_items`):** Free-text location descriptions ("near Library 2nd floor water cooler") are kept alongside the normalized `campus_locations` FK so reports are never blocked when an exact room is absent from `campus_locations`.
2. **`match_candidates.match_reasons` (`TEXT` JSON string, `models.py:151`):** Stores explainability signals as serialized JSON instead of a normalized `match_reason_signals` child table. *Trade-off:* Eliminates an extra `JOIN` on every match queue load; acceptable because individual signals are never queried with `WHERE` predicates.
3. **Polymorphic `audit_logs` & `status_history` (`(entity_type, entity_id)`):** Avoids 3+ nullable FK columns (`lost_item_id`, `found_item_id`, `claim_id`) at the cost of no database-level FK enforcement on `entity_id`.

---

## 3. SQL Commands & Relational Algebra Mapping (DDL, DML, DQL, DCL)

### 3.1 DDL (`CREATE`, `INDEX`, `DROP`)
- **Verbatim DDL (`backend/app/main.py:24-39` & `database/01_schema.sql:7, 102`):**
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE INDEX IF NOT EXISTS idx_lost_items_embedding_hnsw
      ON lost_items USING hnsw (embedding vector_cosine_ops);
  ```
- **Under the hood:** `CREATE TABLE` inserts metadata rows into PostgreSQL system catalogs (`pg_class`, `pg_attribute`, `pg_constraint`) and allocates an 8 KB-paged heap file on disk (`base/<db_oid>/<relfilenode>`). `CREATE INDEX` builds the B-Tree / GIN / HNSW structure and registers it in `pg_index`.

### 3.2 DML (`INSERT`, `UPDATE`, `DELETE`)
- **Verbatim DML (`database/05_advanced_queries.sql:151-162`):**
  ```sql
  UPDATE claims
  SET status = 'approved',
      staff_reviewer_id = 2,
      staff_decision_notes = 'Ownership credentials validated during in-person interview',
      reviewed_at = CURRENT_TIMESTAMP
  WHERE id = 2 AND status = 'submitted';
  ```
- **Under the hood:** In PostgreSQL, `UPDATE` does **not** overwrite the tuple in place. It marks the old tuple's `xmax` transaction ID and writes a **new tuple version** with `xmin = current_txid`, linked via `ctid` (HOT update if no indexed column changed, or new index entries otherwise).

### 3.3 Complex DQL & Relational Algebra Mapping
1. **4+ Table Join (`database/05_advanced_queries.sql:11-28`):**
   ```sql
   SELECT h.id AS handover_id, h.handover_date_time, f.item_description AS item_name,
          c.name AS category, loc.name AS found_location_name,
          u_recip.full_name AS recipient_name, u_staff.full_name AS verifying_staff,
          cl.proof_evidence_notes
   FROM handovers h
   JOIN found_items f ON h.found_item_id = f.id
   JOIN categories c ON f.category_id = c.id
   LEFT JOIN campus_locations loc ON f.location_id = loc.id
   JOIN users u_recip ON h.recipient_user_id = u_recip.id
   JOIN users u_staff ON h.staff_id = u_staff.id
   JOIN claims cl ON h.claim_id = cl.id
   ORDER BY h.handover_date_time DESC;
   ```
   - **Relational Algebra:**
     $$\tau_{\text{handover\_date\_time DESC}}\!\Big(\pi_{\text{handover\_id},\dots}\big((((((h \bowtie_{h.\text{found\_item\_id}=f.\text{id}} f) \bowtie c) \mathbin{\text{⟕}} loc) \bowtie u_{\text{recip}}) \bowtie u_{\text{staff}}) \bowtie cl\big)\Big)$$

2. **Grouping + `HAVING` (`database/05_advanced_queries.sql:34-43`):**
   - **Relational Algebra:**
     $$\sigma_{\text{count}(l.\text{id}) \ge 1}\!\Big(\gamma_{\text{loc.zone},\; \text{COUNT}(l.\text{id}),\; \text{AVG}(\dots)}\big(l \mathbin{\text{⟕}}_{l.\text{location\_id}=loc.\text{id}} loc\big)\Big)$$

3. **Window Function (`database/05_advanced_queries.sql:76-95`):**
   - `RANK() OVER (PARTITION BY l.id ORDER BY mc.match_score DESC)` partitions tuples by `lost_item_id` in memory/sort-node and assigns dense/gapped ranks without collapsing rows like `GROUP BY`.

4. **CTEs (`database/05_advanced_queries.sql:101-128`):**
   - `LostStats`, `FoundStats`, `ClaimStats`, `HandoverStats` compute four independent scalar aggregations (`γ`) and combine them into one operational recovery funnel row.

### 3.4 DCL (`GRANT`, `REVOKE`)
- **Status:** **Not implemented in current codebase.** The backend connects using one PostgreSQL user (`lostfound_user` in `backend/app/config.py`) and enforces RBAC in FastAPI (`require_role()`). (`revoked_tokens` is a JWT blacklist table, not SQL DCL.)
- **How it would be written in PostgreSQL:**
  ```sql
  CREATE ROLE campus_student_ro NOINHERIT;
  GRANT SELECT ON vw_public_found_items TO campus_student_ro;
  REVOKE ALL ON found_items, audit_logs FROM campus_student_ro;
  ```

---

## 4. Transactions, ACID Properties & Concurrency Control

### 4.1 Transaction Blocks in the Codebase
1. **Atomic Physical Handover (`backend/app/routers/handovers.py:54-118`):**
   - Wraps `Handover(...)` insert, `found_item.status = "returned"`, `lost_item.status = "resolved"`, `StatusHistory` inserts, `Notification` insert, and `AuditLog` insert in a single SQLAlchemy transaction with `db.commit()` and `except Exception: db.rollback()`.
2. **Claim Review (`backend/app/routers/claims.py:181-247`):**
   - Updates `claim.status`, `found_item.status = "awaiting_handover"`, `StatusHistory`, and `Notification` in a single `db.commit()`.
3. **SQL Savepoint Demo (`database/05_advanced_queries.sql:148-168`):**
   - Demonstrates `BEGIN; ... SAVEPOINT approval_step; COMMIT;`.

### 4.2 How ACID & MVCC Protect Concurrent Operations
- **Atomicity:** If inserting the `Notification` or updating `lost_items.status` fails mid-handover, `db.rollback()` undoes the `handovers` insert and `found_items` update so an item is never marked `returned` without a handover receipt.
- **Consistency:** `CHECK` constraints (`found_items.status`), `FOREIGN KEY` constraints, and `UNIQUE (claim_id)` / `UNIQUE (found_item_id)` on `handovers` ensure invalid states or double-handovers raise an `IntegrityError` and roll back.
- **Isolation & MVCC Internals:**
  - PostgreSQL defaults to **`READ COMMITTED`** isolation (explicit `SET TRANSACTION ISOLATION LEVEL` and `SELECT ... FOR UPDATE` are **not implemented in current codebase**).
  - Under **MVCC**, each transaction receives a snapshot (`txid`). Writers create new row versions (`xmin`/`xmax`) rather than overwriting data in place, so **readers never block writers and writers never block readers** (no dirty reads).
  - When two concurrent staff requests attempt to record a handover for the same `claim_id`, the second transaction blocks on the `UNIQUE` index lock for `handovers.claim_id` until the first commits, and then fails with a unique-constraint violation (`IntegrityError`).
  - *Honest Gap:* In `submit_claim()` (`claims.py:31-37`), the duplicate active claim check runs as an unlocked `SELECT ... .first()` before `INSERT`, leaving a small TOCTOU window under `READ COMMITTED`. Fixing this at the DB layer requires either `SELECT ... FOR UPDATE` on `found_items` or a partial unique index:
    ```sql
    CREATE UNIQUE INDEX uq_active_claim_per_user_item
    ON claims (found_item_id, claimant_user_id)
    WHERE status IN ('submitted', 'under_review', 'info_requested', 'approved');
    ```
- **Durability:** Every `COMMIT` flushes the **WAL (Write-Ahead Log)** to disk before returning success to FastAPI, allowing crash recovery via WAL replay.

---

## 5. Triggers, Views & Stored Functions/Procedures

> **Runtime Note:** `database/02_triggers_procedures.sql` and `database/03_views.sql` exist on disk as SQL scripts, but `backend/app/main.py` does not auto-execute them on startup; they must be loaded via `psql` if desired, while FastAPI executes equivalent logic in Python.

### 5.1 Triggers (`database/02_triggers_procedures.sql`)
| Trigger | Table & Timing | Function | Purpose & Internals |
| --- | --- | --- | --- |
| `trg_users_updated_at`, `trg_lost_items_updated_at`, `trg_found_items_updated_at`, `trg_claims_updated_at` (`lines 18-36`) | `BEFORE UPDATE FOR EACH ROW` | `update_timestamp_column()` (`lines 9-15`) | Mutates `NEW.updated_at = CURRENT_TIMESTAMP` **before** the new tuple version is written to the heap page, avoiding a second write. |
| `trg_audit_lost_status`, `trg_audit_found_status`, `trg_audit_claim_status` (`lines 78-91`) | `AFTER UPDATE OF status FOR EACH ROW` | `audit_status_change()` (`lines 41-75`) | Compares `OLD.status IS DISTINCT FROM NEW.status` (null-safe) and inserts into `status_history` **after** the row update succeeds. Superior to Python-only logging because even direct `psql` updates are audited. |
| `trg_check_claimable_item` (`lines 116-119`) | `BEFORE INSERT FOR EACH ROW` on `claims` | `check_item_claimable()` (`lines 96-114`) | Queries `found_items.status` and executes `RAISE EXCEPTION` if `'returned'` or `'disposed'`, aborting the statement before `NEW` enters `claims`. |

**How `NEW` and `OLD` work internally:** PostgreSQL passes `HeapTuple` pointers for the pre-update tuple (`OLD`, read-only) and candidate tuple (`NEW`, mutable in `BEFORE` row triggers, read-only in `AFTER` triggers) into the PL/pgSQL execution context.

### 5.2 Stored Procedure (`database/02_triggers_procedures.sql:124-216`)
- `process_physical_handover(...)` (`LANGUAGE plpgsql`): Validates `claims.status = 'approved'` and `found_items.status IN ('awaiting_handover', 'claim_pending')`, inserts into `handovers`, updates `found_items` to `'returned'`, updates `lost_items` to `'resolved'`, and inserts a `notifications` row.

### 5.3 Views (`database/03_views.sql:10-135`)
- `vw_public_found_items` (`lines 10-25`): Security/data-masking view omitting `storage_location`, `finder_name`, `finder_contact`, and `distinctive_details`.
- `vw_staff_match_queue` (`lines 31-60`), `vw_claims_pending_review` (`lines 66-88`), `vw_handover_audit_summary` (`lines 94-111`), and `vw_category_resolution_metrics` (`lines 117-134`).

---

## 6. Indexing, Query Optimization & Full-Text Search

### 6.1 Complete Index Inventory (`database/01_schema.sql` & `backend/app/main.py`)
- **Implicit B-Tree Indexes:** Created automatically by PostgreSQL for every `PRIMARY KEY` (`*_pkey` across all 13 tables) and `UNIQUE` constraint (`users_email_key`, `categories_name_key`, `campus_locations_name_key`, `uq_lost_found_match`, `handovers_claim_id_key`, `handovers_found_item_id_key`, `revoked_tokens_jti_key`, `password_reset_requests_reset_token_key`).
- **Explicit B-Tree Indexes (`01_schema.sql`):** `idx_users_email`, `idx_users_role`, `idx_locations_zone`, `idx_lost_items_user`, `idx_lost_items_category`, `idx_lost_items_status`, `idx_lost_items_date`, `idx_found_items_category`, `idx_found_items_status`, `idx_found_items_storage`, `idx_found_items_date`, `idx_match_lost`, `idx_match_found`, `idx_match_score` (`DESC`), `idx_claims_found`, `idx_claims_claimant`, `idx_claims_status`, `idx_handovers_found`, `idx_handovers_recipient`, `idx_handovers_staff`, `idx_notifications_user` (composite `(user_id, is_read)`), `idx_audit_table_record` (composite `(table_name, record_id)`), `idx_audit_action`, `idx_status_history_entity` (composite `(entity_type, entity_id)`), `idx_revoked_tokens_jti`.
- **GIN Full-Text Search Indexes (`01_schema.sql:99-101, 136-138` & `main.py:28-38`):** `idx_lost_items_fts`, `idx_found_items_fts`.
- **HNSW Vector Indexes (`01_schema.sql:102, 139` & `main.py:25-26`):** `idx_lost_items_embedding_hnsw`, `idx_found_items_embedding_hnsw`.

### 6.2 How B-Tree & GIN Indexes Work Under the Hood
- **B-Tree ($O(\log n)$ vs. $O(n)$ Seq Scan):** Balanced multi-way search tree (root -> internal pages -> doubly-linked leaf pages storing `(key, ctid)`). For `WHERE category_id = 1 AND status = 'in_custody'`, the PostgreSQL query planner estimates selectivity from `pg_statistic` and chooses an **Index Scan** or **Bitmap Index Scan** instead of scanning every 8 KB heap page.
- **GIN Inverted Index vs. `LIKE '%keyword%'`:** `LIKE '%charger%'` has a leading wildcard and cannot use a standard B-Tree, forcing an $O(n)$ Sequential Scan. A **GIN** index maps each stemmed lexeme from `to_tsvector('english', ...)` (e.g., `'charg'`) to a sorted posting list/tree of `ctid`s, intersecting posting lists in milliseconds. *(Honest audit: `idx_*_fts` indexes are created at startup and queried in `05_advanced_queries.sql:134-142`, while runtime `baseline.py` uses Python regex tokenization instead of SQL `to_tsquery`.)*

---

## 7. Vector Databases & Hybrid Semantic Retrieval Mechanics

### 7.1 Text-to-Vector Pipeline (`backend/app/matching/semantic.py`)
- `SentenceEmbeddingEngine.build_item_text()` (`lines 27-45`) formats `item_description`, `brand`, `primary_color`, `secondary_color`, `distinctive_details`, and location into a structured sentence.
- `SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')` (`lines 16-24, 50`) maps that text to a **384-dimensional L2-normalized float vector** (`||v|| = 1`), persisted in PostgreSQL's `vector(384)` column (`models.py:84, 122`).

### 7.2 Cosine Similarity & Cosine Distance Math
For two vectors $A, B \in \mathbb{R}^{384}$:
$$\text{cosine\_similarity}(A, B) = \frac{A \cdot B}{\|A\|\|B\|}, \qquad \text{cosine\_distance}(A, B) = 1 - \frac{A \cdot B}{\|A\|\|B\|}$$
Because `all-MiniLM-L6-v2` outputs L2-normalized vectors ($\|A\| = \|B\| = 1$), this simplifies to $1 - (A \cdot B)$. `pgvector` exposes cosine distance as the **`<=>`** operator, invoked by SQLAlchemy's `FoundItem.embedding.cosine_distance(query_embedding)` (`semantic.py:105-113`), and converts it back to percentage via `(1.0 - distance) * 100`.

### 7.3 HNSW Indexing & Hybrid Relational-Vector Filtering
- **HNSW (Hierarchical Navigable Small World):** Configured via `USING hnsw (embedding vector_cosine_ops)` (`main.py:25-26`, `01_schema.sql:102, 139`). Unlike IVFFlat (**not implemented in current codebase**), HNSW builds a multi-layered proximity graph incrementally on `INSERT`/`UPDATE` without needing a populated training set. Searches start at sparse upper layers for long-range jumps and greedily descend to dense lower layers in $O(\log n)$ time.
- **Hybrid SQL + Vector Execution (`semantic.py:105-113` + `hybrid.py:21-104`):**
  1. PostgreSQL filters `FoundItem.status.in_(["in_custody", "claim_pending"])`, `FoundItem.embedding.isnot(None)`, and `FoundItem.category_id == category_id`, ordered by `embedding <=> query_vec ASC LIMIT 20`.
  2. `compute_hybrid_match()` reranks those candidates in Python:
     $$\text{match\_score} = 0.35(\text{semantic}) + 0.25(\text{keyword}) + 0.40(\text{structured})$$
  3. **Honest Asymmetry Note:** `lost_items.py:65-70` and `matching.py:78-83` use `query_pgvector_candidates()`, whereas `found_items.py:78-81` loops over all open `LostItem` rows in Python.
