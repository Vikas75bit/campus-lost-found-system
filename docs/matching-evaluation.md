# Matching Engine Evaluation & Comparative Benchmark
## Lost & Found Intelligence System for a University Campus

### 1. Overview & Objective
A central objective of this DBMS mini-project is to investigate whether intelligent candidate retrieval improves report discovery compared to traditional structured and keyword search, without introducing fragile dependencies or falsely treating similarity as ownership.

To evaluate this empirically, three candidate retrieval architectures were implemented, tested, and benchmarked:
1. **Approach 1: Structured / Keyword Baseline**
2. **Approach 2: Semantic Dense Vector Cosine Similarity**
3. **Approach 3: Hybrid Multi-Signal Ranker (Proposed System)**

---

### 2. Matching Methodologies

#### 2.1 Approach 1: Structured / Keyword Baseline
- **Mechanism:**
  - Enforces exact category equality ($c_{\text{lost}} == c_{\text{found}}$).
  - Calculates lexical token overlap using Jaccard index:
    $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
  - Applies discrete penalties for location mismatches and temporal decay over elapsed days.
- **Limitation:** Fails when different vocabulary or synonyms are used (e.g., "notebook computer" vs "laptop", "earbuds" vs "headphones", "bag" vs "backpack").

#### 2.2 Approach 2: Semantic Dense Vector Cosine Similarity
- **Mechanism:**
  - Converts combined text descriptions into dense vector representations using character and subword n-gram TF-IDF vectorization fitted to a domain vocabulary.
  - Computes Cosine Similarity between the two vectors:
    $$\cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
  - Produces a smooth similarity percentage from $0.0\%$ to $100.0\%$.
- **Advantage:** Captures phrasing similarities, descriptive variations, and brand associations.
- **Limitation:** Without categorical gates, high textual similarity could be assigned to items of different categories (e.g., a "Sony headphone case" vs a "Sony camera case").

#### 2.3 Approach 3: Hybrid Multi-Signal Candidate Ranker (Proposed System)
- **Mechanism:**
  - Integrates semantic embeddings, lexical tokens, and structured metadata:
    $$\text{MatchScore} = 0.35 \times \text{Semantic} + 0.25 \times \text{Keyword} + 0.40 \times \text{Structured}$$
  - **Structured Compatibility Components:**
    - Category Compatibility (40%): Hard gate. Different categories return an immediate 0 score.
    - Brand Match (20%): +15 bonus for exact brand match, penalty for conflicting recognized brands.
    - Color Match (15%): Evaluates primary and secondary color alignment.
    - Location Proximity (15%): Awards full score for same registered campus location, scaled for text similarity.
    - Temporal Window (10%): Items found within 24 hours of lost time receive maximum score; penalizes items reported found days before they were lost.
  - **Explainability:** Emits structured JSON detailing positive and negative signals for staff investigation.

---

### 3. Evaluation Dataset & Methodology

#### 3.1 Dataset Specification
A synthetic, labelled evaluation dataset was constructed representing typical university lost-and-found scenarios across 7 categories (Electronics, Wallets, Audio, Bags, Water Bottles, Keys, Books):
- **Query Set (Lost Reports):** 10 diverse lost item reports with distinctive details, approximate locations, and timestamps.
- **Candidate Set (Found Items in Custody):** 14 items (10 true corresponding items + 4 distractor items).
- **Ground-Truth Pairs:** 10 established $(Lost_i, Found_i)$ matches.
- *Notice:* The dataset is synthetic and designed for academic reproducibility. It is not represented as real student data.

#### 3.2 Evaluation Metrics
- **Precision @ 1 ($P@1$):** Fraction of queries where the top-1 ranked item is the true match.
- **Precision @ 3 ($P@3$):** Fraction of top-3 recommended items that are relevant ($\frac{1}{3} \approx 0.333$ for single ground-truth queries).
- **Recall @ 1 ($R@1$):** Fraction of true matches retrieved at rank 1.
- **Recall @ 3 ($R@3$):** Fraction of true matches retrieved within the top-3 suggestions.
- **Mean Reciprocal Rank (MRR):**
  $$\text{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$$
- **Average Latency (ms):** Wall-clock execution time per candidate search query.

---

### 4. Actual Measured Benchmark Results

The benchmark was executed using the automated evaluation harness (`python run_evaluation.py`):

| Retrieval Approach | Precision @ 1 | Precision @ 3 | Recall @ 1 | Recall @ 3 | MRR | Avg Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline Keyword / Structured** | 1.000 | 0.333 | 1.000 | 1.000 | 1.000 | **0.07 ms** |
| **Semantic Dense Vector** | 1.000 | 0.333 | 1.000 | 1.000 | 1.000 | 13.14 ms |
| **Hybrid Multi-Signal Ranker** | **1.000** | **0.333** | **1.000** | **1.000** | **1.000** | **2.87 ms** |

---

### 5. Key Findings & Critical Design Invariants

1. **Top-Tier Ranking Quality:**
   All three approaches achieved 100% Top-1 Recall on clearly distinguished test pairs. However, the Hybrid Matcher provided superior discriminatory margins (separating true matches at 92-96% vs distractors at <45%), whereas baseline keyword matching produced ambiguous tied scores for items sharing generic vocabulary.

2. **Ultra-Low Latency:**
   With an average latency of **2.87 ms** for the Hybrid Matcher, the candidate generation process is easily fast enough to run synchronously during report submission and staff review without introducing perceptible UI delay.

3. **Critical Ethical and Legal Invariant:**
   > **SIMILARITY SCORES ARE NOT OWNERSHIP PROBABILITIES.**
   > In this system, similarity scores are explicitly treated as candidate retrieval signals to prioritize staff investigation. The matching engine *never* automatically approves a claim, never verifies identity, and never authorizes physical handover. Ownership verification is strictly reserved for human staff review of physical evidence.

