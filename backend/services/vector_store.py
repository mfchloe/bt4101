import chromadb
from chromadb.utils import embedding_functions

from config import CHROMA_DIR

client = chromadb.PersistentClient(path=CHROMA_DIR)
# Uses Chroma's built-in local embedding model (downloaded once on first use).
embed_fn = embedding_functions.DefaultEmbeddingFunction()  # all-MiniLM-L6-v2
collection = client.get_or_create_collection("library", embedding_function=embed_fn)



def add_chunks(file_id, chunks, doc_type, sbb, theme, format):
    collection.add(
        ids=[f"{file_id}-{i}" for i in range(len(chunks))],
        documents=chunks,
        metadatas=[
            {
                "file_id": file_id,
                "doc_type": doc_type,
                "sbb": sbb,
                "theme": theme,
                "format": format,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ],
    )


def delete_chunks(file_id):
    collection.delete(where={"file_id": file_id})


def query(text, where, n):
    """Return up to n chunks matching the metadata filter, most similar first."""
    if collection.count() == 0:
        return []
    res = collection.query(query_texts=[text], n_results=n, where=where)
    return [
        {"id": chunk_id, "text": doc, "metadata": meta, "distance": dist}
        for chunk_id, doc, meta, dist in zip(
            res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0]
        )
    ]
