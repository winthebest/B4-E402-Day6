# Travel Amenities RAG Chatbot

Prototype Streamlit cho chatbot du lich tra loi nhanh ve tien ich khach san/resort: buffet, ho boi, shuttle, gym, spa.

## 1. Chuan bi

```bash
cd travel-rag-chatbot
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Tao bien moi truong Gemini:

```bash
$env:GEMINI_API_KEY="YOUR_API_KEY"
```

Mac dinh app dung model `gemini-3.1-flash-lite`. Co the doi bang:

```bash
$env:GEMINI_MODEL="gemini-3.1-flash-lite"
```

Neu dung che do VectorDB, lan dau app se tai Hugging Face embedding model. Mac dinh:

```bash
$env:HF_EMBEDDING_MODEL="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
```

## 2. Chay app

```bash
python app.py
```

Neu may khong bi chan `streamlit.exe`, co the chay cach quen thuoc:

```bash
python -m streamlit run app.py
```

## 3. Dua data vao

Them hoac sua file Markdown trong thu muc `data/`.

Goi y format:

```markdown
# Ten khu nghi duong

## Buffet sang
- Gio mo cua: 06:30-10:00
- Dia diem: Nha hang Ocean Breeze
- Ghi chu: Tre em duoi 6 tuoi mien phi

## Ho boi
- Gio mo cua: 06:00-21:00
- Luu y: Can co nguoi lon di kem tre em
```

Nut **Tai lai du lieu** trong sidebar se doc lai cac file `.md`.

## 4. Chon kieu RAG

Trong sidebar co 2 lua chon:

- **Keyword:** tach Markdown thanh chunk theo heading, sau do lay chunk co nhieu tu trung voi cau hoi. Nhanh, nhe, phu hop demo nho.
- **VectorDB (Hugging Face):** dung `sentence-transformers` de tao embedding, luu vao ChromaDB in-memory, sau do semantic search theo vector. Phu hop khi co nhieu dia diem/file va user hoi bang cach dien dat khac data goc.

Flow VectorDB:

```text
data/*.md
-> split chunk theo heading
-> Hugging Face embeddings
-> ChromaDB collection
-> semantic retrieval
-> context
-> Gemini
```

Neu VectorDB chua cai du dependency hoac model chua tai duoc, app se fallback sang Keyword va hien ly do trong UI.

## 5. Build slice

Cho khach du lich dang can hoi nhanh ve tien ich trong ky nghi, prototype dung AI + RAG de tra loi ngan gon, than thien, co nguon trich dan tu Markdown, va neu khong chac thi hoi lai hoac de nghi lien he le tan.
