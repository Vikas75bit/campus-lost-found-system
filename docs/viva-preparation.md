# Comprehensive Viva Preparation & Defense Guide
## Lost & Found Intelligence System for a University Campus
**DBMS Mini-Project | Academic Defense Material**

---

### 1. 60-Second Project Elevator Pitch

> *"Our project is a centralized **Lost & Found Intelligence System** designed for a university campus. Rather than just a basic CRUD app, it implements a substantial relational database architecture that solves real-world campus custody challenges. Students can submit lost item reports with prompted distinctive details; staff can officially log physically received found items into secure storage bins; and an offline **Hybrid Candidate Matching Engine** combines dense semantic vector embeddings, lexical tokens, and structured campus attributes to discover potential matches within 3 milliseconds.*
> 
> *Crucially, our system enforces a strict workflow invariant: **similarity scores are treated strictly as investigative candidate ranking signals, never as legal proof of ownership**. Ownership verification requires human staff review of evidence and confidential distinctive marks. Furthermore, claim approval moves an item to 'Awaiting Handover'—the case is only marked 'Resolved' when physical handover is verified with photo ID in an atomic ACID transaction. We demonstrate 3NF normalization, foreign key cascades, CHECK constraints, triggers, relational views, stored procedures, and audit logging."*

---

### 2. Core DBMS Concepts Demonstrated

#### 2.1 Normalization (3NF)
- **1NF:** All attributes are atomic (e.g., color is split into `primary_color` and `secondary_color`; no array or delimited strings for core relations). Every table has a surrogate primary key `id`.
- **2NF:** Every non-prime attribute is fully dependent on the whole candidate key (`id`). Since keys are single-column integers, partial dependencies cannot exist.
- **3NF:** No transitive functional dependencies exist. For example, location building and zone are factored into `campus_locations` rather than repeated in `lost_items` or `found_items`. Categories are normalized into `categories`.

#### 2.2 Relational Integrity & Domain Constraints
- **CHECK Constraints:**
  - `role IN ('student', 'staff', 'admin')` on `users`
  - `status IN ('open', 'claim_pending', 'matched', 'resolved', 'cancelled')` on `lost_items`
  - `status IN ('in_custody', 'claim_pending', 'awaiting_handover', 'returned', 'disposed')` on `found_items`
  - `status IN ('submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'withdrawn')` on `claims`
  - `match_score >= 0 AND match_score <= 100` on `match_candidates`
- **UNIQUE Constraints:**
  - `uq_lost_found_match UNIQUE (lost_item_id, found_item_id)`: Prevents duplicate match entries between the same pair.
  - `UNIQUE (claim_id)` and `UNIQUE (found_item_id)` on `handovers`: Prevents double handover or multiple returns for a single physical item.
- **Foreign Key Cascades:**
  - `ON DELETE CASCADE`: Used for user-owned auxiliary records (`lost_items`, `notifications`).
  - `ON DELETE RESTRICT`: Used for custody records (`found_items`, `claims`, `handovers`) to guarantee that critical audit logs and inventory history cannot be accidentally deleted.

#### 2.3 ACID Transactions
- Demonstrated during the physical handover process:
  - **Atomicity:** Inserting into `handovers`, updating `found_items` to `returned`, updating `lost_items` to `resolved`, and logging to `status_history` succeed together or fail together.
  - **Consistency:** Enforces that found items must be in `awaiting_handover` and claims in `approved` state before handover can execute.
  - **Isolation:** Serialized updates prevent race conditions where two staff members might simultaneously hand over the same physical item.
  - **Durability:** Committed transactions persist permanently in the database disk store.

#### 2.4 Triggers & Stored Procedures
- **Timestamp Trigger (`update_timestamp_column`):** Automatically updates `updated_at` before every row modification.
- **Audit Trigger (`audit_status_change`):** Fires `AFTER UPDATE OF status` to log status transitions into `status_history`.
- **Integrity Trigger (`check_item_claimable`):** Fires `BEFORE INSERT ON claims` to prevent claims on items already `returned` or `disposed`.
- **Stored Procedure (`process_physical_handover`):** Encapsulates the multi-table atomic handover transaction in PostgreSQL PL/pgSQL.

#### 2.5 Relational Views
- `vw_public_found_items`: Implements **data masking** by omitting internal storage locker codes and finder contact details from students.
- `vw_category_resolution_metrics`: Demonstrates complex aggregation with `COUNT(DISTINCT ...)`, `CASE WHEN`, and percentage arithmetic.
- `vw_staff_match_queue`: Joins 4 tables (`match_candidates`, `lost_items`, `found_items`, `users`) for staff triage.

---

### 3. Deep Dive into AI & Candidate Matching

#### 3.1 Why not just use full-text search?
Full-text search relies on exact keyword matching and stemming. If a student reports a *"silver Dell laptop"* and staff records a *"grey Dell notebook computer left plugged into charger"*, keyword matching fails to score their similarity. Semantic vector embeddings recognize that "laptop" and "notebook computer" represent the same semantic entity.

