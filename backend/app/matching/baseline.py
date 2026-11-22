import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

def tokenize(text: str) -> set:
    if not text:
        return set()
    tokens = re.findall(r'\b[a-zA-Z0-9]{2,}\b', text.lower())
    stopwords = {'the', 'and', 'with', 'for', 'was', 'this', 'that', 'from', 'near', 'have', 'has', 'left', 'lost', 'found', 'side'}
    return set(tokens) - stopwords

def compute_keyword_similarity(text1: str, text2: str) -> float:
    tokens1 = tokenize(text1)
    tokens2 = tokenize(text2)
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    jaccard = len(intersection) / len(union) if union else 0.0
    # Scaled overlap metric
    overlap_score = min(1.0, (len(intersection) * 2.0) / (len(tokens1) + len(tokens2)))
    return (jaccard * 0.4 + overlap_score * 0.6) * 100.0

def baseline_match(lost_item: Any, found_item: Any) -> Tuple[float, Dict[str, Any]]:
    """
    Standard structured/keyword baseline matching.
    Checks category match, keyword overlap in description/brand/color, location match, and temporal delta.
    """
    reasons = {}
    
    # 1. Category Compatibility
    category_match = (lost_item.category_id == found_item.category_id)
    reasons["category_match"] = 100.0 if category_match else 0.0
    if not category_match:
        # Penalize heavily if categories do not match
        return 0.0, {"category_match": 0.0, "reason": "Category mismatch"}

    # 2. Keyword score
    lost_full_text = f"{lost_item.item_description} {lost_item.brand or ''} {lost_item.primary_color or ''} {lost_item.secondary_color or ''} {lost_item.distinctive_details or ''}"
    found_full_text = f"{found_item.item_description} {found_item.brand or ''} {found_item.primary_color or ''} {found_item.secondary_color or ''} {found_item.distinctive_details or ''}"
    
    keyword_score = compute_keyword_similarity(lost_full_text, found_full_text)
    reasons["keyword_score"] = round(keyword_score, 2)

    # 3. Location matching
    loc_score = 0.0
    if lost_item.location_id and found_item.location_id and (lost_item.location_id == found_item.location_id):
        loc_score = 100.0
        reasons["location"] = "Identical registered campus location"
    else:
        # Text similarity on location description
        loc_sim = compute_keyword_similarity(lost_item.approximate_location or "", found_item.found_location_description or "")
        loc_score = max(20.0, loc_sim)
        reasons["location"] = f"Proximity text similarity: {round(loc_score, 1)}%"
    reasons["location_score"] = round(loc_score, 2)

    # 4. Temporal difference
    # Lost items should usually be reported lost around or before found time
    time_diff_days = abs((found_item.found_date_time - lost_item.lost_date_time).total_seconds()) / 86400.0
    if time_diff_days <= 1.0:
        time_score = 100.0
    elif time_diff_days <= 7.0:
        time_score = max(30.0, 100.0 - (time_diff_days * 10.0))
    else:
        time_score = max(10.0, 50.0 - (time_diff_days * 2.0))
    reasons["time_diff_days"] = round(time_diff_days, 1)
    reasons["time_score"] = round(time_score, 2)

    # Baseline aggregate: Keyword (50%) + Location (30%) + Time (20%)
    total_score = (keyword_score * 0.50) + (loc_score * 0.30) + (time_score * 0.20)
    return round(total_score, 2), reasons

