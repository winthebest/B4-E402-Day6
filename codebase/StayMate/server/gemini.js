/*
 * Gemini integration cho StayMate.
 * - buildSystemPrompt(): ghép policies + risky_intents + dữ liệu resort thành context grounding.
 * - callGemini(): gọi REST API (không cần SDK), trả về text.
 * Lưu ý an toàn: guardrail intent rủi ro xử lý ở server.js TRƯỚC khi gọi hàm này,
 * nên Gemini chỉ lo phần FAQ / hội thoại tự nhiên trên dữ liệu có thật.
 */
// Đọc model lúc gọi (sau khi .env đã nạp), tránh chốt giá trị lúc require.
const getModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${key}`;

function buildSystemPrompt(db, ctx) {
  const amenities = (db.amenities.amenities || [])
    .map((a) => {
      const hours = a.hours_display || (a.open && a.close ? `${a.open}-${a.close}` : "chưa có giờ");
      const extra = [a.location, a.frequency, a.phone, a.note].filter(Boolean).join(" | ");
      return `- ${a.name} (${a.id}): ${hours}${extra ? " — " + extra : ""} [${a.data_status}]`;
    })
    .join("\n");

  const restaurants = (db.restaurants.restaurants || [])
    .map((r) => `- ${r.name}: ${r.hours || "?"}`)
    .join("\n");

  const policies = (db.policies.policies || [])
    .map(
      (p) =>
        `- ${p.title}: ĐƯỢC[${(p.ai_can || []).join(", ")}] KHÔNG[${(p.ai_cannot || []).join(
          ", "
        )}]${p.escalate ? " → escalate lễ tân" : ""}`
    )
    .join("\n");

  const riskyKw = (db.risky.keywords_vi || []).join(", ");
  const contact = db.contact || {};

  return `Bạn là StayMate AI — trợ lý concierge TRONG PHÒNG của ${db.amenities.venue_id} (Vinpearl Resort & Spa Phú Quốc).
Khách đang ở phòng ${ctx.room || "?"} (loại khách: ${ctx.guest || "?"}), thời điểm hiện tại: ${ctx.now}.

NGUYÊN TẮC:
- Trả lời NGẮN GỌN, lịch sự, xưng "em" gọi khách "anh/chị", bằng tiếng Việt.
- CHỈ dùng dữ liệu dưới đây. KHÔNG bịa giờ giấc, giá cả. Nếu data_status là "missing" hoặc không có, nói chưa có thông tin và mời gọi lễ tân (${contact.phone || ""}).
- Nếu giờ ở trạng thái "needs_verify", trả lời kèm "giờ tham khảo, anh/chị xác nhận thêm với lễ tân".
- TUYỆT ĐỐI không tự xác nhận đổi/hủy phòng, hoàn tiền, thanh toán, khiếu nại (từ khóa: ${riskyKw}). Những việc này phải chuyển lễ tân.
- Với yêu cầu dịch vụ đơn giản (khăn, nước, đặt bàn, spa): tóm tắt yêu cầu và mời khách xác nhận, không tự ý hoàn tất.

TIỆN ÍCH RESORT:
${amenities}

NHÀ HÀNG:
${restaurants}

LIÊN HỆ LỄ TÂN: ${contact.phone || ""} | hotline ${contact.hotline_vinpearl || ""} | ${contact.email || ""}

CHÍNH SÁCH AI:
${policies}

KHI CÓ [Dữ liệu hệ thống]: dùng làm sự thật, ưu tiên hơn suy đoán. Slot "full" → gợi ý giờ trong "còn trống".`;
}

/**
 * Prompt cho LUỒNG AI GỢI Ý (recommendation).
 * Model thật sự xử lý: dựa loại khách + giờ hiện tại + tiện ích/nhà hàng có thật
 * để tạo gợi ý KHÁC NHAU theo tình huống (family/couple, sáng/tối...).
 */
function buildRecommendPrompt(db, ctx) {
  const amenities = (db.amenities.amenities || [])
    .map((a) => {
      const hours = a.hours_display || (a.open && a.close ? `${a.open}-${a.close}` : "chưa có giờ");
      return `- ${a.name}: ${hours} [${a.data_status}]`;
    })
    .join("\n");
  const restaurants = (db.restaurants.restaurants || [])
    .map((r) => `- ${r.name}: ${r.hours || "?"}`)
    .join("\n");
  const contact = db.contact || {};

  return `Bạn là StayMate AI — concierge trong phòng của Vinpearl Resort & Spa Phú Quốc.
NHIỆM VỤ: Gợi ý hoạt động/dịch vụ phù hợp NHẤT cho khách, CÁ NHÂN HOÁ theo:
- Loại khách: ${ctx.guest || "?"} (family = gia đình; couple = cặp đôi; family_with_kids = có trẻ nhỏ)
- Thời điểm hiện tại: ${ctx.now} (chọn hoạt động hợp khung giờ: sáng/chiều/tối)
- Phòng: ${ctx.room || "?"}

