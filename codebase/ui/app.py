from __future__ import annotations

import os
import re
import hashlib
from dataclasses import dataclass
from pathlib import Path

import streamlit as st

# Optional imports are allowed to fail so the app can still run in demo mode.
try:
    from google import genai
except Exception:  # pragma: no cover - handled in UI
    genai = None

# VectorDB mode needs these packages. If they are missing, keyword retrieval is used.
try:
    import chromadb
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover - handled in UI
    chromadb = None
    SentenceTransformer = None


APP_DIR = Path(__file__).parent
DATA_DIR = APP_DIR / "data"
DEFAULT_MODEL = "gemini-3.1-flash-lite"
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

QUICK_QUESTIONS = [
    "Buffet sáng mở cửa mấy giờ?",
    "Hồ bơi có giờ hoạt động thế nào?",
    "Có shuttle ra sân bay không?",
    "Gym nằm ở đâu và mở đến mấy giờ?",
    "Spa có cần đặt lịch trước không?",
]


@dataclass
class Chunk:
    # One searchable piece of Markdown content.
    source: str
    heading: str
    text: str


@dataclass
class VectorIndex:
    # In-memory Chroma collection plus the original chunks it points back to.
    collection: object
    chunks: list[Chunk]
    model_name: str


def normalize(text: str) -> str:
    # Lowercase and collapse whitespace so keyword matching is more stable.
    return re.sub(r"\s+", " ", text.lower()).strip()


def tokenize(text: str) -> set[str]:
    return set(re.findall(r"[\wÀ-ỹ]+", normalize(text), flags=re.UNICODE))


def split_markdown(path: Path, content: str) -> list[Chunk]:
    # Split each Markdown file into chunks by headings.
    # Example: "## Spa" becomes one retrievable chunk.
    chunks: list[Chunk] = []
    current_heading = path.stem
    current_lines: list[str] = []

    def flush() -> None:
        body = "\n".join(current_lines).strip()
        if body:
            chunks.append(Chunk(source=path.name, heading=current_heading, text=body))

    for line in content.splitlines():
        if line.startswith("#"):
            flush()
            current_heading = line.lstrip("#").strip() or path.stem
            current_lines = []
        else:
            current_lines.append(line)
    flush()
    return chunks


@st.cache_data(show_spinner=False)
def load_chunks(data_dir: str) -> list[Chunk]:
    # Read every .md file in data/. Streamlit caches the result until reload.
    root = Path(data_dir)
    root.mkdir(exist_ok=True)
    chunks: list[Chunk] = []
    for path in sorted(root.glob("*.md")):
        chunks.extend(split_markdown(path, path.read_text(encoding="utf-8")))
    return chunks


def retrieve(question: str, chunks: list[Chunk], limit: int = 4) -> list[tuple[Chunk, float]]:
    # Lightweight retrieval: score chunks by shared words with the user question.
    # This is fast and works well for direct questions like "buffet mo may gio".
    query_terms = tokenize(question)
    scored: list[tuple[Chunk, float]] = []
    for chunk in chunks:
        haystack = tokenize(f"{chunk.heading} {chunk.text}")
        overlap = len(query_terms & haystack)
        heading_bonus = 1.5 if query_terms & tokenize(chunk.heading) else 0
        score = overlap + heading_bonus
        if score > 0:
            scored.append((chunk, score))
    return sorted(scored, key=lambda item: item[1], reverse=True)[:limit]


def chunk_id(chunk: Chunk, position: int) -> str:
    raw = f"{position}|{chunk.source}|{chunk.heading}|{chunk.text}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


@st.cache_resource(show_spinner=False)
def load_embedding_model(model_name: str):
    # Load the Hugging Face sentence-transformers model once per app process.
    if SentenceTransformer is None:
        raise RuntimeError(
            "Chua cai sentence-transformers. Hay chay `pip install -r requirements.txt`."
        )
    return SentenceTransformer(model_name)


