import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from backend.app.matching.baseline import baseline_match
from backend.app.matching.hybrid import compute_hybrid_match
from backend.app.matching.semantic import semantic_engine


class MockEntity:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


now = datetime.now(timezone.utc)

# Challenging labelled evaluation dataset (15 Lost queries vs 20 Found items)
# Includes: paraphrased descriptions, missing distinctive details, misleading brand/color
# distractors, different location phrasings, and temporal offsets.
EVAL_LOST_ITEMS: List[MockEntity] = [
    MockEntity(id=1, category_id=1, item_description="Dell XPS 15 laptop silver grey with carbon fiber deck", brand="Dell", primary_color="Grey", secondary_color="Black", approximate_location="Library 2nd floor", location_id=1, lost_date_time=now - timedelta(days=2), distinctive_details="GitHub sticker on top lid"),
    MockEntity(id=2, category_id=3, item_description="Fossil brown leather bifold wallet with student ID card", brand="Fossil", primary_color="Brown", secondary_color="Tan", approximate_location="Cafeteria cashier table", location_id=3, lost_date_time=now - timedelta(days=1), distinctive_details="Student ID card Alex Rivera inside"),
    MockEntity(id=3, category_id=1, item_description="Sony WH-1000XM4 black over ear wireless headphones", brand="Sony", primary_color="Black", secondary_color="Silver", approximate_location="CS Lab 304 desk 18", location_id=2, lost_date_time=now - timedelta(hours=18), distinctive_details="Silver tape on left hinge"),
    MockEntity(id=4, category_id=2, item_description="The North Face blue Borealis backpack with laptop compartment", brand="The North Face", primary_color="Blue", secondary_color="Black", approximate_location="Lecture Hall 101 front row", location_id=5, lost_date_time=now - timedelta(days=3), distinctive_details="Green carabiner and NASA pin"),
    MockEntity(id=5, category_id=7, item_description="Hydro Flask 32oz stainless steel water bottle yellow lemon color", brand="Hydro Flask", primary_color="Yellow", secondary_color="Black", approximate_location="Gym locker room", location_id=4, lost_date_time=now - timedelta(days=1), distinctive_details="Dent on bottom rim"),
    MockEntity(id=6, category_id=4, item_description="Set of three brass keys on university red fabric lanyard", brand="University", primary_color="Red", secondary_color="Gold", approximate_location="Hostel Block A lounge", location_id=6, lost_date_time=now - timedelta(days=2), distinctive_details="Dorm room 214 marked on tag"),
    MockEntity(id=7, category_id=5, item_description="Database Management Systems Ramakrishnan 3rd edition textbook", brand=None, primary_color="Blue", secondary_color="White", approximate_location="Library reading hall", location_id=1, lost_date_time=now - timedelta(days=4), distinctive_details="Highlighted yellow chapters 4 and 5"),
    MockEntity(id=8, category_id=1, item_description="Apple iPad Air 5th gen space grey with white Apple Pencil", brand="Apple", primary_color="Grey", secondary_color="White", approximate_location="Student Centre study cubicle", location_id=3, lost_date_time=now - timedelta(hours=12), distinctive_details="Pencil has silicone grip"),
    MockEntity(id=9, category_id=6, item_description="Patagonia black fleece zip-up jacket size medium", brand="Patagonia", primary_color="Black", secondary_color=None, approximate_location="Cafeteria booth", location_id=3, lost_date_time=now - timedelta(days=2), distinctive_details="Lip balm in left breast pocket"),
    MockEntity(id=10, category_id=1, item_description="Casio fx-991EX ClassWiz scientific calculator black and white", brand="Casio", primary_color="Black", secondary_color="White", approximate_location="Engineering Exam Hall 2", location_id=5, lost_date_time=now - timedelta(days=3), distinctive_details="Name sticker on back cover"),
    # Difficult cases: paraphrased / missing details / misleading brand-color distractors
    MockEntity(id=11, category_id=1, item_description="Portable aluminum notebook computer with USB-C power brick", brand=None, primary_color="Silver", secondary_color=None, approximate_location="Reading room near windows", location_id=1, lost_date_time=now - timedelta(days=1), distinctive_details=None),
    MockEntity(id=12, category_id=1, item_description="Wireless charging case for Apple earbuds white plastic", brand="Apple", primary_color="White", secondary_color=None, approximate_location="Cafeteria outdoor patio", location_id=3, lost_date_time=now - timedelta(hours=20), distinctive_details=None),
    MockEntity(id=13, category_id=6, item_description="Dark prescription spectacles in hard clamshell box", brand=None, primary_color="Black", secondary_color=None, approximate_location="Turing building 3rd floor", location_id=2, lost_date_time=now - timedelta(days=2), distinctive_details=None),
    MockEntity(id=14, category_id=7, item_description="Insulated metallic coffee flask silver", brand="Contigo", primary_color="Silver", secondary_color="Black", approximate_location="Main auditorium", location_id=5, lost_date_time=now - timedelta(days=2), distinctive_details="Scratch near lid"),
    MockEntity(id=15, category_id=2, item_description="Black canvas rucksack with USB charging port on side", brand=None, primary_color="Black", secondary_color=None, approximate_location="Sports complex bleachers", location_id=4, lost_date_time=now - timedelta(days=3), distinctive_details=None),
]

