# Forensic Codebase Audit & B.Tech DBMS Viva Master Guide
## University Campus Lost & Found Intelligence System

> **Audit Scope & Honesty Guarantee:** Every claim, SQL snippet, file path, symbol name, and architectural trade-off in this guide was verified directly against the source files in this repository. Where the codebase uses an application-layer check or a simplified implementation instead of a database-layer feature, it is explicitly flagged so you can defend it accurately in your viva.

---

## 1. End-to-End System Architecture & Data Flow

### 1.1 Layered Architecture
The system uses a strict **3-tier architecture**:

1. **Presentation Layer (Next.js 14 App Router + TypeScript + Tailwind CSS)**
   - Role-separated portals under `frontend/src/app/student/*`, `frontend/src/app/staff/*`, and `frontend/src/app/admin/*`.
   - Route-level UX gating is handled by `frontend/src/middleware.ts` (`middleware()`), which reads `lf_token` and `lf_role` cookies to redirect unauthenticated or wrong-role users to `/login` or `/access-denied`.
   - All API calls go through `apiFetch()` in `frontend/src/lib/api.ts` using relative `/api/...` URLs.
   - `frontend/next.config.mjs` proxies `/api/:path*` to FastAPI (`http://127.0.0.1:8000/api/:path*`) via `rewrites()`, avoiding CORS issues in browser requests.

2. **Application & Intelligence Layer (Python + FastAPI + SQLAlchemy + SentenceTransformers)**
   - Entrypoint `run.py` calls `ensure_local_postgres_running()` (`backend/app/database.py`) and launches Uvicorn on `backend.app.main:app`.
   - On startup, `lifespan()` in `backend/app/main.py` runs:
     1. `ensure_pgvector_extension()` (`CREATE EXTENSION IF NOT EXISTS vector`)
     2. `Base.metadata.create_all(bind=engine)` (creates all ORM tables from `backend/app/models.py`)
     3. `ensure_pgvector_indexes()` (creates HNSW vector indexes and GIN full-text search indexes idempotently)
     4. `seed_database(db)` (`backend/app/seed.py`)
   - Routers in `backend/app/routers/` handle validation (Pydantic schemas in `backend/app/schemas.py`), JWT + RBAC enforcement (`backend/app/auth.py`), and business workflows.
   - `backend/app/matching/semantic.py` (`SentenceEmbeddingEngine`) generates 384-dimensional L2-normalized embeddings via `sentence-transformers/all-MiniLM-L6-v2`.

3. **Data & Vector Persistence Layer (PostgreSQL 18 + `pgvector` 0.8.7)**
   - **Authoritative Source of Truth:** PostgreSQL (`lost_found_db`) is the single source of truth for both structured relational state (`users`, `lost_items`, `found_items`, `claims`, `handovers`, `status_history`, `audit_logs`, `revoked_tokens`) and persistent dense vector embeddings (`lost_items.embedding` and `found_items.embedding` typed as `vector(384)`).
   - **Why no direct frontend-to-DB queries?**
     - **Security & Data Masking:** Sensitive custody fields (`found_items.storage_location`, `found_items.finder_contact`, `claims.distinctive_proof`) must be stripped by FastAPI (`claims.py`, `found_items.py`, `matching.py`) for `student` callers before JSON leaves the server.
     - **Auth & RBAC:** Database credentials stay on the server; clients only hold signed HS256 JWTs checked by `get_current_user()` and `require_role()`.
     - **Multi-table ACID Transactions & Embedding Generation:** Creating a report or recording a handover requires generating a 384-dim neural embedding and updating multiple tables atomically, which cannot safely live in client code.

