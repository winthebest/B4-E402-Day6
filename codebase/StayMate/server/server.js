/*
 * StayMate backend (Node, không cần npm install — dùng global fetch của Node 18+).
 * - Phục vụ static web/ và data/ (thay python -m http.server).
 * - POST /api/chat: AI-FIRST (Gemini brain) + hậu kiểm an toàn/slot (hackathon: AI chạy thật).
 *
 * Chạy:  node server/server.js
 * Cần:   GEMINI_API_KEY trong .env (xem .env.example). Thiếu key → vẫn chạy guardrail,
 *        phần FAQ trả lời fallback đơn giản (để demo offline).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { callGeminiBrain, getModel } = require("./gemini");

function isRecommendIntent(t) {
  return /gợi ý|đề xuất|nên làm|nên đi|nên ăn|chơi gì|làm gì|đi đâu|lịch trình|tư vấn|có gì (vui|chơi|hay)|recommend|gới ý/.test(
    t
  );
}

function partOfDay(now) {
  const h = new Date().getHours();
  if (h < 11) return "buổi sáng";
  if (h < 17) return "buổi chiều";
  return "buổi tối";
}

/** Fallback gợi ý theo loại khách khi CHƯA có Gemini (vẫn khác nhau theo tình huống) */
function recommendFallback(ctx) {
  const part = partOfDay(ctx.now);
  const g = ctx.guest || "family";
  const map = {
    couple: `Gợi ý cho anh/chị (${part}):\n1. Spa đôi 09:00–21:00 — thư giãn riêng tư.\n2. Bữa tối tại The Beach Bistro — hải sản view biển.\n3. Dạo bãi biển riêng ngắm hoàng hôn.\nAnh/chị muốn em giữ chỗ mục nào ạ?`,
    family_with_kids: `Gợi ý cho gia đình có bé (${part}):\n1. Kids club cho bé vui chơi an toàn.\n2. Hồ bơi 06:00–21:00 — khu nông cho trẻ.\n3. Buffet sáng 06:00–10:30 đa dạng món.\nAnh/chị muốn em hỗ trợ mục nào ạ?`,
    family: `Gợi ý cho gia đình (${part}):\n1. Buffet sáng 06:00–10:30.\n2. Hồ bơi & bãi biển riêng ban ngày.\n3. Bữa tối nhà hàng resort.\nAnh/chị muốn em hỗ trợ mục nào ạ?`,
  };
  return map[g] || map.family;
}

function isHoursQuestion(t) {
  return /mấy giờ|giờ mở|mở mấy|mở cửa|đóng cửa|đóng lúc|giờ đóng|hoạt động|khi nào mở/.test(t);
}

function wantsSpaBooking(t, text) {
  if (!/spa|massage/.test(t) || isHoursQuestion(t)) return false;
  return (
    /đặt|book|giữ chỗ|đi spa|đến spa|muốn đi spa/.test(t) ||
    !!(parseTime(text) && /spa|massage|đi spa/.test(t))
  );
}

function wantsDinnerBooking(t) {
  if (isHoursQuestion(t)) return false;
  return /đặt bàn|ăn tối|bữa tối|dinner/.test(t) && /đặt|book|giữ chỗ/.test(t);
}

function findAmenity(text) {
  const t = norm(text);
  const map = [
    { id: "buffet_breakfast", kw: ["buffet", "ăn sáng", "bữa sáng"] },
    { id: "pool", kw: ["hồ bơi", "bể bơi", "bơi", "pool"] },
    { id: "private_beach", kw: ["bãi biển", "biển", "beach"] },
    { id: "shuttle_beach", kw: ["shuttle", "xe đưa", "xe buýt", "đưa đón"] },
    { id: "gym", kw: ["gym", "tập", "phòng tập", "fitness"] },
    { id: "spa_resort", kw: ["spa", "massage"] },
    { id: "kids_club", kw: ["kids", "trẻ em", "trẻ nhỏ"] },
    { id: "front_desk", kw: ["lễ tân", "tổng đài", "hotline", "gọi"] },
    { id: "late_checkout", kw: ["late", "trả phòng muộn", "checkout", "check-out"] },
  ];
  const hit = map.find((m) => m.kw.some((k) => t.includes(norm(k))));
  if (!hit) return null;
  return (DB.amenities.amenities || []).find((a) => a.id === hit.id) || null;
}