@st.cache_resource(show_spinner=False)
def build_vector_index(chunks_key: str, chunks: tuple[Chunk, ...], model_name: str) -> VectorIndex:
    # Build an in-memory ChromaDB collection from Markdown chunks.
    # chunks_key changes when data changes, forcing Streamlit to rebuild the index.
    if chromadb is None:
        raise RuntimeError("Chua cai chromadb. Hay chay `pip install -r requirements.txt`.")

    embedding_model = load_embedding_model(model_name)
    client = chromadb.Client()
    collection = client.create_collection(
        name=f"travel_amenities_{chunks_key[:12]}",
        metadata={"hnsw:space": "cosine"},
    )

    documents = [f"{chunk.heading}\n{chunk.text}" for chunk in chunks]
    embeddings = embedding_model.encode(documents, normalize_embeddings=True).tolist()
    metadatas = [
        {"source": chunk.source, "heading": chunk.heading, "position": idx}
        for idx, chunk in enumerate(chunks)
    ]
    ids = [chunk_id(chunk, idx) for idx, chunk in enumerate(chunks)]

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    return VectorIndex(collection=collection, chunks=list(chunks), model_name=model_name)


def chunks_cache_key(chunks: list[Chunk]) -> str:
    # Stable hash of all chunk content; used as the VectorDB cache key.
    raw = "\n".join(f"{chunk.source}|{chunk.heading}|{chunk.text}" for chunk in chunks)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def retrieve_vector(
    question: str,
    chunks: list[Chunk],
    embedding_model_name: str,
    limit: int = 4,
) -> list[tuple[Chunk, float]]:
    # Semantic retrieval: embed the question, search ChromaDB, then map results
    # back to the original Markdown chunks for Gemini context.
    index = build_vector_index(chunks_cache_key(chunks), tuple(chunks), embedding_model_name)
    embedding_model = load_embedding_model(embedding_model_name)
    query_embedding = embedding_model.encode([question], normalize_embeddings=True).tolist()[0]
    result = index.collection.query(
        query_embeddings=[query_embedding],
        n_results=min(limit, len(chunks)),
        include=["metadatas", "distances"],
    )

    contexts: list[tuple[Chunk, float]] = []
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    for metadata, distance in zip(metadatas, distances):
        position = int(metadata["position"])
        similarity = 1 - float(distance)
        contexts.append((chunks[position], similarity))
    return contexts


def retrieve_contexts(
    question: str,
    chunks: list[Chunk],
    method: str,
    embedding_model_name: str,
    limit: int = 4,
) -> tuple[list[tuple[Chunk, float]], str]:
    # One switch for retrieval strategy. VectorDB falls back to keyword if setup fails.
    if method == "VectorDB (Hugging Face)":
        try:
            return retrieve_vector(question, chunks, embedding_model_name, limit), "VectorDB"
        except Exception as exc:
            st.warning(f"VectorDB chua san sang, dang fallback sang keyword. Ly do: {exc}")
    return retrieve(question, chunks, limit), "Keyword"


def build_prompt(question: str, contexts: list[tuple[Chunk, float]]) -> str:
    # Prompt pattern: Gemini must answer only from retrieved Markdown context.
    context_text = "\n\n".join(
        f"[{idx}] Nguon: {chunk.source} | Muc: {chunk.heading}\n{chunk.text}"
        for idx, (chunk, _) in enumerate(contexts, start=1)
    )
    return f"""
Ban la tro ly du lich than thien cua mot resort. Chi tra loi dua tren CONTEXT.
Neu CONTEXT khong du thong tin, noi ro rang ban chua co du lieu va goi y khach hoi le tan.
Tra loi bang tieng Viet, ngan gon, uu tien gio mo cua/dia diem/luu y quan trong.
Cuoi cau tra loi them dong "Nguon:" voi ten muc Markdown da dung.

CONTEXT:
{context_text}

CAU HOI:
{question}
""".strip()


def ask_gemini(question: str, contexts: list[tuple[Chunk, float]]) -> str:
    # If GEMINI_API_KEY is missing, return a RAG-only draft so the demo still works.
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

    if not api_key:
        return (
            "Chua co GEMINI_API_KEY, nen minh dang hien cau tra loi demo tu RAG.\n\n"
            + draft_from_context(contexts)
        )
    if genai is None:
        return "Chua cai duoc package google-genai. Hay chay `pip install -r requirements.txt`."

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=build_prompt(question, contexts),
    )
    return response.text or "Minh chua tao duoc cau tra loi. Ban thu hoi lai ngan gon hon nhe."


