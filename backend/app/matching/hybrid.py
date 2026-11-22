from typing import Any, Tuple
import json
from backend.app.matching.baseline import compute_keyword_similarity
from backend.app.matching.semantic import compute_semantic_similarity, semantic_engine

def compute_hybrid_match(lost_item: Any, found_item: Any) -> Tuple[float, float, float, float, str]:
    """
    Computes a hybrid match between a lost item report and a found item record.
    Returns:
        (total_match_score, semantic_score, structured_score, keyword_score, match_reasons_json)
    
    IMPORTANT NOTE:
    The similarity score represents retrieval ranking relevance, NEVER proof of ownership.
    """
    reasons = {
        "disclaimer": "Candidate retrieval similarity score only. Ownership verification requires staff evidence review.",
        "signals": []
    }

    # 1. CATEGORY COMPATIBILITY (Hard / High-Weight Gate)
    if lost_item.category_id != found_item.category_id:
        # Heavily penalize category mismatch
        category_score = 0.0
        reasons["signals"].append({"name": "Category Mismatch", "impact": "High Penalty", "value": "Different categories"})
        return 0.0, 0.0, 0.0, 0.0, json.dumps(reasons)
    else:
        category_score = 100.0
        reasons["signals"].append({"name": "Category Compatibility", "impact": "Positive", "value": "Exact category match"})

    # 2. BRAND & COLOR MATCHING
    brand_score = 50.0 # Neutral baseline
    if lost_item.brand and found_item.brand:
        if lost_item.brand.strip().lower() == found_item.brand.strip().lower():
            brand_score = 100.0
            reasons["signals"].append({"name": "Brand Match", "impact": "Positive", "value": f"Exact brand: {lost_item.brand}"})
        else:
            brand_score = 10.0
            reasons["signals"].append({"name": "Brand Divergence", "impact": "Negative", "value": f"{lost_item.brand} vs {found_item.brand}"})
    
    color_score = 50.0
    if lost_item.primary_color and found_item.primary_color:
        if lost_item.primary_color.strip().lower() == found_item.primary_color.strip().lower():
            color_score = 100.0
            reasons["signals"].append({"name": "Color Match", "impact": "Positive", "value": f"Primary color: {lost_item.primary_color}"})
        else:
            color_score = 30.0

    # 3. LOCATION PROXIMITY
    loc_score = 40.0
    if lost_item.location_id and found_item.location_id and (lost_item.location_id == found_item.location_id):
        loc_score = 100.0
        reasons["signals"].append({"name": "Location Exact Match", "impact": "Positive", "value": "Same registered campus location"})
    else:
        loc_text_sim = compute_keyword_similarity(lost_item.approximate_location or "", found_item.found_location_description or "")
        loc_score = max(30.0, loc_text_sim)
        reasons["signals"].append({"name": "Location Proximity", "impact": "Informational", "value": f"Proximity estimate: {round(loc_score, 1)}%"})

    # 4. TEMPORAL PROXIMITY
    # Found date should be close to or after lost date
    time_diff_hours = (found_item.found_date_time - lost_item.lost_date_time).total_seconds() / 3600.0
    if -12.0 <= time_diff_hours <= 24.0:
        time_score = 100.0
        reasons["signals"].append({"name": "Temporal Window", "impact": "Positive", "value": f"Found within {round(abs(time_diff_hours), 1)} hours of report"})
    elif 24.0 < time_diff_hours <= 168.0: # within 1 week
        time_score = max(50.0, 100.0 - (time_diff_hours / 168.0) * 50.0)
        reasons["signals"].append({"name": "Temporal Window", "impact": "Informational", "value": f"Found {round(time_diff_hours / 24.0, 1)} days after report"})
    elif time_diff_hours < -48.0:
        # Item recorded found more than 2 days BEFORE it was allegedly lost
        time_score = 20.0
        reasons["signals"].append({"name": "Temporal Inconsistency", "impact": "Negative", "value": "Found date preceded reported lost date by >48 hours"})
    else:
        time_score = 30.0

    # Structured Aggregate: Category (40%) + Brand (20%) + Color (15%) + Location (15%) + Time (10%)
    structured_score = (
        (category_score * 0.40) +
        (brand_score * 0.20) +
        (color_score * 0.15) +
        (loc_score * 0.15) +
        (time_score * 0.10)
    )

    # 5. KEYWORD SCORE (Lexical overlap across all fields)
    lost_full_text = f"{lost_item.item_description} {lost_item.brand or ''} {lost_item.distinctive_details or ''} {lost_item.approximate_location}"
    found_full_text = f"{found_item.item_description} {found_item.brand or ''} {found_item.distinctive_details or ''} {found_item.found_location_description}"
    keyword_score = compute_keyword_similarity(lost_full_text, found_full_text)
    reasons["signals"].append({"name": "Lexical Overlap", "impact": "Informational", "value": f"{round(keyword_score, 1)}% token match"})

    # 6. SEMANTIC SCORE (Persistent pgvector 384-dim Dense Cosine Similarity)
    lost_vec = getattr(lost_item, "embedding", None)
    found_vec = getattr(found_item, "embedding", None)
    if lost_vec is not None and found_vec is not None:
        semantic_score = semantic_engine.similarity_from_vectors(lost_vec, found_vec)
    else:
        semantic_score = compute_semantic_similarity(lost_full_text, found_full_text)
    reasons["signals"].append({"name": "pgvector Cosine Similarity", "impact": "Informational", "value": f"{round(semantic_score, 1)}% dense vector match"})

    # 7. FINAL HYBRID BLEND
    # Semantic (35%) + Keyword (25%) + Structured (40%)
    total_match_score = (
        (semantic_score * 0.35) +
        (keyword_score * 0.25) +
        (structured_score * 0.40)
    )

    # Round all values for clean presentation
    total_match_score = round(float(total_match_score), 2)
    semantic_score = round(float(semantic_score), 2)
    structured_score = round(float(structured_score), 2)
    keyword_score = round(float(keyword_score), 2)

    return total_match_score, semantic_score, structured_score, keyword_score, json.dumps(reasons)

