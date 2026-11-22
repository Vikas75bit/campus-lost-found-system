from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from backend.app.config import settings


class SentenceEmbeddingEngine:
    """
    Persistent Dense Vector Embedding Engine using SentenceTransformers
    (`sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions, L2-normalized).
    Embeddings are stored in PostgreSQL `vector(384)` columns via pgvector
    and queried using the `<=>` cosine distance operator.
    """

    def __init__(self, model_name: str = settings.EMBEDDING_MODEL):
        self.model_name = model_name
        self._model: Optional[SentenceTransformer] = None

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    @staticmethod
    def build_item_text(
        item_description: str,
        brand: Optional[str] = None,
        primary_color: Optional[str] = None,
        secondary_color: Optional[str] = None,
        distinctive_details: Optional[str] = None,
        location_text: Optional[str] = None,
    ) -> str:
        parts = [item_description or ""]
        if brand:
            parts.append(f"Brand: {brand}")
        colors = [c for c in (primary_color, secondary_color) if c]
        if colors:
            parts.append(f"Color: {' '.join(colors)}")
        if distinctive_details:
            parts.append(f"Details: {distinctive_details}")
        if location_text:
            parts.append(f"Location: {location_text}")
        return ". ".join(p.strip() for p in parts if p and p.strip())

    def encode(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * settings.EMBEDDING_DIM
        vec = self.model.encode(text.strip(), normalize_embeddings=True)
        return [float(x) for x in vec.tolist()]

    def encode_item(self, item: object) -> List[float]:
        loc_text = getattr(item, "approximate_location", None) or getattr(item, "found_location_description", None)
        text = self.build_item_text(
            item_description=getattr(item, "item_description", ""),
            brand=getattr(item, "brand", None),
            primary_color=getattr(item, "primary_color", None),
            secondary_color=getattr(item, "secondary_color", None),
            distinctive_details=getattr(item, "distinctive_details", None),
            location_text=loc_text,
        )
        return self.encode(text)

    def similarity_from_vectors(self, v1: Optional[List[float]], v2: Optional[List[float]]) -> float:
        if v1 is None or v2 is None:
            return 0.0
        a = np.asarray(v1, dtype=np.float32)
        b = np.asarray(v2, dtype=np.float32)
        na = np.linalg.norm(a)
        nb = np.linalg.norm(b)
        if na == 0.0 or nb == 0.0:
            return 0.0
        cos = float(np.dot(a, b) / (na * nb))
        return float(np.clip(cos * 100.0, 0.0, 100.0))

    def similarity(self, text1: str, text2: str) -> float:
        if not text1 or not text2:
            return 0.0
        vecs = self.model.encode([text1.strip(), text2.strip()], normalize_embeddings=True)
        cos = float(np.dot(vecs[0], vecs[1]))
        return float(np.clip(cos * 100.0, 0.0, 100.0))


semantic_engine = SentenceEmbeddingEngine()


def compute_semantic_similarity(text1: str, text2: str) -> float:
    return semantic_engine.similarity(text1, text2)


def query_pgvector_candidates(
    db: Session,
    query_embedding: List[float],
    category_id: Optional[int] = None,
    limit: int = 20,
):
    """
    Retrieves candidate FoundItems from PostgreSQL using pgvector's `<=>`
    cosine distance operator with metadata filtering (`status`, `category_id`).
    Returns list of (FoundItem, similarity_percentage).
    """
    from backend.app.models import FoundItem

    distance_expr = FoundItem.embedding.cosine_distance(query_embedding)
    q = db.query(FoundItem, (1.0 - distance_expr).label("cosine_sim")).filter(
        FoundItem.status.in_(["in_custody", "claim_pending"]),
        FoundItem.embedding.isnot(None),
    )
    if category_id is not None:
        q = q.filter(FoundItem.category_id == category_id)

    rows = q.order_by(distance_expr.asc()).limit(limit).all()
    return [
        (found_item, round(float(np.clip((sim or 0.0) * 100.0, 0.0, 100.0)), 2))
        for found_item, sim in rows
    ]
