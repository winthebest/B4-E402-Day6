from __future__ import annotations

import os
import re
import hashlib
import html
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

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


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def load_env_file(path: Path) -> None:
    # Tiny .env loader so the app works without adding another dependency.
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file(APP_DIR / ".env")


def launch_with_streamlit_if_needed() -> None:
    """Allow `python app.py` when `streamlit.exe` is blocked by Windows policy."""
    if __name__ != "__main__":
        return

    try:
        from streamlit.runtime.scriptrunner import get_script_run_ctx
    except Exception:
        get_script_run_ctx = None

    if get_script_run_ctx is not None and get_script_run_ctx() is not None:
        return

    from streamlit.web import cli as streamlit_cli

    sys.argv = ["streamlit", "run", str(Path(__file__).resolve()), *sys.argv[1:]]
    raise SystemExit(streamlit_cli.main())


launch_with_streamlit_if_needed()

QUICK_QUESTIONS = [
    "Buffet sáng mở cửa mấy giờ?",
    "Hồ bơi có giờ hoạt động thế nào?",
    "Có shuttle ra sân bay không?",
    "Gym nằm ở đâu và mở đến mấy giờ?",
    "Spa có cần đặt lịch trước không?",
]

GREETING_WORDS = {"hi", "hello", "hey", "xin chào", "xin chao", "chào", "chao"}


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


def is_greeting(text: str) -> bool:
    cleaned = re.sub(r"[^\w\sÀ-ỹ]", " ", normalize(text), flags=re.UNICODE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned in GREETING_WORDS


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


def data_manifest(data_dir: Path) -> str:
    # Include file names, sizes, and mtimes so Streamlit reloads when data changes.
    if not data_dir.exists():
        return "missing"

    parts = []
    for path in sorted(data_dir.glob("*.md")):
        stat = path.stat()
        parts.append(f"{path.name}|{stat.st_size}|{stat.st_mtime_ns}")
    return hashlib.sha1("\n".join(parts).encode("utf-8")).hexdigest()


@st.cache_data(show_spinner=False)
def load_chunks(data_dir: str, manifest: str) -> list[Chunk]:
    # Read every .md file in data/. The manifest invalidates stale Streamlit cache.
    root = Path(data_dir)
    if not root.exists():
        return []

    chunks: list[Chunk] = []
    for path in sorted(root.glob("*.md")):
        chunks.extend(split_markdown(path, path.read_text(encoding="utf-8")))
    return chunks


def count_markdown_files(data_dir: Path) -> int:
    return len(list(data_dir.glob("*.md"))) if data_dir.exists() else 0


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
            "Chưa cài sentence-transformers. Hãy chạy `pip install -r requirements.txt`."
        )
    return SentenceTransformer(model_name)


@st.cache_resource(show_spinner=False)
def build_vector_index(chunks_key: str, chunks: tuple[Chunk, ...], model_name: str) -> VectorIndex:
    # Build an in-memory ChromaDB collection from Markdown chunks.
    # chunks_key changes when data changes, forcing Streamlit to rebuild the index.
    if chromadb is None:
        raise RuntimeError("Chưa cài chromadb. Hãy chạy `pip install -r requirements.txt`.")

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
            st.warning(f"VectorDB chưa sẵn sàng, đang fallback sang keyword. Lý do: {exc}")
    return retrieve(question, chunks, limit), "Keyword"


def build_prompt(question: str, contexts: list[tuple[Chunk, float]]) -> str:
    # Prompt pattern: Gemini must answer only from retrieved Markdown context.
    context_text = "\n\n".join(
        f"[{idx}] Nguồn: {chunk.source} | Mục: {chunk.heading}\n{chunk.text}"
        for idx, (chunk, _) in enumerate(contexts, start=1)
    )
    return f"""
Bạn là trợ lý du lịch thân thiện của một resort. Chỉ trả lời dựa trên CONTEXT.
Nếu CONTEXT không đủ thông tin, nói rõ rằng bạn chưa có dữ liệu và gợi ý khách hỏi lễ tân.
Trả lời bằng tiếng Việt, ngắn gọn, ưu tiên giờ mở cửa/địa điểm/lưu ý quan trọng.
Cuối câu trả lời thêm dòng "Nguồn:" với tên mục Markdown đã dùng.

CONTEXT:
{context_text}

CÂU HỎI:
{question}
""".strip()


