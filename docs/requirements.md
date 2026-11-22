# System Requirements Specification (SRS)
## Lost & Found Intelligence System for a University Campus

### 1. Problem Statement
The university operates a physical lost-and-found room in the student affairs building. The conventional manual workflow relies on handwritten paper registers, fragmented WhatsApp group alerts, and informal in-person queries. This creates operational bottlenecks:
- Low retrieval efficiency when querying historical logs.
- Inability to automatically cross-reference lost item descriptions against physically received found items.
- Risk of inconsistent claim documentation and incomplete handover audit trails.
- Lack of centralized traceability regarding an item's chain of custody and resolution status.

> **Important Boundary Condition:** The existing manual campus process is not assumed to be fraudulent or devoid of verification; campus staff routinely conduct in-person questioning. Rather, this project establishes a centralized digital relational system to streamline report recording, automate candidate match discovery, enforce structured verification workflows, and maintain an immutable audit trail.

---

### 2. Project Objectives
1. Provide a centralized relational platform for students to report lost belongings and track their resolution.
2. Support university staff in officially logging items physically received into custody, complete with designated storage locations (bins, lockers, safe boxes).
3. Implement an intelligent candidate matching engine to discover potential lost-found pairings based on categorical, temporal, spatial, and semantic signals.
4. Enforce a rigorous multi-step claim verification workflow separating match discovery, evidence submission, staff assessment, and physical handover.
5. Demonstrate substantial Database Management System (DBMS) concepts: 3NF normalization, foreign key constraints, CHECK constraints, ACID transactions, relational views, triggers, stored procedures, and audit logging.

---

### 3. System Scope & Actors

#### 3.1 Actors
1. **Campus User / Student:**
   - Registers and authenticates via email/password.
   - Submits lost-item reports.
   - Browses publicly listed found items (with sensitive storage bins and finder contact masked).
   - Reviews system-suggested candidate matches for their own reports.
   - Submits ownership claims with supporting proof and confidential identifiers.
   - Receives in-app notifications on claim decisions and collection readiness.

2. **Lost-and-Found Staff:**
   - Officially records items physically delivered to the lost-and-found room.
   - Enters mandatory physical storage coordinates (room, locker, shelf, bin).
   - Operates the Candidate Matching Cockpit (reviews suggestions, marks status, adds notes).
   - Evaluates ownership claims against physical item evidence and confidential proof.
   - Approves, rejects, or requests additional evidence for claims.
   - Executes the physical handover upon verifying government or student photo ID.

3. **System Administrator:**
   - Manages user accounts, active statuses, and role privileges.
   - Inspects operational dashboards, return rates, and recovery statistics.
   - Reviews system audit logs and entity status transition histories.
   - Executes live performance benchmarks of candidate retrieval models.

4. **Matching Engine (Internal Component):**
   - Autonomous background signal processor.
   - Computes semantic embeddings, lexical overlap, and structured compatibility.
   - Generates candidate match pairs with human-interpretable reasoning.
   - **Crucial Invariant:** The matching engine *never* independently authorizes an ownership claim or handover.

---

### 4. Functional Requirements

#### 4.1 Lost-Item Reporting (LR)
- **LR-01:** An authenticated campus user shall be able to submit a lost-item report.
- **LR-02:** The system shall require a meaningful item description (minimum 5 characters).
- **LR-03:** The system shall require a last-known approximate location.
- **LR-04:** The system shall require an approximate date and optional time range when the item was lost.
- **LR-05:** The system shall require category selection from active university categories.
- **LR-06:** The system shall explicitly prompt users for distinctive characteristics (stickers, scratches, engravings, internal contents).
- **LR-07:** The absence of distinctive details shall *not* prevent submission (field is strictly optional).
- **LR-08:** All submitted data shall be validated via server-side schemas.
- **LR-09:** Each report shall be immutably linked to the submitting user's account (`user_id`).
- **LR-10:** The system shall return a confirmation upon successful report submission.
- **LR-11:** Campus users shall be able to view and track all their submitted reports.
- **LR-12:** Ordinary users shall *not* be permitted to view confidential details or edit reports belonging to other users.
- **LR-13:** Staff and administrators shall possess controlled review and administrative correction permissions.

#### 4.2 Found-Item Custody Management
- **FR-01:** Only authorized staff and administrators shall record found items received into university custody.
- **FR-02:** Found item recording requires mandatory specification of physical storage coordinates (`storage_location` e.g., 'Room 104, Locker Bin B-07').
- **FR-03:** The system shall distinguish between an informal report of a found item and official confirmation of physical custody.
- **FR-04:** Found items shall be categorized, timestamped, and associated with finder details where available.
- **FR-05:** In public browsing mode, internal storage locker codes and finder contact details shall be automatically masked from student users.

#### 4.3 Intelligent Candidate Matching
- **MR-01:** The system shall provide structured filtering baseline (category, keyword, location, date).
- **MR-02:** The system shall compute semantic similarity using dense vector embeddings (TF-IDF + LSA SVD cosine similarity).
- **MR-03:** The hybrid matcher shall aggregate semantic similarity (35%), lexical overlap (25%), and structured attributes (40%).
- **MR-04:** Candidate suggestions shall include a transparent human-readable breakdown of matching signals.
- **MR-05:** Similarity scores shall explicitly carry a disclaimer stating they represent retrieval ranking relevance, *not* legal proof of ownership.
- **MR-06:** Candidate discovery shall be triggerable on-demand or automatically upon report submission.

#### 4.4 Claims & Ownership Verification
- **CR-01:** An authenticated student shall be able to submit an ownership claim against an available found item.
- **CR-02:** The database shall strictly block claims on items with status `returned` or `disposed`.
- **CR-03:** Claimants shall provide a statement of ownership and supporting proof/evidence.
- **CR-04:** Claimants may submit a confidential distinctive identifier (e.g., hidden mark, wallpaper, pocket contents) accessible only to staff.
- **CR-05:** Staff shall evaluate claims and record one of three decisions: `approved`, `rejected`, or `info_requested`.
- **CR-06:** Staff approval of a claim transitions the item to `awaiting_handover`, **never** `returned` or `resolved`.
- **CR-07:** If an approved item is not physically collected, it remains awaiting handover indefinitely.

#### 4.5 Physical Handover & Case Resolution
- **HR-01:** Only authorized staff members shall record a physical handover.
- **HR-02:** A handover operation requires an approved claim and an item in status `awaiting_handover`.
- **HR-03:** Staff must verify and record the recipient's identity document type (e.g., Student ID Card) and unique card number.
- **HR-04:** The handover operation shall execute inside an atomic database transaction.
- **HR-05:** Upon successful handover, the found item transitions to `returned`, and any associated lost report transitions to `resolved`.
- **HR-06:** An item case is considered resolved **only** after physical handover is completed.

#### 4.6 Notifications & Auditability
- **NR-01:** In-app notifications shall alert users when candidate matches are discovered, claims are updated, or items are ready for collection.
- **AR-01:** Every entity status transition shall be recorded in `status_history`.
- **AR-02:** Significant database insert/update operations shall be captured in `audit_logs`.

---

### 5. Non-Functional Requirements
- **Performance:** Matching candidate evaluation for 100+ items must execute within 50 milliseconds.
- **Reliability:** ACID transaction guarantees ensure handovers, claim approvals, and status updates never leave the database in an inconsistent state.
- **Security:** Passwords salted and hashed with bcrypt; role-based access control (RBAC) enforced on all REST endpoints via JWT Bearer authentication.
- **Reproducibility:** Zero external paid API dependencies; executes 100% locally on standard university computing infrastructure.

