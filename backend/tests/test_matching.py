import json
from backend.app.routers.matching import get_match_candidates, review_match_candidate
from backend.app.schemas import MatchCandidateReview
from backend.app.matching.hybrid import compute_hybrid_match
from backend.app.models import LostItem, FoundItem

def test_candidate_matches_returned(db, staff_user):
    candidates = get_match_candidates(None, db, staff_user)
    assert len(candidates) > 0
    top = candidates[0]
    assert top.match_score >= 0 and top.match_score <= 100
    assert top.semantic_score is not None
    assert top.structured_score is not None

def test_similarity_is_not_treated_as_ownership(db, staff_user):
    candidates = get_match_candidates(None, db, staff_user)
    for c in candidates:
        if c.match_reasons:
            parsed = json.loads(c.match_reasons)
            assert "disclaimer" in parsed
            assert "Candidate retrieval similarity score only" in parsed["disclaimer"]

def test_staff_can_review_suggestion(db, staff_user):
    review_in = MatchCandidateReview(
        staff_review_status="relevant",
        staff_notes="High confidence candidate investigated by staff officer."
    )
    res = review_match_candidate(1, review_in, db, staff_user)
    assert res.staff_review_status == "relevant"
    assert res.staff_notes == review_in.staff_notes

def test_hybrid_matching_category_mismatch_yields_zero():
    lost = LostItem(category_id=1, item_description="Dell XPS Laptop", approximate_location="Library")
    found = FoundItem(category_id=2, item_description="Dell Backpack", found_location_description="Library")
    score, _, _, _, reasons = compute_hybrid_match(lost, found)
    assert score == 0.0
    assert "Category Mismatch" in reasons
