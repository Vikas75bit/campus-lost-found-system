import json
import pprint
from backend.app.matching.evaluator import evaluate_models

def main():
    print("==========================================================================")
    print(" UNIVERSITY LOST & FOUND INTELLIGENCE SYSTEM")
    print(" QUANTITATIVE MATCHING EVALUATION BENCHMARK")
    print("==========================================================================")
    print("Running evaluation across:")
    print(" 1. Baseline Keyword / Structured Attribute Matcher")
    print(" 2. Semantic Dense Vector Embedding Matcher (Cosine Similarity)")
    print(" 3. Hybrid Multi-Signal Candidate Matcher (Semantic + Keyword + Structured)")
    print("--------------------------------------------------------------------------")
    
    results = evaluate_models()
    
    metrics = results["metrics"]
    dataset = results["dataset_size"]
    print(f"Dataset Size: {dataset['lost_items']} Lost Reports, {dataset['found_items']} Found Items in Custody, {dataset['ground_truth_pairs']} Ground Truth Pairs.\n")

    header = f"{'Approach':<32} | {'P@1':<6} | {'P@3':<6} | {'R@1':<6} | {'R@3':<6} | {'MRR':<6} | {'Avg Latency (ms)':<16}"
    print(header)
    print("-" * len(header))

    for name, m in metrics.items():
        print(f"{name:<32} | {m['Precision@1']:<6.3f} | {m['Precision@3']:<6.3f} | {m['Recall@1']:<6.3f} | {m['Recall@3']:<6.3f} | {m['MRR']:<6.3f} | {m['Avg_Latency_ms']:<16.2f}")

    print("==========================================================================")
    print("Key Insights:")
    print(" - Semantic dense vectors (all-MiniLM-L6-v2) capture paraphrases missed by exact keywords.")
    print(" - Hybrid matching combines pgvector cosine similarity with structured metadata filters.")
    print(" - Similarity rankings assist staff investigation and NEVER replace human verification.")
    print("==========================================================================")

if __name__ == "__main__":
    main()

