import os

import chromadb
from chromadb.utils import embedding_functions

CHROMA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

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
