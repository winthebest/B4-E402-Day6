/* StayMate UI controller — render chat, quick replies, gọi Concierge engine. */
(() => {
  const chat = document.getElementById("chat");
  const quickbar = document.getElementById("quickbar");
  const form = document.getElementById("composer");
  const input = document.getElementById("input");
  const roomLabel = document.getElementById("roomLabel");
  const aiChip = document.getElementById("aiChip");

  const ctx = { qr: null, room: null, guest: null };
  const history = []; // {role:'user'|'bot', text} cho context Gemini
  let backendOK = true; // có /api/chat hay không (tự dò)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const scroll = () => (chat.scrollTop = chat.scrollHeight);

  function bubble(text, cls = "bot") {
    const div = document.createElement("div");
    div.className = `msg ${cls}`;
    div.textContent = text;
    chat.appendChild(div);
    scroll();
    return div;
  }

  function withSources(div, sources) {
    const clean = (sources || []).filter(Boolean);
    if (!clean.length) return;
    const s = document.createElement("span");
    s.className = "src";
    s.textContent = "Nguồn: " + clean[0].replace(/^https?:\/\//, "").slice(0, 48) + "…";
    div.appendChild(s);
  }

  function withEngine(div, engine) {
    if (!engine || engine === "concierge" || engine === "fallback") return;
    const e = document.createElement("span");
    e.className = "engine" + (engine === "gemini" ? " gemini" : "");
    const labels = { gemini: "✨ Gemini AI", guardrail: "Rule backup" };
    e.textContent = labels[engine] || engine;
    div.appendChild(e);
  }

  async function refreshAiStatus() {
    if (!aiChip) return;
    try {
      const r = await fetch("/api/status");
      if (!r.ok) throw new Error();
      const s = await r.json();
      aiChip.textContent = s.gemini ? `AI ${s.model}` : "AI tắt";
      aiChip.className = "ai-chip " + (s.gemini ? "on" : "off");
      backendOK = true;
    } catch (_) {
      aiChip.textContent = "AI offline";
      aiChip.className = "ai-chip off";
      backendOK = false;
    }
  }

  async function typing() {
    const t = document.createElement("div");
    t.className = "typing";
    t.innerHTML = "<i></i><i></i><i></i>";
    chat.appendChild(t);
    scroll();
    await sleep(420);
    t.remove();
    scroll(); // scroll lại sau khi bỏ typing bubble
  }

  function setQuicks(quicks) {
    quickbar.innerHTML = "";
    (quicks || []).forEach((q) => {
      const b = document.createElement("button");
      b.className = "chip" + (/human|escalate/.test(q.action) ? " warn" : "");
      b.textContent = q.label;
      b.onclick = () => handleAction(q.action, q.label);
      quickbar.appendChild(b);
    });
  }

  const DEFAULT_QUICKS = [
    { label: "✨ Gợi ý cho tôi", action: "ask:gợi ý cho tôi nên làm gì bây giờ" },
    { label: "Giờ buffet sáng", action: "ask:buffet sáng mấy giờ" },
    { label: "Hồ bơi", action: "ask:hồ bơi mấy giờ" },
    { label: "Xin thêm khăn/nước", action: "ask:cho xin thêm khăn và nước" },
    { label: "Đặt spa tối nay", action: "ask:đặt spa 18h" },
    { label: "Gặp lễ tân", action: "human" },
  ];

  async function botRespond(res) {
    await typing();
    const cls = res.type === "escalate" ? "escalate" : "bot";
    const div = bubble(res.text, cls);
    withSources(div, res.sources);
    withEngine(div, res.engine);
    if (res.summary) {
      const s = bubble(`Tóm tắt gửi lễ tân: "${res.summary}" — phòng ${ctx.room}`, "system");
      void s;
    }

    const rawQuicks = res.quicks && res.quicks.length ? res.quicks : DEFAULT_QUICKS;

    // Chặn mọi nút confirm khi intent là book_dining và chưa có nhà hàng cụ thể.
    // Backend (Gemini hoặc rule) có thể trả confirm:dining hoặc nút "Xác nhận" — đều bị chặn.
    const isDiningPending = res.intent === "book_dining" && !res.restaurant;
    const safeQuicks = rawQuicks.map((q) => {
      const isConfirmLike =
        q.action === "confirm:dining" ||
        (isDiningPending && /^confirm:/.test(q.action)) ||
        (isDiningPending && /xác nhận/i.test(q.label));
      return isConfirmLike ? { label: "Chọn nhà hàng", action: "pick:dining" } : q;
    });

    setQuicks(safeQuicks);
  }

  function userSays(text) {
    bubble(text, "user");
  }

  async function askBackend(text) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        room: ctx.room,
        guest: ctx.guest,
        history: history.slice(-6),
      }),
    });
    if (!res.ok) throw new Error("no backend");
    return res.json();
  }

  async function ask(text) {
    userSays(text);
    history.push({ role: "user", text });
    let res;
    if (backendOK) {
      try {
        res = await askBackend(text);
      } catch (_) {
        backendOK = false;
      }
    }
    if (!res) {
      res = Concierge.handle(text, ctx);
      res.engine = res.engine || "concierge";
    }
    await botRespond(res);
    history.push({ role: "bot", text: res.text });
  }

  async function handleAction(action, label) {
    if (action.startsWith("ask:")) return ask(action.slice(4));

    if (action === "human") {
      userSays(label || "Gặp lễ tân");
      await typing();
      bubble(
        `Em đã chuyển yêu cầu của phòng ${ctx.room} tới lễ tân. Nhân viên sẽ liên hệ ngay ạ.`,
        "escalate"
      );
      setQuicks(DEFAULT_QUICKS);
      return;
    }

    if (action === "menu:amenity") {
      await botRespond({
        type: "clarify",
        text: "Anh/chị muốn hỏi tiện ích nào?",
        quicks: [
          { label: "Buffet sáng", action: "ask:buffet sáng mấy giờ" },
          { label: "Hồ bơi", action: "ask:hồ bơi mấy giờ" },
          { label: "Shuttle", action: "ask:shuttle mấy giờ" },
          { label: "Spa", action: "ask:spa mở mấy giờ" },
        ],
      });
      return;
    }

    if (action === "menu:service") {
      await botRespond({
        type: "clarify",
        text: "Anh/chị cần dịch vụ nào?",
        quicks: [
          { label: "Thêm khăn/nước", action: "ask:cho xin thêm khăn và nước" },
          { label: "Đặt bàn tối", action: "ask:đặt bàn 18h" },
          { label: "Đặt spa", action: "ask:đặt spa 18h" },
        ],
      });
      return;
    }

    if (action.startsWith("book:")) {
      const [, key, hh, mm] = action.split(":");
      const time = mm !== undefined ? `${hh}:${mm}` : hh;
      userSays(`Chọn ${time}`);
      const slot = Concierge.checkSlots(key, time);
      if (slot && slot.status === "full") {
        await botRespond({
          type: "escalate",
          variant: "slot",
          text: `Khung ${time} cũng vừa kín mất rồi. Em còn ${slot.alts.join(" / ")} ạ.`,
          quicks: slot.alts.map((tt) => ({ label: `Chọn ${tt}`, action: `book:${key}:${tt}` })),
        });
        return;
      }
      await typing();
      bubble(`Đã giữ chỗ lúc ${time} cho phòng ${ctx.room}. Em gửi xác nhận tới bộ phận liên quan nhé!`, "bot");
      setQuicks(DEFAULT_QUICKS);
      return;
    }

    // pick:dining hoặc confirm:dining (không có nhà hàng) → hỏi chọn nhà hàng
    if (action === "pick:dining" || action === "confirm:dining") {
      const restaurants = (Concierge.DB.restaurants?.restaurants || []).slice(0, 5);
      const quicks = restaurants.length
        ? restaurants.map((r) => ({ label: r.name, action: `confirm:dining:${r.name}` }))
        : [{ label: "Để lễ tân tư vấn", action: "human" }];
      await botRespond({
        type: "clarify",
        text: "Anh/chị muốn đặt bàn tại nhà hàng nào ạ?",
        quicks: [...quicks, { label: "Để lễ tân tư vấn", action: "human" }],
      });
      return;
    }

    if (action.startsWith("confirm:")) {
      const confirmKey = action.slice("confirm:".length);

      // confirm:dining:<tên> — đã chọn nhà hàng cụ thể
      if (confirmKey.startsWith("dining:")) {
        const restaurant = confirmKey.slice("dining:".length);
        userSays(`Chọn ${restaurant}`);
        await typing();
        bubble(`Đã ghi nhận đặt bàn tại ${restaurant} cho phòng ${ctx.room}. Bộ phận sẽ xác nhận lại với anh/chị trong ít phút ạ.`, "bot");
        setQuicks(DEFAULT_QUICKS);
        return;
      }

      // Các confirm khác (housekeeping, spa...)
      userSays("Xác nhận");
      await typing();
      bubble(`Đã gửi yêu cầu cho phòng ${ctx.room}. Bộ phận sẽ xử lý trong ít phút ạ.`, "bot");
      setQuicks(DEFAULT_QUICKS);
      return;
    }

    if (action.startsWith("escalate:")) {
      userSays(label || "Gửi lễ tân");
      await typing();
      bubble(`Em đã chuyển yêu cầu tới lễ tân để xác nhận. Cảm ơn anh/chị!`, "escalate");
      setQuicks(DEFAULT_QUICKS);
      return;
    }
  }

  function greet() {
    const hour = new Date().getHours();
    const part = hour < 11 ? "buổi sáng" : hour < 18 ? "buổi chiều" : "buổi tối";
    const g = ctx.guest || "family";

    const guestGreet = {
      couple:
        `Chào anh/chị phòng ${ctx.room || "quý khách"}! 🌺 Chúc anh/chị ${part} thật dễ chịu tại Vinpearl Phú Quốc. Em là StayMate — concierge riêng của phòng mình. Anh/chị cần em hỗ trợ gì không ạ?`,
      family_with_kids:
        `Xin chào gia đình phòng ${ctx.room || "quý khách"}! 👋 Chúc cả nhà ${part} vui vẻ nhé. Em là StayMate, luôn sẵn sàng hỗ trợ từ hỏi tiện ích đến đặt dịch vụ cho cả nhà ạ!`,
      family:
        `Chào gia đình phòng ${ctx.room || "quý khách"}! 👋 Chúc anh/chị ${part} thoải mái. Em là StayMate — anh/chị cần hỏi gì về resort hay đặt dịch vụ cứ nhắn em nhé!`,
    };

    bubble(
      guestGreet[g] ||
      `Chào phòng ${ctx.room || "quý khách"}! 👋 Chúc anh/chị ${part} vui vẻ. Em là StayMate — trợ lý concierge của phòng mình. Em có thể giúp gì cho anh/chị ạ?`,
      "bot"
    );
    setQuicks(DEFAULT_QUICKS);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    ask(v);
  });

  async function init() {
    try {
      await Concierge.load();
    } catch (err) {
      bubble("Không tải được dữ liệu. Hãy chạy qua static server (xem README) thay vì mở file trực tiếp.", "system");
      bubble(String(err.message || err), "system");
      return;
    }

    const params = new URLSearchParams(location.search);
    ctx.qr = params.get("qr") || "QR1208";
    const room = Concierge.resolveRoom(ctx.qr);
    if (room) {
      ctx.room = room.room;
      ctx.guest = room.guest_type;
      roomLabel.textContent = `Phòng ${room.room}`;
    } else {
      roomLabel.textContent = "QR lỗi";
      bubble("Mã QR không gắn được số phòng. Anh/chị cho em biết đang cần việc gì ạ?", "system");
    }
    await refreshAiStatus();
    greet();
    if (aiChip && aiChip.classList.contains("off")) {
      bubble(
        "⚠️ Demo hackathon cần Gemini: node server/server.js + GEMINI_API_KEY trong .env. Hiện chạy rule backup.",
        "system"
      );
    }
  }

  init();
})();