EVAL_FOUND_ITEMS: List[MockEntity] = [
    MockEntity(id=101, category_id=1, item_description="Silver Dell laptop left plugged into wall charger", brand="Dell", primary_color="Grey", secondary_color="Black", found_location_description="Library study desk", location_id=1, found_date_time=now - timedelta(days=2) + timedelta(hours=2), distinctive_details="Developer sticker on lid"),
    MockEntity(id=102, category_id=3, item_description="Brown men wallet containing student identity card and cash", brand="Fossil", primary_color="Brown", secondary_color="Tan", found_location_description="Cafeteria table near drink machine", location_id=3, found_date_time=now - timedelta(days=1) + timedelta(hours=1), distinctive_details="Student ID card clearly visible"),
    MockEntity(id=103, category_id=1, item_description="Black Sony noise cancelling headphones in black travel case", brand="Sony", primary_color="Black", secondary_color="Silver", found_location_description="CS Lab 304 outside corridor bench", location_id=2, found_date_time=now - timedelta(hours=16), distinctive_details="Marking on hinge"),
    MockEntity(id=104, category_id=2, item_description="Blue backpack containing notebooks and pencil case", brand="The North Face", primary_color="Blue", secondary_color="Black", found_location_description="Lecture Hall 101 stage area", location_id=5, found_date_time=now - timedelta(days=3) + timedelta(hours=3), distinctive_details="Attached carabiner clip"),
    MockEntity(id=105, category_id=7, item_description="Yellow insulated metal thermos bottle", brand="Hydro Flask", primary_color="Yellow", secondary_color="Black", found_location_description="Recreation gym bleachers", location_id=4, found_date_time=now - timedelta(days=1) + timedelta(hours=4), distinctive_details="Dented base"),
    MockEntity(id=106, category_id=4, item_description="Red lanyard with three brass keys and keychain", brand="University", primary_color="Red", secondary_color="Gold", found_location_description="Residence A common room couch", location_id=6, found_date_time=now - timedelta(days=2) + timedelta(hours=1), distinctive_details="Key tag with room number"),
    MockEntity(id=107, category_id=5, item_description="Hardcover university DBMS textbook Ramakrishnan", brand=None, primary_color="Blue", secondary_color="White", found_location_description="Library 1st floor return bin", location_id=1, found_date_time=now - timedelta(days=4) + timedelta(hours=5), distinctive_details="Yellow marker annotations"),
    MockEntity(id=108, category_id=1, item_description="Grey tablet computer with attached stylus pen", brand="Apple", primary_color="Grey", secondary_color="White", found_location_description="Student centre coffee lounge", location_id=3, found_date_time=now - timedelta(hours=10), distinctive_details="White stylus pen in case"),
    MockEntity(id=109, category_id=6, item_description="Black outdoor zip jacket", brand="Patagonia", primary_color="Black", secondary_color=None, found_location_description="Cafeteria coat rack", location_id=3, found_date_time=now - timedelta(days=2) + timedelta(hours=4), distinctive_details="Small item in pocket"),
    MockEntity(id=110, category_id=1, item_description="Black scientific calculator Casio", brand="Casio", primary_color="Black", secondary_color="White", found_location_description="Lecture hall 101 seat 34", location_id=5, found_date_time=now - timedelta(days=3) + timedelta(hours=2), distinctive_details="Sticker residue on back"),
    # Difficult ground-truth matches (paraphrased, missing brand, different phrasing)
    MockEntity(id=111, category_id=1, item_description="Silver MacBook Air laptop with type-c adapter", brand="Apple", primary_color="Silver", secondary_color=None, found_location_description="Main Library quiet study area", location_id=1, found_date_time=now - timedelta(days=1) + timedelta(hours=3), distinctive_details=None),
    MockEntity(id=112, category_id=1, item_description="Small white AirPods Pro charging pod without earpieces", brand="Apple", primary_color="White", secondary_color=None, found_location_description="Student Activity Centre courtyard", location_id=3, found_date_time=now - timedelta(hours=18), distinctive_details=None),
    MockEntity(id=113, category_id=6, item_description="Black-rimmed eyeglasses inside protective hard case", brand=None, primary_color="Black", secondary_color=None, found_location_description="CS Lab 304 podium", location_id=2, found_date_time=now - timedelta(days=2) + timedelta(hours=5), distinctive_details=None),
    MockEntity(id=114, category_id=7, item_description="Brushed steel travel mug with black push-button cap", brand="Contigo", primary_color="Silver", secondary_color="Black", found_location_description="Lecture Hall Complex 101 back row", location_id=5, found_date_time=now - timedelta(days=2) + timedelta(hours=2), distinctive_details="Scuffed rim"),
    MockEntity(id=115, category_id=2, item_description="Black fabric backpack featuring external USB cable slot", brand=None, primary_color="Black", secondary_color=None, found_location_description="Sports Pavilion Gym seating", location_id=4, found_date_time=now - timedelta(days=3) + timedelta(hours=6), distinctive_details=None),
    # Misleading distractors (same brand/color/category as lost items)
    MockEntity(id=116, category_id=1, item_description="Lenovo ThinkPad black laptop with red trackpoint", brand="Lenovo", primary_color="Black", secondary_color="Red", found_location_description="Library 3rd floor", location_id=1, found_date_time=now - timedelta(days=5), distinctive_details=None),
    MockEntity(id=117, category_id=2, item_description="Black Nike gym duffel bag with athletic shoes", brand="Nike", primary_color="Black", secondary_color="White", found_location_description="Gym changing room", location_id=4, found_date_time=now - timedelta(days=2), distinctive_details=None),
    MockEntity(id=118, category_id=6, item_description="Prescription reading glasses in brown leather pouch", brand="RayBan", primary_color="Brown", secondary_color="Clear", found_location_description="Cafeteria table 12", location_id=3, found_date_time=now - timedelta(days=1), distinctive_details=None),
    MockEntity(id=119, category_id=7, item_description="Silver Starbucks travel coffee tumbler", brand="Starbucks", primary_color="Silver", secondary_color="Green", found_location_description="CS Lab 202", location_id=2, found_date_time=now - timedelta(days=3), distinctive_details=None),
    MockEntity(id=120, category_id=1, item_description="White Apple USB-C 20W wall adapter plug", brand="Apple", primary_color="White", secondary_color=None, found_location_description="Cafeteria bench", location_id=3, found_date_time=now - timedelta(hours=19), distinctive_details=None),
]

