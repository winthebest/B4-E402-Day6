/*
 * StayMate concierge engine (rule-based, chạy được không cần backend).
 * Đọc data/ JSON, phân loại intent → trả về { type, text, card, sources, quicks }.
 * Hook cắm Gemini sau: thay hàm generateReply() bằng gọi API,
 * vẫn dùng findAmenity()/checkSlots()/isRisky() làm "tools".
 */
const Concierge = (() => {
  const DATA_BASE = "../data";
  let DB = {};

  async function load() {
    const files = {
      amenities: "amenities_resort.json",
      restaurants: "resort_restaurants.json",
      contact: "resort_contact.json",
      rooms: "rooms.json",
      slots: "slots.json",
      risky: "risky_intents.json",
      policies: "policies.json",
      departments: "departments.json",
    };
    const entries = await Promise.all(
      Object.entries(files).map(async ([key, file]) => {
        const res = await fetch(`${DATA_BASE}/${file}`);
        if (!res.ok) throw new Error(`Không tải được ${file} (${res.status})`);
        return [key, await res.json()];
      })
    );
    DB = Object.fromEntries(entries);
    return DB;
  }

  const norm = (s) =>
    (s || "").toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();

  function resolveRoom(qr) {
    const rooms = DB.rooms?.rooms || {};
    return rooms[qr] || rooms[`QR${qr}`] || null;
  }

  // --- Path 4: Correction / risky intent ---
  function isRisky(text) {
    const t = norm(text);
    const kws = DB.risky?.keywords_vi || [];
    return kws.find((k) => t.includes(norm(k))) || null;
  }

  function findAmenity(idOrText) {
    const list = DB.amenities?.amenities || [];
    const t = norm(idOrText);
    const map = [
      { id: "buffet_breakfast", kw: ["buffet", "ăn sáng", "bữa sáng"] },
      { id: "pool", kw: ["hồ bơi", "bể bơi", "bơi", "pool"] },
      { id: "private_beach", kw: ["bãi biển", "biển", "beach"] },
      { id: "shuttle_beach", kw: ["shuttle", "xe đưa", "xe buýt", "đưa đón"] },
      { id: "gym", kw: ["gym", "tập", "phòng tập", "fitness"] },
      { id: "spa_resort", kw: ["spa", "massage"] },
      { id: "kids_club", kw: ["kids", "trẻ em", "trẻ nhỏ"] },
      { id: "front_desk", kw: ["lễ tân", "tổng đài", "số điện thoại", "hotline", "gọi"] },
      { id: "late_checkout", kw: ["late", "trả phòng muộn", "checkout", "check-out", "check out"] },
    ];
    const hit = map.find((m) => m.kw.some((k) => t.includes(norm(k))));
    if (!hit) return null;
    return list.find((a) => a.id === hit.id) || null;
  }

  // --- Path 3: Failure (slot) ---
  function checkSlots(key, time) {
    const grp = DB.slots?.slots?.[key];
    if (!grp) return null;
    const status = time ? grp[time] : null;
    const alts = Object.entries(grp)
      .filter(([, v]) => v === "available")
      .map(([t]) => t);
    return { status, alts, requested: time };
  }

  function departmentFor(category) {
    const deps = DB.departments?.departments || {};
    for (const [, d] of Object.entries(deps)) {
      if ((d.handles || []).includes(category)) return d.label;
    }
    return "Lễ tân";
  }

  function amenityReply(a) {
    if (a.id === "front_desk") {
      return {
        type: "answer",
        text: `Lễ tân resort: ${a.phone}\nHotline Vinpearl: ${a.hotline}\nEmail: ${a.email}`,
        sources: [a.source],
      };
    }
    if (a.id === "late_checkout") {
      return {
        type: "answer",
        text: `Late check-out tuỳ tình trạng phòng trống và có thể phụ phí. Em gửi yêu cầu tới lễ tân để xác nhận giúp anh/chị nhé?`,
        quicks: [{ label: "Gửi lễ tân xác nhận", action: "escalate:late_checkout" }],
        sources: [],
      };
    }
    const hours =
      a.hours_display || (a.open && a.close ? `${a.open} – ${a.close}` : null);
    let text = `${a.name}`;
    if (hours) text += `: ${hours}`;
    if (a.frequency) text += ` (${a.frequency})`;
    if (!hours && a.note) text += `: ${a.note}`;
    else if (a.note && a.id !== "buffet_breakfast") text += `\n${a.note}`;
    if (a.data_status === "needs_verify")
      text += `\n(Giờ tham khảo — anh/chị có thể xác nhận thêm với lễ tân.)`;
    if (a.data_status === "missing")
      return {
        type: "answer",
        text: `Hiện em chưa có giờ chính thức của ${a.name.toLowerCase()}. Anh/chị gọi lễ tân ${DB.contact?.phone || ""} để được hỗ trợ nhanh nhé.`,
        sources: [],
      };
    return { type: "answer", text, sources: a.source ? [a.source] : [] };
  }

  /*
   * Bộ não chính. Trả về object để app.js render.
   * type: answer | card | escalate | clarify | request
   */
  function handle(text, ctx = {}) {
    const t = norm(text);

    // Path 4 — rủi ro: tiền/chính sách → escalate, KHÔNG tự xác nhận
    const risky = isRisky(text);
    if (risky) {
      const p =
        (DB.policies?.policies || []).find((x) =>
          ["refund_cancel", "payment_dispute", "out_of_scope"].includes(x.id)
        ) || {};
      return {
        type: "escalate",
        text: `Yêu cầu liên quan đến "${risky}" cần nhân viên xác nhận. Em không tự xử lý việc này để tránh sai sót về tiền/chính sách.\nEm đã tóm tắt và chuyển lễ tân giúp anh/chị.`,
        summary: text,
        quicks: [{ label: "Chuyển lễ tân", action: "human" }],
      };
    }

    // Luồng gợi ý (không backend → fallback rule, vẫn đổi theo loại khách)
    if (/gợi ý|đề xuất|nên làm|nên đi|chơi gì|làm gì|đi đâu|tư vấn|recommend/.test(t)) {
      const part = new Date().getHours() < 11 ? "buổi sáng" : new Date().getHours() < 17 ? "buổi chiều" : "buổi tối";
      const g = ctx.guest || "family";
      const texts = {
        couple: `Gợi ý cho anh/chị (${part}):\n1. Spa đôi thư giãn.\n2. Bữa tối The Beach Bistro view biển.\n3. Dạo bãi biển ngắm hoàng hôn.\nAnh/chị muốn em hỗ trợ mục nào ạ?`,
        family_with_kids: `Gợi ý cho gia đình có bé (${part}):\n1. Kids club cho bé.\n2. Hồ bơi khu nông cho trẻ.\n3. Buffet sáng 06:00–10:30.\nem hỗ trợ mục nào ạ?`,
        family: `Gợi ý cho gia đình (${part}):\n1. Buffet sáng 06:00–10:30.\n2. Hồ bơi & bãi biển riêng.\n3. Bữa tối nhà hàng resort.\nem hỗ trợ mục nào ạ?`,
      };
      return {
        type: "answer",
        text: texts[g] || texts.family,
        quicks:
          g === "couple"
            ? [
                { label: "Đặt spa đôi", action: "ask:đặt spa 18h" },
                { label: "Đặt bàn tối", action: "ask:đặt bàn 19h" },
              ]
            : [
                { label: "Buffet sáng", action: "ask:buffet sáng mấy giờ" },
                { label: "Đặt bàn tối", action: "ask:đặt bàn 19h" },
              ],
      };
    }

    // Đặt spa / bàn → kiểm tra slot (Path 3 nếu hết chỗ)
    const wantSpa = /spa|massage/.test(t);
    const wantDinner = /đặt bàn|nhà hàng|ăn tối|bữa tối|dinner/.test(t);
    const timeMatch = t.match(/(\d{1,2})[h:](\d{0,2})/);
    if ((wantSpa || wantDinner) && (timeMatch || /đặt/.test(t))) {
      const key = wantSpa ? "spa_resort_60" : "restaurant_dinner_resort";
      let time = null;
      if (timeMatch) {
        const hh = timeMatch[1].padStart(2, "0");
        const mm = (timeMatch[2] || "00").padStart(2, "0");
        time = `${hh}:${mm}`;
      }
      const slot = checkSlots(key, time);
      if (slot && time && slot.status === "full") {
        return {
          type: "escalate",
          variant: "slot",
          text: `Rất tiếc, khung ${time} đã kín. Em còn ${slot.alts.join(
            " hoặc "
          )} — anh/chị chọn giúp em nhé?`,
          quicks: [
            ...slot.alts.map((tt) => ({ label: `Chọn ${tt}`, action: `book:${key}:${tt}` })),
            { label: "Chuyển lễ tân", action: "human" },
          ],
        };
      }
      if (slot && time && slot.status === "available") {
        return {
          type: "request",
          text: `Em giữ chỗ ${wantSpa ? "spa" : "bàn"} lúc ${time} cho phòng ${
            ctx.room || "?"
          }. Anh/chị xác nhận để em gửi tới ${departmentFor(wantSpa ? "spa" : "dining")} nhé?`,
          quicks: [{ label: "Xác nhận", action: `confirm:${key}:${time}` }],
        };
      }
      // Đã nói giờ nhưng khung không có trong lịch (MOCK) → gợi ý slot trống, không hỏi lại "mấy giờ"
      if (slot && time && !slot.status && slot.alts.length) {
        return {
          type: "escalate",
          variant: "slot",
          text: `Em chưa có khung ${time} trống cho ${wantSpa ? "spa" : "bàn"}. Em còn ${slot.alts.join(
            " hoặc "
          )} — anh/chị chọn giúp em nhé?`,
          quicks: [
            ...slot.alts.map((tt) => ({ label: `Chọn ${tt}`, action: `book:${key}:${tt}` })),
            { label: "Chuyển lễ tân", action: "human" },
          ],
        };
      }
      // Chưa nói giờ → hỏi + gợi ý từ slots.json
      const pickQuicks = (slot?.alts || []).map((tt) => ({
        label: tt,
        action: `book:${key}:${tt}`,
      }));
      return {
        type: "clarify",
        text: `Anh/chị muốn đặt ${wantSpa ? "spa" : "bàn"} lúc mấy giờ ạ?`,
        quicks: pickQuicks.length ? pickQuicks : [{ label: "Chuyển lễ tân", action: "human" }],
      };
    }

    // Đồ ăn / nhà hàng (E03, E08 — gom về một hội thoại)
    if (/gọi món|phục vụ phòng|room service|mang lên phòng|đồ ăn.*phòng/.test(t)) {
      return {
        type: "request",
        text: `Em ghi nhận yêu cầu đồ ăn/phục vụ phòng cho phòng ${ctx.room || "?"}. Anh/chị ghi rõ món (hoặc bấm xác nhận) để em chuyển ${departmentFor("dining")} nhé?`,
        quicks: [
          { label: "Xác nhận gửi", action: "confirm:dining" },
          { label: "Đặt bàn nhà hàng", action: "ask:đặt bàn 19h" },
        ],
      };
    }
    if (/đồ ăn|ăn gì|muốn ăn|cho.*ăn|đói|đặt món|thức ăn|món ăn|nhà hàng|ăn uống|buffet/.test(t)) {
      const list = (DB.restaurants?.restaurants || []).slice(0, 4);
      const lines = list.map((r) => `• ${r.name}: ${r.hours || "liên hệ lễ tân"}`).join("\n");
      return {
        type: "answer",
        text: `Resort có các nhà hàng sau:\n${lines}\n\nAnh/chị muốn đặt bàn tối, hỏi buffet sáng, hay gọi món lên phòng ạ?`,
        sources: DB.restaurants?.source ? [DB.restaurants.source] : [],
        quicks: [
          { label: "Đặt bàn tối", action: "ask:đặt bàn 19h" },
          { label: "Buffet sáng", action: "ask:buffet sáng mấy giờ" },
          { label: "Gọi món phòng", action: "ask:gọi món phục vụ phòng" },
        ],
      };
    }

    // Yêu cầu amenity đơn giản (khăn/nước) → housekeeping (Path Happy/request)
    if (/khăn|nước|gối|dọn phòng|amenity/.test(t)) {
      return {
        type: "request",
        text: `Em ghi nhận yêu cầu: "${text}". Gửi tới ${departmentFor(
          "towel"
        )} cho phòng ${ctx.room || "?"} nhé?`,
        quicks: [{ label: "Xác nhận gửi", action: "confirm:housekeeping" }],
      };
    }

    // FAQ tiện ích (Path Happy)
    const a = findAmenity(text);
    if (a) return amenityReply(a);

    // Path 2 — Low-confidence
    return {
      type: "clarify",
      text: `Để em hỗ trợ đúng, anh/chị đang cần việc nào ạ?`,
      quicks: [
        { label: "Hỏi tiện ích", action: "menu:amenity" },
        { label: "Đặt dịch vụ", action: "menu:service" },
        { label: "Gặp lễ tân", action: "human" },
      ],
    };
  }

  return { load, resolveRoom, handle, isRisky, findAmenity, checkSlots, get DB() { return DB; } };
})();