### 1.2 Exact Lifecycle Trace (Example: Lost Report -> Match -> Claim -> Handover)
1. Student submits form on `frontend/src/app/student/report-lost/page.tsx` -> `POST /api/lost-items` -> proxied by Next.js to `create_lost_item()` (`backend/app/routers/lost_items.py`).
2. `semantic_engine.encode_item()` computes a 384-dim `all-MiniLM-L6-v2` vector, inserts `LostItem` + `StatusHistory`, and commits.
3. `query_pgvector_candidates()` (`backend/app/matching/semantic.py`) queries `found_items` using `pgvector`'s `<=>` cosine distance operator (`FoundItem.embedding.cosine_distance(query_embedding)`), then `compute_hybrid_match()` (`backend/app/matching/hybrid.py`) scores each candidate and persists `MatchCandidate` rows (`score >= 45.0`) plus `Notification` rows.
4. Student views candidates/found items and submits a claim -> `POST /api/claims` (`submit_claim()` in `backend/app/routers/claims.py`), transitioning `found_items.status` from `in_custody` to `claim_pending`.
5. Staff reviews claim -> `PUT /api/claims/{id}/review` (`review_claim()` in `backend/app/routers/claims.py`). Approving sets `claim.status = 'approved'` and `found_item.status = 'awaiting_handover'`.
6. Student visits the Lost & Found room with physical ID -> Staff submits handover -> `POST /api/handovers` (`record_handover()` in `backend/app/routers/handovers.py`) atomically inserts `Handover`, sets `found_items.status = 'returned'`, sets `lost_items.status = 'resolved'`, and logs `StatusHistory` + `AuditLog`.

---

## 2. Conceptual & Logical Database Design (The "Why")

### 2.1 Actual Tables Created in the Schema (`database/01_schema.sql` & `backend/app/models.py`)

| Table | Primary Key | Foreign Keys | Key Constraints (`UNIQUE`, `CHECK`, `NOT NULL`) |
| --- | --- | --- | --- |
| `users` | `id` (SERIAL) | — | `email UNIQUE NOT NULL`, `password_hash NOT NULL`, `full_name NOT NULL`, `role CHECK IN ('student','staff','admin')`, `is_active NOT NULL` |
| `categories` | `id` (SERIAL) | — | `name UNIQUE NOT NULL`, `is_active NOT NULL` |
| `campus_locations` | `id` (SERIAL) | — | `name UNIQUE NOT NULL`, `zone NOT NULL`, `is_active NOT NULL` |
| `lost_items` | `id` (SERIAL) | `user_id -> users(id)` (`CASCADE`), `category_id -> categories(id)` (`RESTRICT`), `location_id -> campus_locations(id)` (`SET NULL`) | `approximate_location NOT NULL`, `item_description NOT NULL`, `lost_date_time NOT NULL`, `status CHECK IN ('open','claim_pending','matched','resolved','cancelled')`, `embedding vector(384)` |
| `found_items` | `id` (SERIAL) | `recorded_by_staff_id -> users(id)` (`RESTRICT`), `category_id -> categories(id)` (`RESTRICT`), `location_id -> campus_locations(id)` (`SET NULL`) | `found_location_description NOT NULL`, `item_description NOT NULL`, `storage_location NOT NULL`, `physical_custody_confirmed NOT NULL`, `status CHECK IN ('in_custody','claim_pending','awaiting_handover','returned','disposed')`, `embedding vector(384)` |
| `match_candidates` | `id` (SERIAL) | `lost_item_id -> lost_items(id)` (`CASCADE`), `found_item_id -> found_items(id)` (`CASCADE`), `reviewed_by_staff_id -> users(id)` (`SET NULL`) | `UNIQUE (lost_item_id, found_item_id)` (`uq_lost_found_match`), `match_score/semantic_score/structured_score/keyword_score CHECK (>= 0 AND <= 100)`, `staff_review_status CHECK IN ('unreviewed','relevant','rejected','investigating')` |
| `claims` | `id` (SERIAL) | `found_item_id -> found_items(id)` (`RESTRICT`), `claimant_user_id -> users(id)` (`CASCADE`), `lost_item_id -> lost_items(id)` (`SET NULL`), `staff_reviewer_id -> users(id)` (`SET NULL`) | `claim_description NOT NULL`, `proof_evidence_notes NOT NULL`, `status CHECK IN ('submitted','under_review','info_requested','approved','rejected','withdrawn')` |
| `handovers` | `id` (SERIAL) | `claim_id -> claims(id)` (`RESTRICT`), `found_item_id -> found_items(id)` (`RESTRICT`), `recipient_user_id -> users(id)` (`RESTRICT`), `staff_id -> users(id)` (`RESTRICT`) | `claim_id UNIQUE NOT NULL`, `found_item_id UNIQUE NOT NULL` (enforces 1:1 handover per claim & per found item), `recipient_id_type NOT NULL`, `recipient_id_number NOT NULL` |
| `notifications` | `id` (SERIAL) | `user_id -> users(id)` (`CASCADE`) | `title NOT NULL`, `message NOT NULL`, `notification_type NOT NULL`, `is_read NOT NULL` |
| `audit_logs` | `id` (SERIAL) | `changed_by_user_id -> users(id)` (`SET NULL`) | `table_name NOT NULL`, `record_id NOT NULL`, `action CHECK IN ('INSERT','UPDATE','DELETE')` |
| `status_history` | `id` (SERIAL) | `changed_by_user_id -> users(id)` (`SET NULL`) | `entity_type CHECK IN ('lost_item','found_item','claim')`, `entity_id NOT NULL`, `new_status NOT NULL` |
| `revoked_tokens` | `id` (SERIAL) | `user_id -> users(id)` (`CASCADE`) | `jti UNIQUE NOT NULL`, `expires_at NOT NULL` |
| `password_reset_requests` | `id` (SERIAL) | — | `email NOT NULL`, `reset_token UNIQUE NOT NULL`, `expires_at NOT NULL`, `used NOT NULL` |