#### 3.2 How are dense semantic vectors generated?
We use word and character n-gram (1-3) TF-IDF vectorization fitted across a campus domain vocabulary, reduced into dense latent semantic representations. We then compute the **Cosine Similarity**:
$$\text{CosineSim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \frac{\sum_{i=1}^n u_i v_i}{\sqrt{\sum_{i=1}^n u_i^2} \sqrt{\sum_{i=1}^n v_i^2}}$$

#### 3.3 Why Hybrid Multi-Signal Matching instead of pure vector search?
Pure vector search ignores vital relational constraints. A blue Nike shoe and a blue Nike shirt have high semantic similarity, but belong to completely incompatible categories. Our hybrid formula enforces:
$$\text{MatchScore} = 0.35 \times \text{Semantic} + 0.25 \times \text{Keyword} + 0.40 \times \text{Structured}$$
- Category compatibility serves as a primary gate (mismatch yields 0).
- Location proximity and temporal windows discount items found days before they were lost.

---

### 4. Top 15 Likely Viva Questions with Technical Answers

#### Q1: What is the primary key of the `match_candidates` table and why is there a UNIQUE constraint?
**Answer:** The primary key is the synthetic surrogate key `id SERIAL PRIMARY KEY`. In addition, there is a composite UNIQUE constraint `UNIQUE (lost_item_id, found_item_id)`. This enforces that any specific lost report and physical found item pairing has at most one candidate evaluation record in the database, preventing duplicate scoring entries.

#### Q2: Why does an approved claim not mark the item as 'returned'?
**Answer:** An approved claim means staff has verified the student's evidence and approved them to collect the item. However, the item is still physically sitting in the lost-and-found room locker. Marking it 'returned' prematurely would falsely indicate that the university no longer has custody. The item is set to `awaiting_handover`, and only transitions to `returned` when the student physically appears and presents photo ID.

#### Q3: How do you prevent SQL injection in your backend?
**Answer:** We use SQLAlchemy 2.0 ORM and parameterized queries. All user inputs are passed as parameters rather than string-concatenated into SQL statements, preventing SQL injection vulnerabilities.

#### Q4: What is the difference between `ON DELETE CASCADE` and `ON DELETE RESTRICT` in your schema?
**Answer:** We use `CASCADE` on `lost_items.user_id` so that if a student user account is removed, their submitted reports are automatically deleted. Conversely, we use `RESTRICT` on `found_items.recorded_by_staff_id` and `claims.found_item_id` to prevent deleting physical custody inventory and legal claim records while they are active.

#### Q5: How is data masking implemented in your system?
**Answer:** Data masking is enforced at both the database level via the relational view `vw_public_found_items` and at the API level in `found_items.py`. When a student requests found items, the `storage_location` (e.g. Locker Bin B-07) and finder personal contact details are stripped/nullified, preventing students from knowing the exact room locker codes.

#### Q6: Explain the difference between 2NF and 3NF using an example from your schema.
**Answer:** 2NF requires 1NF and no partial dependencies on composite keys. Since all our tables use single-attribute surrogate keys (`id`), 2NF is satisfied trivially. 3NF requires no transitive dependencies ($A \to B \to C$). If `lost_items` stored `location_name` and `building_name` directly, that would violate 3NF because `location_id \to building_name`. By moving building and zone into `campus_locations` and referencing only `location_id`, we satisfy 3NF.

#### Q7: What are the performance advantages of using indexes on `match_score` and `email`?
**Answer:** Without an index, querying for a user by email or sorting candidate matches by score requires a Full Table Scan ($O(N)$ disk page reads). By creating B-Tree indexes on `users(email)` and `match_candidates(match_score DESC)`, lookups execute in $O(\log N)$ time, and sorted top matches can be retrieved immediately from index leaf nodes without an in-memory sort.

#### Q8: How does your system guarantee that an item cannot be handed over twice?
**Answer:** In the `handovers` table, both `claim_id` and `found_item_id` are defined with `UNIQUE` constraints. If a second handover operation is attempted for an item that already has a handover record, the database engine raises an immediate `IntegrityError` and rejects the transaction.

#### Q9: What happens if the database server crashes midway through a handover operation?
**Answer:** The handover operation is wrapped in an explicit ACID database transaction (`BEGIN ... COMMIT`). If a crash occurs before the commit, the transaction is rolled back completely. The item will not be marked as returned, ensuring no phantom handovers exist.

#### Q10: How does your Latent Semantic Analysis (LSA) dense vector matching work without an internet connection?
**Answer:** We use `scikit-learn`'s subword and character n-gram TF-IDF vectorizer fitted on domain campus item vocabulary. Everything runs 100% locally on the CPU in pure Python/C using NumPy and SciPy. No external APIs (like OpenAI or HuggingFace cloud) are needed, guaranteeing zero cost and 100% offline reproducibility.

#### Q11: What is the Mean Reciprocal Rank (MRR) measured in your benchmark?
**Answer:** MRR is the average of the reciprocal ranks of the first correct match across all test queries: $\text{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$. In our empirical benchmark, both the Semantic and Hybrid matchers achieved an MRR of **1.000**, meaning the true ground-truth match was consistently retrieved at Rank 1.

#### Q12: Why did you choose FastAPI over Flask or Django?
**Answer:** FastAPI provides native asynchronous request processing, automatic OpenAPI/Swagger documentation generation at `/docs`, and native integration with Pydantic v2 schemas for robust type validation and serialization.

#### Q13: Can a student edit another student's lost report?
**Answer:** No. In `lost_items.py`, the endpoint inspects the authenticated user ID extracted from the signed JWT token. If `current_user.role == 'student'` and `item.user_id != current_user.id`, the server raises an HTTP 403 Forbidden exception.

#### Q14: What is stored in the `status_history` table?
**Answer:** `status_history` is an audit table recording every lifecycle transition for lost reports, found items, and claims. It stores `entity_type`, `entity_id`, `old_status`, `new_status`, `changed_by_user_id`, `change_reason`, and `created_at`.

#### Q15: Why is Docker Compose provided if the application can run with `python run.py`?
**Answer:** `python run.py` provides instant zero-configuration local execution using SQLite so any student or examiner can launch the project with 1 command. `docker-compose.yml` provides a production-grade containerized deployment with PostgreSQL 16 and `pgvector`, demonstrating multi-container orchestration.

