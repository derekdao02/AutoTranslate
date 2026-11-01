(function () {
    'use strict';

    /* =====================================================================
     * TBRAIN AUTO-FILL & AUTO-FETCH – MASTER SCRIPT
     * AI provider: Groq (openai/gpt-oss-120b)
     * ===================================================================== */


    /* =====================================================================
     * CODE PATH: 01 - GLOBAL CONFIG
     * Nội dung:
     * - Groq AI config
     * - Tbrain API / Auto fetch config
     * - L3 CDN
     * - localStorage keys
     * - Control button IDs
     * ===================================================================== */


    // ---------- AI (Groq) ----------
    // Không hard-code key khi upload CDN. Nhập key qua nút "🔑 Key" trên topbar.
    const GROQ_API_KEY = "";
    const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const GROQ_MODELS = [
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'openai/gpt-oss-safeguard-20b'
    ];

    const GROQ_MAX_RETRIES_PER_MODEL = 3;

    const GROQ_MODEL_OPTIONS = {
        'qwen/qwen3.8-27b': { temperature: 0.6, top_p: 0.95, max_completion_tokens: 2048, reasoning_effort: 'default' },
        'openai/gpt-oss-120b': { temperature: 1, top_p: 1, max_completion_tokens: 2048, reasoning_effort: 'medium' },
        'openai/gpt-oss-20b': { temperature: 1, top_p: 1, max_completion_tokens: 2048, reasoning_effort: 'medium' },
        'openai/gpt-oss-safeguard-20b': { temperature: 1, top_p: 1, max_completion_tokens: 2048, reasoning_effort: 'medium' }
    };

    const AI_RETRY_DELAY_MS = 2000;

    // ---------- Tbrain API ----------
    const PROJECT_ID = "cfbe006a-9012-41bc-ba3c-afa8a3338139";
    const API_BASE = "https://api.tbrain.ai";
    const API_URL = `${API_BASE}/api/v1/tasks/pool?projectId=${PROJECT_ID}&page=1&pageSize=20`;
    const STATS_API_URL = `${API_BASE}/api/v1/tasks/my-stats?projectId=${PROJECT_ID}`;
    const EXTRA_HOURS_API_URL = `${API_BASE}/api/v1/my/extra-hours?projectId=${PROJECT_ID}`;
    const CLICK_URL = "https://beacon.tbrain.ai";

    // ---------- Auto fetch ----------
    let POLL_INTERVAL = 2000;
    let MIN_DURATION_SECONDS = 7200;
    const TOKEN_RETRY_INTERVAL = 60000;
    const REQUEST_TIMEOUT = 5000;
    const AUTO_ACQUIRE = true;
    const PERF_LOG = true;
    const MIN_SAFE_POLL_INTERVAL = 2500;
    const RATE_LIMIT_FALLBACK_WAIT = 5000;
    const RATE_LIMIT_SAFETY_MS = 1000;

    // ---------- L3 ----------
    const L3_CDN_URL = 'https://cdn.jsdelivr.net/gh/derekdao02/AutoTranslate@master/l3.json';
    let GLOBAL_L3_LIST = []; // Danh sách L3 sau khi tải từ CDN

    // ---------- localStorage keys ----------
    const STORAGE_KEYS = {
        active: 'tb_fetch_active_state',
        poll: 'tb_poll_interval_val',
        duration: 'tb_min_duration_val',
        apiKey: 'tb_groq_api_key_custom'
    };

    // ---------- Nút cần khóa/mở khi đang chạy ----------
    const CONTROL_BUTTON_IDS = [
        'tb-inject-fill',       // Fill 1
        'tb-inject-loop',       // Fill All
        'tb-inject-single-l3',  // Fill L3
        'tb-inject-l3-loop'     // Fill L3 All
    ];
    // ---------- Bảng màu nút ----------
    const TB_COLORS = {
        fillOne: '#4f46e5',
        fillAll: '#4338ca',
        copy: '#6366f1',
        paste: '#0ea5e9',
        fillL3: '#059669',
        loading: '#d97706',
        done: '#10b981',
        error: '#b91c1c',
        stop: '#dc2626',
        key: '#64748b',
        rework: '#d97706',
        takeOn: '#2563eb',
        takeOnArrow: '#4d6fd5',
        takeOff: '#b91c1c'
    };
    // ---------- Bộ icon SVG (cùng phong cách, dùng currentColor) ----------
    const svgIcon = (paths) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" ` +
        `fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" ` +
        `stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;display:block">${paths}</svg>`;
    const TB_ICONS = {
        error: svgIcon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
        retry: svgIcon('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
        done: svgIcon('<path d="M20 6 9 17l-5-5"/>'),
        loading: svgIcon('<path d="M21 12a9 9 0 1 1-6.2-8.6"/>'),
        stop: svgIcon('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
        ai: svgIcon('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V3"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>'),
        write: svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
        fillOne: svgIcon('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
        fillAll: svgIcon('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>'),
        copy: svgIcon('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
        paste: svgIcon('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
        fillL3: svgIcon('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
        rework: svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
        key: svgIcon('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'),
        power: svgIcon('<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>'),
        chevronRight: svgIcon('<path d="m9 18 6-6-6-6"/>'),
        chevronLeft: svgIcon('<path d="m15 18-6-6 6-6"/>')
    };
    // Gán icon + text cho nút (spin = icon xoay khi đang chạy)
    function setBtn(btn, icon, text, color = null, spin = false) {
        if (!btn) return;
        btn.innerHTML = `${TB_ICONS[icon]}<span class="tb-txt">${text}</span>`;
        btn.classList.toggle('tb-spin', spin);
        if (color) btn.style.backgroundColor = color;
    }
    /* =====================================================================
     * CODE PATH: 02 - L3 DATA
     * Nội dung:
     * - Tải danh sách L3 từ CDN vào GLOBAL_L3_LIST
     * ===================================================================== */

    async function loadL3Data() {
        try {
            const res = await fetch(L3_CDN_URL);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Hỗ trợ cả định dạng mảng object [{"name": "Kitchen"}, ...] hoặc mảng string ["Kitchen", ...]
                    GLOBAL_L3_LIST = data.map(item => typeof item === 'string' ? item : item.name).filter(Boolean);
                    console.log(`✅ Đã tải thành công ${GLOBAL_L3_LIST.length} mục L3 từ CDN!`);
                }
            }
        } catch (err) {
            console.error("❌ Không thể tải danh sách L3 từ CDN:", err);
        }
    }
    loadL3Data();


    /* =====================================================================
     * CODE PATH: 03 - VIDEO SPEED 10X
     * Nội dung:
     * - Inject nút 10x
     * - Giữ Ctrl + Shift > 500ms để tua 10x
     * - Khôi phục tốc độ cũ khi thả phím / mất focus
     * ===================================================================== */

    let pressTimer = null;
    let isHolding = false;
    let isFastForwardActive = false;
    let previousRates = new Map();
    let lastActiveBtn = null; // Nút tốc độ đang active trước khi tua 10x

    // 1. Hàm inject nút 10x vào DOM nếu chưa có
    function inject10xButton() {
        const ratesContainer = document.querySelector('[data-testid="transport-rates"]');
        if (ratesContainer && !document.getElementById('tb-transport-rate-10')) {
            const btn10x = document.createElement('button');
            btn10x.id = 'tb-transport-rate-10';
            btn10x.type = 'button';
            btn10x.disabled = true; // Mặc định disable
            btn10x.className = 'flex h-9 items-center justify-center rounded border border-tb-border text-fg-2 hover:bg-hover opacity-40 w-auto px-2 font-mono text-xs transition-all';
            btn10x.title = 'Hold Ctrl+Shift (>500ms) — play at 10x';
            btn10x.setAttribute('data-testid', 'transport-rate-10');
            btn10x.setAttribute('aria-pressed', 'false');
            btn10x.textContent = '10x';

            ratesContainer.appendChild(btn10x);
        }
    }

    // 2. Kích hoạt chế độ 10x trên UI và Video
    function activate10x() {
        const btn10x = document.getElementById('tb-transport-rate-10');
        const ratesContainer = document.querySelector('[data-testid="transport-rates"]');

        if (ratesContainer) {
            // Tìm và lưu nút đang active hiện tại (có aria-pressed="true")
            lastActiveBtn = ratesContainer.querySelector('[aria-pressed="true"]');
            if (lastActiveBtn) {
                lastActiveBtn.setAttribute('aria-pressed', 'false');
                lastActiveBtn.className = 'flex h-9 items-center justify-center rounded border border-tb-border text-fg-2 hover:bg-hover disabled:opacity-40 w-auto px-2 font-mono text-xs';
            }
        }

        // Highlight sáng nút 10x
        if (btn10x) {
            btn10x.disabled = false;
            btn10x.setAttribute('aria-pressed', 'true');
            btn10x.className = 'flex h-9 items-center justify-center rounded border hover:bg-hover w-auto px-2 font-mono text-xs border-brand-blue bg-brand-blue/15 font-semibold text-fg underline underline-offset-2 opacity-100';
        }

        // Tăng tốc độ toàn bộ video lên 10x
        document.querySelectorAll('video').forEach(v => {
            // Lưu lại tốc độ hiện tại trước khi tua nhanh
            if (!previousRates.has(v)) {
                previousRates.set(v, v.playbackRate);
            }
            v.playbackRate = 10;
            v.play().catch(err => console.log('Play error:', err.message));
        });
    }

    // 3. Tắt chế độ 10x, trả về tốc độ và nút UI cũ
    function deactivate10x() {
        const btn10x = document.getElementById('tb-transport-rate-10');

        // Reset nút 10x về dạng disable
        if (btn10x) {
            btn10x.disabled = true;
            btn10x.setAttribute('aria-pressed', 'false');
            btn10x.className = 'flex h-9 items-center justify-center rounded border border-tb-border text-fg-2 hover:bg-hover opacity-40 w-auto px-2 font-mono text-xs transition-all';
        }

        // Trả lại tốc độ cũ cho từng video từ Map previousRates
        document.querySelectorAll('video').forEach(v => {
            if (previousRates.has(v)) {
                v.playbackRate = previousRates.get(v);
                previousRates.delete(v);
            } else {
                v.playbackRate = 1; // Mặc định nếu không tìm thấy
            }
        });

        // Khôi phục nút cũ active trên UI nếu có
        if (lastActiveBtn) {
            lastActiveBtn.setAttribute('aria-pressed', 'true');
            lastActiveBtn.className = 'flex h-9 items-center justify-center rounded border hover:bg-hover disabled:opacity-40 w-auto px-2 font-mono text-xs border-brand-blue bg-brand-blue/15 font-semibold text-fg underline underline-offset-2';

            // Trigger click lại nút cũ để player giao diện web tự đồng bộ lại tốc độ gốc
            lastActiveBtn.click();
        }

        lastActiveBtn = null;
    }

    // 4. Lắng nghe phím Ctrl + Shift
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && !isHolding) {
            isHolding = true;

            pressTimer = setTimeout(() => {
                if (isHolding && !isFastForwardActive) {
                    isFastForwardActive = true;
                    activate10x();
                }
            }, 500); // Ngưỡng giữ 500ms
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Shift' || !e.ctrlKey || !e.shiftKey) {
            isHolding = false;
            clearTimeout(pressTimer);

            if (isFastForwardActive) {
                isFastForwardActive = false;
                deactivate10x();
            }
        }
    });

    // Phòng trường hợp chuyển tab hoặc mất focus
    window.addEventListener('blur', () => {
        if (isFastForwardActive) {
            isHolding = false;
            isFastForwardActive = false;
            clearTimeout(pressTimer);
            deactivate10x();
        }
    });

    // Liên tục kiểm tra để inject nút 10x khi giao diện video load
    // Optimized: UI injection is coordinated by the shared DOM observer below.
    // setInterval(inject10xButton, 500);


    /* =====================================================================
     * CODE PATH: 04 - AI PROMPTS
     * Nội dung:
     * - Prompt single / batch
     * - Rules: desc, act, skill group, difficulty
     * - Input builders
     * ===================================================================== */

    // 1. Task Definition & Output Format Definition
    const promptSystem = `Translate the Vietnamese action description into English and classify it.
Return ONLY one valid JSON object with exactly these 4 fields:`;

    const promptSystemBatch = `Translate and classify each Vietnamese action description in the list.
Return ONLY a valid JSON array with one object per input, in the exact same order. Each object has exactly these 4 fields:`;

    // 2. Rules & Skill Group Guidelines & Examples
    const promptRules = `
        {"desc":"...","act":"...","skill":"...","difficulty":"..."}

        DESC: concise, natural English starting with a V-ing verb.

        ACT (slug): lowercase, hyphen-separated, format "object-action1ing-action2ing".
        - Start with the main object, then EVERY main action as a gerund (-ing), in original order (include all actions joined by "and"/"và"/"rồi").
        - Never use base verbs. Never duplicate an action.
        - Omit tools, methods, articles, prepositions unless essential to identify the action.
        - Preparatory actions (e.g. "Khoác áo choàng" = putting on a cape) go in desc only, never in act.

        SKILL: exactly ONE of these names:
        - Pick and Place / Object Handling: moving, lifting, stacking, transferring objects without altering them
        - Tool Use & Technical Manipulation: using tools, crafting, weaving, carving, drilling, shaping wood/metal/bamboo; setting up or operating machinery
        - Food Preparation & Cooking: chopping, cooking, mixing ingredients, washing food
        - Mechanical / Automotive Work: vehicles, tires, engines
        - Repair & Maintenance: fixing broken furniture, appliances, plumbing
        - Assembly & Installation: joining components, screwing, mounting, gluing parts together
        - Construction & Building: bricklaying, plastering, pouring concrete
        - Cleaning & Sanitation: wiping, sweeping, mopping, washing surfaces
        - Organization & Tidying: arranging, sorting, tidying items
        - Packing & Bagging: folding, boxing, wrapping, sealing packages
        - Clothing & Laundry: folding clothes, ironing, sewing, laundering
        - Inventory & Stock Management: counting, shelving, labeling stock, inspecting quality
        - Retail & Service Operations: cashier, taking orders, serving customers, payment
        - Human Interaction & Handoffs: handing items to people, greeting
        - Healthcare & Caregiving: ALL hair actions (cutting, shaving, washing), first aid, feeding patients, bandaging
        - Home Appliance Interaction: operating microwaves, washing machines
        - Electronics & Diagnostics: soldering circuit boards, testing/diagnosing electrical faults
        - Dish Handling: bowls, plates, cups, chopsticks, cutlery (washing, stacking, setting, clearing, carrying)

        DIFFICULTY: exactly "Easy", "Medium" or "Hard".
        - Easy: simple, single-step or repetitive, low dexterity (lifting, moving, wiping flat surfaces, simple folding, sorting by color/shape).
        - Medium: moderate precision, tool use, multi-step or hand-eye coordination, craft/assembly (weaving, cutting with scissors, grinding and painting, screwing, precise placement, measuring).
        - Hard: intricate, multi-stage, specialized, heavy exertion or delicate (hair cutting/shaving, soldering microchips, complex mechanical repair, caregiving procedures, fine carpentry, precision welding).

        DOMAIN RULES (action -> skill, difficulty):
        Cardboard factory (QTQ):
        - Setting up/adjusting/operating machines (slotting, carton erecting, measuring cut position) -> Tool Use & Technical Manipulation, Medium
        - Folding/shaping corners, assembling or packing boxes -> Packing & Bagging, Medium/Hard; attaching barcode labels -> Packing & Bagging, Easy
        - Counting sheets/boxes, inspecting defects, checking stock -> Inventory & Stock Management, Medium
        - Lifting, loading, stacking sheets, removing scraps -> Pick and Place / Object Handling
        - Cleaning scraps from area/machines -> Cleaning & Sanitation
        Restaurant (Urban Shanghai):
        - Setting tables, clearing used dishes -> Dish Handling, Easy; carrying plates from kitchen to dining area -> Dish Handling, Medium
        - Serving food at a table -> Retail & Service Operations, Easy; taking orders, payment -> Retail & Service Operations, Medium
        - Handing a takeaway order to a customer -> Human Interaction & Handoffs, Easy
        Bamboo/rattan (Mây tre Vân Anh):
        - Cutting/trimming strips with tools -> Tool Use & Technical Manipulation, Medium; weaving baskets, shaping/trimming woven products -> Tool Use & Technical Manipulation, Hard
        - Gluing strips into a frame -> Assembly & Installation, Medium; attaching a rim to a basket -> Assembly & Installation, Hard
        - Packing finished items -> Packing & Bagging; moving/stacking items -> Pick and Place / Object Handling
        Motorcycle (Đức Hiệp):
        - Core systems (engine, gearbox, brakes, transmission, steering, suspension, wheels) -> ALWAYS Mechanical / Automotive Work, even if described as "repairing": engine repair Hard, brake pads Medium
        - Auxiliary parts/bodywork (body panels, seats) -> Repair & Maintenance, Medium
        - Testing battery with a multimeter -> Electronics & Diagnostics, Medium; diagnosing electrical faults -> Electronics & Diagnostics, Hard
        - Washing motorcycles, cleaning parts -> Cleaning & Sanitation
        Sewing/upholstery:
        - Measuring/cutting fabric, sewing, trimming edges, ironing -> Clothing & Laundry: machine sewing Medium; curved/complex patterns or car seat covers Hard
        - Stretching/fastening fabric onto frames or seats -> Assembly & Installation, Hard
        - Adjusting sewing machine settings -> Tool Use & Technical Manipulation
        - Repairing a sewing machine or garment defects -> Repair & Maintenance, Hard

        EXAMPLES:
        "Nhúng tre vào nước" -> {"desc":"Dipping bamboo in water","act":"bamboo-dipping","skill":"Pick and Place / Object Handling","difficulty":"Easy"}
        "Chuẩn bị công cụ/tool" -> {"desc":"Preparing tools","act":"tools-preparing","skill":"Pick and Place / Object Handling","difficulty":"Easy"}
        "Cắt tóc và cạo tóc bằng kéo" -> {"desc":"Cutting and shaving hair with scissors","act":"hair-cutting-shaving","skill":"Healthcare & Caregiving","difficulty":"Hard"}
        "Rửa và lau bàn" -> {"desc":"Washing and wiping a table","act":"table-washing-wiping","skill":"Cleaning & Sanitation","difficulty":"Easy"}
        "Mài thanh gỗ rồi sơn thanh gỗ" -> {"desc":"Grinding and painting a wooden rod","act":"wooden-rod-grinding-painting","skill":"Tool Use & Technical Manipulation","difficulty":"Medium"}
        "Wrapping a strand around the edge of a plate" -> {"desc":"Wrapping a strand around the edge of a plate","act":"plate-strand-wrapping","skill":"Pick and Place / Object Handling","difficulty":"Easy"}`;

    // 3. Final Constraints & Input Payload
    const promptInput = (text) =>
        `Return valid JSON only, no Markdown fences or explanations.
    Input: "${text}"`;

    const promptInputBatch = (textsArray) =>
        `Return a valid JSON array only, no Markdown fences or explanations.
    Input: ${JSON.stringify(textsArray)}`;

    /* =====================================================================
     * CODE PATH: 05 - GROQ AI
     * Nội dung:
     * - API key (localStorage)
     * - requestGroqJson: gọi API + retry + parse JSON
     * - aiAnalyzeDescription: Fill 1
     * - aiAnalyzeDescriptionsBatch: Fill All
     * ===================================================================== */

    // ---------------------------------------------------------------------
    // 05.1 - API KEY (localStorage)
    // ---------------------------------------------------------------------
    function getStoredApiKey() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.apiKey);
            return saved ? JSON.parse(saved) : GROQ_API_KEY;
        } catch (_) {
            return GROQ_API_KEY;
        }
    }

    function saveStoredApiKey(key) {
        localStorage.setItem(STORAGE_KEYS.apiKey, JSON.stringify(String(key || '').trim()));
    }

    window.getStoredApiKey = getStoredApiKey;

    // ---------------------------------------------------------------------
    // 05.2 - GỌI GROQ CHAT COMPLETIONS (retry + parse JSON)
    // ---------------------------------------------------------------------
    const RETRYABLE_STATUS = [429, 500, 502, 503];

    function parseAiJson(rawText) {
        const clean = String(rawText || '')
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
        return JSON.parse(clean);
    }

    async function requestGroqJson(prompt, label = 'GROQ') {
        const apiKey = getStoredApiKey();
        if (!apiKey) throw new Error('Chưa có Groq API Key – nhập qua nút 🔑 Key');

        let lastError = null;

        for (const model of GROQ_MODELS) {
            let delay = AI_RETRY_DELAY_MS; // reset delay khi đổi model
            console.log(`🤖 [${label}] Dùng model: ${model}`);

            for (let attempt = 1; attempt <= GROQ_MAX_RETRIES_PER_MODEL; attempt++) {
                try {
                    const response = await fetch(GROQ_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model,
                            ...GROQ_MODEL_OPTIONS[model],
                            stream: false,
                            messages: [{ role: 'user', content: prompt }]
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text().catch(() => '');
                        const err = new Error(`HTTP ${response.status}: ${errorText}`);
                        err.retryable = RETRYABLE_STATUS.includes(response.status);
                        throw err;
                    }

                    const data = await response.json();
                    const rawText = data?.choices?.[0]?.message?.content;
                    if (!rawText) throw new Error('Groq trả về nội dung rỗng');

                    return parseAiJson(rawText);
                } catch (error) {
                    lastError = error;
                    console.warn(`❌ [${label}] ${model} lần ${attempt}/${GROQ_MAX_RETRIES_PER_MODEL}:`, error.message);

                    // Lỗi không retry được (400, 404 model...) → sang model khác luôn
                    if (error.retryable === false || attempt === GROQ_MAX_RETRIES_PER_MODEL) break;

                    await sleep(delay);
                    delay *= 2;
                }
            }

            console.warn(`⚠️ [${label}] ${model} thất bại → chuyển model tiếp theo`);
        }

        throw lastError || new Error('ALL_GROQ_MODELS_FAILED');
    }

    // ---------------------------------------------------------------------
    // 05.3 - CHUẨN HÓA KẾT QUẢ AI
    // ---------------------------------------------------------------------
    const DEFAULT_SKILL = 'Pick and Place / Object Handling';
    const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

    function normalizeAiResult(item) {
        return {
            desc: item?.desc ? String(item.desc).trim() : '',
            act: item?.act ? String(item.act).toLowerCase().trim() : 'object-action',
            skill: item?.skill && String(item.skill).trim() ? String(item.skill).trim() : DEFAULT_SKILL,
            difficulty: DIFFICULTY_LEVELS.includes(item?.difficulty) ? item.difficulty : 'Easy'
        };
    }

    function buildFallbackResult(text) {
        return {
            desc: text,
            act: String(text).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-') || 'object-action',
            skill: DEFAULT_SKILL,
            difficulty: 'Easy'
        };
    }

    // ---------------------------------------------------------------------
    // 05.4 - PHÂN TÍCH 1 MÔ TẢ (Fill 1)
    // ---------------------------------------------------------------------
    async function aiAnalyzeDescription(text) {
        if (!text) return buildFallbackResult('');
        const prompt = `${promptSystem}\n\n${promptRules}\n\n${promptInput(text)}`;
        try {
            const parsed = await requestGroqJson(prompt, 'GROQ SINGLE');
            if (!parsed || !parsed.desc || !parsed.act) throw new Error('JSON thiếu desc/act');
            const result = normalizeAiResult(parsed);
            console.log('🤖 [GROQ SINGLE]:', result);
            return result;
        } catch (error) {
            console.error('❌ [GROQ SINGLE] tất cả model đều lỗi:', error);
            throw error;
        }
    }

    // ---------------------------------------------------------------------
    // 05.5 - PHÂN TÍCH NHIỀU MÔ TẢ 1 LẦN (Fill All)
    // ---------------------------------------------------------------------
    async function aiAnalyzeDescriptionsBatch(textsArray) {
        if (!Array.isArray(textsArray) || textsArray.length === 0) return [];
        const prompt = `${promptSystemBatch}\n\n${promptRules}\n\n${promptInputBatch(textsArray)}`;
        try {
            const parsed = await requestGroqJson(prompt, 'GROQ BATCH');
            if (!Array.isArray(parsed)) throw new Error('Kết quả batch không phải array');
            const result = parsed.map(normalizeAiResult);
            console.log('🤖 [GROQ BATCH]:', result);
            return result;
        } catch (error) {
            console.error('❌ [GROQ BATCH] tất cả model đều lỗi:', error);
            throw error;
        }
    }


    /* =====================================================================
     * CODE PATH: 06 - FORM & DOM HELPERS
     * Nội dung:
     * - Selectors (CONFIG)
     * - Tìm Description / Activity / Skill / L3
     * - Set value kiểu React + combobox
     * - Đọc Difficulty / dữ liệu segment hiện tại
     * ===================================================================== */

    // ==================== CONFIG: AUTO-FILL ====================
    const CONFIG = {
        panelId: 'tb-helper-panel',
        segmentSelector: '',
        copyRequiresAllFields: true,
        activitySeparator: '_',
        maxObjectWords: 2,
        minL3Score: 18,
        delayBetweenEpisodes: 50,

        selectors: {
            description: [
                'textarea[data-testid="label-task-description"]',
                'textarea[name*="description" i]',
                'textarea[id*="description" i]'
            ],
            activity: [
                'input[data-testid*="activity" i]',
                'input[name*="activity" i]',
                'input[id*="activity" i]',
                'input[placeholder*="activity" i]'
            ],
            skillGroup: [
                'input[data-testid*="skill" i]',
                'input[name*="skill" i]',
                'input[id*="skill" i]',
                'input[placeholder*="skill" i]'
            ],
            scene: [
                'input[data-testid*="scene" i]',
                'input[data-testid*="environment" i]',
                'input[name*="scene" i]',
                'input[id*="scene" i]',
                'input[placeholder*="scene" i]',
                'input[placeholder*="environment" i]'
            ]
        }
    };
    function normalizeText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[’']/g, '')
            .replace(/[-_/]/g, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function findFirstElement(selectors, root = document) {
        for (const selector of selectors) {
            const el = root.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    function findInputNearLabel(labelTexts, root = document) {
        const candidates = Array.from(root.querySelectorAll('label, span, p, div'))
            .filter(el => el.children.length <= 2 && el.textContent.trim().length < 60);

        const label = candidates.find(el => {
            const t = normalizeText(el.textContent);
            return labelTexts.some(l => t === normalizeText(l) || t.startsWith(normalizeText(l)));
        });
        if (!label) return null;

        if (label.matches('label') && label.htmlFor) {
            const linked = document.getElementById(label.htmlFor);
            if (linked) return linked;
        }

        let node = label;
        for (let depth = 0; depth < 4 && node; depth++) {
            const input = node.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea');
            if (input) return input;
            node = node.parentElement;
        }
        return null;
    }

    const getDescriptionElement = (root = document) => findFirstElement(CONFIG.selectors.description, root) || findInputNearLabel(['task description', 'description'], root);
    const getActivityElement = (root = document) => findFirstElement(CONFIG.selectors.activity, root) || findInputNearLabel(['activity'], root);
    const getSkillGroupElement = (root = document) => findFirstElement(CONFIG.selectors.skillGroup, root) || findInputNearLabel(['skill group', 'skill'], root);
    const getSceneElement = (root = document) => findFirstElement(CONFIG.selectors.scene, root) || findInputNearLabel(['scene environment l3', 'environment l3', 'scene', 'l3'], root);

    function setNativeValue(element, value) {
        if (!element) return false;
        const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(element, value); else element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function clickOptionByText(targetText) {
        const target = normalizeText(targetText);
        const activeListboxes = Array.from(document.querySelectorAll('[role="listbox"], .dropdown-menu, .MuiAutocomplete-popper, [class*="dropdown"], [class*="menu"]'))
            .filter(el => el.offsetParent !== null);

        let candidates = [];
        if (activeListboxes.length > 0) {
            for (const box of activeListboxes) {
                const items = Array.from(box.querySelectorAll('button, [role="option"], [role="button"], li, div, span'))
                    .filter(el => el.offsetParent !== null && normalizeText(el.textContent) === target);
                candidates = candidates.concat(items);
            }
        }

        if (candidates.length === 0) {
            candidates = Array.from(document.querySelectorAll('button, [role="option"], [role="button"], li, div, span'))
                .filter(el => el.offsetParent !== null && normalizeText(el.textContent) === target);
        }

        if (candidates.length === 0) return false;
        candidates[0].click();
        return true;
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function setComboBoxValue(element, value) {
        if (!element || !value) return false;

        // 1. Focus và kích hoạt mở combobox
        element.focus();
        element.click();
        await sleep(100);

        // 2. Gán giá trị thông qua React Native Value Setter (nếu có)
        const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(element, value);
        else element.value = value;

        // 3. Bắn các sự kiện bàn phím và input để React state bắt được thay đổi
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(350);

        // 4. Thử tìm và click vào option khớp với giá trị trong dropdown nếu có
        if (clickOptionByText(value)) {
            await sleep(100);
            element.blur();
            return true;
        }

        // 5. Nếu không có option khớp, gửi phím Enter để xác nhận giá trị custom
        ['keydown', 'keypress', 'keyup'].forEach(type => {
            element.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        });

        await sleep(150);
        element.blur();

        // 6. Kiểm tra lại lần cuối, nếu bị React reset thì cưỡng bức gán lại giá trị setter
        if (element.value !== value) {
            if (setter) setter.call(element, value);
            else element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return true;
    }
    const DIFFICULTY_NAMES = ['Easy', 'Medium', 'Hard'];

    function readDifficulty(root) {
        const isVisible = el => el.offsetParent !== null || el.getClientRects().length > 0;
        const isSelectedEl = el => {
            if (['aria-checked', 'aria-pressed', 'aria-selected', 'aria-current'].some(a => el.getAttribute(a) === 'true')) return true;
            const state = el.getAttribute('data-state');
            if (state && /^(checked|on|active|selected)$/i.test(state)) return true;
            const cls = (el.className && el.className.toString()) || '';
            if (/(^|[\s_-])(selected|active|checked)([\s_-]|$)/i.test(cls)) return true;
            const input = el.matches('input') ? el : el.querySelector('input[type="radio"], input[type="checkbox"]');
            return !!(input && input.checked);
        };
        const candidates = Array.from(root.querySelectorAll('button, [role="button"], [role="radio"], [role="option"], [role="tab"], label, li')).filter(isVisible);
        const hit = candidates.find(el => DIFFICULTY_NAMES.some(n => normalizeText(n) === normalizeText(el.textContent)) && isSelectedEl(el));
        if (hit) return DIFFICULTY_NAMES.find(n => normalizeText(n) === normalizeText(hit.textContent));
        return '';
    }

    function getCurrentSegmentRoot() {
        const descEl = getDescriptionElement();
        if (!descEl) return document.body;
        let node = descEl;
        while (node && node !== document.body) {
            if (node.querySelectorAll('[data-testid^="episode-index-row-"]').length > 0 || node.classList.contains('segment') || node.tagName === 'FORM') {
                return node;
            }
            node = node.parentElement;
        }
        return document.body;
    }

    function readCurrentSegmentData() {
        const root = getCurrentSegmentRoot();
        const val = el => (el && 'value' in el ? String(el.value).trim() : '');
        return {
            description: val(getDescriptionElement(root)),
            activity: val(getActivityElement(root)),
            skillGroup: val(getSkillGroupElement(root)),
            difficulty: readDifficulty(root),
            l3: val(getSceneElement(root))
        };
    }


    /* =====================================================================
     * CODE PATH: 07 - AUTO FILL
     * Nội dung:
     * - Khóa/mở nút khi đang chạy
     * - Fill 1 (1 segment)
     * - Fill All (batch toàn bộ episode)
     * - Rework task
     * ===================================================================== */

    let isFillAllRunning = false;

    // Hàm khóa/mở khóa toàn bộ nút chức năng
    function setAllButtonsDisabled(isDisabled, activeBtnId = null) {
        CONTROL_BUTTON_IDS.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = isDisabled;
                if (isDisabled) {
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'not-allowed';
                } else {
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    if (id === activeBtnId && btn.dataset.origText) {
                        btn.innerHTML = btn.dataset.origText;
                        btn.style.backgroundColor = '';
                    }
                }
            }
        });
    }
    async function analyzeForFill(description) {
        // 1. Gọi AI (Groq) để lấy object gồm 4 trường: desc, act, skill, difficulty
        const result = await aiAnalyzeDescription(description);

        // Nếu vì lý do nào đó (lỗi mạng, hết quota) mà hàm trả về chuỗi thay vì object, ta có cơ chế phòng thủ:
        if (!result || typeof result !== 'object') {
            return {
                desc: description,
                act: "object-action",
                skill: { name: 'Pick and Place / Object Handling' },
                difficulty: { name: 'Easy' }
            };
        }

        // 2. Tách các trường từ kết quả AI
        const desc = result.desc;
        const act = result.act;

        // Định dạng lại thành object mà các hàm set giá trị form Tbrain đang cần
        const skill = { name: result.skill };
        const difficulty = { name: result.difficulty };

        // 3. Trả về đầy đủ để script tự động điền vào các ô input trên giao diện
        return { desc, act, skill, difficulty };
    }

    function setButtonError(btn) {
        btn.classList.add('tb-error');
        btn.classList.remove('tb-spin');
        btn.innerHTML =
            `<span class="tb-err-label">${TB_ICONS.retry}<span class="tb-txt">Try again</span></span>` +
            `<span class="tb-err-hover">${TB_ICONS.retry}<span class="tb-txt">Try again</span></span>`;
        btn.style.backgroundColor = TB_COLORS.error;
        btn.title = 'Tất cả model đều lỗi – bấm để thử lại';
        btn.disabled = false;
    }

    function clearButtonError(btn) {
        btn.classList.remove('tb-error', 'tb-spin');
        btn.removeAttribute('title');
    }

    async function runFillOne() {
        const currentBtnId = 'tb-inject-fill';
        setAllButtonsDisabled(true, currentBtnId);

        // Tìm nút Fill 1 trên giao diện (bạn có thể thay thế ID này nếu đặt khác)
        const fillSingleBtn = document.getElementById('tb-inject-fill') || document.querySelector('.tb-inject-fill-btn');

        if (fillSingleBtn) {
            clearButtonError(fillSingleBtn);
            setBtn(fillSingleBtn, 'loading', 'Analyzing...', TB_COLORS.loading, true);
            fillSingleBtn.disabled = true;
        }

        try {
            const descEl = getDescriptionElement();
            if (!descEl || !descEl.value.trim()) {
                if (fillSingleBtn) resetFillOneButton(fillSingleBtn);
                return false;
            }

            const rawText = descEl.value.trim();
            const result = await analyzeForFill(rawText);

            if (result.desc && result.desc !== rawText) {
                setNativeValue(descEl, result.desc);
            }

            const activityEl = getActivityElement();
            if (activityEl) setNativeValue(activityEl, result.act);

            const skillEl = getSkillGroupElement();
            // Xử lý linh hoạt đề phòng result.skill có thể là string hoặc object
            const skillName = typeof result.skill === 'object' ? result.skill.name : result.skill;
            if (skillEl) await setComboBoxValue(skillEl, skillName);
            else clickOptionByText(skillName);

            const diffName = typeof result.difficulty === 'object' ? result.difficulty.name : result.difficulty;
            clickOptionByText(diffName);

            // --- BỔ SUNG LOGIC KIỂM TRA L3 TẠI ĐÂY ---
            const inputEl = document.getElementById('tb-l3-custom-input');
            const customVal = inputEl ? inputEl.value.trim() : '';
            if (customVal) {
                const sceneEl = getSceneElement();
                if (sceneEl) await setComboBoxValue(sceneEl, customVal);
            }
            // ----------------------------------------

            segmentClipboard = readCurrentSegmentData();
            storageSet(CLIPBOARD_KEY, segmentClipboard);

            // Báo thành công tạm thời trên nút
            if (fillSingleBtn) {
                setBtn(fillSingleBtn, 'done', 'Done!', TB_COLORS.done);
            }

            setTimeout(() => {
                if (fillSingleBtn) resetFillOneButton(fillSingleBtn);
            }, 1200);

            return true;
        } catch (err) {
            console.error("Lỗi khi chạy AutoFill:", err);
            if (fillSingleBtn) setButtonError(fillSingleBtn);
            return false;
        } finally {
            setAllButtonsDisabled(false, currentBtnId);
        }
    }

    // Hàm phụ trợ đưa nút về trạng thái bình thường
    function resetFillOneButton(btn) {
        clearButtonError(btn);
        setBtn(btn, 'fillOne', 'Fill 1', TB_COLORS.fillOne);
        btn.disabled = false;
    }
    async function runFillAll() {
        const currentBtnId = 'tb-inject-loop';
        setAllButtonsDisabled(true, currentBtnId);

        try {
            if (isFillAllRunning) { isFillAllRunning = false; return; }

            const episodeButtons = Array.from(document.querySelectorAll('[data-testid^="episode-index-row-"]'));
            if (!episodeButtons.length) { alert('Không tìm thấy danh sách episode.'); return; }

            isFillAllRunning = true;

            // --- 1. HIỆN TRẠNG THÁI LOADING TRÊN NÚT ---
            const loopButtons = document.querySelectorAll('.tb-inject-loop-btn');
            loopButtons.forEach(b => {
                clearButtonError(b);
                setBtn(b, 'loading', 'Collecting...', TB_COLORS.loading, true);
                b.disabled = true;
            });

            // document.querySelectorAll('.tb-inject-loop-btn').forEach(b => {
            //     b.textContent = '⏹ Stop';
            //     b.style.backgroundColor = '#b91c1c';
            // });

            const descriptionsToProcess = [];
            const validButtons = [];

            // 1. Duyệt qua tất cả các episode để thu thập mô tả (description)
            for (let idx = 0; idx < episodeButtons.length; idx++) {
                if (!isFillAllRunning) break;
                const btn = episodeButtons[idx];
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.click();
                await sleep(CONFIG.delayBetweenEpisodes);

                const descEl = getDescriptionElement();
                const textVal = descEl ? descEl.value.trim() : "";

                if (textVal && textVal !== 'no description yet') {
                    descriptionsToProcess.push(textVal);
                    validButtons.push(btn);
                }
            }

            if (descriptionsToProcess.length === 0) {
                alert('Không tìm thấy mô tả nào hợp lệ để xử lý.');
                isFillAllRunning = false;
                resetFillAllButtons();
                return;
            }

            // --- 2. BÁO ĐANG GỬI LÊN AI XỬ LÝ BATCH ---
            loopButtons.forEach(b => {
                setBtn(b, 'ai', `AI Analyzing (${descriptionsToProcess.length})...`, null, true);
            });

            console.log(`📦 Đã gom được ${descriptionsToProcess.length} mô tả. Đang gửi lên Groq batch...`);

            // 2. Gửi toàn bộ mảng mô tả lên AI một lần duy nhất
            const batchResults = await aiAnalyzeDescriptionsBatch(descriptionsToProcess);

            // --- 3. BÁO ĐANG ĐIỀN DỮ LIỆU VÀO FORM ---
            loopButtons.forEach(b => {
                setBtn(b, 'write', 'Filling Data...', null, true);
            });

            // 3. Duyệt lại từng episode để điền kết quả tương ứng đã nhận từ mảng trả về
            for (let i = 0; i < validButtons.length; i++) {
                if (!isFillAllRunning) break;
                const btn = validButtons[i];
                const res = batchResults[i];

                if (!res) continue;

                btn.click();
                await sleep(CONFIG.delayBetweenEpisodes);

                const root = getCurrentSegmentRoot();

                // Điền Description
                const descEl = getDescriptionElement(root);
                if (descEl && res.desc) setNativeValue(descEl, res.desc);

                // Điền Activity
                const activityEl = getActivityElement(root);
                if (activityEl && res.act) setNativeValue(activityEl, res.act);

                // Điền Skill Group
                const skillEl = getSkillGroupElement(root);
                if (skillEl) await setComboBoxValue(skillEl, res.skill);
                else clickOptionByText(res.skill);

                // Điền Difficulty
                if (res.difficulty) clickOptionByText(res.difficulty, root);

                // Kiểm tra L3 Custom nếu có
                const inputEl = document.getElementById('tb-l3-custom-input');
                const customVal = inputEl ? inputEl.value.trim() : '';
                if (customVal) {
                    const sceneEl = getSceneElement(root);
                    if (sceneEl) await setComboBoxValue(sceneEl, customVal);
                }

                await sleep(50);
            }

            // --- 4. HOÀN TẤT, TRẢ LẠI TRẠNG THÁI NÚT BAN ĐẦU ---
            resetFillAllButtons();
        } catch (err) {
            console.error("Lỗi khi chạy Fill All:", err);
            isFillAllRunning = false;
            document.querySelectorAll('.tb-inject-loop-btn').forEach(setButtonError);
        } finally {
            setAllButtonsDisabled(false, currentBtnId);
        }
        console.log('✅ Đã hoàn tất Fill All theo dạng Batch Array!');
    }

    // Thêm hàm xử lý khi bấm nút Rework task
    async function runReworkTask() {
        const btnRework = document.getElementById('tb-inject-rework');
        if (btnRework) {
            const originalText = btnRework.innerHTML;
            setBtn(btnRework, 'loading', 'Processing...', TB_COLORS.loading, true);

            // Thêm logic gọi API hoặc xử lý task fail tại đây theo ý bạn
            console.log('🔄 Đang thực hiện xử lý Rework task...');

            setTimeout(() => {
                setBtn(btnRework, 'done', 'Done!', TB_COLORS.done);
                setTimeout(() => {
                    setBtn(btnRework, 'rework', 'Rework task', TB_COLORS.rework);
                }, 1500);
            }, 1000);
        }
    }

    // Hàm phụ trợ reset nút về trạng thái ban đầu
    function resetFillAllButtons() {
        isFillAllRunning = false;
        document.querySelectorAll('.tb-inject-loop-btn').forEach(b => {
            clearButtonError(b);
            setBtn(b, 'fillAll', 'Fill All', TB_COLORS.fillAll);
            b.disabled = false;
        });
    }


    /* =====================================================================
     * CODE PATH: 08 - COPY & PASTE
     * Nội dung:
     * - Clipboard segment lưu trong localStorage
     * - Copy / Paste segment
     * ===================================================================== */

    const CLIPBOARD_KEY = 'tbHelperSegmentClipboard';
    function storageGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
    function storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }

    let segmentClipboard = storageGet(CLIPBOARD_KEY);
    function runCopySegment() {
        segmentClipboard = readCurrentSegmentData();
        storageSet(CLIPBOARD_KEY, segmentClipboard);

        const btnCopy = document.getElementById('tb-inject-copy');
        if (btnCopy) {
            const originalText = btnCopy.innerHTML;
            setBtn(btnCopy, 'done', 'Copied!', TB_COLORS.done);
            setTimeout(() => {
                setBtn(btnCopy, 'copy', 'Copy', TB_COLORS.copy);
            }, 1000);
        }
        console.log('[TBRAIN] Đã copy thông tin segment:', segmentClipboard);
    }

    async function runPasteSegment() {
        if (!segmentClipboard) { alert('Chưa có dữ liệu nào được lưu.'); return; }
        const root = getCurrentSegmentRoot();
        const data = segmentClipboard;
        try {
            if (data.description) { const el = getDescriptionElement(root); if (el) setNativeValue(el, data.description); }
            if (data.activity) { const el = getActivityElement(root); if (el) setNativeValue(el, data.activity); }
            if (data.skillGroup) { const el = getSkillGroupElement(root); if (el) await setComboBoxValue(el, data.skillGroup); }
            if (data.difficulty) { clickOptionByText(data.difficulty, root); }
            if (data.l3) { const el = getSceneElement(root); if (el) await setComboBoxValue(el, data.l3); }
        } catch (err) { console.error('Lỗi khi paste:', err); }
    }


    /* =====================================================================
     * CODE PATH: 09 - L3 FILL
     * Nội dung:
     * - Fill L3 cho segment hiện tại
     * - Fill L3 cho toàn bộ episode
     * ===================================================================== */

    let isFillAllL3Running = false;

    async function runFillOneL3() {
        const currentBtnId = 'tb-inject-single-l3';
        setAllButtonsDisabled(true, currentBtnId);

        try {
            const inputEl = document.getElementById('tb-l3-custom-input');
            const customVal = inputEl ? inputEl.value.trim() : '';
            if (!customVal) { alert('Vui lòng nhập giá trị L3 vào ô text box trước!'); return; }
            const sceneEl = getSceneElement();
            console.log('sceneEl')
            console.log(sceneEl)
            console.log('customVal')
            console.log(customVal)
            if (sceneEl) await setComboBoxValue(sceneEl, customVal);
        } catch (err) {
            console.error("Lỗi khi chạy Fill L3:", err);
        } finally {
            setAllButtonsDisabled(false, currentBtnId);
        }
    }

    async function runFillAllL3() {
        const currentBtnId = 'tb-inject-l3-loop';
        setAllButtonsDisabled(true, currentBtnId);

        try {
            if (isFillAllL3Running) { isFillAllL3Running = false; return; }
            const inputEl = document.getElementById('tb-l3-custom-input');
            const customVal = inputEl ? inputEl.value.trim() : '';
            if (!customVal) { alert('Vui lòng nhập giá trị L3 vào ô text box trước!'); return; }

            const episodeButtons = Array.from(document.querySelectorAll('[data-testid^="episode-index-row-"]'));
            if (!episodeButtons.length) { runFillOneL3(); return; }

            isFillAllL3Running = true;
            document.querySelectorAll('.tb-inject-fill-l3-loop-btn').forEach(b => setBtn(b, 'stop', 'Stop Fill L3', TB_COLORS.stop));

            for (let idx = 0; idx < episodeButtons.length; idx++) {
                if (!isFillAllL3Running) break;
                const btn = episodeButtons[idx];
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.click();
                await sleep(CONFIG.delayBetweenEpisodes);
                if (!isFillAllL3Running) break;
                const sceneEl = getSceneElement();
                if (sceneEl) await setComboBoxValue(sceneEl, customVal);
                await sleep(300);
            }
        } catch (err) {
            console.error("Lỗi khi chạy Fill L3 All:", err);
        } finally {
            isFillAllL3Running = false;
            document.querySelectorAll('.tb-inject-fill-l3-loop-btn').forEach(b => setBtn(b, 'fillL3', 'Fill L3 All', TB_COLORS.fillL3));
            setAllButtonsDisabled(false, currentBtnId);
        }
    }


    /* =====================================================================
     * CODE PATH: 10 - AUTO FETCH & TASK ACQUIRE
     * Nội dung:
     * - Bắt JWT Tbrain (fetch/XHR, storage, cookie)
     * - Rate limit
     * - Poll task pool + auto acquire
     * - Notification + beep
     * ===================================================================== */

    const log = {
        info: (...a) => console.log("[INFO]", ...a),
        warn: (...a) => console.warn("[WARN]", ...a),
        error: (...a) => console.error("[ERROR]", ...a)
    };

    const now = () => performance.now();
    function perf(label, start) { if (PERF_LOG) log.info(`[PERF] ${label}: ${(now() - start).toFixed(1)} ms`); }

    const rateLimitState = { limit: null, remaining: null, resetAt: 0, pauseUntil: 0, lastStatus: null };

    function readRateLimitHeaders(response) {
        const headers = response.headers;
        const limitRaw = headers.get("x-ratelimit-limit");
        const remainingRaw = headers.get("x-ratelimit-remaining");
        const resetRaw = headers.get("x-ratelimit-reset");

        const limit = limitRaw === null ? NaN : Number(limitRaw);
        const remaining = remainingRaw === null ? NaN : Number(remainingRaw);

        if (Number.isFinite(limit) && limit >= 0) rateLimitState.limit = limit;
        if (Number.isFinite(remaining) && remaining >= 0) rateLimitState.remaining = remaining;

        if (resetRaw !== null) {
            const reset = Number(resetRaw);
            if (Number.isFinite(reset) && reset >= 0) {
                rateLimitState.resetAt = reset > 1e9 ? reset * 1000 : Date.now() + reset * 1000;
            }
        }
        rateLimitState.lastStatus = response.status;
        if (response.status === 429) {
            rateLimitState.pauseUntil = Math.max(rateLimitState.pauseUntil, Date.now() + RATE_LIMIT_FALLBACK_WAIT + RATE_LIMIT_SAFETY_MS);
        }
    }

    async function waitForRateLimit() {
        while (!stopped) {
            const waitMs = rateLimitState.pauseUntil - Date.now();
            if (waitMs <= 0) return;
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        throw new Error("Task monitor stopped");
    }

    function getAdaptivePollInterval() {
        return Math.max(POLL_INTERVAL, MIN_SAFE_POLL_INTERVAL);
    }

    const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
    const interceptedTokens = new Map();
    const rejectedTokens = new Set();
    let cachedTokenCandidate = null;
    let lastTokenValue = null;

    function decodePayload(token) {
        try {
            let p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            p += "=".repeat((4 - p.length % 4) % 4);
            const binary = atob(p);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (_) { return null; }
    }

    function scoreSource(source) {
        let score = 0;
        if (/access|auth|jwt|bearer|token|session/i.test(source)) score += 2;
        if (/refresh/i.test(source)) score -= 5;
        return score;
    }

    function scanString(raw, source, found) {
        if (typeof raw !== "string" || raw.length < 20) return;
        JWT_RE.lastIndex = 0;
        let match;
        while ((match = JWT_RE.exec(raw)) !== null) {
            const token = match[0];
            if (rejectedTokens.has(token)) continue;
            const payload = decodePayload(token);
            if (!payload) continue;
            const candidate = { token, source, payload, score: scoreSource(source) };
            const existing = found.get(token);
            if (!existing || candidate.score > existing.score) found.set(token, candidate);
        }
    }

    function scanStorage(storage, label, found) {
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key !== null) scanString(storage.getItem(key), `${label}:${key}`, found);
            }
        } catch (_) { }
    }

    function scanCookies(found) {
        try {
            for (const pair of document.cookie.split(";")) {
                const index = pair.indexOf("=");
                if (index >= 0) scanString(pair.slice(index + 1).trim(), `cookie:${pair.slice(0, index).trim()}`, found);
            }
        } catch (_) { }
    }

    function findToken(forceScan = false) {
        const timestamp = Date.now();
        if (!forceScan && cachedTokenCandidate) {
            const cached = cachedTokenCandidate;
            const expiry = Number(cached.payload.exp);
            if (!rejectedTokens.has(cached.token) && (!expiry || expiry * 1000 > timestamp + 5000)) return cached;
            cachedTokenCandidate = null;
        }

        const found = new Map();
        for (const token of interceptedTokens.keys()) {
            if (!rejectedTokens.has(token)) {
                const payload = decodePayload(token);
                if (payload) found.set(token, { token, source: "intercepted request", payload, score: 10 });
            }
        }

        if (forceScan || found.size === 0) {
            scanStorage(window.localStorage, "localStorage", found);
            scanStorage(window.sessionStorage, "sessionStorage", found);
            scanCookies(found);
        }

        let best = null;
        for (const candidate of found.values()) {
            if (!rejectedTokens.has(candidate.token)) {
                const expiry = Number(candidate.payload.exp);
                if (!expiry || expiry * 1000 > timestamp + 5000) {
                    if (!best || candidate.score > best.score) best = candidate;
                }
            }
        }
        cachedTokenCandidate = best;
        return best;
    }

    const origFetch = window.fetch;
    const xhrProto = XMLHttpRequest.prototype;
    const origOpen = xhrProto.open;
    const origSetHeader = xhrProto.setRequestHeader;

    function captureAuth(value, url) {
        try {
            if (typeof value !== "string" || !url) return;
            const parsed = new URL(String(url), location.href);
            if (parsed.hostname.endsWith("tbrain.ai")) {
                JWT_RE.lastIndex = 0;
                let match;
                while ((match = JWT_RE.exec(value)) !== null) interceptedTokens.set(match[0], Date.now());
            }
        } catch (_) { }
    }

    function readHeaders(headers) {
        if (!headers) return null;
        try {
            if (headers instanceof Headers) return headers.get("authorization");
            if (Array.isArray(headers)) {
                for (const pair of headers) if (String(pair[0]).toLowerCase() === "authorization") return String(pair[1]);
            } else if (typeof headers === "object") {
                for (const key of Object.keys(headers)) if (key.toLowerCase() === "authorization") return String(headers[key]);
            }
        } catch (_) { }
        return null;
    }

    window.fetch = function (input, init) {
        try {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
            const auth = readHeaders(init && init.headers) || readHeaders(input && input.headers);
            if (auth) captureAuth(auth, url);
        } catch (_) { }
        return origFetch.apply(this, arguments);
    };

    xhrProto.open = function (method, url) { this.tbMonitorUrl = String(url); return origOpen.apply(this, arguments); };
    xhrProto.setRequestHeader = function (name, value) {
        if (String(name).toLowerCase() === "authorization") captureAuth(value, this.tbMonitorUrl);
        return origSetHeader.apply(this, arguments);
    };

    let audioCtx = null;
    let deniedLogged = false;

    async function ensurePermission() {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") {
            if (!deniedLogged) {
                log.warn("Notification permission denied.");
                deniedLogged = true;
            }
            return false;
        }
        try {
            return await Notification.requestPermission() === "granted";
        } catch (_) {
            return false;
        }
    }

    function unlockAudio() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC && !audioCtx) audioCtx = new AC();
            if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
        } catch (_) { }
    }

    function beep() {
        try {
            if (!audioCtx) unlockAudio();
            if (!audioCtx || audioCtx.state !== "running") return;
            const start = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = 880;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.15);
        } catch (_) { }
    }

    async function showAcquireNotification(acquiredTasks) {
        if (!acquiredTasks || acquiredTasks.length === 0) return;
        beep();

        if (!(await ensurePermission())) {
            log.info("[NOTIFICATION PERMISSION DENIED]", acquiredTasks);
            return;
        }

        try {
            for (const item of acquiredTasks) {
                const hours = Number.isFinite(item.durationSeconds)
                    ? (item.durationSeconds / 3600).toFixed(2)
                    : "Unknown";

                const title = "🚀 Đã nhận Task mới thành công!";
                const body = `ID: ${item.id}\nThời lượng: ${hours} giờ`;

                const notification = new Notification(title, {
                    body: body,
                    tag: `tbrain-acquired-${item.id}`,
                    renotify: true
                });

                notification.onclick = event => {
                    event.preventDefault();
                    window.open(CLICK_URL, "_blank");
                    try { window.focus(); } catch (_) { }
                    notification.close();
                };
            }
        } catch (error) {
            log.error("Notification failed:", error.message);
        }
    }

    function getTaskId(task) {
        if (!task) return null;
        const id = task.id !== undefined ? task.id : task.taskId !== undefined ? task.taskId : task._id;
        return id != null ? String(id) : null;
    }

    async function fetchPool(token) {
        await waitForRateLimit();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        try {
            const response = await origFetch.call(window, API_URL, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
                credentials: "include",
                cache: "no-store",
                signal: controller.signal
            });
            readRateLimitHeaders(response);
            return response;
        } finally { clearTimeout(timeout); }
    }

    async function acquireTask(token, taskObj) {
        const id = getTaskId(taskObj);
        try {
            const response = await origFetch.call(window, `${API_BASE}/api/v1/tasks/${encodeURIComponent(id)}/acquire`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "*/*" },
                credentials: "include",
                body: "{}"
            });
            readRateLimitHeaders(response);
            return { taskObj, id, ok: response.ok, status: response.status };
        } catch (error) {
            return { taskObj, id, ok: false, status: 0 };
        }
    }

    async function acquireNew(token, taskList) {
        let successfullyAcquired = [];
        for (const taskObj of taskList) {
            const res = await acquireTask(token, taskObj);
            if (res.ok) {
                successfullyAcquired.push({
                    id: res.id,
                    durationSeconds: taskObj.durationSeconds
                });
            }
        }

        if (successfullyAcquired.length > 0) {
            await showAcquireNotification(successfullyAcquired);
        }

        return { success: successfullyAcquired.length, total: taskList.length };
    }

    function extractTasks(body) {
        if (Array.isArray(body)) return body;
        if (!body || typeof body !== "object") return null;
        for (const key of ["tasks", "items", "results", "data", "records", "rows", "content"]) {
            if (Array.isArray(body[key])) return body[key];
        }
        return null;
    }

    const seenIds = new Set();
    let firstPoll = true;
    let timer = null;
    let stopped = false;
    let cycleRunning = false;

    async function runCycle() {
        let candidate = findToken() || findToken(true);
        if (!candidate) return TOKEN_RETRY_INTERVAL;

        let response;
        try {
            response = await fetchPool(candidate.token);
        } catch (_) {
            return getAdaptivePollInterval();
        }

        if (response.status === 401 || response.status === 403) {
            rejectedTokens.add(candidate.token);
            cachedTokenCandidate = null;
            return TOKEN_RETRY_INTERVAL;
        }

        if (!response.ok) return getAdaptivePollInterval();

        let body;
        try { body = await response.json(); } catch (_) { return getAdaptivePollInterval(); }

        const tasks = extractTasks(body);
        if (!tasks) return getAdaptivePollInterval();

        const eligibleTasks = [];
        for (const task of tasks) {
            const id = getTaskId(task);
            if (id === null || seenIds.has(id)) continue;
            seenIds.add(id);

            const duration = Number(task && task.durationSeconds);
            if (Number.isFinite(duration) && duration > MIN_DURATION_SECONDS) {
                eligibleTasks.push(task);
            }
        }

        if (eligibleTasks.length > 0) {
            if (AUTO_ACQUIRE) {
                await acquireNew(candidate.token, eligibleTasks);
            }
        }

        return getAdaptivePollInterval();
    }

    async function tick() {
        let isActive = localStorage.getItem(STORAGE_KEYS.active) !== null ? JSON.parse(localStorage.getItem(STORAGE_KEYS.active)) : true;
        if (!isActive || stopped || cycleRunning) return;
        cycleRunning = true;
        try {
            const delay = await runCycle();
            if (!stopped) timer = setTimeout(tick, delay);
        } catch (_) {
            if (!stopped) timer = setTimeout(tick, getAdaptivePollInterval());
        } finally {
            cycleRunning = false;
        }
    }

    function stop() {
        stopped = true;
        clearTimeout(timer);
    }

    tick();
    void ensurePermission();


    /* =====================================================================
     * CODE PATH: 11 - EARNINGS
     * Nội dung:
     * - Tổng thu nhập từ stats + extra hours
     * - Thu nhập theo timeline hiện tại
     * ===================================================================== */

    async function updateMyEarnings() {
        const candidate = findToken() || findToken(true);
        if (!candidate) return;

        const earningsEl = document.getElementById('tb-earnings-display');
        if (!earningsEl) return;

        try {
            // Gọi đồng thời cả 2 API lấy stats và extra-hours
            const [statsRes, extraRes] = await Promise.all([
                origFetch.call(window, STATS_API_URL, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${candidate.token}`, Accept: "*/*" },
                    credentials: "include"
                }),
                origFetch.call(window, EXTRA_HOURS_API_URL, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${candidate.token}`, Accept: "*/*" },
                    credentials: "include"
                })
            ]);

            let totalSeconds = 0;

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                totalSeconds += Number(statsData.labelledSeconds) || 0;
            }

            if (extraRes.ok) {
                const extraData = await extraRes.json();
                if (Array.isArray(extraData)) {
                    // Cộng dồn seconds từ các mục bonus
                    extraData.forEach(item => {
                        totalSeconds += Number(item.seconds) || 0;
                    });
                }
            }

            // Chuyển tổng giây ra giờ và nhân với 50,000 VND
            const hours = totalSeconds / 3600;
            const totalMoney = hours * 50000;

            earningsEl.textContent = `💰 ${Math.round(totalMoney).toLocaleString('vi-VN')} đ`;
            earningsEl.title = `Tổng thời gian (Đã gồm bonus): ${hours.toFixed(2)}h (${totalSeconds.toFixed(0)} giây)`;
        } catch (err) {
            console.error("Lỗi cập nhật thu nhập và giờ bonus:", err);
        }
    }

    function calculateEarningsFromTimeline() {
        const timelineEl = document.querySelector('[data-testid="timeline-hours"]');
        if (!timelineEl) return 0;

        const text = timelineEl.textContent || '';
        // Lấy phần trước dấu "/" (Ví dụ: "3 h 31 min")
        const recordedPart = text.split('/')[0].trim();

        let totalMinutes = 0;

        // Biểu thức chính quy để bóc tách giờ và phút
        const hourMatch = recordedPart.match(/(\d+)\s*h/);
        const minMatch = recordedPart.match(/(\d+)\s*min/);

        if (hourMatch) {
            totalMinutes += parseInt(hourMatch[1], 10) * 60;
        }
        if (minMatch) {
            totalMinutes += parseInt(minMatch[1], 10);
        }

        // Nếu không khớp định dạng h/min, thử tìm dạng giây hoặc số khác nếu có
        if (!hourMatch && !minMatch) {
            // Fallback: đọc qua title nếu có (ví dụ: "Episodes 3:31:09 of 3:53:14 recorded")
            const titleText = timelineEl.getAttribute('title') || '';
            const timeMatch = titleText.match(/(\d+):(\d+):(\d+)/);
            if (timeMatch) {
                const h = parseInt(timeMatch[1], 10);
                const m = parseInt(timeMatch[2], 10);
                const s = parseInt(timeMatch[3], 10);
                totalMinutes = h * 60 + m + s / 60;
            }
        }

        // 50,000 đ / 1 tiếng = 50,000 / 60 đ / 1 phút
        const earnings = (totalMinutes / 60) * 50000;
        return Math.round(earnings);
    }

    // Tạo ô hiển thị số tiền kiếm được từ timeline hiện tại
    function injectTimelineEarningsDisplay() {
        // Tìm vị trí thích hợp để gắn ô tiền (ví dụ cạnh timeline-hours hoặc trong wrapper của bạn)
        const timelineEl = document.querySelector('[data-testid="timeline-hours"]');
        if (timelineEl && !document.getElementById('tb-timeline-earnings')) {
            const earningsBadge = document.createElement('span');
            earningsBadge.id = 'tb-timeline-earnings';
            earningsBadge.className = 'ml-2 px-2 py-0.5 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded';
            earningsBadge.textContent = '💰 0 đ';

            // Chèn ngay sau phần tử timeline-hours
            timelineEl.insertAdjacentElement('afterend', earningsBadge);
        }

        // Cập nhật giá trị tiền
        const earningsBadge = document.getElementById('tb-timeline-earnings');
        if (earningsBadge) {
            const money = calculateEarningsFromTimeline();
            earningsBadge.textContent = `💰 ${money.toLocaleString('vi-VN')} đ`;
        }
    }

    // Chạy định kỳ để cập nhật số tiền theo thời gian thực khi bạn làm việc trên task
    // Optimized: update only when timeline-hours actually changes.
    let tbTimelineHoursEl = null;
    let tbTimelineHoursObserver = null;
    function bindTimelineEarningsObserver() {
        const el = document.querySelector('[data-testid=\"timeline-hours\"]');
        if (!el || el === tbTimelineHoursEl) return;
        tbTimelineHoursObserver?.disconnect();
        tbTimelineHoursEl = el;
        injectTimelineEarningsDisplay();
        tbTimelineHoursObserver = new MutationObserver(() => injectTimelineEarningsDisplay());
        tbTimelineHoursObserver.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });
    }


    /* =====================================================================
     * CODE PATH: 12 - UI
     * Nội dung:
     * - 12.1 Topbar (Take Task, thu nhập, poll/duration, Key)
     * - 12.2 Task toolbar (L3, Fill, Copy, Paste)
     * - 12.3 Toolbar hotkeys ! @ # $
     * - 12.4 UI refresh observer
     * ===================================================================== */

    // ---------------------------------------------------------------------
    // 12.1 - TOPBAR
    // ---------------------------------------------------------------------
    function initTopbarControls() {
        const themeToggleBtn = document.querySelector('[data-testid="theme-toggle"]');
        const appHeader = document.querySelector('div[data-app-header="true"]');

        // Nếu chưa có appHeader hoặc đã khởi tạo wrapper rồi thì bỏ qua
        if (!appHeader || document.getElementById("tb-fetch-control-wrapper")) return;

        const isMobile = window.innerWidth < 768;

        let isActive = localStorage.getItem(STORAGE_KEYS.active) !== null ? JSON.parse(localStorage.getItem(STORAGE_KEYS.active)) : false;
        let currentPoll = localStorage.getItem(STORAGE_KEYS.poll) !== null ? parseInt(localStorage.getItem(STORAGE_KEYS.poll), 10) : POLL_INTERVAL;
        let currentDuration = localStorage.getItem(STORAGE_KEYS.duration) !== null ? parseInt(localStorage.getItem(STORAGE_KEYS.duration), 10) : MIN_DURATION_SECONDS;

        POLL_INTERVAL = currentPoll;
        MIN_DURATION_SECONDS = currentDuration;

        const wrapper = document.createElement("div");
        wrapper.id = "tb-fetch-control-wrapper";

        if (isMobile) {
            // === MOBILE: Thành 1 dòng riêng biệt ngay dưới header Workspace, scroll ngang mượt mà ===
            wrapper.className = "flex items-center gap-2 overflow-x-auto py-1.5 px-3 w-full bg-tag-gray-bg/95 border-b border-tb-border shrink-0";
            wrapper.style.cssText = `
            width: 100% !important;
            max-width: 100% !important;
            display: flex !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
            z-index: 40;
        `;

            if (!document.getElementById('tb-fetch-scroll-style')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'tb-fetch-scroll-style';
                styleEl.innerHTML = `
                #tb-fetch-control-wrapper::-webkit-scrollbar {
                    display: none;
                }
                #tb-fetch-control-wrapper > * {
                    flex-shrink: 0 !important;
                }
            `;
                document.head.appendChild(styleEl);
            }
        } else {
            // === LAPTOP: Nằm ngang cạnh nút theme toggle ===
            wrapper.className = "flex items-center gap-2 mr-2 bg-tag-gray-bg/40 px-2 py-1 rounded-md border border-tb-border shrink-0 relative";
        }

        const earningsDisplay = document.createElement("span");
        earningsDisplay.id = "tb-earnings-display";
        earningsDisplay.className = "text-xs font-bold text-emerald-400 whitespace-nowrap mr-1";
        earningsDisplay.textContent = "💰 0 đ";
        wrapper.appendChild(earningsDisplay);

        // Group chứa nút Take Task và nút mũi tên toggle (Đảm bảo flex khít tuyệt đối)
        const taskGroup = document.createElement("div");
        taskGroup.className = "inline-flex items-center rounded-md overflow-hidden shrink-0";
        taskGroup.style.cssText = "display: inline-flex !important; position: relative; border-radius: 6px; box-sizing: border-box;";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        // Bo góc trái, bỏ bo góc phải để dán khít vào nút mũi tên
        toggleBtn.className = "inline-flex h-7 items-center justify-center gap-1 px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90";
        toggleBtn.style.cssText = "border-top-left-radius: 10px; border-bottom-left-radius: 10px; border-top-right-radius: 0; border-bottom-right-radius: 0; border: none; margin: 0;";

        function updateToggleButton() {
            setBtn(toggleBtn, 'power', isActive ? 'Take Task: ON' : 'Take Task: OFF',
                isActive ? TB_COLORS.takeOn : TB_COLORS.takeOff);
        }
        updateToggleButton();

        // Nút mũi tên: Bo góc phải, dán khít cạnh trái
        const arrowBtn = document.createElement("button");
        arrowBtn.type = "button";
        arrowBtn.innerHTML = TB_ICONS.chevronRight;
        function updateArrowStyle() {
            const baseColor = isActive ? TB_COLORS.takeOn : TB_COLORS.takeOff; // Xanh khi ON, Đỏ khi OFF
            arrowBtn.className = "inline-flex h-7 w-6 items-center justify-center text-xs text-white transition-colors";
            arrowBtn.style.cssText = `
            background-color: ${isActive ? TB_COLORS.takeOnArrow : TB_COLORS.takeOff};
            border-top: 1px solid ${baseColor};
            border-bottom: 1px solid ${baseColor};
            border-right: 1px solid ${baseColor};
            border-left: 1px solid rgba(255, 255, 255, 0.25);
            border-top-right-radius: 10px;
            border-bottom-right-radius: 10px;
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            margin: 0;
            padding: 0;
        `;
        }
        updateArrowStyle();

        // Sự kiện click nút Take Task
        toggleBtn.onclick = () => {
            isActive = !isActive;
            localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(isActive));
            updateToggleButton();
            updateArrowStyle();
            if (isActive) { stopped = false; tick(); }
            else { stop(); }
        };
        taskGroup.appendChild(toggleBtn);
        taskGroup.appendChild(arrowBtn);

        wrapper.appendChild(taskGroup);

        // --- CONTAINER CHỨA 2 Ô NHẬP THỜI GIAN (ẨN MẶC ĐỊNH) ---
        const timeSettingsContainer = document.createElement("div");
        timeSettingsContainer.id = "tb-time-settings-popup";
        timeSettingsContainer.className = "hidden items-center gap-1.5 shrink-0";

        let hideTimeout = null;

        function resetHideTimer() {
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                timeSettingsContainer.classList.add("hidden");
                timeSettingsContainer.classList.remove("flex");
                arrowBtn.innerHTML = TB_ICONS.chevronRight;
            }, 5000); // 10 giây không tương tác sẽ tự ẩn
        }

        arrowBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = timeSettingsContainer.classList.contains("hidden");
            if (isHidden) {
                timeSettingsContainer.classList.remove("hidden");
                timeSettingsContainer.classList.add("flex");
                arrowBtn.innerHTML = TB_ICONS.chevronLeft;
                resetHideTimer();
            } else {
                timeSettingsContainer.classList.add("hidden");
                timeSettingsContainer.classList.remove("flex");
                arrowBtn.innerHTML = TB_ICONS.chevronRight;
                if (hideTimeout) clearTimeout(hideTimeout);
            }
        };

        timeSettingsContainer.addEventListener("input", resetHideTimer);
        timeSettingsContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            resetHideTimer();
        });

        const pollInput = document.createElement("input");
        pollInput.type = "number";
        pollInput.value = currentPoll;
        pollInput.title = "Poll Interval (ms)";
        pollInput.className = "w-16 px-1.5 py-0.5 text-xs rounded bg-canvas border border-tb-border text-fg text-center shrink-0";
        pollInput.onchange = e => {
            const val = parseInt(e.target.value, 10);
            if (val >= 500) {
                POLL_INTERVAL = val;
                localStorage.setItem(STORAGE_KEYS.poll, val);
            }
        };

        const durationInput = document.createElement("input");
        durationInput.type = "number";
        durationInput.value = currentDuration;
        durationInput.title = "Min Duration (s)";
        durationInput.className = "w-16 px-1.5 py-0.5 text-xs rounded bg-canvas border border-tb-border text-fg text-center shrink-0";
        durationInput.onchange = e => {
            const val = parseInt(e.target.value, 10);
            if (val >= 0) {
                MIN_DURATION_SECONDS = val;
                localStorage.setItem(STORAGE_KEYS.duration, val);
            }
        };

        timeSettingsContainer.appendChild(pollInput);
        timeSettingsContainer.appendChild(durationInput);
        wrapper.appendChild(timeSettingsContainer);

        // --- NÚT API KEY & MODAL (dùng getStoredApiKey / saveStoredApiKey ở CODE PATH 05) ---

        const btnKey = document.createElement("button");
        btnKey.type = "button";
        btnKey.className = "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 shrink-0";
        setBtn(btnKey, 'key', 'Key', TB_COLORS.key);

        const tokenModal = document.createElement("div");
        tokenModal.style.cssText = "display: none; position: absolute; top: 40px; right: 0; background: #1e293b; border: 1px solid #475569; padding: 12px; border-radius: 8px; z-index: 9999; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); width: 260px;";

        tokenModal.innerHTML = `
        <div style="font-size: 11px; color: #f8fafc; margin-bottom: 6px; font-weight: 600;">Nhập Groq API Key:</div>
        <input type="password" id="tb-token-input" value="${getStoredApiKey()}" placeholder="Dán Groq API Key vào đây..." style="width: 100%; height: 26px; background: #0f172a; color: #fff; border: 1px solid #64748b; border-radius: 4px; padding: 0 6px; font-size: 11px; margin-bottom: 8px; box-sizing: border-box;" />
        <div style="display: flex; justify-content: flex-end; gap: 6px;">
            <button type="button" id="tb-token-save" style="background: #10b981; color: white; border: none; padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">Lưu</button>
            <button type="button" id="tb-token-close" style="background: #475569; color: white; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Đóng</button>
        </div>
    `;

        btnKey.onclick = (e) => {
            e.stopPropagation();
            const isVisible = tokenModal.style.display === "block";
            tokenModal.style.display = isVisible ? "none" : "block";
            if (!isVisible) {
                tokenModal.querySelector("#tb-token-input").value = getStoredApiKey();
            }
        };

        setTimeout(() => {
            const saveBtn = tokenModal.querySelector('#tb-token-save');
            const closeBtn = tokenModal.querySelector('#tb-token-close');
            const inputEl = tokenModal.querySelector('#tb-token-input');

            if (saveBtn) {
                saveBtn.onclick = () => {
                    saveStoredApiKey(inputEl.value);
                    tokenModal.style.display = 'none';
                };
            }
            if (closeBtn) {
                closeBtn.onclick = () => {
                    tokenModal.style.display = 'none';
                };
            }
        }, 100);

        timeSettingsContainer.appendChild(btnKey);
        wrapper.appendChild(tokenModal);

        if (isMobile) {
            appHeader.insertAdjacentElement("afterend", wrapper);
        } else {
            if (themeToggleBtn) {
                themeToggleBtn.insertAdjacentElement("beforebegin", wrapper);
            }
        }

        updateMyEarnings();
        setInterval(updateMyEarnings, 30000);
    }

    // ---------------------------------------------------------------------
    // 12.2 - TASK TOOLBAR
    // ---------------------------------------------------------------------
    function injectTaskToolbar() {
        // Tìm container của cả 2 trang (Task thường OR Task Review/Fix)
        const taskContainer = document.querySelector('div[data-testid="task-submitted"]')
            || document.querySelector('div[data-testid="task-review-view"]');

        if (!taskContainer || document.getElementById('tb-inject-fill')) return;

        const isMobile = window.innerWidth < 768;

        // Tìm hoặc tạo headerSection bên trong taskContainer
        const firstChild = taskContainer.firstElementChild;
        let headerSection = null;

        if (firstChild && firstChild.classList.contains('border-b') && firstChild.classList.contains('justify-between')) {
            headerSection = firstChild;
        }

        if (!headerSection) {
            headerSection = document.createElement('div');
            headerSection.className = isMobile
                ? 'flex flex-col items-start gap-2 border-b border-tb-border px-3 pb-3 pt-3 w-full'
                : 'flex items-center justify-between gap-3 border-b border-tb-border px-5 pb-3 pt-4';

            const titleDiv = document.createElement('div');
            titleDiv.className = isMobile ? 'w-full' : '';
            titleDiv.innerHTML = `
            <h2 class="text-sm font-medium text-fg">Task Editor Controls</h2>
            <p class="mt-0.5 text-2xs text-fg-muted">Automated toolbar for fast segment tagging</p>
        `;
            headerSection.appendChild(titleDiv);
            taskContainer.insertBefore(headerSection, taskContainer.firstChild);
        } else {
            headerSection.className = isMobile
                ? 'flex flex-col items-start gap-2 border-b border-tb-border px-3 pb-3 pt-3 w-full'
                : 'flex items-center justify-between gap-3 border-b border-tb-border px-5 pb-3 pt-4';
        }

        const btnBaseClass = "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 shrink-0";

        const helperToolbar = document.createElement('div');
        helperToolbar.id = 'tb-helper-toolbar';

        if (isMobile) {
            helperToolbar.className = 'flex items-center gap-2 overflow-x-auto py-1 w-full shrink-0';
            helperToolbar.style.cssText = `
            width: 100% !important;
            max-width: 100% !important;
            display: flex !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
        `;
        } else {
            helperToolbar.className = 'flex items-center gap-2 ml-auto shrink-0 flex-wrap';
        }

        if (!document.getElementById('tb-scroll-hide-style')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'tb-scroll-hide-style';
            styleEl.innerHTML = `
                #tb-helper-toolbar::-webkit-scrollbar {
                    display: none;
                }
                #tb-helper-toolbar > * {
                    flex-shrink: 0 !important;
                }
                
                /* Error: bình thường hiện "Error", hover hiện "Try again" */
                .tb-error .tb-err-hover { display: none; }
                .tb-error:hover .tb-err-label { display: none; }
                .tb-error:hover .tb-err-hover { display: inline-flex; }
                .tb-error:hover { filter: brightness(1.12); }
                .tb-err-label, .tb-err-hover { align-items: center; gap: 4px; }
                .tb-err-label { display: inline-flex; }
                /* Icon + chữ thẳng hàng, không xuống dòng */
                .tb-pair > button, #tb-fetch-control-wrapper button {
                    gap: 4px;
                    line-height: 1 !important;
                    white-space: nowrap !important;
                }
                /* Căn icon giữa theo chiều dọc với chữ */
                .tb-pair > button, #tb-fetch-control-wrapper button {
                    display: inline-flex;
                    align-items: center !important;
                }
                .tb-pair > button svg, #tb-fetch-control-wrapper button svg {
                    display: block;
                    width: 15px;
                    height: 15px;
                    margin-top: 0;
                }
                .tb-pair > button > span:not(.tb-err-label):not(.tb-err-hover),
                #tb-fetch-control-wrapper button > span {
                    display: inline-block;
                    line-height: 1;
                }
                /* Error / Try again: icon và chữ nằm cùng 1 hàng */
                .tb-pair > button.tb-error > .tb-err-label {
                    display: inline-flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 4px;
                    line-height: 1;
                }
                .tb-pair > button.tb-error > .tb-err-hover {
                    display: none;
                    flex-direction: row;
                    align-items: center;
                    gap: 4px;
                    line-height: 1;
                }
                .tb-pair > button.tb-error svg { width: 15px; height: 15px; display: block; }
                .tb-pair > button.tb-error:hover > .tb-err-label { display: none; }
                .tb-pair > button.tb-error:hover > .tb-err-hover { display: inline-flex; }
                /* Cắt khoảng trống trên/dưới của font để chữ nằm đúng giữa icon */
                .tb-txt {
                    display: inline-block;
                    line-height: 1;
                    text-box: trim-both cap alphabetic;
                }
                @supports not (text-box: trim-both cap alphabetic) {
                    .tb-txt { transform: translateY(1px); }
                }
                /* 2 nửa Fill 1 / Fill All luôn rộng bằng nhau */
                #tb-inject-fill, #tb-inject-loop {
                    min-width: 80px;
                    justify-content: center !important;
                }
                /* Cặp nút: viền chung + vạch chia tối */
                .tb-pair {
                    border-radius: 10px;
                    box-shadow: 0 0 0 1px rgba(255,255,255,.14);
                }
                .tb-pair > *:last-child {
                    box-shadow: inset 1px 0 0 rgba(0,0,0,.28);
                }
                /* Hover / active */
                .tb-pair > button {
                    transition: filter .15s ease, transform .1s ease !important;
                }
                .tb-pair > button:hover:not(:disabled) {
                    filter: brightness(1.18);
                }
                .tb-pair > button:active:not(:disabled) {
                    filter: brightness(.92);
                    transform: translateY(1px);
                }
                /* Icon xoay khi đang chạy */
                @keyframes tb-spin { to { transform: rotate(360deg); } }
                .tb-spin svg { animation: tb-spin .8s linear infinite; }

                #tb-fetch-control-wrapper button {
                    cursor: pointer !important;
                    transition: filter .15s ease, transform .1s ease !important;
                }
                #tb-fetch-control-wrapper button:hover {
                    filter: brightness(1.18);
                }
                #tb-fetch-control-wrapper button:active {
                    filter: brightness(.92);
                    transform: translateY(1px);
                }
            `;
            document.head.appendChild(styleEl);
        }

        // --- CÁC NÚT BẤM VÀ INPUT TRONG TOOLBAR ---
        const l3Input = document.createElement('input');
        l3Input.id = 'tb-l3-custom-input';
        l3Input.type = 'text';
        l3Input.placeholder = 'Enter L3...';
        l3Input.style.cssText = 'height: 28px; width: 110px; background-color: #ffffff !important; color: #000000 !important; border: 1px solid #cbd5e1 !important; border-radius: 6px; padding: 0 8px; font-size: 12px; flex-shrink: 0;';

        // Lưu border gốc để trả lại khi blur
        const L3_BORDER_DEFAULT = '1px solid #cbd5e1';

        function setL3Focused(focused) {
            if (focused) {
                l3Input.style.setProperty('border', 'none', 'important');
                l3Input.style.setProperty('outline', 'none', 'important');
                l3Input.style.setProperty('box-shadow', 'none', 'important');
            } else {
                l3Input.style.setProperty('border', L3_BORDER_DEFAULT, 'important');
                l3Input.style.setProperty('border-right', 'none', 'important'); // giữ kiểu dính với nút Fill L3 All
                l3Input.style.removeProperty('box-shadow');
            }
        }

        const dropdown = document.createElement('div');
        dropdown.id = 'tb-l3-dropdown';
        dropdown.style.cssText = 'display: none; position: absolute; top: 32px; left: 0; width: 200px; max-height: 220px; overflow-y: auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; z-index: 99999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';

        let l3ActiveIndex = -1;

        function getL3Items() {
            return [...dropdown.querySelectorAll('.tb-l3-item')];
        }

        function highlightL3(index) {
            const items = getL3Items();
            if (!items.length) return;

            // Vòng lại đầu/cuối danh sách
            if (index < 0) index = items.length - 1;
            if (index >= items.length) index = 0;

            l3ActiveIndex = index;
            items.forEach((el, i) => {
                el.style.background = i === index ? '#d1fae5' : '#ffffff';
                el.style.fontWeight = i === index ? '600' : '400';
            });

            // Tự cuộn dropdown để item đang chọn luôn nhìn thấy
            items[index].scrollIntoView({ block: 'nearest' });
        }

        function selectL3(item) {
            l3Input.value = item;
            dropdown.style.display = 'none';
            l3ActiveIndex = -1;
        }

        function renderDropdown(filter = '') {
            dropdown.innerHTML = '';
            l3ActiveIndex = -1;

            const filtered = GLOBAL_L3_LIST
                .filter(item => item.toLowerCase().includes(filter.toLowerCase()))
                .slice(0, 20);

            if (filtered.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            filtered.forEach((item, i) => {
                const div = document.createElement('div');
                div.className = 'tb-l3-item';
                div.textContent = item;
                div.style.cssText = 'padding: 6px 10px; font-size: 11px; color: #1e293b; cursor: pointer; border-bottom: 1px solid #f1f5f9;';
                // Hover chuột cũng đồng bộ với index của bàn phím
                div.onmouseover = () => highlightL3(i);
                div.onmousedown = (e) => {
                    e.preventDefault();
                    selectL3(item);
                };
                dropdown.appendChild(div);
            });

            dropdown.style.display = 'block';
        }

        l3Input.addEventListener('input', (e) => renderDropdown(e.target.value));
        l3Input.addEventListener('focus', () => {
            setL3Focused(true);
            renderDropdown(l3Input.value);
        });

        l3Input.addEventListener('blur', () => {
            setL3Focused(false);
            setTimeout(() => dropdown.style.display = 'none', 200);
        });

        l3Input.addEventListener('keydown', (e) => {
            const isOpen = dropdown.style.display === 'block';

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                if (!isOpen) renderDropdown(l3Input.value);
                highlightL3(l3ActiveIndex + (e.key === 'ArrowDown' ? 1 : -1));
                return;
            }

            if (e.key === 'Enter' && isOpen) {
                e.preventDefault();
                e.stopPropagation();
                const items = getL3Items();
                // Chưa chọn bằng mũi tên thì Enter lấy item đầu tiên
                const target = items[l3ActiveIndex >= 0 ? l3ActiveIndex : 0];
                if (target) selectL3(target.textContent);
                return;
            }

            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                e.stopPropagation();
                dropdown.style.display = 'none';
                l3ActiveIndex = -1;
            }
        });

        const l3Wrapper = document.createElement('div');
        l3Wrapper.className = 'relative flex items-center shrink-0';
        l3Wrapper.appendChild(l3Input);
        l3Wrapper.appendChild(dropdown);

        const btnFill = document.createElement('button');
        btnFill.id = 'tb-inject-fill';
        btnFill.type = 'button';
        btnFill.className = btnBaseClass;
        btnFill.style.cssText = 'cursor: pointer;';
        setBtn(btnFill, 'fillOne', 'Fill 1', TB_COLORS.fillOne);
        btnFill.addEventListener('click', runFillOne);

        const btnLoop = document.createElement('button');
        btnLoop.id = 'tb-inject-loop';
        btnLoop.type = 'button';
        btnLoop.className = `tb-inject-loop-btn ${btnBaseClass}`;
        btnLoop.style.cssText = 'cursor: pointer;';
        setBtn(btnLoop, 'fillAll', 'Fill All', TB_COLORS.fillAll);
        btnLoop.addEventListener('click', runFillAll);

        const btnFillL3Loop = document.createElement('button');
        btnFillL3Loop.id = 'tb-inject-l3-loop';
        btnFillL3Loop.type = 'button';
        btnFillL3Loop.className = `tb-inject-fill-l3-loop-btn ${btnBaseClass}`;
        btnFillL3Loop.style.cssText = 'cursor: pointer;';
        setBtn(btnFillL3Loop, 'fillL3', 'Fill L3 All', TB_COLORS.fillL3);
        btnFillL3Loop.addEventListener('click', runFillAllL3);

        const btnCopy = document.createElement('button');
        btnCopy.id = 'tb-inject-copy';
        btnCopy.type = 'button';
        btnCopy.className = btnBaseClass;
        btnCopy.style.cssText = 'cursor: pointer; min-width: 70px';
        setBtn(btnCopy, 'copy', 'Copy', TB_COLORS.copy);
        btnCopy.addEventListener('click', runCopySegment);

        const btnPaste = document.createElement('button');
        btnPaste.id = 'tb-inject-paste';
        btnPaste.type = 'button';
        btnPaste.className = btnBaseClass;
        btnPaste.style.cssText = 'cursor: pointer; min-width: 70px';
        setBtn(btnPaste, 'paste', 'Paste', TB_COLORS.paste);
        btnPaste.addEventListener('click', runPasteSegment);

        // --- GHÉP CẶP NÚT THEO TÍNH NĂNG ---
        const PAIR_HEIGHT = '28px';

        function makePair(left, right, title) {
            const group = document.createElement('div');
            group.className = 'tb-pair inline-flex items-center shrink-0';
            group.setAttribute('role', 'group');
            group.title = title;
            group.style.cssText = `height:${PAIR_HEIGHT}; position:relative;`;

            [left, right].forEach((el, i) => {
                el.classList.remove('rounded-md', 'h-7');
                el.style.height = PAIR_HEIGHT;
                el.style.boxSizing = 'border-box';
                // Chỉ bo góc ngoài, không dùng overflow-hidden để dropdown L3 không bị cắt
                el.style.borderRadius = i === 0 ? '10px 0 0 10px' : '0 10px 10px 0';
                group.appendChild(el);
            });

            return group;
        }

        // Ô L3: cùng chiều cao, bo trái, không viền phải để dính vào nút
        l3Wrapper.style.height = PAIR_HEIGHT;
        l3Input.style.height = PAIR_HEIGHT;
        l3Input.style.boxSizing = 'border-box';
        l3Input.style.borderRadius = '10px 0 0 10px';
        l3Input.style.borderRight = 'none';
        l3Input.style.margin = '0';

        helperToolbar.appendChild(makePair(l3Wrapper, btnFillL3Loop, 'Enter L3 - Fill L3 All'));
        helperToolbar.appendChild(makePair(btnFill, btnLoop, 'Fill All - Fill 1'));
        helperToolbar.appendChild(makePair(btnCopy, btnPaste, 'Copy - Paste'));

        headerSection.appendChild(helperToolbar);
    }

    // ---------------------------------------------------------------------
    // 12.3 - TOOLBAR HOTKEYS
    // ---------------------------------------------------------------------
    document.addEventListener('keydown', function (e) {
        // Chỉ kích hoạt khi không gõ trong ô input/textarea khác (ngoại trừ ô nhập L3 tùy chỉnh)
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const activeId = document.activeElement ? document.activeElement.id : '';

        if (activeTag === 'textarea' || (activeTag === 'input' && activeId !== 'tb-l3-custom-input')) {
            return;
        }

        if (e.key === '!') {
            e.preventDefault();
            const btn = document.getElementById('tb-inject-fill');
            if (btn) btn.click();
        } else if (e.key === '@') {
            e.preventDefault();
            const btn = document.getElementById('tb-inject-loop'); // Nút "Fill All" (Loop All)
            if (btn) btn.click();
        } else if (e.key === '#') {
            e.preventDefault();
            const btn = document.getElementById('tb-inject-l3-loop'); // Nút "Fill L3 All"
            if (btn) btn.click();
        } else if (e.key === '$') {
            e.preventDefault();
            const btn = document.getElementById('tb-inject-paste'); // Nút "Paste"
            if (btn) btn.click();
        }
    });

    // ---------------------------------------------------------------------
    // 12.4 - UI REFRESH (debounced observer)
    // ---------------------------------------------------------------------
    function injectUIControls() {
        initTopbarControls();
        injectTaskToolbar();
    }

    let tbUiScheduled = false;
    function scheduleTbUiRefresh() {
        if (tbUiScheduled) return;
        tbUiScheduled = true;
        setTimeout(() => {
            tbUiScheduled = false;
            inject10xButton();
            injectUIControls();
            bindTimelineEarningsObserver();
            if (typeof window.__tbInjectSegUI === 'function') window.__tbInjectSegUI();
        }, 80);
    }
    const tbUiObserver = new MutationObserver(scheduleTbUiRefresh);
    tbUiObserver.observe(document.documentElement, { childList: true, subtree: true });
    scheduleTbUiRefresh();
    console.log('✅ Master Tbrain Script (No Tool in Activity) is ready.');


    /* =====================================================================
     * CODE PATH: 13 - SEGMENT CREATOR
     * Nội dung:
     * - Q = Start, W = End (>= 30s) + tạo + chọn segment
     * - Esc = huỷ Start
     * - Nút Start/End cạnh Zoom
     * ===================================================================== */

    (() => {
        // Helpers riêng (đặt tên tránh trùng sleep/log/now của script gốc)
        const $$s = (s, r = document) => [...r.querySelectorAll(s)];
        const segSleep = ms => new Promise(r => setTimeout(r, ms));
        const segLog = (...a) => console.log("%c[TB-SEG]", "color:#22c55e;font-weight:bold", ...a);
        const getNew30 = () => $$s("button").find(b => /^New 30/.test(b.title || ""));
        const fiberOf = el => el && el[Object.keys(el).find(k => k.startsWith("__reactFiber$"))];
        const vids = () => $$s("video");
        const playhead = () => vids()[0]?.currentTime ?? 0;
        const parseT = s => typeof s === "number" ? s
            : String(s).trim().split(":").map(Number).reduce((a, v) => a * 60 + v, 0);
        const fmtT = t => {
            t = Math.round(t); const h = t / 3600 | 0, m = (t % 3600) / 60 | 0, s = t % 60;
            return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
        };
        const fmtFloor = t => fmtT(Math.floor(t));

        // ---------- 1. Runner mutation của app ----------
        function getRunner() {
            let r = fiberOf(getNew30()); while (r?.return) r = r.return;
            const st = [r];
            while (st.length) {
                const f = st.pop(); if (!f) continue;
                if ([0, 11, 15].includes(f.tag)) {
                    let h = f.memoizedState;
                    while (h && typeof h === "object" && "next" in h) {
                        const cb = Array.isArray(h.memoizedState) ? h.memoizedState[0] : null;
                        if (typeof cb === "function" && cb.toString().includes("Not an episode edit")) return cb;
                        h = h.next;
                    }
                }
                st.push(f.sibling, f.child);
            }
            return null;
        }
        function run(name, params, quiet = false) {
            const runner = getRunner();
            if (!runner) { segLog("⚠️ Không tìm thấy runner"); return null; }
            let res = null;
            try { res = runner(name, params); } catch (e) { if (!quiet) segLog("⚠️", name, e.message); return null; }
            if (!quiet) segLog(res ? "✅" : "⚠️ bị từ chối", name, params);
            return res;
        }

        // ---------- 2. Bỏ chọn segment (Esc) ----------
        async function deselect() {
            window.__tbSkipKey = true;
            try {
                document.activeElement?.blur?.();
                const ev = () => new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true });
                document.body.dispatchEvent(ev()); window.dispatchEvent(ev());
            } finally { window.__tbSkipKey = false; }
            await segSleep(150);
        }

        // ---------- 3. Chọn segment vừa tạo ----------
        async function selectNew(start, newKey) {
            const wants = new Set([fmtT(start), fmtFloor(start)]);
            const findRow = () => $$s('[data-testid^="episode-index-row-"]').find(r => {
                const m = r.innerText.match(/(\d+:)?\d+:\d{2}\s*$/);
                return m && wants.has(m[0].trim());
            });
            let row = null;
            for (let i = 0; i < 15 && !(row = findRow()); i++) await segSleep(100);
            if (row) {
                (row.querySelector("button,[role='button'],a") || row).click();
                await segSleep(300);
                segLog("👉 Đã chọn segment:", row.dataset.testid);
                return true;
            }
            if (newKey) {
                for (const p of [{ key: newKey }, { episodeKey: newKey }, { episodeId: newKey }, { id: newKey }]) {
                    if (run("ui.episode_bench.select", p, true)) { segLog("👉 Đã chọn qua mutation select", p); return true; }
                }
            }
            segLog("⚠️ Không chọn được segment mới", [...wants]);
            return false;
        }

        // ---------- 4. Seek ----------
        async function seekTo(t) {
            vids().forEach(v => (v.currentTime = t));
            await segSleep(200);
            segLog("⏩ Playhead →", fmtT(t));
        }

        // ---------- 5. Tạo segment ----------
        function tryCreate(s, e) {
            return run("ui.episode_bench.create", { startSeconds: s, endSeconds: e })
                ?? run("ui.episode_bench.create", { startSeconds: s, endSeconds: e, newKey: crypto.randomUUID() });
        }
        async function create(start, end) {
            start = parseT(start); end = parseT(end);
            if (!(end > start)) { segLog("⚠️ End phải > Start"); return null; }
            let res = tryCreate(start, end);
            if (!res) {
                segLog("Bị từ chối → bỏ chọn segment rồi thử lại");
                await deselect();
                res = tryCreate(start, end);
            }
            if (res) {
                await selectNew(start, res.newKey);
                await seekTo(end);
            }
            return res;
        }
        let markStart = null;
        const MIN_SEGMENT_SECONDS = 30;
        const TIME_EPSILON = 0.02;
        const BTN_CLASS =
            "relative flex h-7 items-center gap-1.5 rounded border px-2 " +
            "text-[11px] transition-colors duration-150";

        const ICON_Q = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
