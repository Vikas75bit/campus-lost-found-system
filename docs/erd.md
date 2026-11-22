# Entity-Relationship Diagram (ERD)
## Lost & Found Intelligence System for a University Campus

### 1. Visual Entity-Relationship Diagram (Mermaid)

```mermaid
erDiagram
    USERS ||--o{ LOST_ITEMS : "reports (1:N)"
    USERS ||--o{ FOUND_ITEMS : "records custody (1:N)"
    USERS ||--o{ CLAIMS : "submits (1:N)"
    USERS ||--o{ HANDOVERS : "receives item (1:N)"
    USERS ||--o{ HANDOVERS : "authorizes handover (1:N)"
    USERS ||--o{ NOTIFICATIONS : "receives (1:N)"
    USERS ||--o{ AUDIT_LOGS : "triggers action (1:N)"

    CATEGORIES ||--o{ LOST_ITEMS : "classifies (1:N)"
    CATEGORIES ||--o{ FOUND_ITEMS : "classifies (1:N)"

    CAMPUS_LOCATIONS ||--o{ LOST_ITEMS : "lost at (1:N)"
    CAMPUS_LOCATIONS ||--o{ FOUND_ITEMS : "found at (1:N)"

    LOST_ITEMS ||--o{ MATCH_CANDIDATES : "suggested pair (1:N)"
    FOUND_ITEMS ||--o{ MATCH_CANDIDATES : "suggested pair (1:N)"

    FOUND_ITEMS ||--o{ CLAIMS : "claimed on (1:N)"
    LOST_ITEMS ||--o{ CLAIMS : "linked reference (1:N)"

    CLAIMS ||--|| HANDOVERS : "authorizes handover (1:1)"
    FOUND_ITEMS ||--|| HANDOVERS : "handed over (1:1)"

    USERS {
        int id PK
        string email UK "NOT NULL"
        string password_hash "NOT NULL"
        string full_name "NOT NULL"
        string role "CHECK in (student, staff, admin)"
        string phone
        string department
        boolean is_active "DEFAULT TRUE"
        timestamp created_at
        timestamp updated_at
    }

    CATEGORIES {
        int id PK
        string name UK "NOT NULL"
        string description
        string icon_name
        boolean is_active "DEFAULT TRUE"
        timestamp created_at
    }

    CAMPUS_LOCATIONS {
        int id PK
        string name UK "NOT NULL"
        string zone "NOT NULL"
        string building
        string floor
        string description
        boolean is_active "DEFAULT TRUE"
    }

    LOST_ITEMS {
        int id PK
        int user_id FK "NOT NULL -> users.id"
        int category_id FK "NOT NULL -> categories.id"
        int location_id FK "NULLABLE -> campus_locations.id"
        string approximate_location "NOT NULL"
        text item_description "NOT NULL"
        text distinctive_details "OPTIONAL"
        string brand
        string primary_color
        string secondary_color
        timestamp lost_date_time "NOT NULL"
        string lost_time_range
        string status "CHECK in (open, claim_pending, matched, resolved, cancelled)"
        string image_url
        timestamp created_at
        timestamp updated_at
    }

    FOUND_ITEMS {
        int id PK
        int recorded_by_staff_id FK "NOT NULL -> users.id"
        int category_id FK "NOT NULL -> categories.id"
        int location_id FK "NULLABLE -> campus_locations.id"
        string found_location_description "NOT NULL"
        text item_description "NOT NULL"
        text distinctive_details "OPTIONAL"
        string brand
        string primary_color
        string secondary_color
        timestamp found_date_time "NOT NULL"
        boolean physical_custody_confirmed "DEFAULT TRUE"
        string storage_location "NOT NULL (Room/Bin/Locker)"
        string finder_name
        string finder_contact
        string status "CHECK in (in_custody, claim_pending, awaiting_handover, returned, disposed)"
        string image_url
        timestamp created_at
        timestamp updated_at
    }

    MATCH_CANDIDATES {
        int id PK
        int lost_item_id FK "NOT NULL -> lost_items.id"
        int found_item_id FK "NOT NULL -> found_items.id"
        numeric match_score "CHECK >= 0 AND <= 100"
        numeric semantic_score
        numeric structured_score
        numeric keyword_score
        text match_reasons "JSON Breakdown"
        string staff_review_status "CHECK in (unreviewed, relevant, rejected, investigating)"
        text staff_notes
        int reviewed_by_staff_id FK "NULLABLE -> users.id"
        timestamp reviewed_at
        timestamp created_at
    }

    CLAIMS {
        int id PK
        int found_item_id FK "NOT NULL -> found_items.id"
        int claimant_user_id FK "NOT NULL -> users.id"
        int lost_item_id FK "NULLABLE -> lost_items.id"
        text claim_description "NOT NULL"
        text proof_evidence_notes "NOT NULL"
        text distinctive_proof "CONFIDENTIAL"
        string status "CHECK in (submitted, under_review, info_requested, approved, rejected, withdrawn)"
        int staff_reviewer_id FK "NULLABLE -> users.id"
        text staff_decision_notes
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }

    HANDOVERS {
        int id PK
        int claim_id FK "UK NOT NULL -> claims.id"
        int found_item_id FK "UK NOT NULL -> found_items.id"
        int recipient_user_id FK "NOT NULL -> users.id"
        int staff_id FK "NOT NULL -> users.id"
        timestamp handover_date_time "NOT NULL"
        string recipient_id_type "NOT NULL"
        string recipient_id_number "NOT NULL"
        text handover_notes
        boolean recipient_signature_acknowledged "DEFAULT TRUE"
        timestamp created_at
    }

    NOTIFICATIONS {
        int id PK
        int user_id FK "NOT NULL -> users.id"
        string title "NOT NULL"
        text message "NOT NULL"
        string notification_type "NOT NULL"
        boolean is_read "DEFAULT FALSE"
        string reference_entity
        int reference_id
        timestamp created_at
    }

    AUDIT_LOGS {
        int id PK
        string table_name "NOT NULL"
        int record_id "NOT NULL"
        string action "CHECK in (INSERT, UPDATE, DELETE)"
        text old_values
        text new_values
        int changed_by_user_id FK "NULLABLE -> users.id"
        string ip_address
        timestamp created_at
    }

    STATUS_HISTORY {
        int id PK
        string entity_type "CHECK in (lost_item, found_item, claim)"
        int entity_id "NOT NULL"
        string old_status
        string new_status "NOT NULL"
        int changed_by_user_id FK "NULLABLE -> users.id"
        text change_reason
        timestamp created_at
    }
```