GROUND_TRUTH_MAPPINGS = {
    1: 101, 2: 102, 3: 103, 4: 104, 5: 105,
    6: 106, 7: 107, 8: 108, 9: 109, 10: 110,
    11: 111, 12: 112, 13: 113, 14: 114, 15: 115,
}


def evaluate_models() -> Dict[str, Any]:
    """
    Evaluates Baseline Keyword/Structured Search, Dense Sentence-Transformer
    Semantic Retrieval (all-MiniLM-L6-v2), and Hybrid Multi-Signal Matching
    on the same 15-query x 20-candidate labelled dataset.
    """
    approaches = [
        "Baseline Keyword/Structured",
        "Semantic Dense Vector (all-MiniLM-L6-v2)",
        "Hybrid Multi-Signal (pgvector + Structured)",
    ]
    results: Dict[str, Any] = {
        "dataset_size": {
            "lost_items": len(EVAL_LOST_ITEMS),
            "found_items": len(EVAL_FOUND_ITEMS),
            "ground_truth_pairs": len(GROUND_TRUTH_MAPPINGS),
        },
        "metrics": {},
    }

    # Pre-compute 384-dim embeddings once to mirror pgvector persistent storage
    lost_vecs = {item.id: semantic_engine.encode_item(item) for item in EVAL_LOST_ITEMS}
    found_vecs = {item.id: semantic_engine.encode_item(item) for item in EVAL_FOUND_ITEMS}
    for item in EVAL_LOST_ITEMS:
        item.embedding = lost_vecs[item.id]
    for item in EVAL_FOUND_ITEMS:
        item.embedding = found_vecs[item.id]

    for approach in approaches:
        p_at_1, p_at_3, r_at_1, r_at_3, reciprocal_ranks, latencies = [], [], [], [], [], []

        for lost in EVAL_LOST_ITEMS:
            true_found_id = GROUND_TRUTH_MAPPINGS[lost.id]
            candidates = []

            start_t = time.perf_counter()
            for found in EVAL_FOUND_ITEMS:
                if approach == "Baseline Keyword/Structured":
                    score, _ = baseline_match(lost, found)
                elif approach == "Semantic Dense Vector (all-MiniLM-L6-v2)":
                    score = semantic_engine.similarity_from_vectors(lost.embedding, found.embedding)
                else:
                    score, _, _, _, _ = compute_hybrid_match(lost, found)
                candidates.append((found.id, score))

            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            latencies.append(elapsed_ms)

            candidates.sort(key=lambda x: x[1], reverse=True)
            ranked_ids = [c[0] for c in candidates]

            top_1 = ranked_ids[:1]
            top_3 = ranked_ids[:3]

            p_at_1.append(1.0 if true_found_id in top_1 else 0.0)
            p_at_3.append((1.0 / 3.0) if true_found_id in top_3 else 0.0)
            r_at_1.append(1.0 if true_found_id in top_1 else 0.0)
            r_at_3.append(1.0 if true_found_id in top_3 else 0.0)

            if true_found_id in ranked_ids:
                reciprocal_ranks.append(1.0 / (ranked_ids.index(true_found_id) + 1))
            else:
                reciprocal_ranks.append(0.0)

        results["metrics"][approach] = {
            "Precision@1": round(sum(p_at_1) / len(p_at_1), 3),
            "Precision@3": round(sum(p_at_3) / len(p_at_3), 3),
            "Recall@1": round(sum(r_at_1) / len(r_at_1), 3),
            "Recall@3": round(sum(r_at_3) / len(r_at_3), 3),
            "MRR": round(sum(reciprocal_ranks) / len(reciprocal_ranks), 3),
            "Avg_Latency_ms": round(sum(latencies) / len(latencies), 3),
        }

    return results