def ask_gemini(question: str, contexts: list[tuple[Chunk, float]]) -> str:
    # If GEMINI_API_KEY is missing, return a RAG-only draft so the demo still works.
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

    if not api_key:
        return (
            "Chưa có GEMINI_API_KEY, nên mình đang hiển thị câu trả lời demo từ RAG.\n\n"
            + draft_from_context(contexts)
        )
    if genai is None:
        return "Chưa cài được package google-genai. Hãy chạy `pip install -r requirements.txt`."

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=build_prompt(question, contexts),
    )
    return response.text or "Mình chưa tạo được câu trả lời. Bạn thử hỏi lại ngắn gọn hơn nhé."


def draft_from_context(contexts: list[tuple[Chunk, float]]) -> str:
    # Offline fallback: show the best retrieved Markdown chunk without calling LLM.
    if not contexts:
        return "Mình chưa tìm thấy thông tin phù hợp trong data Markdown. Bạn có thể bổ sung thêm file trong thư mục data/."
    chunk = contexts[0][0]
    compact = re.sub(r"\n+", "\n", chunk.text).strip()
    return f"{compact}\n\nNguồn: {chunk.source} - {chunk.heading}"


def render_user_message(content: str) -> None:
    safe_content = html.escape(content).replace("\n", "<br/>")
    st.markdown(
        f"""
        <div class="chat-row user-row">
            <div class="chat-bubble user-bubble">{safe_content}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def source_paths(contexts: list[tuple[Chunk, float]]) -> list[str]:
    paths: list[str] = []
    seen: set[str] = set()
    for chunk, _ in contexts:
        source_path = str((DATA_DIR / chunk.source).resolve())
        if source_path not in seen:
            paths.append(source_path)
            seen.add(source_path)
    return paths


def source_links(contexts: list[tuple[Chunk, float]]) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for chunk, _ in contexts:
        if chunk.source in seen:
            continue

        source_path = str((DATA_DIR / chunk.source).resolve())
        source_url = f"?source={quote(chunk.source, safe='')}"
        links.append((source_path, source_url))
        seen.add(chunk.source)
    return links


def selected_source_path() -> Path | None:
    source_name = st.query_params.get("source")
    if not source_name:
        return None
    if isinstance(source_name, list):
        source_name = source_name[0]

    data_root = DATA_DIR.resolve()
    candidate = (DATA_DIR / source_name).resolve()
    try:
        candidate.relative_to(data_root)
    except ValueError:
        return None

    if candidate.suffix.lower() != ".md" or not candidate.exists():
        return None
    return candidate


def render_source_viewer() -> bool:
    source_path = selected_source_path()
    if source_path is None:
        return False

    st.markdown("### File nguồn")
    st.caption(str(source_path))
    st.markdown('<a href="./" target="_self">Quay lại chatbot</a>', unsafe_allow_html=True)
    st.code(source_path.read_text(encoding="utf-8"), language="markdown")
    return True


def preload_embedding_model(model_name: str) -> None:
    try:
        with st.spinner(f"Đang tải embedding model `{model_name}`..."):
            load_embedding_model(model_name)
    except Exception as exc:
        st.error(
            "Không tải được embedding model. "
            "Hãy kiểm tra `requirements.txt`, kết nối mạng lần đầu tải model, "
            f"và giá trị `HF_EMBEDDING_MODEL` trong `.env`.\n\nChi tiết: {exc}"
        )
        st.stop()


st.set_page_config(
    page_title="Travel Amenities Chatbot",
    page_icon=":airplane:",
    layout="centered",
)

configured_embedding_model = os.getenv("HF_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
if env_flag("PRELOAD_EMBEDDING_MODEL", default=True):
    preload_embedding_model(configured_embedding_model)

# Sky Holiday theme: bright sky blue with a soft sunny accent.
st.markdown(
    """
    <style>
    :root {
        --sky-50: #f3fbff;
        --sky-100: #e1f5ff;
        --sky-200: #bfeaff;
        --sky-500: #1b9ee8;
        --sky-700: #075f9f;
        --sun-100: #fff4bf;
        --sun-300: #ffd75a;
        --ink: #12324a;
        --muted: #4f6f86;
        --line: #a9dff8;
    }
    .stApp {
        background:
            radial-gradient(circle at 18% 0%, rgba(255, 215, 90, .32), transparent 24rem),
            linear-gradient(180deg, var(--sky-50) 0%, #ffffff 46%, #edf9ff 100%);
        color: var(--ink);
    }
    .block-container {
        padding-top: 2rem;
    }
    .stApp h1,
    .stApp h2,
    .stApp h3,
    .stApp p,
    .stApp label,
    .stApp span {
        color: var(--ink);
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #e5f7ff 0%, #f8fdff 100%);
        border-right: 1px solid var(--line);
    }
    [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3,
    [data-testid="stSidebar"] p,
    [data-testid="stSidebar"] label,
    [data-testid="stSidebar"] span {
        color: var(--ink);
    }
    .hero {
        padding: 1.55rem 1.35rem;
        border-radius: 8px;
        background:
            linear-gradient(135deg, rgba(255, 215, 90, .95) 0%, rgba(255, 244, 191, .86) 22%, transparent 23%),
            linear-gradient(135deg, #0b82d8 0%, #22b8f0 58%, #6ad7f7 100%);
        color: white;
        margin-bottom: 1.1rem;
        box-shadow: 0 14px 34px rgba(7, 95, 159, .18);
    }
    .hero h1 {
        font-size: 2rem;
        margin: 0 0 .35rem 0;
        letter-spacing: 0;
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(7, 95, 159, .35);
    }
    .hero p {
        margin: 0;
        color: #f5fcff;
        opacity: 1;
        font-weight: 500;
    }
    [data-testid="stChatMessage"] {
        background: rgba(255, 255, 255, .82);
        border: 1px solid #d7effb;
        border-radius: 8px;
        box-shadow: 0 8px 22px rgba(7, 95, 159, .08);
        margin-bottom: .75rem;
        max-width: 84%;
        width: fit-content;
        min-width: 12rem;
    }
    [data-testid="stChatMessage"][aria-label*="assistant" i] {
        margin-right: auto;
        margin-left: 0;
        background: rgba(255, 255, 255, .9);
        border-color: #d7effb;
    }
    [data-testid="stChatMessage"][aria-label*="user" i] {
        flex-direction: row-reverse;
        margin-left: auto;
        margin-right: 0;
        background: linear-gradient(180deg, #fff9df 0%, #e9f8ff 100%);
        border-color: #9bdcf7;
    }
    [data-testid="stChatMessage"][aria-label*="user" i] [data-testid="stMarkdownContainer"] {
        text-align: right;
    }
    [data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] p {
        color: var(--ink);
    }
    .chat-row {
        display: flex;
        width: 100%;
        margin: .72rem 0;
    }
    .chat-row.user-row {
        justify-content: flex-end;
    }
    .chat-bubble {
        max-width: 78%;
        min-width: 6rem;
        padding: .78rem .95rem;
        border-radius: 8px;
        line-height: 1.5;
        color: var(--ink);
        box-shadow: 0 8px 22px rgba(7, 95, 159, .08);
        overflow-wrap: anywhere;
    }
    .user-bubble {
        background: linear-gradient(180deg, #fff9df 0%, #e9f8ff 100%);
        border: 1px solid #9bdcf7;
        text-align: right;
        font-weight: 500;
    }
    [data-testid="stChatInput"] textarea,
    .stTextInput input {
        background: #ffffff;
        color: var(--ink);
        border: 1px solid var(--line);
    }
    [data-testid="stChatInput"] textarea:focus,
    .stTextInput input:focus {
        border-color: var(--sky-500);
        box-shadow: 0 0 0 1px var(--sky-500);
    }
    .source-box {
        border: 1px solid var(--line);
        background: linear-gradient(180deg, #ffffff 0%, #f3fbff 100%);
        border-radius: 8px;
        padding: .8rem;
        margin-top: .5rem;
        font-size: .92rem;
        color: var(--ink);
        box-shadow: 0 8px 18px rgba(7, 95, 159, .08);
    }
    .source-box strong {
        color: var(--sky-700);
    }
    div.stButton > button {
        border-radius: 8px;
        border: 1px solid var(--line);
        background: #ffffff;
        color: var(--sky-700);
        font-weight: 600;
        min-height: 2.35rem;
    }
    div.stButton > button:hover {
        border-color: var(--sky-500);
        background: linear-gradient(180deg, #ffffff 0%, #eef9ff 100%);
        color: #064f86;
    }
    div.stButton > button:focus {
        box-shadow: 0 0 0 2px rgba(255, 215, 90, .55);
    }
    .stRadio [role="radiogroup"] label {
        background: rgba(255, 255, 255, .7);
        border: 1px solid #d7effb;
        border-radius: 8px;
        padding: .28rem .45rem;
        margin-bottom: .25rem;
    }
    .stAlert {
        border-radius: 8px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
        <h1>BlueTrip Amenities Chatbot</h1>
        <p>Hỏi nhanh về buffet, hồ bơi, shuttle, gym và spa trong kỳ nghỉ.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

if render_source_viewer():
    st.stop()

markdown_file_count = count_markdown_files(DATA_DIR)
markdown_manifest = data_manifest(DATA_DIR)
chunks = load_chunks(str(DATA_DIR), markdown_manifest)

with st.sidebar:
    # Sidebar controls the data reload, retrieval strategy, and quick questions.
    st.subheader("Dữ liệu RAG")
    st.caption(f"Thư mục: {DATA_DIR}")
    st.caption(f"Đã tìm thấy {markdown_file_count} file Markdown và nạp {len(chunks)} chunk.")
    retrieval_method = st.radio(
        "Kiểu truy hồi",
        ["Keyword", "VectorDB (Hugging Face)"],
        help="Keyword dùng từ trùng khớp. VectorDB dùng sentence-transformers + ChromaDB.",
    )
    embedding_model_name = st.text_input(
        "Hugging Face embedding model",
        value=configured_embedding_model,
        disabled=retrieval_method == "Keyword",
    )
    if st.button("Tải lại dữ liệu"):
        st.cache_data.clear()
        st.cache_resource.clear()
        st.rerun()
    st.divider()
    st.subheader("Câu hỏi nhanh")
    selected_question = None
    for question in QUICK_QUESTIONS:
        if st.button(question, use_container_width=True):
            selected_question = question

# Session memory for the current browser session only.
# It keeps chat messages visible, but is not persisted to disk.
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "Xin chào! Bạn muốn hỏi về tiện ích nào trong kỳ nghỉ?",
        }
    ]

for message in st.session_state.messages:
    if message["role"] == "user":
        render_user_message(message["content"])
    else:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

user_question = selected_question or st.chat_input("Ví dụ: Shuttle ra sân bay có cần đặt trước không?")

if user_question:
    # Main chat turn:
    # 1. Save user question.
    # 2. Retrieve Markdown context.
    # 3. Ask Gemini or use fallback draft.
    # 4. Show retrieved sources for transparency.
    st.session_state.messages.append({"role": "user", "content": user_question})
    render_user_message(user_question)

    contexts: list[tuple[Chunk, float]] = []
    retrieval_used = retrieval_method
    with st.chat_message("assistant"):
        if is_greeting(user_question):
            answer = (
                "Xin chào! Mình có thể giúp bạn tra cứu thông tin về resort, "
                "combo nghỉ dưỡng, bữa sáng, đưa đón sân bay, vui chơi và các tiện ích khác."
            )
        elif not chunks:
            answer = (
                "Mình chưa nạp được nội dung Markdown để trả lời.\n\n"
                f"- Thư mục đang đọc: `{DATA_DIR}`\n"
                f"- Số file Markdown tìm thấy: {markdown_file_count}\n\n"
                "Hãy bấm **Tải lại dữ liệu** ở sidebar hoặc khởi động lại app."
            )
        else:
            contexts, retrieval_used = retrieve_contexts(
                user_question,
                chunks,
                retrieval_method,
                embedding_model_name,
            )
            if not contexts:
                answer = "Mình chưa tìm thấy thông tin này trong data Markdown. Bạn có thể hỏi lại cụ thể hơn hoặc liên hệ lễ tân."
            else:
                with st.spinner(f"Đang truy hồi bằng {retrieval_used} và hỏi Gemini..."):
                    answer = ask_gemini(user_question, contexts)
        st.markdown(answer)
        if contexts:
            with st.expander("Nguồn RAG đã truy hồi"):
                for source_path, source_url in source_links(contexts):
                    st.markdown(
                        f'<a href="{html.escape(source_url)}" target="_blank" '
                        f'rel="noopener noreferrer">{html.escape(source_path)}</a>',
                        unsafe_allow_html=True,
                    )

    st.session_state.messages.append({"role": "assistant", "content": answer})