---

### 2. Relationship Cardinality & Referential Integrity Matrix

| Parent Table | Child Table | Relationship | Foreign Key Column | On Delete Action | Integrity Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `lost_items` | $1 : N$ | `user_id` | `CASCADE` | If a user account is deleted, their reports are removed. |
| `users` | `found_items` | $1 : N$ | `recorded_by_staff_id` | `RESTRICT` | Prevents deleting staff accounts responsible for physical custody. |
| `categories` | `lost_items` | $1 : N$ | `category_id` | `RESTRICT` | Prevents deleting a category actively referenced by open reports. |
| `categories` | `found_items` | $1 : N$ | `category_id` | `RESTRICT` | Protects categorical integrity of inventory. |
| `campus_locations` | `lost_items` | $1 : N$ | `location_id` | `SET NULL` | Removing a campus location does not invalidate the report description. |
| `lost_items` | `match_candidates` | $1 : N$ | `lost_item_id` | `CASCADE` | When a lost item is removed, generated candidate matches are cleared. |
| `found_items` | `match_candidates` | $1 : N$ | `found_item_id` | `CASCADE` | When a found item is removed, generated candidate matches are cleared. |
| `found_items` | `claims` | $1 : N$ | `found_item_id` | `RESTRICT` | Prevents deleting an item currently subject to active ownership claims. |
| `users` | `claims` | $1 : N$ | `claimant_user_id` | `CASCADE` | Deleting a user account cleans up their pending claims. |
| `claims` | `handovers` | $1 : 1$ | `claim_id` | `RESTRICT` (UNIQUE) | Strictly guarantees an approved claim is handed over exactly once. |
| `found_items` | `handovers` | $1 : 1$ | `found_item_id` | `RESTRICT` (UNIQUE) | Strictly prevents handing over the same physical found item twice. |