### 2.2 Why Entities Are Separated
- **Why `lost_items` and `found_items` are separate tables:** A lost report is an *unverified student memory* (`approximate_location`, `lost_time_range`), whereas a found item is a *physical custody asset* (`recorded_by_staff_id`, `storage_location`, `physical_custody_confirmed`, `finder_contact`). Merging them would create sparse NULLable columns and muddle custody accountability.
- **Why `match_candidates` is an associative bridge table:** One lost report can resemble many found items and vice versa (**M:N**). `match_candidates` stores the pairwise scores, explainability JSON (`match_reasons`), and staff review state with `UNIQUE (lost_item_id, found_item_id)`.
- **Why `claims` is separate from `found_items` and `handovers`:** Multiple students can submit competing claims on the same found item (**1:N**). Separating `claims` preserves rejected/withdrawn claims for dispute resolution. Separating `handovers` with `UNIQUE(claim_id)` and `UNIQUE(found_item_id)` guarantees an item can only be physically released once.
- **Why `status_history` and `audit_logs` are separate:** Storing only `status` on an item overwrites its past states. `status_history` provides an append-only timeline of state transitions.

### 2.3 Normalization Level & Intentional Denormalization
- **3NF Achieved:** Every table has atomic attributes and a surrogate `SERIAL` PK (`1NF`), no partial dependencies on composite keys (`2NF`), and non-key attributes depend solely on the PK (`3NF` — e.g., `category` details live in `categories`, `zone/building/floor` live in `campus_locations`).
- **Intentional Denormalization / Pragmatic Choices:**
  1. `lost_items.approximate_location` and `found_items.found_location_description` coexist with nullable `location_id` FK so users can enter free-text spots ("behind Vending Machine 2") not in `campus_locations`.
  2. `match_candidates.match_reasons` stores a JSON string (`TEXT`) rather than a child `match_signals` table because signal breakdowns are read/written as a single UI payload.
  3. `audit_logs` and `status_history` use polymorphic `(table_name, record_id)` / `(entity_type, entity_id)` references instead of nullable FKs to every table.

---

## 3. Advanced DBMS Features Implemented (With Exact SQL)

> **CRITICAL FORENSIC NOTE FOR YOUR VIVA:**
> `backend/app/main.py` (`lifespan()`) executes `ensure_pgvector_extension()`, `Base.metadata.create_all()`, `ensure_pgvector_indexes()`, and `seed_database()`. **It does NOT automatically execute `database/02_triggers_procedures.sql` or `database/03_views.sql`!** Those two files are standalone SQL scripts for manual `psql` deployment/demonstration. At runtime, the FastAPI backend performs equivalent validation and `StatusHistory`/`AuditLog` inserts in Python. Be upfront about this if asked!

### 3.1 `pgvector` HNSW Cosine Indexes & Similarity Retrieval (Active at Runtime)
**Where:** `database/01_schema.sql` (lines 102, 139) and `backend/app/main.py` (lines 25–26):+

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS idx_lost_items_embedding_hnsw
    ON lost_items USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_found_items_embedding_hnsw
    ON found_items USING hnsw (embedding vector_cosine_ops);
```
And queried via SQLAlchemy in `backend/app/matching/semantic.py` (`query_pgvector_candidates()`, lines 105–113), which compiles to PostgreSQL's `<=>` cosine distance operator:
```sql
SELECT found_items.*, 1.0 - (found_items.embedding <=> :query_vec) AS cosine_sim
FROM found_items
WHERE found_items.status IN ('in_custody', 'claim_pending')
  AND found_items.embedding IS NOT NULL
  AND found_items.category_id = :category_id