function amenityFact(a) {
  const hours = a.hours_display || (a.open && a.close ? `${a.open} – ${a.close}` : null);
  return `${a.name} | giờ: ${hours || "chưa có"} | ${a.data_status}`;
}

/** Tool context đưa vào Gemini — AI luôn thấy slot/tiện ích/rủi ro đã phân tích */
function buildToolContext(text, ctx) {
  const t = norm(text);
  const lines = [`phòng: ${ctx.room || "?"}`, `khách: ${ctx.guest || "?"}`, `lúc: ${ctx.now}`];
  const risky = isRisky(text);
  if (risky) lines.push(`intent_rủi_ro: ${risky} (chỉ escalate, không tự xử lý)`);
  const a = findAmenity(text);
  if (a) lines.push(`tiện_ích: ${amenityFact(a)}`);
  if (wantsSpaBooking(t, text) || wantsDinnerBooking(t)) {
    const key = wantsSpaBooking(t, text) ? "spa_resort_60" : "restaurant_dinner_resort";
    const time = parseTime(text);
    const slot = checkSlots(key, time);
    if (slot) {
      lines.push(
        `đặt_chỗ: ${key} | giờ hỏi: ${time || "chưa rõ"} | trạng thái: ${slot.status || "không có trong lịch"} | còn trống: ${slot.alts.join(", ") || "không"}`
      );
    }
  }
  if (/đồ ăn|ăn gì|nhà hàng|buffet|đói|món ăn/.test(t)) {
    const names = (DB.restaurants.restaurants || []).slice(0, 4).map((r) => `${r.name} (${r.hours || "?"})`);
    lines.push(`nhà_hàng: ${names.join("; ")}`);
  }
  return lines.join("\n");
}

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 8000;

// --- nạp .env thủ công (tránh phụ thuộc dotenv) ---
(function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (_) {}
})();

// --- nạp data/ một lần ---
function loadDB() {
  const d = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
  return {
    amenities: d("amenities_resort.json"),
    restaurants: d("resort_restaurants.json"),
    contact: d("resort_contact.json"),
    rooms: d("rooms.json"),
    slots: d("slots.json"),
    risky: d("risky_intents.json"),
    policies: d("policies.json"),
    departments: d("departments.json"),
  };
}
let DB = loadDB();

const norm = (s) => (s || "").toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();

function isRisky(text) {
  const t = norm(text);
  return (DB.risky.keywords_vi || []).find((k) => t.includes(norm(k))) || null;
}

function checkSlots(key, time) {
  const grp = DB.slots.slots[key];
  if (!grp) return null;
  const alts = Object.entries(grp).filter(([, v]) => v === "available").map(([t]) => t);
  return { status: time ? grp[time] : null, alts };
}