>
    <path d="M8 5v14"></path>
    <path d="M16 8l-4 4 4 4"></path>
</svg>`;

        const ICON_W = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
>
    <path d="M16 5v14"></path>
    <path d="M8 8l4 4-4 4"></path>
</svg>`;


        const KBD = k => `
<kbd
    class="rounded px-1 font-mono text-2xs"
    style="
        background:rgba(255,255,255,.12);
        color:inherit;
    "
>
    ${k}
</kbd>`;

        function fmtDuration(sec) {
            sec = Math.max(0, Number(sec) || 0);
            const total = Math.floor(sec);
            const h = Math.floor(total / 3600);
            const m = Math.floor((total % 3600) / 60);
            const s = total % 60;
            if (h > 0) {
                return (h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"));
            }
            return (m + ":" + String(s).padStart(2, "0"));
        }

        function setActiveButton(button) {
            button.disabled = false;
            button.style.background = "#2563eb";
            button.style.borderColor = "#60a5fa";
            button.style.color = "#ffffff";

            button.style.boxShadow =
                "0 0 0 1px rgba(96,165,250,.20)," +
                "0 0 8px rgba(37,99,235,.30)";
            button.style.opacity = "1";
            button.style.cursor = "pointer";
        }

        function setMarkedButton(button) {
            button.disabled = true;
            button.style.background = "rgba(245,158,11,.18)";
            button.style.borderColor = "#f59e0b";
            button.style.color = "#fbbf24";
            button.style.boxShadow =
                "0 0 0 1px rgba(245,158,11,.18)," +
                "0 0 8px rgba(245,158,11,.20)";

            button.style.opacity = "1";
            button.style.cursor = "default";
        }

        function setDisabledButton(button) {
            button.disabled = true;
            button.style.background = "transparent";
            button.style.borderColor = "rgba(148,163,184,.25)";
            button.style.color = "#64748b";
            button.style.boxShadow = "none";
            button.style.opacity = "0.5";
            button.style.cursor = "default";
        }

        function updateQW() {
            const q = document.getElementById("tb-mark-q");
            const w = document.getElementById("tb-mark-w");

            if (!q || !w) {
                return;
            }

            if (markStart == null) {
                setActiveButton(q);
                setDisabledButton(w);

                q.innerHTML =
                    `${ICON_Q}` +
                    `<span>Start</span>` +
                    `${KBD("Q")}`;

                w.innerHTML =
                    `${ICON_W}` +
                    `<span>End</span>` +
                    `${KBD("W")}`;

                q.title = "Mark start — Q";
                w.title = "Nhấn Q để chọn Start trước";
                return;
            }

            const current = playhead();
            const duration = Math.abs(current - markStart);
            const canCreate = duration + TIME_EPSILON >= MIN_SEGMENT_SECONDS;

            setDisabledButton(q);
            q.innerHTML =
                `${ICON_Q}` +
                `<span>Start ${fmtT(markStart)}</span>` +
                `${KBD("Q")}`;

            q.title = `Start ${fmtT(markStart)} — Esc để huỷ`;

            if (!canCreate) {
                setMarkedButton(w);
                w.innerHTML =
                    `${ICON_W}` +
                    `<span>End ${fmtDuration(duration)}</span>` +
                    `${KBD("W")}`;

                w.title =
                    `Chưa đủ 30 giây — ` +
                    `${fmtDuration(duration)} / 0:30`;

                return;
            }

            setActiveButton(w);

            w.innerHTML =
                `${ICON_W}` +
                `<span>End ${fmtDuration(duration)}</span>` +
                `${KBD("W")}`;

            w.title = `Duration ${fmtDuration(duration)} — ` + `nhấn W để tạo segment`;
        }

        function markQ() {
            if (markStart != null) {
                segLog("Đã có Start — nhấn Esc để huỷ");
                return;
            }
            markStart = playhead();
            updateQW();
            segLog(`Start = ${fmtT(markStart)}`);
        }

        async function markW() {
            if (markStart == null) {
                segLog("Chưa có Start — nhấn Q trước");
                return;
            }

            let s = markStart;
            let en = playhead();

            if (en < s) {
                [s, en] = [en, s];
            }

            const duration = en - s;
            if (duration + TIME_EPSILON < MIN_SEGMENT_SECONDS) {
                segLog(`Chưa đủ 30s: ${fmtDuration(duration)}`);
                updateQW();
                return;
            }

            const oldStart = markStart;
            markStart = null;

            updateQW();

            const result = await create(s, en);
            if (!result) {
                console.warn("[TB-SEG] App từ chối tạo segment");
                markStart = oldStart;
                updateQW();
                return;
            }
            setTimeout(() => window.tbPan?.run?.(), 450);
        }

        function cancelMark() {
            markStart = null;
            updateQW();
            segLog("Đã huỷ Start");
        }

        // ---------- 7. UI: New 60 s + nút Q / W ----------
        function injectSegUI() {
            const benchTools = document.querySelector('[data-testid="bench-tools"]');

            if (!benchTools)
                return;

            const zoomGroup =
                [...benchTools.querySelectorAll(
                    'div[role="group"]'
                )].find(
                    el =>
                        el.getAttribute("aria-label") ===
                        "Zoom the timeline"
                );

            if (!zoomGroup)
                return;

            let w = document.getElementById("tb11-ui");
            if (w) {
                if (w.parentElement !== benchTools || w.nextElementSibling !== zoomGroup) {
                    benchTools.insertBefore(w, zoomGroup);
                }
                return;
            }

            w = document.createElement("div");
            w.id = "tb11-ui";
            w.style.cssText = "display:flex;" + "align-items:center;" + "gap:0;";

            w.className =
                "flex items-center " +
                "[&>button]:rounded-none " +
                "[&>button:first-of-type]:rounded-l " +
                "[&>button:last-of-type]:rounded-r " +
                "[&>button+button]:-ml-px";

            w.setAttribute("role", "group");
            w.setAttribute("aria-label", "Mark segment");

            const mk = (id, title, fn) => {
                const b = document.createElement("button");
                b.type = "button";
                b.id = id;
                b.title = title;
                b.className = BTN_CLASS;
                b.onclick = e => {
                    e.preventDefault();
                    e.stopPropagation();
                    b.blur();
                    fn();
                };
                return b;
            };

            w.append(
                mk("tb-mark-q", "Mark start — Q", markQ),
                mk("tb-mark-w", "Mark end — W", markW)
            );

            benchTools.insertBefore(w, zoomGroup);
            updateQW();
        }
        window.__tbInjectSegUI = injectSegUI;
        injectSegUI();

        // -------------------------------------------------------
        // Update duration của W theo video
        // Không dùng setInterval
        // -------------------------------------------------------
        let durationVideo = null;

        function bindDurationVideo() {
            const video = document.querySelector("video");

            if (!video || video === durationVideo) {
                return;
            }

            if (durationVideo) {
                durationVideo.removeEventListener("timeupdate", updateQW);
                durationVideo.removeEventListener("seeked", updateQW);
            }

            durationVideo = video;
            video.addEventListener("timeupdate", updateQW, { passive: true });
            video.addEventListener("seeked", updateQW, { passive: true });
        }

        bindDurationVideo();

        // ---------- 8. Phím Q / W / Esc ----------
        const isTyping = e => {
            const el = e.target;
            return el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) ||
                el?.closest?.('[role="combobox"],[role="textbox"],[contenteditable="true"]');
        };

        document.addEventListener("keydown", e => {
            if (window.__tbSkipKey) return;
            if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
            const k = e.key.toLowerCase();
            if (!["q", "w", "escape"].includes(k)) return;
            if (k === "escape" && markStart == null) return;
            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
            if (k === "q") markQ();
            else if (k === "w") markW();
            else cancelMark();
        }, true);

        // ---------- Ctrl+S / Cmd+S = Save draft ----------
        document.addEventListener("keydown", e => {
            if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;

            // Chặn hộp thoại "Save page" của trình duyệt
            e.preventDefault();
            e.stopPropagation();

            const btn = document.querySelector('[data-testid="episode-bench-save-draft"]');
            if (!btn) {
                segLog("⚠️ Không tìm thấy nút Save draft");
                return;
            }
            if (btn.disabled) {
                segLog("⚠️ Save draft đang disabled");
                return;
            }

            // Blur ô đang gõ để React commit giá trị cuối cùng trước khi lưu
            document.activeElement?.blur?.();
            setTimeout(() => {
                btn.click();
                segLog("💾 Save draft (Ctrl+S)");
            }, 50);
        }, true);

        window.tb = { run, create, deselect, selectNew, seekTo, getRunner };
        segLog("Segment Creator ready → Q = Start | W = End + tạo + chọn + playhead về cuối | Esc = huỷ");
    })();


    /* =====================================================================
     * CODE PATH: 14 - TIMELINE AUTO FOLLOW
     * Nội dung:
     * - Playhead > 90% thì pan timeline về 10%
     * ===================================================================== */

    (() => {
        if (window.__tbFollowLoaded) return; window.__tbFollowLoaded = true;

        const TRIGGER = 90, TARGET = 10;   // %
        const PH_SEL = 'div[aria-hidden="true"].bg-brand-blue.w-0\\.5';
        const flog = (...a) => console.log("%c[TB-FOLLOW]", "color:#a855f7;font-weight:bold", ...a);

        let ph = null, disabled = false, busyUntil = 0, mouseDown = false;
        document.addEventListener("pointerdown", () => (mouseDown = true), true);
        document.addEventListener("pointerup", () => (mouseDown = false), true);

        const getPh = () => (ph?.isConnected ? ph : (ph = document.querySelector(PH_SEL)));

        function followCheck() {
            if (disabled || document.hidden || mouseDown || performance.now() < busyUntil) return;
            const v = document.querySelector("video");
            if (!v || v.paused) return;
            const el = getPh(); if (!el) return;

            const p = parseFloat(el.style.left);
            if (!(p >= TRIGGER && p <= 101)) return;

            const box = el.parentElement;
            const R = box.getBoundingClientRect();
            const px = (p - TARGET) / 100 * R.width;
            box.dispatchEvent(new WheelEvent("wheel", {
                bubbles: true, cancelable: true, deltaMode: 0, deltaX: px,
                clientX: R.left + R.width / 2, clientY: R.top + R.height / 2
            }));
            busyUntil = performance.now() + 800;
        }

        // Optimized: follow the player's own timeupdate event instead of polling every 250 ms.
        let followVideo = null;
        function bindFollowVideo() {
            const v = document.querySelector("video");
            if (!v || v === followVideo) return;
            followVideo?.removeEventListener("timeupdate", followCheck);
            followVideo = v;
            followVideo.addEventListener("timeupdate", followCheck, { passive: true });
        }
        bindFollowVideo();
        const followBindObserver = new MutationObserver(bindFollowVideo);
        followBindObserver.observe(document.body, { childList: true, subtree: true });

        window.tbFollow = {
            playhead: getPh,
            off: () => (disabled = true),
            on: () => (disabled = false)
        };
        flog("Auto follow ready – chỉ theo playhead");
    })();
})();
