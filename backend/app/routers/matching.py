from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import MatchCandidate, LostItem, FoundItem, User
from backend.app.schemas import MatchCandidateResponse, MatchCandidateReview
from backend.app.auth import get_current_user, require_role
from backend.app.matching.hybrid import compute_hybrid_match
from backend.app.matching.semantic import query_pgvector_candidates, semantic_engine

router = APIRouter(prefix="/matching", tags=["Matching Engine"])

@router.get("/candidates", response_model=List[MatchCandidateResponse])
def get_match_candidates(
    review_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(MatchCandidate).join(LostItem, MatchCandidate.lost_item_id == LostItem.id)

    # Students only see suggestions for their own lost reports
    if current_user.role == "student":
        query = query.filter(LostItem.user_id == current_user.id)
    elif review_status:
        query = query.filter(MatchCandidate.staff_review_status == review_status)

    candidates = query.order_by(MatchCandidate.match_score.desc()).all()
    results = []
    is_staff = current_user.role in ["staff", "admin"]

    for c in candidates:
        lost = c.lost_item
        found = c.found_item
        results.append(MatchCandidateResponse(
            id=c.id,
            lost_item_id=c.lost_item_id,
            found_item_id=c.found_item_id,
            match_score=float(c.match_score),
            semantic_score=float(c.semantic_score or 0.0),
            structured_score=float(c.structured_score or 0.0),
            keyword_score=float(c.keyword_score or 0.0),
            match_reasons=c.match_reasons,
            staff_review_status=c.staff_review_status,
            staff_notes=c.staff_notes,
            reviewed_at=c.reviewed_at,
            created_at=c.created_at,
            lost_item_description=lost.item_description if lost else None,
            found_item_description=found.item_description if found else None,
            lost_owner_name=lost.user.full_name if lost and lost.user and is_staff else None,
            lost_location=lost.approximate_location if lost else None,
            found_location=found.found_location_description if found else None,
            category_name=lost.category.name if lost and lost.category else None,
            storage_location=found.storage_location if found and is_staff else None
        ))
    return results

@router.post("/refresh")
def refresh_all_matches(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    """
    Triggers batch candidate discovery across all open lost reports using pgvector
    cosine similarity retrieval (`<=>`) combined with hybrid multi-signal reranking.
    """
    open_lost = db.query(LostItem).filter(LostItem.status.in_(["open", "matched"])).all()

    new_matches_count = 0
    updated_matches_count = 0

    for lost in open_lost:
        if lost.embedding is None:
            lost.embedding = semantic_engine.encode_item(lost)
            lost.embedding_model = settings.EMBEDDING_MODEL

        pgvec_hits = query_pgvector_candidates(
            db=db,
            query_embedding=list(lost.embedding),
            category_id=lost.category_id,
            limit=20,
        )
        candidate_found = [f for f, _ in pgvec_hits]
        if not candidate_found:
            candidate_found = db.query(FoundItem).filter(
                FoundItem.status.in_(["in_custody", "claim_pending"]),
                FoundItem.category_id == lost.category_id,
            ).all()

        for found in candidate_found:
            score, sem, struct, kw, reasons_json = compute_hybrid_match(lost, found)
            if score >= 45.0: # Candidate inclusion threshold
                existing = db.query(MatchCandidate).filter(
                    MatchCandidate.lost_item_id == lost.id,
                    MatchCandidate.found_item_id == found.id
                ).first()

                if existing:
                    existing.match_score = score
                    existing.semantic_score = sem
                    existing.structured_score = struct
                    existing.keyword_score = kw
                    existing.match_reasons = reasons_json
                    updated_matches_count += 1
                else:
                    mc = MatchCandidate(
                        lost_item_id=lost.id,
                        found_item_id=found.id,
                        match_score=score,
                        semantic_score=sem,
                        structured_score=struct,
                        keyword_score=kw,
                        match_reasons=reasons_json,
                        staff_review_status="unreviewed"
                    )
                    db.add(mc)
                    new_matches_count += 1

    db.commit()
    return {
        "status": "success",
        "message": f"pgvector + Hybrid match evaluation complete. {new_matches_count} new candidates discovered, {updated_matches_count} existing candidate scores refreshed.",
        "note": "Similarity rankings serve strictly as investigative aids for staff, not legal determinations of ownership."
    }


@router.get("/semantic-search")
def semantic_search_found_items(
    q: str = Query(..., min_length=2, description="Natural language query for pgvector semantic search"),
    category_id: Optional[int] = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes a live pgvector `<=>` cosine distance query against persistent
    384-dim `all-MiniLM-L6-v2` embeddings in `found_items`.
    """
    query_vec = semantic_engine.encode(q)
    hits = query_pgvector_candidates(db=db, query_embedding=query_vec, category_id=category_id, limit=limit)
    is_staff = current_user.role in ["staff", "admin"]
    return {
        "query": q,
        "embedding_model": settings.EMBEDDING_MODEL,
        "metric": "cosine_similarity_pgvector",
        "disclaimer": "Candidate retrieval similarity score only. Ownership verification requires staff evidence review.",
        "results": [
            {
                "found_item_id": item.id,
                "category_id": item.category_id,
                "category_name": item.category.name if item.category else None,
                "item_description": item.item_description,
                "brand": item.brand,
                "primary_color": item.primary_color,
                "found_location_description": item.found_location_description,
                "found_date_time": item.found_date_time,
                "status": item.status,
                "storage_location": item.storage_location if is_staff else None,
                "semantic_similarity_pct": sim_pct,
            }
            for item, sim_pct in hits
        ],
    }

@router.put("/{candidate_id}/review", response_model=MatchCandidateResponse)
def review_match_candidate(
    candidate_id: int,
    review_in: MatchCandidateReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    candidate = db.query(MatchCandidate).filter(MatchCandidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate match not found.")

    candidate.staff_review_status = review_in.staff_review_status
    candidate.staff_notes = review_in.staff_notes
    candidate.reviewed_by_staff_id = current_user.id
    candidate.reviewed_at = datetime.now(timezone.utc)

    # If marked relevant, also update lost item status to 'matched' if still open
    if review_in.staff_review_status == "relevant" and candidate.lost_item.status == "open":
        candidate.lost_item.status = "matched"

    db.commit()
    db.refresh(candidate)

    lost = candidate.lost_item
    found = candidate.found_item

    return MatchCandidateResponse(
        id=candidate.id,
        lost_item_id=candidate.lost_item_id,
        found_item_id=candidate.found_item_id,
        match_score=float(candidate.match_score),
        semantic_score=float(candidate.semantic_score or 0.0),
        structured_score=float(candidate.structured_score or 0.0),
        keyword_score=float(candidate.keyword_score or 0.0),
        match_reasons=candidate.match_reasons,
        staff_review_status=candidate.staff_review_status,
        staff_notes=candidate.staff_notes,
        reviewed_at=candidate.reviewed_at,
        created_at=candidate.created_at,
        lost_item_description=lost.item_description if lost else None,
        found_item_description=found.item_description if found else None,
        lost_owner_name=lost.user.full_name if lost and lost.user else None,
        lost_location=lost.approximate_location if lost else None,
        found_location=found.found_location_description if found else None,
        category_name=lost.category.name if lost and lost.category else None,
        storage_location=found.storage_location if found else None
    )

