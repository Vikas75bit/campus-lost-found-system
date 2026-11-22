from fastapi import APIRouter, Depends
from backend.app.matching.evaluator import evaluate_models
from backend.app.auth import get_current_user

router = APIRouter(prefix="/evaluation", tags=["System Evaluation"])

@router.get("/benchmark")
def get_evaluation_benchmark(current_user = Depends(get_current_user)):
    """
    Executes real-time quantitative evaluation of:
    1. Baseline Keyword/Structured Filtering
    2. Semantic Dense Vector Cosine Similarity
    3. Hybrid Multi-Signal Candidate Ranking
    Returns measured Precision@K, Recall@K, MRR, and Latencies.
    """
    results = evaluate_models()
    return results

