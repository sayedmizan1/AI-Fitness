"""
RAG pipeline using Google Gemini embeddings + ChromaDB.
"""

import os
from typing import List
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import chromadb
from chromadb.config import Settings as ChromaSettings
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


def get_embedding_function():
    api_key = os.getenv("GOOGLE_API_KEY")
    return GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=api_key,
    )


def get_chroma_client(persist_dir: str = None):
    persist_dir = persist_dir or os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    os.makedirs(persist_dir, exist_ok=True)
    return chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


class FitnessVectorStore:
    """ChromaDB vector store manager for fitness knowledge base."""

    COLLECTIONS = ["exercises", "nutrition", "injuries", "workouts"]

    def __init__(self, persist_dir: str = None):
        self.client = get_chroma_client(persist_dir)
        self.embedder = get_embedding_function()
        self._collections = {}

    def get_collection(self, name: str):
        if name not in self._collections:
            self._collections[name] = self.client.get_or_create_collection(
                name=f"fitmentor_{name}",
                metadata={"hnsw:space": "cosine"},
            )
        return self._collections[name]

    def add_documents(
        self, collection_name: str, texts: List[str], metadatas: List[dict] = None
    ):
        col = self.get_collection(collection_name)
        embeddings = self.embedder.embed_documents(texts)
        ids = [
            f"{collection_name}_{i}_{hash(t) & 0xFFFFFF}" for i, t in enumerate(texts)
        ]
        col.add(
            documents=texts,
            embeddings=embeddings,
            ids=ids,
            metadatas=metadatas or [{}] * len(texts),
        )
        return len(texts)

    def search(self, collection_name: str, query: str, top_k: int = 4) -> List[dict]:
        col = self.get_collection(collection_name)
        count = col.count()
        if count == 0:
            return []
        query_embedding = self.embedder.embed_query(query)
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, count),
            include=["documents", "metadatas", "distances"],
        )
        docs = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            docs.append(
                {
                    "content": doc,
                    "metadata": meta,
                    "relevance": round(1 - dist, 3),
                }
            )
        return docs

    def search_all(self, query: str, top_k: int = 3) -> List[dict]:
        """Search across all collections and merge results."""
        all_results = []
        for col in self.COLLECTIONS:
            results = self.search(col, query, top_k=top_k)
            for r in results:
                r["collection"] = col
                all_results.append(r)
        # Sort by relevance
        all_results.sort(key=lambda x: x["relevance"], reverse=True)
        return all_results[: top_k * 2]