def draft_from_context(contexts: list[tuple[Chunk, float]]) -> str:
    # Offline fallback: show the best retrieved Markdown chunk without calling LLM.
    if not contexts:
        return "Minh chua tim thay thong tin phu hop trong data Markdown. Ban co the bo sung them file trong thu muc data/."
    chunk = contexts[0][0]
    compact = re.sub(r"\n+", "\n", chunk.text).strip()
    return f"{compact}\n\nNguon: {chunk.source} - {chunk.heading}"


st.set_page_config(
    page_title="Travel Amenities Chatbot",
    page_icon=":airplane:",
    layout="centered",
)

# Small CSS layer for a brighter travel-friendly Streamlit UI.
st.markdown(
    """
    <style>
    .stApp {
        background: linear-gradient(180deg, #f5fbff 0%, #ffffff 45%, #eef7ff 100%);
        color: #17324d;
    }
    [data-testid="stSidebar"] {
        background: #e8f5ff;
    }
    .hero {
        padding: 1.4rem 1.2rem;
        border-radius: 8px;
        background: linear-gradient(135deg, #0b74de 0%, #31a8e8 100%);
        color: white;
        margin-bottom: 1rem;
    }
    .hero h1 {
        font-size: 2rem;
        margin: 0 0 .35rem 0;
        letter-spacing: 0;
    }
    .hero p {
        margin: 0;
        opacity: .95;
    }
    .source-box {
        border: 1px solid #cfe8ff;
        background: #f8fcff;
        border-radius: 8px;
        padding: .8rem;
        margin-top: .5rem;
        font-size: .92rem;
    }
    div.stButton > button {
        border-radius: 8px;
        border-color: #8bc8ff;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
        <h1>BlueTrip Amenities Chatbot</h1>
        <p>Hoi nhanh ve buffet, ho boi, shuttle, gym va spa trong ky nghi.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

with st.sidebar:
    # Sidebar controls the data reload, retrieval strategy, and quick questions.
    st.subheader("Du lieu RAG")
    st.caption(f"Thu muc: {DATA_DIR}")
    retrieval_method = st.radio(
        "Kieu truy hoi",
        ["Keyword", "VectorDB (Hugging Face)"],
        help="Keyword dung tu trung khop. VectorDB dung sentence-transformers + ChromaDB.",
    )
    embedding_model_name = st.text_input(
        "Hugging Face embedding model",
        value=os.getenv("HF_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL),
        disabled=retrieval_method == "Keyword",
    )
    if st.button("Tai lai du lieu"):
        st.cache_data.clear()
        st.cache_resource.clear()
        st.rerun()
    st.divider()
    st.subheader("Cau hoi nhanh")
    selected_question = None
    for question in QUICK_QUESTIONS:
        if st.button(question, use_container_width=True):
            selected_question = question

chunks = load_chunks(str(DATA_DIR))

# Session memory for the current browser session only.
# It keeps chat messages visible, but is not persisted to disk.
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "Xin chao! Ban muon hoi ve tien ich nao trong ky nghi?",
        }
    ]

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

user_question = selected_question or st.chat_input("Vi du: Shuttle ra san bay co can dat truoc khong?")

if user_question:
    # Main chat turn:
    # 1. Save user question.
    # 2. Retrieve Markdown context.
    # 3. Ask Gemini or use fallback draft.
    # 4. Show retrieved sources for transparency.
    st.session_state.messages.append({"role": "user", "content": user_question})
    with st.chat_message("user"):
        st.markdown(user_question)

    contexts, retrieval_used = retrieve_contexts(
        user_question,
        chunks,
        retrieval_method,
        embedding_model_name,
    )
    with st.chat_message("assistant"):
        if not chunks:
            answer = "Chua co file Markdown trong data/. Hay them du lieu tien ich roi bam Tai lai du lieu."
        elif not contexts:
            answer = "Minh chua tim thay thong tin nay trong data Markdown. Ban co the hoi lai cu the hon hoac lien he le tan."
        else:
            with st.spinner(f"Dang truy hoi bang {retrieval_used} va hoi Gemini..."):
                answer = ask_gemini(user_question, contexts)
        st.markdown(answer)
        if contexts:
            with st.expander("Nguon RAG da truy hoi"):
                for chunk, score in contexts:
                    st.markdown(
                        f"""
                        <div class="source-box">
                        <strong>{chunk.heading}</strong> · {chunk.source} · {retrieval_used} score {score:.3f}<br/>
                        {chunk.text.replace(chr(10), '<br/>')}
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

    st.session_state.messages.append({"role": "assistant", "content": answer})