function parseTime(t) {
  const m = norm(t).match(/(\d{1,2})[h:](\d{0,2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${(m[2] || "00").padStart(2, "0")}`;
}

// --- guardrail: xử lý các path bắt buộc deterministic, không giao cho LLM ---
function guardrail(text, ctx) {
  // Path 4 — rủi ro tiền/chính sách
  const risky = isRisky(text);
  if (risky) {
    return {
      type: "escalate",
      text: `Yêu cầu liên quan đến "${risky}" cần nhân viên xác nhận. Em không tự xử lý để tránh sai sót về tiền/chính sách, và đã chuyển lễ tân giúp anh/chị (phòng ${ctx.room || "?"}).`,
      summary: text,
      quicks: [{ label: "Chuyển lễ tân", action: "human" }],
      engine: "guardrail",
    };
  }

  const t = norm(text);

  // FAQ giờ tiện ích (spa mở mấy giờ, buffet…) — không nhầm đặt chỗ
  const amenity = findAmenity(text);
  if (amenity && isHoursQuestion(t)) {
    const hours =
      amenity.hours_display || (amenity.open && amenity.close ? `${amenity.open} – ${amenity.close}` : null);
    let textOut = hours
      ? `${amenity.name}: ${hours}${amenity.data_status === "needs_verify" ? " (giờ tham khảo)" : ""}`
      : `Em chưa có giờ mở cửa chính thức của ${amenity.name}. Anh/chị gọi lễ tân ${DB.contact?.phone || ""} nhé.`;
    return { type: "answer", text: textOut, engine: "guardrail" };
  }

  // Đồ ăn / nhà hàng
  if (/gọi món|phục vụ phòng|room service|mang lên phòng|đồ ăn.*phòng/.test(t)) {
    return {
      type: "request",
      text: `Em ghi nhận yêu cầu đồ ăn/phục vụ phòng cho phòng ${ctx.room || "?"}. Anh/chị xác nhận để em chuyển bộ phận ẩm thực nhé?`,
      quicks: [
        { label: "Xác nhận gửi", action: "confirm:dining" },
        { label: "Đặt bàn nhà hàng", action: "ask:đặt bàn 19h" },
      ],
      engine: "guardrail",
    };
  }
  if (/đồ ăn|ăn gì|muốn ăn|cho.*ăn|đói|đặt món|thức ăn|món ăn|nhà hàng|ăn uống|buffet/.test(t)) {
    const list = (DB.restaurants.restaurants || []).slice(0, 4);
    const lines = list.map((r) => `• ${r.name}: ${r.hours || "liên hệ lễ tân"}`).join("\n");
    return {
      type: "answer",
      text: `Resort có các nhà hàng sau:\n${lines}\n\nAnh/chị muốn đặt bàn tối, hỏi buffet sáng, hay gọi món lên phòng ạ?`,
      quicks: [
        { label: "Đặt bàn tối", action: "ask:đặt bàn 19h" },
        { label: "Buffet sáng", action: "ask:buffet sáng mấy giờ" },
        { label: "Gọi món phòng", action: "ask:gọi món phục vụ phòng" },
      ],
      engine: "guardrail",
    };
  }

  // Yêu cầu amenity đơn giản (khăn/nước/gối) → housekeeping, draft + xác nhận
  if (/khăn|nước|gối|dọn phòng|bàn chải|dép/.test(t)) {
    return {
      type: "request",
      text: `Em ghi nhận yêu cầu: "${text}" cho phòng ${ctx.room || "?"}. Em gửi tới bộ phận Buồng phòng nhé?`,
      quicks: [{ label: "Xác nhận gửi", action: "confirm:housekeeping" }],
      engine: "guardrail",
    };
  }

  // Path 3 — đặt spa/bàn, kiểm tra slot
  const wantSpa = wantsSpaBooking(t, text);
  const wantDinner = wantsDinnerBooking(t);
  if (wantSpa || wantDinner) {
    const time = parseTime(text);
    if (time) {
      const key = wantSpa ? "spa_resort_60" : "restaurant_dinner_resort";
      const slot = checkSlots(key, time);
      if (slot && slot.status === "full") {
        return {
          type: "escalate",
          variant: "slot",
          text: `Rất tiếc, khung ${time} đã kín. Em còn ${slot.alts.join(" hoặc ")} — anh/chị chọn giúp em nhé?`,
          quicks: [
            ...slot.alts.map((tt) => ({ label: `Chọn ${tt}`, action: `book:${key}:${tt}` })),
            { label: "Chuyển lễ tân", action: "human" },
          ],
          engine: "guardrail",
        };
      }
      if (slot && slot.status === "available") {
        return {
          type: "request",
          text: `Em giữ chỗ ${wantSpa ? "spa" : "bàn"} lúc ${time} cho phòng ${ctx.room || "?"}. Anh/chị xác nhận để em gửi đi nhé?`,
          quicks: [{ label: "Xác nhận", action: `confirm:${key}:${time}` }],
          engine: "guardrail",
        };
      }
      // Giờ đã parse nhưng không có trong lịch → gợi ý khung trống
      if (slot && !slot.status && slot.alts.length) {
        return {
          type: "escalate",
          variant: "slot",
          text: `Em chưa có khung ${time} trống cho ${wantSpa ? "spa" : "bàn"}. Em còn ${slot.alts.join(" hoặc ")} — anh/chị chọn giúp em nhé?`,
          quicks: [
            ...slot.alts.map((tt) => ({ label: `Chọn ${tt}`, action: `book:${key}:${tt}` })),
            { label: "Chuyển lễ tân", action: "human" },
          ],
          engine: "guardrail",
        };
      }
    }
    // Đặt spa/bàn nhưng chưa nói giờ → gợi ý từ slots
    const key = wantSpa ? "spa_resort_60" : "restaurant_dinner_resort";
    const slot = checkSlots(key, null);
    if (slot?.alts?.length) {
      return {
        type: "clarify",
        text: `Anh/chị muốn đặt ${wantSpa ? "spa" : "bàn"} lúc mấy giờ ạ?`,
        quicks: slot.alts.map((tt) => ({ label: tt, action: `book:${key}:${tt}` })),
        engine: "guardrail",
      };
    }
  }
  return null; // → Gemini + tool context
}

function geminiEnabled() {
  const key = process.env.GEMINI_API_KEY;
  return !!(key && !key.startsWith("your-"));
}

function fallbackFAQ(text) {
  const t = norm(text);
  const a = (DB.amenities.amenities || []).find((x) =>
    [x.id, x.name].some((n) => t.includes(norm(n).split(" ")[0]))
  );
  if (a) {
    const hours = a.hours_display || (a.open && a.close ? `${a.open} – ${a.close}` : null);
    if (a.id === "front_desk") return `Lễ tân: ${a.phone} | hotline ${a.hotline}`;
    if (hours) return `${a.name}: ${hours}${a.data_status === "needs_verify" ? " (giờ tham khảo)" : ""}`;
    return `${a.name}: ${a.note || "anh/chị gọi lễ tân để biết thêm nhé"}`;
  }
  return "Để em hỗ trợ đúng, anh/chị cần hỏi tiện ích, đặt dịch vụ hay gặp lễ tân ạ?";
}

async function handleChat(payload) {
  const ctx = {
    room: payload.room,
    guest: payload.guest,
    now: new Date().toLocaleString("vi-VN", { hour12: false }),
  };
  const text = payload.text || "";

  // Offline / chưa key → rule engine (backup demo)
  if (!geminiEnabled()) {
    const g = guardrail(text, ctx);
    if (g) return g;
    if (isRecommendIntent(norm(text))) {
      return {
        type: "answer",
        text: recommendFallback(ctx),
        engine: "fallback",
        ai: { intent: "recommend" },
        quicks: recommendQuicks(ctx),
      };
    }
    return { type: "answer", text: fallbackFAQ(text), engine: "fallback" };
  }

  // AI-FIRST: Gemini hiểu ý → server chỉ kiểm tra an toàn + slot
  try {
    const ai = await callGeminiBrain(process.env.GEMINI_API_KEY, DB, ctx, payload.history || [], text);
    return enforceAndRespond(ai, text, ctx);
  } catch (e) {
    const g = guardrail(text, ctx);
    if (g) return { ...g, engine: "fallback", error: String(e.message) };
    return { type: "answer", text: fallbackFAQ(text), engine: "fallback", error: String(e.message) };
  }
}

function enforceAndRespond(ai, text, ctx) {
  const meta = { model: getModel(), intent: ai.intent, guest: ctx.guest };

  if (ai.escalate || ai.intent === "risky" || isRisky(text)) {
    return {
      type: "escalate",
      text: ai.reply,
      summary: text,
      quicks: [{ label: "Chuyển lễ tân", action: "human" }],
      engine: "gemini",
      ai: { ...meta, intent: "risky", enforced: "safety" },
    };
  }

  if (ai.intent === "book_spa" || ai.intent === "book_dining") {
    const key = ai.intent === "book_spa" ? "spa_resort_60" : "restaurant_dinner_resort";
    const time = parseTime(ai.time) || parseTime(text);
    const slot = checkSlots(key, time);
    if (time && slot?.status === "available") {
      return {
        type: "request",
        text: ai.reply,
        quicks: [{ label: "Xác nhận", action: `confirm:${key}:${time}` }],
        engine: "gemini",
        ai: { ...meta, time },
      };
    }
    if (time && slot && slot.alts.length) {
      return {
        type: "escalate",
        variant: "slot",
        text: `Khung ${time} không đặt được. Em còn ${slot.alts.join(" hoặc ")} — anh/chị chọn giúp em nhé?`,
        quicks: [
          ...slot.alts.map((tt) => ({ label: `Chọn ${tt}`, action: `book:${key}:${tt}` })),
          { label: "Chuyển lễ tân", action: "human" },
        ],
        engine: "gemini",
        ai: { ...meta, enforced: "slot" },
      };
    }
    const free = checkSlots(key, null);
    return {
      type: "clarify",
      text: ai.reply,
      quicks: (free?.alts || []).map((tt) => ({ label: tt, action: `book:${key}:${tt}` })),
      engine: "gemini",
      ai: meta,
    };
  }

  if (ai.intent === "room_service") {
    const dept = /món|ăn|đói|nhà hàng/.test(norm(text)) ? "dining" : "housekeeping";
    return {
      type: "request",
      text: ai.reply,
      quicks: [{ label: "Xác nhận gửi", action: `confirm:${dept}` }],
      engine: "gemini",
      ai: meta,
    };
  }

  return {
    type: "answer",
    text: ai.reply,
    engine: "gemini",
    ai: { ...meta, part_of_day: partOfDay(ctx.now) },
    quicks: ai.intent === "recommend" ? recommendQuicks(ctx) : undefined,
  };
}

function recommendQuicks(ctx) {
  const g = ctx.guest || "family";
  if (g === "couple")
    return [
      { label: "Đặt spa đôi", action: "ask:đặt spa 18h" },
      { label: "Đặt bàn tối", action: "ask:đặt bàn 19h" },
      { label: "Gặp lễ tân", action: "human" },
    ];
  return [
    { label: "Buffet sáng", action: "ask:buffet sáng mấy giờ" },
    { label: "Hồ bơi", action: "ask:hồ bơi mấy giờ" },
    { label: "Đặt bàn tối", action: "ask:đặt bàn 19h" },
  ];
}

// --- HTTP server ---
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

function urlPathToFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p === "/") return path.join(ROOT, "web", "index.html");
  if (p === "/web") p = "/web/index.html";
  if (p.endsWith("/")) p += "index.html";
  return path.normalize(path.join(ROOT, p.replace(/^\//, "")));
}

function serveStatic(req, res) {
  const urlPath = req.url.split("?")[0];
  const file = urlPathToFile(req.url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("403"); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      return serveStaticFile(path.join(file, "index.html"), urlPath + "index.html", res);
    }
    serveStaticFile(file, urlPath, res);
  });
}

function serveStaticFile(file, displayPath, res) {
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("403"); }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); return res.end("404 " + displayPath); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "text/plain" });
    res.end(d);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        gemini: geminiEnabled(),
        model: getModel(),
        mode: geminiEnabled() ? "ai-first" : "fallback-rules",
      })
    );
    return;
  }
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const out = await handleChat(JSON.parse(body || "{}"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ type: "answer", text: "Lỗi server: " + e.message }));
      }
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  const mode = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("your-")
    ? `AI-first Gemini (${getModel()})` : "fallback-rules (chưa GEMINI_API_KEY)";
  console.log(`StayMate server: http://localhost:${PORT}/web/?qr=QR1208`);
  console.log(`Chat engine: ${mode}`);
});