ORDER BY found_items.embedding <=> :query_vec ASC
LIMIT 20;
```
- **Problem Solved:** Enables sub-linear Approximate Nearest Neighbor (ANN) semantic retrieval directly inside PostgreSQL instead of brute-force Python loops over all items.

### 3.2 GIN Full-Text Search Indexes (Created at Runtime, Queried in SQL Scripts)
**Where:** `database/01_schema.sql` (lines 99–101, 136–138), `backend/app/main.py` (lines 28–38), and `database/05_advanced_queries.sql` (lines 134–142):
```sql
CREATE INDEX IF NOT EXISTS idx_found_items_fts ON found_items USING GIN (
    to_tsvector('english', coalesce(item_description, '') || ' ' ||
    coalesce(distinctive_details, '') || ' ' || coalesce(brand, '') || ' ' ||
    coalesce(found_location_description, ''))
);
```
- **Gap to Note:** While the GIN indexes are created in PostgreSQL on startup, `backend/app/matching/baseline.py` computes lexical similarity in Python (`tokenize()` + Jaccard/Overlap) rather than executing `to_tsvector @@ to_tsquery` in SQL.

### 3.3 Triggers & Constraint Enforcement (`database/02_triggers_procedures.sql`)
1. **Automatic `updated_at` Timestamp Trigger** (`lines 9–36`):
   ```sql
   CREATE OR REPLACE FUNCTION update_timestamp_column()
   RETURNS TRIGGER AS $$
   BEGIN
       NEW.updated_at = CURRENT_TIMESTAMP;
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```
2. **Automatic Status History Audit Trigger** (`lines 41–91`):
   ```sql
   CREATE OR REPLACE FUNCTION audit_status_change()
   RETURNS TRIGGER AS $$
   DECLARE entity_val VARCHAR(30);
   BEGIN
       IF TG_TABLE_NAME = 'lost_items' THEN entity_val := 'lost_item';
       ELSIF TG_TABLE_NAME = 'found_items' THEN entity_val := 'found_item';
       ELSIF TG_TABLE_NAME = 'claims' THEN entity_val := 'claim';
       ELSE entity_val := TG_TABLE_NAME;
       END IF;
       IF (OLD.status IS DISTINCT FROM NEW.status) THEN
           INSERT INTO status_history (entity_type, entity_id, old_status, new_status, changed_by_user_id, change_reason)
           VALUES (entity_val, NEW.id, OLD.status, NEW.status, NULL, CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
       END IF;
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```
   - **Why DB layer?** Guarantees even direct SQL updates in `psql` cannot bypass the audit trail (note: `changed_by_user_id` is `NULL` in the trigger because PostgreSQL doesn't know the JWT user unless passed via `SET LOCAL`).
3. **Custody Integrity Guard Trigger** (`lines 96–119`):
   ```sql
   CREATE OR REPLACE FUNCTION check_item_claimable()
   RETURNS TRIGGER AS $$
   DECLARE current_item_status VARCHAR(30);
   BEGIN
       SELECT status INTO current_item_status FROM found_items WHERE id = NEW.found_item_id;
       IF current_item_status IN ('returned', 'disposed') THEN
           RAISE EXCEPTION 'Cannot submit claim: Found item % is already % and cannot be claimed.',
               NEW.found_item_id, current_item_status;
       END IF;
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

### 3.4 Stored Procedure: Atomic Physical Handover (`database/02_triggers_procedures.sql`, lines 124–216)
```sql
CREATE OR REPLACE PROCEDURE process_physical_handover(
    p_claim_id INTEGER, p_found_item_id INTEGER, p_recipient_user_id INTEGER,
    p_staff_id INTEGER, p_recipient_id_type VARCHAR(60),
    p_recipient_id_number VARCHAR(80), p_handover_notes TEXT
)
LANGUAGE plpgsql AS $$
DECLARE v_claim_status VARCHAR(30); v_found_status VARCHAR(30); v_lost_item_id INTEGER;
BEGIN
    SELECT status, lost_item_id INTO v_claim_status, v_lost_item_id FROM claims WHERE id = p_claim_id;
    IF v_claim_status != 'approved' THEN
        RAISE EXCEPTION 'Cannot execute handover: Claim % is in state %, but must be approved.', p_claim_id, v_claim_status;
    END IF;
    SELECT status INTO v_found_status FROM found_items WHERE id = p_found_item_id;
    IF v_found_status != 'awaiting_handover' AND v_found_status != 'claim_pending' THEN
        RAISE EXCEPTION 'Cannot execute handover: Found item % is currently %.', p_found_item_id, v_found_status;
    END IF;
    INSERT INTO handovers (...) VALUES (...);
    UPDATE found_items SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = p_found_item_id;
    IF v_lost_item_id IS NOT NULL THEN
        UPDATE lost_items SET status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = v_lost_item_id;
    END IF;
    INSERT INTO notifications (...) VALUES (...);
END;
$$;
```
- **Why DB layer?** Ensures `handovers` insert, `found_items` update, `lost_items` update, and `notifications` insert succeed or roll back as one atomic unit. (At runtime, `record_handover()` in `handovers.py` executes these exact steps inside a SQLAlchemy transaction with `try ... db.commit() ... except: db.rollback()`.)

### 3.5 Security & Reporting Views (`database/03_views.sql`)
- `vw_public_found_items` (`lines 10–25`): Projects only safe public columns and omits `storage_location`, `finder_name`, `finder_contact`, and `distinctive_details`.
- `vw_staff_match_queue`, `vw_claims_pending_review`, `vw_handover_audit_summary`, and `vw_category_resolution_metrics` (`GROUP BY` + conditional `COUNT(DISTINCT CASE WHEN ...)`).

---

## 4. The Matching & Verification Engine (How It Actually Works)

### 4.1 Step-by-Step Candidate Retrieval & Scoring
1. **Embedding Generation (`backend/app/matching/semantic.py`):**
   - `build_item_text()` concatenates `item_description`, `brand`, `primary_color`, `secondary_color`, `distinctive_details`, and location text.
   - `SentenceEmbeddingEngine.encode()` uses **`sentence-transformers/all-MiniLM-L6-v2`** (`normalize_embeddings=True`) to produce a **384-dim** float vector stored in PostgreSQL `vector(384)`.
   - **Yes, semantic vector search is genuinely active (not stubbed).**
2. **Stage 1 Retrieval (`query_pgvector_candidates()`):**
   - On `POST /api/lost-items` (`limit=15`) and `POST /api/matching/refresh` (`limit=20`), PostgreSQL ranks `FoundItem` rows with `status IN ('in_custody', 'claim_pending')` and matching `category_id` using `<=>` cosine distance.
   - *Fallback/Gap:* On `POST /api/found-items` (`found_items.py:78-81`), the code queries all `open`/`matched` `LostItem` rows in Python instead of calling `query_pgvector_candidates()`, and uses threshold `>= 50.0` (vs `>= 45.0` in `lost_items.py` and `matching.py`).
3. **Stage 2 Hybrid Reranking (`compute_hybrid_match()` in `backend/app/matching/hybrid.py`):**
   - **Hard Category Gate (`lines 21–25`):** If `lost_item.category_id != found_item.category_id`, immediately returns `0.0` across all scores.
   - **Structured Score (`lines 75–81`):**
     $$\text{structured} = 0.40(\text{category}=100) + 0.20(\text{brand}) + 0.15(\text{color}) + 0.15(\text{location}) + 0.10(\text{time})$$
     - Brand: `100` (exact case-insensitive match), `50` (missing on either side), `10` (mismatch).
     - Color (`primary_color` only — `secondary_color` is unused here): `100` (match), `50` (missing), `30` (mismatch).
     - Location: `100` if `location_id` matches, else `max(30.0, keyword_similarity(approx_loc, found_loc))`.
     - Time (`found_date_time - lost_date_time`): `100` for `-12h..+24h`; decays `100 -> 50` up to `168h` (1 week); `20` if found `>48h` before lost; `30` otherwise.
   - **Keyword Score (`lines 84–86`, `baseline.py:12–22`):** Regex tokenization + stopword removal -> `(0.4 * Jaccard + 0.6 * Dice/Overlap) * 100`.
   - **Semantic Score (`lines 90–95`):** Uses stored `embedding` vectors via `similarity_from_vectors()` (NumPy dot-product cosine similarity * 100), or encodes on the fly if either vector is `None`.
   - **Final Hybrid Blend (`lines 100–104`):**
     $$\text{match\_score} = 0.35(\text{semantic}) + 0.25(\text{keyword}) + 0.40(\text{structured})$$

### 4.2 Why Similarity Scores Are Decoupled from Ownership Verification
Both `hybrid.py:13` and `matching.py:124` explicitly state that similarity scores are **retrieval ranking aids, never proof of ownership**:
- Two students can lose identical black Dell laptops in the same library on the same day -> both score ~90%+.
- True ownership depends on **private verification evidence** (`claims.proof_evidence_notes`, `claims.distinctive_proof`, and physical photo ID at handover) that is *not* part of the public description.

---

## 5. Workflow Integrity & Security Enforcement

### 5.1 Four-Stage State Machine Separation
| Stage | `match_candidates.staff_review_status` | `claims.status` | `found_items.status` | `lost_items.status` | Enforcing Code |
| --- | --- | --- | --- | --- | --- |
| **1. Match Suggested** | `unreviewed` / `relevant` | — | `in_custody` | `open` -> `matched` | `lost_items.py:81-91`, `matching.py:183-184` |
| **2. Claim Submitted** | (unchanged) | `submitted` | `claim_pending` | (unchanged) | `claims.py:39-54` |
| **3. Claim Approved (Handover Authorized)** | (unchanged) | `approved` | **`awaiting_handover`** (NEVER `returned`) | (unchanged) | `claims.py:200-202` |
| **4. Handover Recorded (Case Resolved)** | (unchanged) | `approved` | **`returned`** | **`resolved`** | `handovers.py:32-114` |

**Proof that approval never prematurely resolves a case (`backend/app/routers/claims.py:200–202`):**
```python
    if review_in.status == "approved":
        # CRITICAL: A claim approval moves found item to 'awaiting_handover', NEVER 'returned'!
        found_item.status = "awaiting_handover"
```
And `record_handover()` (`backend/app/routers/handovers.py:32–46`) refuses to execute unless `claim.status == "approved"` AND `found_item.status == "awaiting_handover"`.

### 5.2 Role-Based Access Control (RBAC) & Data Masking
- **Authentication (`backend/app/auth.py`):**
  - Passwords hashed with `bcrypt` (`get_password_hash`, `verify_password`).
  - HS256 JWT includes `sub`, `role`, `user_id`, `exp`, and `jti` (UUID).
  - `get_current_user()` checks `revoked_tokens` (`RevokedToken.jti == jti`) so logout invalidates tokens server-side, and verifies `user.is_active`.
- **Authorization (`require_role(["staff", "admin"])` / `require_role(["admin"])`):**
  - `student`: Can create lost reports, browse masked found items (`storage_location` and `finder_contact` omitted), view only *their own* match candidates (`LostItem.user_id == current_user.id`) and *their own* claims (`Claim.claimant_user_id == current_user.id`).
  - `staff` / `admin`: Can record found items, trigger `/api/matching/refresh`, review matches/claims, and execute `/api/handovers`.
  - `admin` only: Manage users/roles (`backend/app/routers/admin.py:55-88`) and view audit logs.
- **Note on Frontend Middleware (`frontend/src/middleware.ts`):** Cookies (`lf_token`, `lf_role`) only gate Next.js page navigation UX; FastAPI ignores cookies and validates the cryptographic `Authorization: Bearer <token>` header on every API call.

---

## 6. Viva Defense: 8 Toughest Professor Attack Questions & Honest Answers

### Q1. "You have `02_triggers_procedures.sql` and `03_views.sql`, yet `main.py` only runs `Base.metadata.create_all()` and `ensure_pgvector_indexes()`. Are your triggers, stored procedure, and views actually running in PostgreSQL?"
**Honest Answer:**
"By default, `main.py` creates all tables, `pgvector` HNSW indexes, and GIN FTS indexes via `lifespan()`, while `02_triggers_procedures.sql` and `03_views.sql` are standalone DDL scripts designed to be applied via `psql`. At runtime, the FastAPI routers (`claims.py`, `handovers.py`, `found_items.py`) enforce the state guards and insert `StatusHistory` and `AuditLog` records inside SQLAlchemy transactions. In production, we would execute those SQL scripts via Alembic migrations so both application and direct-SQL paths share the triggers and `process_physical_handover()` procedure."

### Q2. "What happens if two students submit a claim—or two staff members record a handover—at the exact same millisecond? Do you have race condition protection?"
**Honest Answer:**
"For **handovers**, yes at the database level: `handovers.claim_id` and `handovers.found_item_id` both have `UNIQUE` constraints (`models.py:207-208`), so a second concurrent `INSERT` raises an `IntegrityError` and triggers `db.rollback()` (`handovers.py:116-118`). However, in `submit_claim()` (`claims.py:31-37`), duplicate-claim detection currently uses an application-level `SELECT ... .first()` without `SELECT ... FOR UPDATE` or a partial unique index `ON claims(found_item_id, claimant_user_id) WHERE status IN ('submitted','under_review','info_requested','approved')`. Adding that partial unique index in PostgreSQL would eliminate the TOCTOU race completely."

### Q3. "Why use `pgvector` inside PostgreSQL instead of a dedicated vector DB like Pinecone, Qdrant, or Milvus?"
**Honest Answer:**
"Our queries require **atomic metadata filtering + vector similarity** (e.g., `WHERE status IN ('in_custody', 'claim_pending') AND category_id = :cat ORDER BY embedding <=> :vec LIMIT 20`). With a separate vector DB, item status changes (`in_custody -> returned`) would require cross-system synchronization and risk stale/ghost matches. Keeping `vector(384)` inside PostgreSQL gives ACID consistency between custody status and vector search with a single backup and query planner."

### Q4. "You created GIN full-text search indexes (`idx_lost_items_fts`, `idx_found_items_fts`), but does your Python matching code actually use them?"
**Honest Answer:**
"Honestly, no—those GIN indexes are created in PostgreSQL and demonstrated in `database/05_advanced_queries.sql` (Query 6), whereas `backend/app/matching/baseline.py` computes lexical overlap in Python using regex tokenization plus weighted Jaccard/Overlap. Because campus lost-and-found volume is small, Python scoring is fast, but at larger scale we should replace or pre-filter with `to_tsvector @@ plainto_tsquery` to leverage the GIN index."

### Q5. "Your `compute_hybrid_match()` returns `0.0` immediately on category mismatch. Isn't that a brittle failure mode if a student picks the wrong category?"
**Honest Answer:**
"Yes, that is an intentional precision-over-recall trade-off in `hybrid.py:21-25` and `query_pgvector_candidates()` (`category_id` filter) to prevent noisy cross-category suggestions (e.g., matching a black phone case with a black wallet). However, `/api/matching/semantic-search` allows `category_id=None` so staff can search across all categories when a misclassified report is suspected."

### Q6. "Your Next.js `middleware.ts` reads `lf_role` from a plain client cookie. Can't a student edit `lf_role=admin` in DevTools and bypass RBAC?"
**Honest Answer:**
"Editing the `lf_role` cookie only lets them render the empty `/admin` client shell—it grants **zero data or mutation access**. Every FastAPI endpoint validates the cryptographically signed HS256 JWT (`Authorization: Bearer ...`) in `get_current_user()` and checks `User.role` in PostgreSQL via `require_role()` (`auth.py:83-98`), returning `403 Forbidden` on any unauthorized API request."

### Q7. "How do you invalidate a stateless JWT on logout, and what is the scalability bottleneck of your auth layer?"
**Honest Answer:**
"Each JWT carries a UUID `jti` claim (`auth.py:52`). On logout, `jti` is inserted into PostgreSQL's `revoked_tokens` table, and `get_current_user()` checks `RevokedToken` on every authenticated request (`auth.py:78-81`). The trade-off is one extra indexed DB lookup per request (and expired rows in `revoked_tokens` need periodic cleanup). Also, our `check_rate_limit()` (`auth.py:19-33`) uses an in-memory Python dictionary, which would need to move to Redis in a multi-worker deployment."

### Q8. "Look at `found_items.py` vs `lost_items.py`: why does `POST /api/lost-items` use `query_pgvector_candidates()` with threshold `45.0`, while `POST /api/found-items` loops over all open lost items in Python with threshold `50.0`?"
**Honest Answer:**
"That is an asymmetry in the current implementation: `lost_items.py:65-80` uses SQL `pgvector` `<=>` top-15 retrieval and saves candidates at `>= 45.0`, whereas `found_items.py:78-81` fetches all `open`/`matched` `LostItem` rows in Python and saves at `>= 50.0`. Both still compute the exact same `compute_hybrid_match()` formula, but unifying `found_items.py` to use `lost_items.embedding.cosine_distance(...)` and a shared config threshold would make both directions consistent and O(log N) via the HNSW index."
