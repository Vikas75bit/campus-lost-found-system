# System Architecture & Technical Design
## Lost & Found Intelligence System for a University Campus

### 1. High-Level Architectural Overview

The system employs a clean, modular multi-tier architecture separating presentation, REST application services, intelligent signal processing, and relational data persistence.

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Responsive Web UI)"]
        UI_Student["Student Experience\n(Reports, Browse, Claims, Matches)"]
        UI_Staff["Staff Experience\n(Custody, Match Cockpit, Claims Queue, Handover Desk)"]
        UI_Admin["Admin Experience\n(Users, Roles, Audit Logs, AI Benchmark)"]
    end

    subgraph APILayer ["FastAPI Application Services (Python 3.12)"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        RouterLost["Lost Reports Router"]
        RouterFound["Found Custody Router"]
        RouterMatch["Matching Router"]
        RouterClaim["Claims & Verification Router"]
        RouterHandover["Physical Handover Router"]
        RouterAdmin["Admin & Operations Router"]
        RouterEval["AI Benchmark Router"]
    end

    subgraph EngineLayer ["Intelligent Matching Subsystem"]
        SemanticEngine["Semantic Embedding Engine\n(TF-IDF + LSA SVD Dense Cosine)"]
        BaselineEngine["Structured Attribute & Keyword Scorer"]
        HybridScorer["Hybrid Multi-Signal Ranker & Explainability Engine"]
    end

    subgraph DataLayer ["Relational Database Layer (PostgreSQL / SQLite)"]
        Tables[("10 Normalized Relational Tables\n(PK, FK, UNIQUE, CHECK)")]
        Triggers["Triggers & Functions\n(Audit Logging, Status Transitions, Constraints)"]
        Views["Relational Views\n(Data Masking, Reporting, Match Cockpit)"]
        TxManager["ACID Transaction Management\n(Atomic Handovers & Approvals)"]
    end

    UI_Student -->|REST / JSON| AuthMiddleware
    UI_Staff -->|REST / JSON| AuthMiddleware
    UI_Admin -->|REST / JSON| AuthMiddleware

    AuthMiddleware --> RouterLost
    AuthMiddleware --> RouterFound
    AuthMiddleware --> RouterMatch
    AuthMiddleware --> RouterClaim
    AuthMiddleware --> RouterHandover
    AuthMiddleware --> RouterAdmin
    AuthMiddleware --> RouterEval

    RouterLost -.->|Scan Candidates| HybridScorer
    RouterFound -.->|Scan Candidates| HybridScorer
    RouterMatch --> HybridScorer
    RouterEval --> HybridScorer

    HybridScorer --> SemanticEngine
    HybridScorer --> BaselineEngine

    RouterLost --> DataLayer
    RouterFound --> DataLayer
    RouterMatch --> DataLayer
    RouterClaim --> DataLayer
    RouterHandover --> TxManager
    RouterAdmin --> DataLayer

    TxManager --> Tables
    Tables --> Triggers
    Tables --> Views
```

---

### 2. Component Responsibilities

#### 2.1 Web Presentation Layer (`frontend/`)
- **Single Page Application (SPA):** Delivered directly by FastAPI with zero build tool dependencies, guaranteeing offline execution on any machine.
- **Dynamic Role Adaptation:** Switches UI capabilities based on active user role (`student`, `staff`, `admin`).
- **Interactive Modals:** Handles lost reporting, official found receipt, evidence submission, claim review, physical handover recording, and live benchmark execution.
- **Data Confidentiality:** Masks physical custody storage codes and finder contact details from students.

#### 2.2 Application Services Layer (`backend/app/`)
- **FastAPI Core (`main.py`):** Configures routing, CORS, static file mounts, database lifecycle events, and error handling.
- **Security & RBAC (`auth.py`):** Issues signed JWT tokens (HS256) and enforces role-based endpoint guards via FastAPI dependency injection (`require_role(["staff", "admin"])`).
- **Data Transfer & Validation (`schemas.py`):** Enforces Pydantic v2 schemas validating payload lengths, regex constraints, and required fields.
- **Relational ORM (`models.py`, `database.py`):** SQLAlchemy 2.0 object-relational mapping establishing exact relational constraints, foreign keys, cascades, and checks.

#### 2.3 Intelligent Candidate Matching Subsystem (`backend/app/matching/`)
1. **Baseline Keyword/Structured Matcher (`baseline.py`):**
   - Filters exact category compatibility.
   - Computes token overlap (Jaccard similarity + length-normalized overlap) across descriptions, brands, and colors.
   - Computes temporal difference in days with smooth decay.
   - Computes registered location ID match or text proximity.
2. **Semantic Dense Vector Engine (`semantic.py`):**
   - Projects raw text into a dense semantic space using TF-IDF word & character n-grams (1-3) fitted across a campus domain vocabulary.
   - Computes Cosine Similarity:
     $$\text{CosineSim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
   - Produces a continuous semantic score $[0, 100]\%$.
3. **Hybrid Multi-Signal Ranker (`hybrid.py`):**
   - Combines signals with weighted multi-criteria aggregation:
     $$\text{MatchScore} = 0.35 \times \text{Semantic} + 0.25 \times \text{Keyword} + 0.40 \times \text{Structured}$$
   - Structured sub-score includes Category (40%), Brand match (20%), Color match (15%), Location proximity (15%), and Temporal window (10%).
   - Generates transparent JSON reasoning strings detailing each signal for staff inspection.

---

### 3. End-to-End Item Lifecycle Workflow

The lifecycle strictly decouples match suggestion, claim evaluation, approval, and physical collection:

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (alex@campus.edu)
    participant API as FastAPI Backend
    participant Engine as Hybrid Matching Engine
    participant DB as Relational Database
    actor Staff as Staff Officer (sarah@campus.edu)

    Note over Student, DB: 1. Lost Item Reporting
    Student->>API: POST /api/lost-items (Description, Category, Location, Date)
    API->>DB: INSERT into lost_items (status='open')
    API->>Engine: Scan existing found items in custody
    Engine-->>API: Discovered candidates (MatchScore >= 50%)
    API->>DB: INSERT into match_candidates & notifications

    Note over Staff, DB: 2. Physical Item Received in Custody
    Staff->>API: POST /api/found-items (Item, Location, storage_location='Locker B-07')
    API->>DB: INSERT into found_items (status='in_custody')
    API->>Engine: Scan open lost reports
    Engine-->>API: High confidence match (Score: 94.5%)
    API->>DB: INSERT into match_candidates & notifications

    Note over Staff, API: 3. Staff Review of Suggestions
    Staff->>API: GET /api/matching/candidates
    Staff->>API: PUT /api/matching/{id}/review (status='relevant', notes='Inspected lid')
    API->>DB: UPDATE match_candidates

    Note over Student, DB: 4. Ownership Claim Submission
    Student->>API: POST /api/claims (proof_notes, distinctive_proof='Torn sticker ear')
    API->>DB: INSERT into claims (status='submitted')
    API->>DB: UPDATE found_items (status='claim_pending')

    Note over Staff, DB: 5. Staff Claim Assessment
    Staff->>API: PUT /api/claims/{id}/review (status='approved', notes='Invoice verified')
    API->>DB: UPDATE claims (status='approved')
    API->>DB: UPDATE found_items (status='awaiting_handover')
    Note right of DB: Item is AWAITING HANDOVER (NOT returned!)
    API->>DB: INSERT into notifications ("Ready for collection at office")

    Note over Student, Staff: 6. In-Person Collection & Physical Handover
    Student->>Staff: Visits Lost & Found Room with Student ID Card
    Staff->>Staff: Verifies Student ID number & signature in register
    Staff->>API: POST /api/handovers (claim_id, recipient_id_type, recipient_id_number)
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT into handovers
    API->>DB: UPDATE found_items (status='returned')
    API->>DB: UPDATE lost_items (status='resolved')
    API->>DB: INSERT into status_history & audit_logs
    API->>DB: COMMIT TRANSACTION
    API-->>Staff: Handover complete. Case marked RESOLVED.
```