QUY TẮC:
- Đưa 2–3 gợi ý NGẮN, đánh số, mỗi gợi ý kèm lý do hợp với loại khách + giờ.
- CHỈ dùng tiện ích/nhà hàng có thật bên dưới, kèm giờ. KHÔNG bịa giờ/giá.
- couple → ưu tiên spa, bữa tối lãng mạn, ngắm hoàng hôn. family_with_kids → kids club, hồ bơi, buffet. family → cân bằng.
- Nếu hoạt động ngoài giờ mở cửa hiện tại, nói rõ "khung giờ phù hợp là ...".
- Cuối câu mời khách chọn để em hỗ trợ đặt. Xưng "em", gọi "anh/chị". Tiếng Việt, lịch sự, ngắn gọn.

TIỆN ÍCH:
${amenities}

NHÀ HÀNG:
${restaurants}

LIÊN HỆ LỄ TÂN: ${contact.phone || ""}`;
}

/**
 * Bộ não AI (hackathon CP2+): Gemini tự hiểu ý → JSON intent + reply.
 * Server chỉ hậu kiểm: tiền/chính sách + slots.json.
 */
function buildBrainPrompt(db, ctx) {
  const amenities = (db.amenities.amenities || [])
    .map((a) => {
      const h = a.hours_display || (a.open && a.close ? `${a.open}-${a.close}` : "chưa có giờ");
      return `- ${a.name} (${a.id}): ${h} [${a.data_status}]`;
    })
    .join("\n");
  const restaurants = (db.restaurants.restaurants || [])
    .map((r) => `- ${r.name}: ${r.hours || "?"}`)
    .join("\n");
  const slots = Object.entries(db.slots.slots || {})
    .map(([k, v]) => `- ${k}: ${Object.entries(v).map(([t, s]) => `${t}=${s}`).join(", ")}`)
    .join("\n");
  const riskyKw = (db.risky.keywords_vi || []).join(", ");
  const c = db.contact || {};
  return `Bạn là StayMate AI — concierge trong phòng Vinpearl Resort & Spa Phú Quốc.
Phòng ${ctx.room || "?"}, loại khách: ${ctx.guest || "?"}, lúc: ${ctx.now}.

TỰ hiểu ý khách. Trả JSON đúng schema, KHÔNG thêm chữ ngoài JSON.

intent: faq | recommend | book_spa | book_dining | room_service | risky | other
- risky: hoàn tiền, đổi/hủy, thanh toán, khiếu nại (${riskyKw}) → escalate=true
- book_*: điền time=HH:MM nếu khách nói giờ; chưa có thì ""
- reply: tiếng Việt, ngắn, xưng em, CHỈ dùng data dưới, không bịa giờ/giá

TIỆN ÍCH:\n${amenities}
NHÀ HÀNG:\n${restaurants}
SLOT (server kiểm tra lại):\n${slots}
LỄ TÂN: ${c.phone || ""}`;
}

const BRAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: {
      type: "STRING",
      enum: ["faq", "recommend", "book_spa", "book_dining", "room_service", "risky", "other"],
    },
    reply: { type: "STRING" },
    time: { type: "STRING" },
    escalate: { type: "BOOLEAN" },
  },
  required: ["intent", "reply", "escalate"],
};

async function callGeminiBrain(apiKey, db, ctx, history, userText) {
  const contents = [];
  for (const m of history || []) {
    contents.push({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text }] });
  }
  contents.push({ role: "user", parts: [{ text: userText }] });
  const body = {
    systemInstruction: { parts: [{ text: buildBrainPrompt(db, ctx) }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: BRAIN_SCHEMA,
    },
  };
  const res = await fetch(ENDPOINT(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const raw = (await res.json())?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  let p;
  try {
    p = JSON.parse(raw);
  } catch (_) {
    p = { intent: "other", reply: raw.trim() || "Em chưa rõ ý anh/chị ạ.", escalate: false };
  }
  return {
    intent: p.intent || "other",
    reply: (p.reply || "").trim() || "Em chưa rõ ý anh/chị, anh/chị nói lại giúp em nhé?",
    time: p.time || "",
    escalate: !!p.escalate,
  };
}

/** Ghép câu khách + kết quả tool (slot, tiện ích) trước khi gọi model */
function buildAugmentedUserMessage(userText, toolContext) {
  if (!toolContext) return userText;
  return `[Dữ liệu hệ thống — dùng để trả lời, không bịa thêm]\n${toolContext}\n\n[Câu khách]\n${userText}`;
}

async function callGemini(apiKey, systemPrompt, history, userText, toolContext) {
  const finalUser = buildAugmentedUserMessage(userText, toolContext);
  const contents = [];
  for (const m of history || []) {
    contents.push({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text }] });
  }
  contents.push({ role: "user", parts: [{ text: finalUser }] });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800,
      // Tắt "thinking" của Gemini 2.5 flash để token dành cho câu trả lời (tránh bị cắt)
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(ENDPOINT(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text.trim() || "Em chưa rõ ý anh/chị, anh/chị nói lại giúp em nhé?";
}

module.exports = {
  buildSystemPrompt,
  buildRecommendPrompt,
  buildBrainPrompt,
  callGeminiBrain,
  buildAugmentedUserMessage,
  callGemini,
  getModel,
};
