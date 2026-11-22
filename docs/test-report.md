# Comprehensive Quality Assurance & Test Report
## Lost & Found Intelligence System for a University Campus

### 1. Test Execution Summary

The entire system test suite was executed against the codebase using the automated `pytest` framework:

- **Total Test Cases Executed:** 25
- **Passed:** 25 (100.0%)
- **Failed:** 0 (0.0%)
- **Execution Time:** 6.92 seconds
- **Platform:** Windows, Python 3.12.14, SQLAlchemy 2.1.6, SQLite (Memory Engine) & PostgreSQL Dialect

```
============================= test session starts =============================
collected 25 items

backend/tests/test_auth.py::test_valid_login PASSED                      [  4%]
backend/tests/test_auth.py::test_invalid_login_wrong_password PASSED     [  8%]
backend/tests/test_auth.py::test_invalid_login_nonexistent_user PASSED   [ 12%]
backend/tests/test_auth.py::test_user_registration PASSED                [ 16%]
backend/tests/test_auth.py::test_role_restrictions PASSED                [ 20%]
backend/tests/test_claims_handover.py::test_student_can_submit_claim PASSED [ 24%]
backend/tests/test_claims_handover.py::test_cannot_claim_returned_item PASSED [ 28%]
backend/tests/test_claims_handover.py::test_staff_claim_approval_leaves_item_awaiting_handover PASSED [ 32%]
backend/tests/test_claims_handover.py::test_staff_completes_handover_and_resolves_case PASSED [ 36%]
backend/tests/test_dbms_constraints.py::test_fk_constraint_enforced_on_invalid_category PASSED [ 40%]
backend/tests/test_dbms_constraints.py::test_check_constraint_on_invalid_user_role PASSED [ 44%]
backend/tests/test_dbms_constraints.py::test_check_constraint_on_invalid_lost_status PASSED [ 48%]
backend/tests/test_dbms_constraints.py::test_unique_constraint_on_email PASSED [ 52%]
backend/tests/test_dbms_constraints.py::test_status_history_retained PASSED [ 56%]
backend/tests/test_matching.py::test_candidate_matches_returned PASSED   [ 60%]
backend/tests/test_matching.py::test_similarity_is_not_treated_as_ownership PASSED [ 64%]
backend/tests/test_matching.py::test_staff_can_review_suggestion PASSED  [ 68%]
backend/tests/test_matching.py::test_hybrid_matching_category_mismatch_yields_zero PASSED [ 72%]
backend/tests/test_reports.py::test_valid_lost_report_submission PASSED  [ 76%]
backend/tests/test_reports.py::test_missing_required_fields_rejected PASSED [ 80%]
backend/tests/test_reports.py::test_optional_distinctive_details_accepted_empty PASSED [ 84%]
backend/tests/test_reports.py::test_student_cannot_modify_another_students_report PASSED [ 88%]
backend/tests/test_reports.py::test_student_cannot_view_restricted_details_of_other_report PASSED [ 92%]
backend/tests/test_reports.py::test_staff_can_record_found_item_custody PASSED [ 96%]
backend/tests/test_reports.py::test_student_found_item_browsing_masks_storage_location PASSED [100%]

======================= 25 passed in 6.92s =======================
```

---

### 2. Traceability Matrix & Test Case Breakdown

| Module | Test Case ID | Requirement Verified | Expected Behavior | Outcome |
| :--- | :--- | :--- | :--- | :---: |
| **Auth** | `test_valid_login` | §6.1 Authentication | Valid credentials return signed JWT with role | **PASSED** |
| **Auth** | `test_invalid_login_wrong_password` | §6.1 Security | Wrong password returns HTTP 401 Unauthorized | **PASSED** |
| **Auth** | `test_invalid_login_nonexistent_user`| §6.1 Security | Unregistered user returns HTTP 401 | **PASSED** |
| **Auth** | `test_user_registration` | §6.1 Registration | New user registered with bcrypt hash | **PASSED** |
| **Auth** | `test_role_restrictions` | §3.1 Access Control | Student accessing staff/admin route raises 403 | **PASSED** |
| **Reports** | `test_valid_lost_report_submission` | LR-01 to LR-10 | Authenticated report saved with status 'open' | **PASSED** |
| **Reports** | `test_missing_required_fields_rejected` | LR-08 Validation | Missing description or location rejected (422) | **PASSED** |
| **Reports** | `test_optional_distinctive_details_empty` | LR-06, LR-07 | Report accepted with null distinctive details | **PASSED** |
| **Reports** | `test_student_cannot_modify_others` | LR-12 Access Control | Student modifying another user's report raises 403 | **PASSED** |
| **Reports** | `test_student_cannot_view_restricted` | §6.7 Privacy | Ordinary student blocked from other users' reports | **PASSED** |
| **Found** | `test_staff_can_record_found_custody` | §5, §6.4 Custody | Staff records item with mandatory storage bin | **PASSED** |
| **Found** | `test_student_browsing_masks_storage` | §6.7 Confidentiality | Storage bin code and finder masked for students | **PASSED** |
| **Matching** | `test_candidate_matches_returned` | §6.5 Matching | Candidates returned with similarity scores (0-100) | **PASSED** |
| **Matching** | `test_similarity_not_ownership` | §3.3 Invariant | Explicit disclaimer present in matching reasons | **PASSED** |
| **Matching** | `test_staff_can_review_suggestion` | §6.6 Staff Review | Staff can set status to 'relevant'/'rejected' | **PASSED** |
| **Matching** | `test_hybrid_category_mismatch_zero` | §6.5 Hybrid Scorer | Category mismatch results in 0.0 match score | **PASSED** |
| **Claims** | `test_student_can_submit_claim` | §6.7 Claim Flow | Student submits claim on item in custody | **PASSED** |
| **Claims** | `test_cannot_claim_returned_item` | §6.7 Integrity | Claiming an already returned item raises 400 | **PASSED** |
| **Claims** | `test_staff_approval_awaiting_handover`| §3.4 Invariant | Approved claim moves item to `awaiting_handover` | **PASSED** |
| **Handover** | `test_staff_handover_resolves_case` | §3.4, §6.8 Handover | Physical handover sets `returned` and `resolved` | **PASSED** |
| **DBMS** | `test_fk_constraint_invalid_category` | §7 Constraints | Non-existent FK category raises IntegrityError | **PASSED** |
| **DBMS** | `test_check_constraint_user_role` | §7 Constraints | Invalid role string violates CHECK constraint | **PASSED** |
| **DBMS** | `test_check_constraint_lost_status` | §7 Constraints | Invalid status string violates CHECK constraint | **PASSED** |
| **DBMS** | `test_unique_constraint_email` | §7 Constraints | Duplicate user email raises IntegrityError | **PASSED** |
| **DBMS** | `test_status_history_retained` | §7 Auditability | Status history entries logged with timestamps | **PASSED** |

---

### 3. Critical Verification Assertions Confirmed

1. **Approved Claims Do NOT Automatically Resolve:**
   In `test_staff_claim_approval_leaves_item_awaiting_handover`, when staff approves a claim, the found item status changes to `awaiting_handover`. The status is verified *not* to be `returned` and *not* to be `resolved`.

2. **Case is Resolved ONLY Upon Handover:**
   In `test_staff_completes_handover_and_resolves_case`, only after `POST /api/handovers` is called with recipient ID verification does the found item transition to `returned` and the associated lost report transition to `resolved`.

3. **Database Constraints are Actively Enforced:**
   Foreign key violations, invalid check constraints, and unique constraint duplications were directly tested against the database engine and verified to trigger transactional rollbacks.

