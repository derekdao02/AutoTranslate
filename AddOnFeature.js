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

    /* =====================================================================
     * CODE PATH: 01-AI - GROQ CONFIG
     * ===================================================================== */
    // Không hard-code key khi upload CDN. Nhập key qua nút "Key" trên topbar.
    const GROQ_API_KEY = "";
    const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const GROQ_MODELS = [
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'openai/gpt-oss-safeguard-20b'
    ];
    const GROQ_MAX_RETRIES_PER_MODEL = 3;
    // 4096: đủ cho 25 kết quả + reasoning, không vượt 8K TPM
    const GROQ_MODEL_OPTIONS = {
        'qwen/qwen3.8-27b': { temperature: 0.6, top_p: 0.95, max_completion_tokens: 4096, reasoning_effort: 'default' },
        'openai/gpt-oss-120b': { temperature: 1, top_p: 1, max_completion_tokens: 4096, reasoning_effort: 'medium' },
        'openai/gpt-oss-20b': { temperature: 1, top_p: 1, max_completion_tokens: 4096, reasoning_effort: 'medium' },
        'openai/gpt-oss-safeguard-20b': { temperature: 1, top_p: 1, max_completion_tokens: 4096, reasoning_effort: 'medium' }
    };
    const AI_RETRY_DELAY_MS = 2000;

    // ---------- AI batch ----------
    const AI_CHUNK_SIZE = 50;             // tối đa 50 mô tả UNIQUE / 1 request
    const AI_CHUNK_DELAY_MS = 15000;      // nghỉ giữa các chunk → ~4 request/phút (8K TPM)

    // ---------- Tbrain API ----------
    const PROJECT_ID = "cfbe006a-9012-41bc-ba3c-afa8a3338139";
    const API_BASE = "https://api.tbrain.ai";
    const API_URL = `${API_BASE}/api/v1/tasks/pool?projectId=${PROJECT_ID}&page=1&pageSize=20`;
    const STATS_API_URL = `${API_BASE}/api/v1/tasks/my-stats?projectId=${PROJECT_ID}`;
    const CLICK_URL = "https://beacon.tbrain.ai";

    // ---------- Auto fetch ----------
    let POLL_INTERVAL = 2000;
    let MIN_DURATION_SECONDS = 7200;
    const TOKEN_RETRY_INTERVAL = 60000;
    const REQUEST_TIMEOUT = 5000;
    const AUTO_ACQUIRE = true;
    const PERF_LOG = true;
    const MIN_SAFE_POLL_INTERVAL = 1000;
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
 * CODE PATH: 03 - VIDEO SPEED 10X / 16X
 * Nội dung:
 * - Inject nút 10x + 16x
 * - Ctrl + Shift > 500ms = 10x
 * - Ctrl + Shift + Alt > 500ms = 16x
 * - Thả phím = khôi phục tốc độ cũ
 * ===================================================================== */

    let pressTimer = null;
    let isHolding = false;
    let activeBoostRate = null;
    // null = chưa bật | "temporary" = giữ Ctrl | "permanent" = phím 6/7
    let boostMode = null;
    const BOOST_HOLD_MS = 400;

    let previousRates = new Map();
    let lastActiveBtn = null;


    // ============================================================
    // 1. INJECT 10X + 16X
    // ============================================================

    function inject10xButton() {
        const ratesContainer =
            document.querySelector('[data-testid="transport-rates"]');

        if (!ratesContainer) return;


        // ---------------- 10X ----------------

        if (!document.getElementById('tb-transport-rate-10')) {
            const btn10x = document.createElement('button');

            btn10x.id = 'tb-transport-rate-10';
            btn10x.type = 'button';
            btn10x.disabled = false;

            btn10x.className =
                'flex h-9 items-center justify-center rounded border ' +
                'border-tb-border text-fg-2 hover:bg-hover ' +
                'w-auto px-2 font-mono text-xs transition-all';

            btn10x.title =
                'Hold Ctrl (400ms) — play at 10x';

            btn10x.setAttribute(
                'data-testid',
                'transport-rate-10'
            );

            btn10x.setAttribute(
                'aria-pressed',
                'false'
            );

            btn10x.textContent = '10x';

            ratesContainer.appendChild(btn10x);
        }


        // ---------------- 16X ----------------

        if (!document.getElementById('tb-transport-rate-16')) {
            const btn16x = document.createElement('button');

            btn16x.id = 'tb-transport-rate-16';
            btn16x.type = 'button';
            btn16x.disabled = false;

            btn16x.className =
                'flex h-9 items-center justify-center rounded border ' +
                'border-tb-border text-fg-2 hover:bg-hover ' +
                'w-auto px-2 font-mono text-xs transition-all';

            btn16x.title =
                'Hold Ctrl+Shift (400ms) — play at 16x';

            btn16x.setAttribute(
                'data-testid',
                'transport-rate-16'
            );

            btn16x.setAttribute(
                'aria-pressed',
                'false'
            );

            btn16x.textContent = '16x';


            // Đặt ngay sau 10x
            const btn10x =
                document.getElementById('tb-transport-rate-10');

            if (btn10x) {
                btn10x.insertAdjacentElement(
                    'afterend',
                    btn16x
                );
            } else {
                ratesContainer.appendChild(btn16x);
            }
        }
    }


    // ============================================================
    // 2. STYLE
    // ============================================================

    function setBoostButtonActive(btn) {
        if (!btn) return;

        btn.disabled = false;

        btn.setAttribute(
            'aria-pressed',
            'true'
        );

        btn.className =
            'flex h-9 items-center justify-center rounded border ' +
            'hover:bg-hover w-auto px-2 font-mono text-xs ' +
            'border-brand-blue bg-brand-blue/15 font-semibold ' +
            'text-fg underline underline-offset-2 opacity-100';
    }


    function setBoostButtonInactive(btn) {
        if (!btn) return;

        // btn.disabled = true;

        btn.setAttribute(
            'aria-pressed',
            'false'
        );

        btn.className =
            'flex h-9 items-center justify-center rounded border ' +
            'border-tb-border text-fg-2 hover:bg-hover ' +
            'w-auto px-2 font-mono text-xs transition-all';
    }


    // ============================================================
    // 3. ACTIVATE 10X / 16X
    // ============================================================

    function activateBoost(rate, mode = "temporary") {
        // ============================================================
        // DON'T BOOST IF VIDEO IS PAUSED
        // ============================================================

        const videos =
            [...document.querySelectorAll("video")];

        // Chỉ temporary mới yêu cầu video đang phát
        if (mode === "temporary") {
            const isAnyVideoPlaying =
                videos.some(video =>
                    !video.paused &&
                    !video.ended &&
                    video.readyState > 0
                );

            if (!isAnyVideoPlaying) {
                return;
            }
        }

        // State cũ không còn khớp video thực tế → reset để boost lại được
        if (
            activeBoostRate !== null &&
            !videos.some(v => v.playbackRate === activeBoostRate)
        ) {
            activeBoostRate = null;
            boostMode = null;
            lastActiveBtn = null;
            previousRates.clear();
        }

        // Đúng rate + mode và video đang chạy đúng tốc độ thì bỏ qua
        if (
            activeBoostRate === rate &&
            boostMode === mode &&
            videos.every(v => v.playbackRate === rate)
        ) {
            return;
        }

        const isAnyVideoPlaying =
            videos.some(video =>
                !video.paused &&
                !video.ended &&
                video.readyState > 0
            );

        if (!isAnyVideoPlaying) {
            return;
        }

        // Đã chạy đúng rate rồi thì không làm lại
        if (activeBoostRate === rate) return;

        const btn10x =
            document.getElementById('tb-transport-rate-10');

        const btn16x =
            document.getElementById('tb-transport-rate-16');

        const ratesContainer =
            document.querySelector('[data-testid="transport-rates"]');


        // Chỉ lưu tốc độ gốc ở lần boost đầu tiên
        if (activeBoostRate === null) {

            if (ratesContainer) {

                lastActiveBtn =
                    ratesContainer.querySelector(
                        '[aria-pressed="true"]'
                    );

                if (
                    lastActiveBtn &&
                    lastActiveBtn !== btn10x &&
                    lastActiveBtn !== btn16x
                ) {
                    lastActiveBtn.setAttribute(
                        'aria-pressed',
                        'false'
                    );

                    lastActiveBtn.className =
                        'flex h-9 items-center justify-center rounded ' +
                        'border border-tb-border text-fg-2 hover:bg-hover ' +
                        'disabled:opacity-40 w-auto px-2 font-mono text-xs';
                }
            }


            document
                .querySelectorAll('video')
                .forEach(v => {

                    if (!previousRates.has(v)) {
                        previousRates.set(
                            v,
                            v.playbackRate
                        );
                    }

                });
        }


        activeBoostRate = rate;
        boostMode = mode;

        // UI
        if (rate === 10) {
            setBoostButtonActive(btn10x);
            setBoostButtonInactive(btn16x);
        }

        if (rate === 16) {
            setBoostButtonInactive(btn10x);
            setBoostButtonActive(btn16x);
        }


        // Video
        document
            .querySelectorAll("video")
            .forEach(v => {

                // Permanent: set cả khi pause | Temporary: chỉ video đang chạy
                if (mode === "permanent" || (!v.paused && !v.ended)) {
                    v.playbackRate = rate;
                }

            });
    }


    // ============================================================
    // 4. DEACTIVATE
    // ============================================================

    function deactivateBoost() {

        const btn10x =
            document.getElementById('tb-transport-rate-10');

        const btn16x =
            document.getElementById('tb-transport-rate-16');


        setBoostButtonInactive(btn10x);
        setBoostButtonInactive(btn16x);


        document
            .querySelectorAll('video')
            .forEach(v => {

                if (previousRates.has(v)) {

                    v.playbackRate =
                        previousRates.get(v);

                    previousRates.delete(v);

                } else {

                    v.playbackRate = 1;

                }

            });


        // Khôi phục button tốc độ gốc
        if (lastActiveBtn) {

            lastActiveBtn.setAttribute(
                'aria-pressed',
                'true'
            );

            lastActiveBtn.className =
                'flex h-9 items-center justify-center rounded border ' +
                'hover:bg-hover disabled:opacity-40 w-auto px-2 ' +
                'font-mono text-xs border-brand-blue bg-brand-blue/15 ' +
                'font-semibold text-fg underline underline-offset-2';

            lastActiveBtn.click();
        }


        lastActiveBtn = null;
        activeBoostRate = null;
        boostMode = null;
    }


    // ============================================================
    // 5. KEYBOARD
    // ============================================================
    // Giữ Ctrl trong 400ms         => 10x
    // Giữ Ctrl + Shift trong 400ms => 16x
    // Alt không còn được sử dụng nên Alt + Click vẫn Add Mark
    // ============================================================

    function clearBoostPressTimer() {
        clearTimeout(pressTimer);

        pressTimer = null;
        isHolding = false;
    }

    // Tốc độ đang giữ (6/7 hoặc click) trước khi nhấn Ctrl/Ctrl+Shift
    let holdRate = null;

    // Boost tạm thời TRÊN tốc độ đang giữ
    function overlayBoost(rate) {
        if (boostMode === "permanent") {
            holdRate = activeBoostRate;
        }

        if (holdRate === null) return;

        activeBoostRate = rate;
        boostMode = "overlay";

        const btn10x = document.getElementById('tb-transport-rate-10');
        const btn16x = document.getElementById('tb-transport-rate-16');

        if (rate === 10) {
            setBoostButtonActive(btn10x);
            setBoostButtonInactive(btn16x);
        } else {
            setBoostButtonInactive(btn10x);
            setBoostButtonActive(btn16x);
        }

        document.querySelectorAll('video').forEach(v => {
            v.playbackRate = rate;
        });
    }

    // Nhả Ctrl → quay về tốc độ đang giữ
    function restoreHold() {
        if (boostMode !== "overlay" || holdRate === null) return;

        const rate = holdRate;
        holdRate = null;

        activateBoost(rate, "permanent");
    }

    function scheduleOverlay(rate) {
        clearBoostPressTimer();
        isHolding = true;

        pressTimer = setTimeout(() => {
            pressTimer = null;

            if (
                isHolding &&
                (boostMode === "permanent" || boostMode === "overlay")
            ) {
                overlayBoost(rate);
            }
        }, BOOST_HOLD_MS);
    }

    function scheduleBoost(rate, condition, mode = "temporary") {
        clearBoostPressTimer();

        isHolding = true;

        pressTimer = setTimeout(() => {
            pressTimer = null;

            if (
                isHolding &&
                condition()
            ) {
                activateBoost(rate, mode);
            }
        }, BOOST_HOLD_MS);
    }

    document.addEventListener(
        "keydown",
        event => {
            if (event.repeat) {
                return;
            }

            const isModifierKey =
                event.key === "Control" ||
                event.key === "Shift" ||
                event.key === "Alt" ||
                event.key === "Meta";

            // Không xử lý tốc độ nếu có Alt hoặc Meta
            // Alt + Click vẫn giữ nguyên chức năng Add Mark
            if (
                event.altKey ||
                event.metaKey
            ) {
                if (activeBoostRate === null) {
                    clearBoostPressTimer();
                }

                return;
            }

            // Đang gõ text thì 6/7 vẫn nhập số bình thường
            const isTyping = document.activeElement?.matches(
                'input, textarea, select, [contenteditable="true"]'
            );

            if (!isTyping && !event.ctrlKey && !event.shiftKey) {
                // Phím 6 → giữ 10x
                if (event.key === '6' || event.code === 'Numpad6') {
                    event.preventDefault();
                    clearBoostPressTimer();
                    activateBoost(10, "permanent");
                    return;
                }

                // Phím 7 → giữ 16x
                if (event.key === '7' || event.code === 'Numpad7') {
                    event.preventDefault();
                    clearBoostPressTimer();
                    activateBoost(16, "permanent");
                    return;
                }
            }

            // Đang giữ 6/7 thì Ctrl / Ctrl+Shift không can thiệp
            // if (boostMode === "permanent") return;

            // Nếu nhấn thêm một phím thường như:
            // Ctrl+S, Ctrl+E, Ctrl+Enter, Ctrl+Shift+C...
            // thì hủy timer để tránh bật tốc độ ngoài ý muốn
            // Ctrl + phím thường (Ctrl+S, Ctrl+Shift+C...) → hủy timer đang chờ
            if (!isModifierKey) {
                if (boostMode !== "temporary") {
                    clearBoostPressTimer();
                }
                return;
            }

            // ========================================================
            // ĐANG GIỮ 10X/16X (phím 6/7 hoặc click nút)
            // Ctrl+Shift → chuyển sang giữ 16x
            // Ctrl       → chuyển sang giữ 10x
            // ========================================================
            // ========================================================
            // ĐANG GIỮ 10X/16X
            // Ctrl+Shift → tạm 16x | Ctrl → tạm 10x | nhả → về tốc độ giữ
            // ========================================================
            if (boostMode === "permanent" || boostMode === "overlay") {
                if (!event.ctrlKey) return;

                const target = event.shiftKey ? 16 : 10;

                // Đã đúng tốc độ → hủy timer đang chờ
                if (target === activeBoostRate) {
                    clearBoostPressTimer();
                    return;
                }

                if (boostMode === "overlay") {
                    // Đang boost rồi → đổi ngay 10x ↔ 16x
                    clearBoostPressTimer();
                    overlayBoost(target);
                } else {
                    // Chưa boost → chờ 400ms
                    scheduleOverlay(target);
                }

                return;
            }

            // ========================================================
            // CTRL + SHIFT = 16X
            // ========================================================
            if (
                event.ctrlKey &&
                event.shiftKey
            ) {
                // Nếu 10x đang chạy, nhấn thêm Shift sẽ lên 16x ngay
                if (activeBoostRate === 10) {
                    clearBoostPressTimer();
                    activateBoost(16);
                    return;
                }

                if (activeBoostRate !== 16) {
                    scheduleBoost(
                        16,
                        () =>
                            activeBoostRate !== 16 &&
                            !document.hidden
                    );
                }

                return;
            }

            // ========================================================
            // CTRL ONLY = 10X
            // ========================================================
            if (
                event.ctrlKey &&
                !event.shiftKey &&
                event.key === "Control" &&
                activeBoostRate === null
            ) {
                scheduleBoost(
                    10,
                    () =>
                        activeBoostRate === null &&
                        !document.hidden
                );
            }
        }
    );


    // ============================================================
    // 6. KEY UP
    // ============================================================

    document.addEventListener(
        "keyup",
        event => {
            // Đang giữ 6/7: nhả phím nào cũng không đổi tốc độ
            // Đang giữ: thả phím không đổi tốc độ,
            // chỉ hủy timer nếu thả trước 400ms
            if (boostMode === "permanent" || boostMode === "overlay") {
                // Nhả Ctrl → về tốc độ đang giữ
                if (event.key === "Control") {
                    clearBoostPressTimer();
                    restoreHold();
                    return;
                }

                // Nhả Shift nhưng vẫn giữ Ctrl → về tạm 10x
                if (event.key === "Shift") {
                    clearBoostPressTimer();

                    if (boostMode === "overlay" && event.ctrlKey) {
                        if (holdRate === 10) {
                            restoreHold();
                        } else {
                            overlayBoost(10);
                        }
                    }
                }

                return;
            }

            // Thả Ctrl thì tắt 10x hoặc 16x
            if (
                event.key === "Control" ||
                !event.ctrlKey
            ) {
                clearBoostPressTimer();

                if (activeBoostRate !== null) {
                    deactivateBoost();
                }

                return;
            }

            // Đang 16x, thả Shift nhưng vẫn giữ Ctrl
            // thì chuyển trực tiếp về 10x
            if (
                event.key === "Shift" &&
                event.ctrlKey &&
                !event.shiftKey
            ) {
                clearBoostPressTimer();

                if (activeBoostRate === 16) {
                    activateBoost(10);
                } else if (activeBoostRate === null) {
                    scheduleBoost(
                        10,
                        () =>
                            activeBoostRate === null &&
                            !document.hidden
                    );
                }
            }
        }
    );


    // ============================================================
    // 7. WINDOW BLUR
    // ============================================================

    window.addEventListener(
        'blur',
        () => {

            isHolding = false;

            clearTimeout(pressTimer);

            // Rời cửa sổ chỉ tắt boost tạm thời
            if (boostMode === "overlay") {
                restoreHold();
            } else if (activeBoostRate !== null && boostMode !== "permanent") {
                deactivateBoost();
            }
        }
    );

    // ============================================================
    // 8. ĐỔI SANG RATE NATIVE → BỎ GIỮ 10X/16X
    // - Click 1x/2x/4x/6x/8x
    // - Phím 1/2/3/4/5 (hotkey mặc định của web)
    // ============================================================
    function getNativeRateButtons() {
        return [
            ...document.querySelectorAll(
                '[data-testid="transport-rates"] [data-testid^="transport-rate-"]'
            )
        ].filter(b =>
            b.id !== 'tb-transport-rate-10' &&
            b.id !== 'tb-transport-rate-16'
        );
    }

    function releasePermanentHold(btn) {
        if (!btn || activeBoostRate === null) return;

        const rate = Number(
            btn.getAttribute('data-testid').replace('transport-rate-', '')
        );

        // Tắt hold TRƯỚC khi web đổi rate
        // → mục 9 không ép ngược về 10x/16x
        clearBoostPressTimer();
        previousRates.clear();
        lastActiveBtn = null;
        activeBoostRate = null;
        boostMode = null;
        holdRate = null;

        setBoostButtonInactive(document.getElementById('tb-transport-rate-10'));
        setBoostButtonInactive(document.getElementById('tb-transport-rate-16'));

        setTimeout(() => {
            // Chọn lại đúng rate cũ thì React không render lại → tự tô sáng
            btn.setAttribute('aria-pressed', 'true');
            btn.className =
                'flex h-9 items-center justify-center rounded border ' +
                'hover:bg-hover disabled:opacity-40 w-auto px-2 ' +
                'font-mono text-xs border-brand-blue bg-brand-blue/15 ' +
                'font-semibold text-fg underline underline-offset-2';

            if (Number.isFinite(rate)) {
                document.querySelectorAll('video').forEach(v => {
                    v.playbackRate = rate;
                });
            }
        }, 0);
    }

    // ---------- Click nút native ----------
    document.addEventListener('click', event => {
        const btn = event.target.closest('[data-testid^="transport-rate-"]');

        if (
            !btn ||
            btn.id === 'tb-transport-rate-10' ||
            btn.id === 'tb-transport-rate-16'
        ) {
            return;
        }

        releasePermanentHold(btn);
    }, true);

    // ---------- Phím 1–5 ----------
    // 1 → nút thứ 1 (1x), 2 → 2x, 3 → 4x, 4 → 6x, 5 → 8x
    document.addEventListener('keydown', event => {
        if (activeBoostRate === null || event.repeat) return;

        if (
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.metaKey
        ) {
            return;
        }

        // Đang gõ Description thì bỏ qua
        const isTyping = document.activeElement?.matches(
            'input, textarea, select, [contenteditable="true"]'
        );
        if (isTyping) return;

        const match = event.code.match(/^(?:Digit|Numpad)([1-5])$/);
        if (!match) return;

        const btn = getNativeRateButtons()[Number(match[1]) - 1];

        // Không preventDefault → web vẫn tự xử lý phím như bình thường
        releasePermanentHold(btn);
    }, true);

    // ============================================================
    // 9. WEB TỰ ĐỔI RATE (seek, đổi segment...) → ÉP GIỮ 10X/16X
    // ============================================================
    ['ratechange', 'play', 'loadedmetadata'].forEach(type => {
        document.addEventListener(type, event => {
            const v = event.target;

            if (
                v instanceof HTMLVideoElement &&
                boostMode === "permanent" &&
                activeBoostRate !== null &&
                v.playbackRate !== activeBoostRate
            ) {
                v.playbackRate = activeBoostRate;
            }
        }, true);
    });

    // ============================================================
    // 10. CLICK 10X / 16X (delegation – không mất khi React render lại)
    // ============================================================
    document.addEventListener('click', event => {
        const btn = event.target.closest(
            '#tb-transport-rate-10, #tb-transport-rate-16'
        );
        if (!btn) return;

        event.preventDefault();
        event.stopPropagation();

        clearBoostPressTimer();
        activateBoost(
            btn.id === 'tb-transport-rate-10' ? 10 : 16,
            "permanent"
        );
    }, true);


    /* =====================================================================
     * CODE PATH: 04 - AI PROMPTS
     * 04.1 Head (single / batch)
     * 04.2 Core rules
     * 04.3 Common site rules + examples
     * 04.4 Task context + prompt builder
     * ===================================================================== */

    // ---------- 04.1 HEAD ----------
    const promptSystem = `Translate the Vietnamese action description into English and classify it.
Return ONLY one JSON object: {"desc":"...","act":"...","skill":"...","difficulty":"..."}`;

    const promptSystemBatch = `Translate and classify each Vietnamese action description. Each input item has "id" and "text".
Return ONLY a JSON array, one object per input: {"id":<same id>,"desc":"...","act":"...","skill":"...","difficulty":"..."}`;

    // ---------- 04.2 CORE ----------
    const PROMPT_CORE = `RULES
DESC: concise English starting with a V-ing verb; concrete, observable MAIN actions in original order. NEVER generic labels ("Crafting custom products", "Performing general handyman work", "Doing manual work") when a specific action can be named. Never invent details. Preparatory actions may appear in desc only.
ACT: lowercase hyphen slug "object-action1ing-action2ing": main object first, each main action once as -ing, original order; no tools/articles/prepositions; no preparatory actions.
SKILL (exactly one, by PRIMARY work):
Pick and Place / Object Handling: move, lift, stack, transfer without altering
Tool Use & Technical Manipulation: hand tools, cutting/shaping/carving/weaving; setting up or operating machines
Food Preparation & Cooking: chop, cook, mix, wash food
Mechanical / Automotive Work: vehicle systems, engines, tires
Repair & Maintenance: fixing damaged parts, furniture, appliances
Assembly & Installation: joining, gluing, screwing, mounting, fastening parts
Construction & Building: bricklaying, plastering, concrete
Cleaning & Sanitation: wiping, sweeping, washing surfaces/parts
Organization & Tidying: arranging, sorting, tidying items
Packing & Bagging: folding boxes, boxing, wrapping, sealing, labeling packages
Clothing & Laundry: measuring/cutting fabric, sewing, stitching, ironing
Inventory & Stock Management: counting, checking stock, inspecting quality
Retail & Service Operations: taking orders, payment, serving customers, selling
Human Interaction & Handoffs: handing items to people, greeting
Healthcare & Caregiving: ALL hair actions, first aid, caregiving
Home Appliance Interaction: microwave, washing machine
Electronics & Diagnostics: soldering, testing/diagnosing electrical faults
Dish Handling: bowls, plates, cups, chopsticks, cutlery
DIFFICULTY:
Easy = simple, repetitive, low dexterity (moving, stacking, wiping, packing).
Medium = tool use, two-hand coordination, some precision or multiple steps, but NO measuring, diagnosis, calibration, or specialized technique.
Hard = tight-tolerance or delicate work (narrow edges, curves, small parts, risk of damage), specialized skill, diagnosis, or heavy/awkward controlled handling.
If truly unsure between Medium and Hard -> Hard. Otherwise keep Medium.
Full example: "Cắt tóc và cạo tóc bằng kéo" -> {"desc":"Cutting and shaving hair with scissors","act":"hair-cutting-shaving","skill":"Healthcare & Caregiving","difficulty":"Hard"}`;

    // ---------- 04.3 COMMON SITE RULES + EXAMPLES ----------
    // Thêm site mới = thêm 1 dòng vào PROMPT_SITES + 1-2 ví dụ vào PROMPT_EXAMPLES
    const PROMPT_SITES = `SITE RULES (apply the group matching TASK CONTEXT/description; they override general rules)
Carton factory: setting up/adjusting/operating carton machines (slotting, erecting, cut position) -> Tool Use & Technical Manipulation; folding/shaping corners, assembling/packing boxes, attaching barcode labels -> Packing & Bagging (barcode is NOT Retail); counting sheets/boxes, checking stock, inspecting defects -> Inventory & Stock Management; lifting/loading/stacking sheets, removing scraps -> Pick and Place / Object Handling; cleaning scraps -> Cleaning & Sanitation.
Restaurant: bowls/plates/chopsticks/cutlery -> Dish Handling; taking orders, payment, serving at table -> Retail & Service Operations; general arranging/tidying -> Organization & Tidying.
Bamboo/rattan workshop: cutting/bending/shaping/weaving strips -> Tool Use & Technical Manipulation; gluing/joining parts to finish a product -> Assembly & Installation; packing finished items -> Packing & Bagging.
Motorcycle shop: core systems (engine, gearbox, brakes, transmission, steering, suspension, wheels) -> ALWAYS Mechanical / Automotive Work, even if "repairing"; auxiliary parts/bodywork/seats -> Repair & Maintenance; testing/diagnosing electrical faults with meters/scanners -> Electronics & Diagnostics; washing vehicle/parts -> Cleaning & Sanitation.
Sewing/upholstery workshop: measuring/cutting/sewing/stitching/aligning fabric -> Clothing & Laundry; operating/adjusting special machines (not sewing) -> Tool Use & Technical Manipulation; stretching/fastening fabric onto seat frames/cushions -> Assembly & Installation; repairing damaged products/machines -> Repair & Maintenance.`;

    const PROMPT_EXAMPLES = `EXAMPLES (desc => skill | difficulty)
Stacking finished bamboo baskets => Pick and Place / Object Handling | Easy
Removing excess cardboard and stacking it => Pick and Place / Object Handling | Easy
Adjusting the slotting machine for cardboard production => Tool Use & Technical Manipulation | Medium
Weaving bamboo baskets by hand => Tool Use & Technical Manipulation | Hard
Chopping vegetables with a knife => Food Preparation & Cooking | Medium
Replacing motorcycle brake pads => Mechanical / Automotive Work | Medium
Repairing a motorcycle engine using tools => Mechanical / Automotive Work | Hard
Replacing damaged motorcycle body panels => Repair & Maintenance | Medium
Gluing bamboo strips into a circular frame => Assembly & Installation | Medium
Stretching and fastening upholstery fabric onto a seat frame => Assembly & Installation | Hard
Laying bricks with mortar => Construction & Building | Hard
Washing and wiping a table => Cleaning & Sanitation | Easy
Arranging tools on a shelf => Organization & Tidying | Easy
Attaching barcode labels to cardboard products => Packing & Bagging | Easy
Folding cardboard corners and feeding them into a carton erecting machine => Packing & Bagging | Hard
Cutting fabric according to a pattern => Clothing & Laundry | Medium
Sewing a car seat cover using a sewing machine => Clothing & Laundry | Hard
Counting cardboard sheets before loading them into the machine => Inventory & Stock Management | Medium
Taking food orders from customers => Retail & Service Operations | Medium
Handing a takeaway order directly to a customer => Human Interaction & Handoffs | Easy
Cutting and shaving hair with scissors => Healthcare & Caregiving | Hard
Loading clothes into a washing machine => Home Appliance Interaction | Easy
Diagnosing motorcycle electrical faults => Electronics & Diagnostics | Hard
Setting the table with bowls and chopsticks => Dish Handling | Easy`;

    // ---------- 04.4a TASK CONTEXT (Site / Environment / Business / Job) ----------
    const TASK_CTX_FIELDS = {
        site: ['Site'],
        env: ['Environment'],
        business: ['Business name', 'Business'],
        job: ['Job']
    };

    // Tìm phần tử có text đúng bằng label → lấy value ở sibling kế bên hoặc phần còn lại của parent
    function readTaskField(names) {
        const want = names.map(n => n.toLowerCase());
        const els = document.querySelectorAll('dt, th, label, span, p, strong, b, div');
        for (const el of els) {
            if (el.children.length > 2) continue;
            const own = (el.textContent || '').trim().replace(/:$/, '').toLowerCase();
            if (!want.includes(own)) continue;

            let v = el.nextElementSibling?.textContent?.trim();
            if (!v) {
                // Trường hợp "JobConstruction laborer" (label + value chung 1 parent)
                const full = el.parentElement?.textContent?.trim() || '';
                v = full.slice(el.textContent.trim().length).replace(/^[:\s]+/, '').trim();
            }
            if (v) return v.replace(/\s+/g, ' ');
        }
        return '';
    }

    function getTaskContext() {
        const ctx = {};
        for (const [k, labels] of Object.entries(TASK_CTX_FIELDS)) ctx[k] = readTaskField(labels);
        console.log('🧾 Task context:', ctx);
        return ctx;
    }

    function buildContextBlock(ctx) {
        if (!ctx) return '';
        const lines = [
            ctx.site && `Site: ${ctx.site}`,
            ctx.env && `Environment: ${ctx.env}`,
            ctx.business && `Business: ${ctx.business}`,
            ctx.job && `Job: ${ctx.job}`
        ].filter(Boolean);
        return lines.length
            ? `TASK CONTEXT (use only to disambiguate skill/difficulty; do NOT copy into desc):\n${lines.join('\n')}`
            : '';
    }

    // ---------- 04.4b PROMPT BUILDER ----------
    function buildPrompt(head, input, ctx = getTaskContext()) {
        const ctxBlock = buildContextBlock(ctx);
        return `${head}\n\n${PROMPT_CORE}\n\n${PROMPT_SITES}\n\n${PROMPT_EXAMPLES}\n\n${ctxBlock ? ctxBlock + '\n\n' : ''}${input}`;
    }

    const promptInput = (text) =>
        `Return valid JSON only, no Markdown.\nInput: ${JSON.stringify(text)}`;

    const promptInputBatch = (items) =>
        `Return a valid JSON array only, no Markdown. Every input id must appear exactly once.\nInput: ${JSON.stringify(items)}`;

    /* =====================================================================
     * CODE PATH: 05 - GROQ AI
     * 05.1 API key
     * 05.2 requestGroqJson (retry + model fallback + parse)
     * 05.3 Normalize result
     * 05.4 Fill 1
     * 05.5 Fill All (dedupe + chunk + map theo id + retry thiếu)
     * ===================================================================== */

    // ---------- 05.1 API KEY ----------
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

    // ---------- 05.2 GROQ CALL ----------
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
        if (!apiKey) throw new Error('Chưa có Groq API Key – nhập qua nút Key');
        let lastError = null;

        for (const model of GROQ_MODELS) {
            let delay = AI_RETRY_DELAY_MS;
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
                    // Lỗi không retry được (400, 401, 404...) → sang model khác luôn
                    if (error.retryable === false || attempt === GROQ_MAX_RETRIES_PER_MODEL) break;
                    await sleep(delay);
                    delay *= 2;
                }
            }
            console.warn(`⚠️ [${label}] ${model} thất bại → chuyển model tiếp theo`);
        }
        throw lastError || new Error('ALL_GROQ_MODELS_FAILED');
    }

    // ---------- 05.3 NORMALIZE ----------
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

    // ---------- 05.4 FILL 1 ----------
    async function aiAnalyzeDescription(text) {
        if (!text) return buildFallbackResult('');
        const prompt = buildPrompt(promptSystem, promptInput(text));

        try {
            let parsed = await requestGroqJson(prompt, 'GROQ SINGLE');
            if (Array.isArray(parsed)) parsed = parsed[0];
            if (!parsed || !parsed.desc || !parsed.act) throw new Error('JSON thiếu desc/act');
            const result = normalizeAiResult(parsed);
            console.log('🤖 [GROQ SINGLE]:', result);
            return result;
        } catch (error) {
            console.error('❌ [GROQ SINGLE] tất cả model đều lỗi:', error);
            throw error;
        }
    }

    // ---------- 05.5 FILL ALL ----------
    function normalizeDescKey(text) {
        return String(text || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // Gửi 1 chunk [{id, text}] → Map(id → result)
    async function aiAnalyzeDescriptionsBatch(items, ctx = getTaskContext()) {
        if (!Array.isArray(items) || items.length === 0) return new Map();

        const prompt = buildPrompt(promptSystemBatch, promptInputBatch(items), ctx);
        let parsed = await requestGroqJson(prompt, 'GROQ BATCH');

        // Một số model bọc array trong object
        if (!Array.isArray(parsed)) parsed = parsed?.results || parsed?.items || parsed?.data;
        if (!Array.isArray(parsed)) throw new Error('Kết quả batch không phải array');

        const validIds = new Set(items.map(x => x.id));
        const map = new Map();
        for (const r of parsed) {
            const id = Number(r?.id);
            if (!validIds.has(id) || map.has(id)) continue; // id lạ / trùng → bỏ
            if (!r.desc || !r.act) continue;                // thiếu field → coi như missing
            map.set(id, normalizeAiResult(r));
        }
        return map;
    }

    // Input : mảng text theo thứ tự segment
    // Output: mảng result CÙNG độ dài, CÙNG thứ tự (null nếu fail)
    async function aiAnalyzeAllSmart(texts, onProgress = () => { }) {
        const results = new Array(texts.length).fill(null);

        const ctx = getTaskContext();
        console.log(`🏭 Site: ${ctx.site || '-'} | ${ctx.business || '-'}`);

        // 1. GROUP: key → { text, indexes: [vị trí segment] }
        const groups = new Map();
        texts.forEach((text, i) => {
            const key = normalizeDescKey(text);
            if (!key) return;
            if (!groups.has(key)) groups.set(key, { text: String(text).trim(), indexes: [] });
            groups.get(key).indexes.push(i);
        });

        const pending = [...groups.values()];
        console.log(`📦 ${texts.length} segments → ${pending.length} unique → gửi AI`);

        // 2. CHUNK unique / request
        const totalChunks = Math.ceil(pending.length / AI_CHUNK_SIZE);
        let anyAiError = null;

        for (let c = 0; c < totalChunks; c++) {
            if (!isFillAllRunning) break;

            const chunk = pending.slice(c * AI_CHUNK_SIZE, (c + 1) * AI_CHUNK_SIZE);
            const items = chunk.map((g, id) => ({ id, text: g.text }));
            onProgress(c + 1, totalChunks, items.length);

            let map = new Map();
            try {
                map = await aiAnalyzeDescriptionsBatch(items, ctx);
            } catch (e) {
                anyAiError = e;
                console.warn(`❌ Chunk ${c + 1}/${totalChunks} lỗi:`, e.message);
            }

            // 3. RETRY 1 lần chỉ những id bị thiếu
            const missing = items.filter(x => !map.has(x.id));
            if (missing.length && isFillAllRunning) {
                console.warn(`🔁 Chunk ${c + 1}: retry ${missing.length} mục thiếu`);
                try {
                    const retry = await aiAnalyzeDescriptionsBatch(missing, ctx);
                    retry.forEach((v, k) => map.set(k, v));
                } catch (e) {
                    anyAiError = e;
                    console.warn('❌ Retry lỗi:', e.message);
                }
            }

            // 4. BROADCAST kết quả về tất cả segment trùng mô tả
            chunk.forEach((g, id) => {
                const res = map.get(id);
                if (res) g.indexes.forEach(i => (results[i] = res));
            });

            // 5. Nghỉ giữa các chunk để không vượt TPM
            if (c < totalChunks - 1 && isFillAllRunning) {
                console.log(`⏳ Nghỉ ${AI_CHUNK_DELAY_MS / 1000}s trước chunk ${c + 2}/${totalChunks}`);
                await sleep(AI_CHUNK_DELAY_MS);
            }
        }

        const failed = results.filter((r, i) => !r && normalizeDescKey(texts[i])).length;
        if (failed) console.warn(`⚠️ ${failed} segment không có kết quả AI → sẽ bị bỏ qua khi điền`);
        if (failed && failed === texts.length) throw anyAiError || new Error('ALL_BATCH_FAILED');

        return results;
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
     * - Khóa/mở nút khi đang chạy
     * - Fill 1 / Fill All / Rework
     * ===================================================================== */
    let isFillAllRunning = false;

    function setAllButtonsDisabled(isDisabled, activeBtnId = null) {
        CONTROL_BUTTON_IDS.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = isDisabled;
            btn.style.opacity = isDisabled ? '0.6' : '1';
            btn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
            if (!isDisabled && id === activeBtnId && btn.dataset.origText) {
                btn.innerHTML = btn.dataset.origText;
                btn.style.backgroundColor = '';
            }
        });
    }

    async function analyzeForFill(description) {
        const result = await aiAnalyzeDescription(description);
        if (!result || typeof result !== 'object') {
            return {
                desc: description,
                act: 'object-action',
                skill: { name: DEFAULT_SKILL },
                difficulty: { name: 'Easy' }
            };
        }
        return {
            desc: result.desc,
            act: result.act,
            skill: { name: result.skill },
            difficulty: { name: result.difficulty }
        };
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

    // Điền 1 kết quả AI vào segment hiện tại (dùng chung cho Fill 1 và Fill All)
    async function applyResultToCurrentSegment(res, root = getCurrentSegmentRoot()) {
        const skillName = typeof res.skill === 'object' ? res.skill.name : res.skill;
        const diffName = typeof res.difficulty === 'object' ? res.difficulty.name : res.difficulty;

        const descEl = getDescriptionElement(root);
        if (descEl && res.desc && res.desc !== descEl.value.trim()) setNativeValue(descEl, res.desc);

        const activityEl = getActivityElement(root);
        if (activityEl && res.act) setNativeValue(activityEl, res.act);

        const skillEl = getSkillGroupElement(root);
        if (skillEl) await setComboBoxValue(skillEl, skillName);
        else clickOptionByText(skillName);

        if (diffName) clickOptionByText(diffName);

        const l3Val = document.getElementById('tb-l3-custom-input')?.value.trim() || '';
        if (l3Val) {
            const sceneEl = getSceneElement(root);
            if (sceneEl) await setComboBoxValue(sceneEl, l3Val);
        }
    }

    // ---------- FILL 1 ----------
    async function runFillOne() {
        const currentBtnId = 'tb-inject-fill';
        setAllButtonsDisabled(true, currentBtnId);
        const btn = document.getElementById(currentBtnId);
        if (btn) {
            clearButtonError(btn);
            setBtn(btn, 'loading', 'Analyzing...', TB_COLORS.loading, true);
            btn.disabled = true;
        }

        try {
            const descEl = getDescriptionElement();
            if (!descEl || !descEl.value.trim()) {
                if (btn) resetFillOneButton(btn);
                return false;
            }

            const result = await analyzeForFill(descEl.value.trim());
            await applyResultToCurrentSegment(result);

            segmentClipboard = readCurrentSegmentData();
            storageSet(CLIPBOARD_KEY, segmentClipboard);

            if (btn) setBtn(btn, 'done', 'Done!', TB_COLORS.done);
            setTimeout(() => btn && resetFillOneButton(btn), 1200);
            return true;
        } catch (err) {
            console.error('Lỗi khi chạy Fill 1:', err);
            if (btn) setButtonError(btn);
            return false;
        } finally {
            setAllButtonsDisabled(false, currentBtnId);
        }
    }

    function resetFillOneButton(btn) {
        clearButtonError(btn);
        setBtn(btn, 'fillOne', 'Fill 1', TB_COLORS.fillOne);
        btn.disabled = false;
    }

    // ---------- FILL ALL ----------
    async function runFillAll() {
        const currentBtnId = 'tb-inject-loop';
        setAllButtonsDisabled(true, currentBtnId);

        try {
            if (isFillAllRunning) { isFillAllRunning = false; return; }

            const episodeButtons = Array.from(document.querySelectorAll('[data-testid^="episode-index-row-"]'));
            if (!episodeButtons.length) { alert('Không tìm thấy danh sách episode.'); return; }

            isFillAllRunning = true;
            const loopButtons = document.querySelectorAll('.tb-inject-loop-btn');
            loopButtons.forEach(b => {
                clearButtonError(b);
                setBtn(b, 'loading', 'Collecting...', TB_COLORS.loading, true);
                b.disabled = true;
            });

            // 1. Thu thập description + nhớ segment tương ứng
            const descriptionsToProcess = [];
            const validButtons = [];
            for (const btn of episodeButtons) {
                if (!isFillAllRunning) break;
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.click();
                await sleep(CONFIG.delayBetweenEpisodes);

                const textVal = getDescriptionElement()?.value.trim() || '';
                if (textVal && textVal !== 'no description yet') {
                    descriptionsToProcess.push(textVal);
                    validButtons.push(btn);
                }
            }

            if (!descriptionsToProcess.length) {
                alert('Không tìm thấy mô tả nào hợp lệ để xử lý.');
                resetFillAllButtons();
                return;
            }

            // 2. Dedupe + chunk → mảng kết quả cùng thứ tự với validButtons
            loopButtons.forEach(b => setBtn(b, 'ai', `AI Analyzing (${descriptionsToProcess.length})...`, null, true));
            const batchResults = await aiAnalyzeAllSmart(descriptionsToProcess, (cur, total, n) => {
                loopButtons.forEach(b => setBtn(b, 'ai', `AI ${cur}/${total} (${n})...`, null, true));
            });

            // 3. Điền kết quả vào từng segment
            loopButtons.forEach(b => setBtn(b, 'write', 'Filling Data...', null, true));
            for (let i = 0; i < validButtons.length; i++) {
                if (!isFillAllRunning) break;
                const res = batchResults[i];
                if (!res) continue;

                validButtons[i].click();
                await sleep(CONFIG.delayBetweenEpisodes);
                await applyResultToCurrentSegment(res);
                await sleep(50);
            }

            resetFillAllButtons();
            console.log('✅ Đã hoàn tất Fill All!');
        } catch (err) {
            console.error('Lỗi khi chạy Fill All:', err);
            isFillAllRunning = false;
            document.querySelectorAll('.tb-inject-loop-btn').forEach(setButtonError);
        } finally {
            setAllButtonsDisabled(false, currentBtnId);
        }
    }

    function resetFillAllButtons() {
        isFillAllRunning = false;
        document.querySelectorAll('.tb-inject-loop-btn').forEach(b => {
            clearButtonError(b);
            setBtn(b, 'fillAll', 'Fill All', TB_COLORS.fillAll);
            b.disabled = false;
        });
    }

    // ---------- REWORK (giữ nguyên) ----------
    async function runReworkTask() {
        const btnRework = document.getElementById('tb-inject-rework');
        if (!btnRework) return;
        setBtn(btnRework, 'loading', 'Processing...', TB_COLORS.loading, true);
        console.log('🔄 Đang thực hiện xử lý Rework task...');
        setTimeout(() => {
            setBtn(btnRework, 'done', 'Done!', TB_COLORS.done);
            setTimeout(() => setBtn(btnRework, 'rework', 'Rework task', TB_COLORS.rework), 1500);
        }, 1000);
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

    let poolCapacityState = {
        held: 0,
        max: 0,
        total: 0
    };

    function updatePoolCapacityUI(held, max, total) {
        poolCapacityState.held = Number(held) || 0;
        poolCapacityState.max = Number(max) || 0;
        poolCapacityState.total = Number(total) || 0;

        const heldEl = document.getElementById(
            'tb-pool-capacity-display'
        );

        const totalEl = document.getElementById(
            'tb-pool-total-display'
        );

        const hasHeld = poolCapacityState.held > 0;

        if (heldEl) {
            heldEl.innerHTML = hasHeld
                ? `<span style="
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #00bf81;
              display: inline-block;
              flex-shrink: 0;
           "></span>
           <span>Held ${poolCapacityState.held}/${poolCapacityState.max}</span>`
                : `<span>Held ${poolCapacityState.held}/${poolCapacityState.max}</span>`;

            heldEl.style.gap = '5px';

            heldEl.style.color =
                hasHeld ? '#39e6ad' : '#94a3b8';

            heldEl.style.backgroundColor =
                hasHeld
                    ? 'rgba(0, 191, 129, 0.13)'
                    : 'rgba(71, 85, 105, 0.20)';

            heldEl.style.borderColor =
                hasHeld
                    ? 'rgba(0, 191, 129, 0.20)'
                    : 'rgba(148, 163, 184, 0.20)';
        }

        if (totalEl) {
            const hasData = poolCapacityState.total > 0;

            totalEl.innerHTML = hasData
                ? `<span style="
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #3b82f6;
              display: inline-block;
              flex-shrink: 0;
           "></span>
           <span>Total ${poolCapacityState.total}</span>`
                : `<span>Total ${poolCapacityState.total}</span>`;

            totalEl.style.gap = '5px';

            totalEl.style.color =
                hasData ? '#93c5fd' : '#94a3b8';

            totalEl.style.backgroundColor =
                hasData
                    ? 'rgba(59, 130, 246, 0.13)'
                    : 'rgba(71, 85, 105, 0.20)';

            totalEl.style.borderColor =
                hasData
                    ? 'rgba(59, 130, 246, 0.20)'
                    : 'rgba(148, 163, 184, 0.20)';
        }
    }

    // const mocks = [
    //     [0, 1, 0],
    //     [0, 1, 5],
    //     [1, 1, 5],
    // ];

    // let i = 0;

    // setInterval(() => {
    //     const [held, max, total] = mocks[i];

    //     updatePoolCapacityUI(held, max, total);

    //     console.log(`Mock: Held ${held}/${max} | Total ${total}`);

    //     i = (i + 1) % mocks.length;
    // }, 2000);

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
        try {
            body = await response.json();
        } catch (_) {
            return getAdaptivePollInterval();
        }

        // ============================================================
        // POOL CAPACITY: held / max
        // ============================================================
        const held = Number(body?.status?.capacity?.held);
        const max = Number(body?.status?.capacity?.max);
        const total = Array.isArray(body?.data)
            ? body.data.length
            : 0;

        if (Number.isFinite(held) && Number.isFinite(max)) {
            updatePoolCapacityUI(held, max, total);
        }

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
        const candidate =
            findToken() || findToken(true);

        if (!candidate) return;

        const earningsEl =
            document.getElementById('tb-earnings-display');

        if (!earningsEl) return;

        try {
            const response = await origFetch.call(
                window,
                STATS_API_URL,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${candidate.token}`,
                        Accept: "*/*"
                    },
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Stats API HTTP ${response.status}`
                );
            }

            const data = await response.json();

            // API mới trả tổng approved time trực tiếp
            const totalSeconds =
                Number(data.approvedSeconds) || 0;

            // 50,000 VND / giờ
            const hours =
                totalSeconds / 3600;

            const totalMoney =
                hours * 50000;

            earningsEl.textContent =
                `💰 ${Math.round(totalMoney).toLocaleString('vi-VN')} đ`;

            earningsEl.title =
                `Approved: ${hours.toFixed(2)}h ` +
                `(${Math.round(totalSeconds).toLocaleString('vi-VN')} giây)`;

        } catch (err) {
            console.error(
                "[TBRAIN] Lỗi cập nhật thu nhập:",
                err
            );
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
    // ---------------------------------------------------------------------
    // 12.1 - TOPBAR
    // ---------------------------------------------------------------------

    function loadTaskMonitorSettings() {
        const storedPoll = Number(
            localStorage.getItem(STORAGE_KEYS.poll)
        );

        const storedDuration = Number(
            localStorage.getItem(STORAGE_KEYS.duration)
        );

        // poll được lưu bằng milliseconds
        if (
            Number.isFinite(storedPoll) &&
            storedPoll >= 500
        ) {
            POLL_INTERVAL = storedPoll;
        }

        // duration được lưu bằng seconds
        if (
            Number.isFinite(storedDuration) &&
            storedDuration >= 0
        ) {
            MIN_DURATION_SECONDS = storedDuration;
        }
    }

    // Load setting ngay khi script khởi chạy
    loadTaskMonitorSettings();


    function initTopbarControls() {
        const themeToggleBtn =
            document.querySelector(
                '[data-testid="theme-toggle"]'
            );

        const appHeader =
            document.querySelector(
                'div[data-app-header="true"]'
            );

        // Chưa có header hoặc đã inject rồi
        if (
            !appHeader ||
            document.getElementById(
                "tb-fetch-control-wrapper"
            )
        ) {
            return;
        }

        const isMobile =
            window.innerWidth < 768;

        let isActive =
            localStorage.getItem(
                STORAGE_KEYS.active
            ) !== null
                ? JSON.parse(
                    localStorage.getItem(
                        STORAGE_KEYS.active
                    )
                )
                : false;


        // ============================================================
        // WRAPPER
        // ============================================================

        const wrapper =
            document.createElement("div");

        wrapper.id =
            "tb-fetch-control-wrapper";


        if (isMobile) {
            wrapper.className =
                "flex items-center gap-2 overflow-x-auto " +
                "py-1.5 px-3 w-full bg-tag-gray-bg/95 " +
                "border-b border-tb-border shrink-0";

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

            if (
                !document.getElementById(
                    "tb-fetch-scroll-style"
                )
            ) {
                const styleEl =
                    document.createElement("style");

                styleEl.id =
                    "tb-fetch-scroll-style";

                styleEl.innerHTML = `
                #tb-fetch-control-wrapper::-webkit-scrollbar {
                    display: none;
                }

                #tb-fetch-control-wrapper > * {
                    flex-shrink: 0 !important;
                }
            `;

                document.head.appendChild(
                    styleEl
                );
            }

        } else {
            wrapper.className =
                "flex items-center gap-2 mr-2 " +
                "bg-tag-gray-bg/40 px-2 py-1 " +
                "rounded-md border border-tb-border " +
                "shrink-0 relative";
        }


        // ============================================================
        // EARNINGS
        // ============================================================

        const earningsDisplay =
            document.createElement("span");

        earningsDisplay.id =
            "tb-earnings-display";

        earningsDisplay.className =
            "text-xs font-bold text-emerald-400 " +
            "whitespace-nowrap mr-1";

        earningsDisplay.textContent =
            "💰 0 đ";

        wrapper.appendChild(
            earningsDisplay
        );

        // ============================================================
        // POOL CAPACITY
        // ============================================================

        const capacityDisplay =
            document.createElement("span");

        capacityDisplay.id =
            "tb-pool-capacity-display";

        capacityDisplay.textContent =
            `Held ${poolCapacityState.held}/${poolCapacityState.max}`;

        capacityDisplay.style.cssText = `
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 7px;

            border: 1px solid rgba(148, 163, 184, 0.20);
            border-radius: 7px;

            background: rgba(71, 85, 105, 0.20);
            color: #94a3b8;

            font-size: 10px;
            font-weight: 600;
            line-height: 1;
            white-space: nowrap;

            transition:
                color 0.15s ease,
                background-color 0.15s ease,
                border-color 0.15s ease,
                box-shadow 0.15s ease;
        `;

        wrapper.appendChild(capacityDisplay);

        const totalDisplay = document.createElement("span");

        totalDisplay.id = "tb-pool-total-display";

        totalDisplay.textContent =
            `Total ${poolCapacityState.total}`;

        totalDisplay.style.cssText = `
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 7px;

            border: 1px solid rgba(148, 163, 184, 0.20);
            border-radius: 7px;

            background: rgba(71, 85, 105, 0.20);
            color: #94a3b8;

            font-size: 10px;
            font-weight: 600;
            line-height: 1;
            white-space: nowrap;
        `;

        wrapper.appendChild(totalDisplay);

        updatePoolCapacityUI(
            poolCapacityState.held,
            poolCapacityState.max,
            poolCapacityState.total
        );


        // ============================================================
        // TAKE TASK BUTTON
        // Không còn arrow và time popup trên topbar
        // ============================================================

        // ============================================================
        // TAKE TASK BUTTON
        // Giữ nguyên DOM giữa ON/OFF để button không bị lệch
        // ============================================================

        const toggleBtn = document.createElement("button");

        toggleBtn.type = "button";

        toggleBtn.style.cssText = `
            height: 24px;
            min-height: 24px;

            padding: 0 9px;
            margin: 0;

            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;

            border: none;
            border-radius: 8px;

            color: #ffffff;

            font-family: inherit;
            font-size: 11px;
            font-weight: 600;
            line-height: 1;

            white-space: nowrap;

            cursor: pointer;

            flex: 0 0 auto;
            align-self: center;
            vertical-align: middle;

            transform: none;

            transition:
                background-color 0.15s ease,
                opacity 0.15s ease;
        `;


        // Icon cố định
        const takeTaskIcon = document.createElement("span");

        takeTaskIcon.textContent = "⏻";
        takeTaskIcon.setAttribute("aria-hidden", "true");

        takeTaskIcon.style.cssText = `
    width: 13px;
    height: 13px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 0;
    margin: 0;

    font-size: 13px;
    line-height: 13px;

    flex: 0 0 13px;

    transform: translateY(0);
`;


        // Text cố định
        const takeTaskText = document.createElement("span");

        takeTaskText.textContent = "Take Task";

        takeTaskText.style.cssText = `
    height: 13px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 0;
    margin: 0;

    font-size: 12px;
    line-height: 13px;

    transform: translateY(0);
`;


        toggleBtn.appendChild(takeTaskIcon);
        toggleBtn.appendChild(takeTaskText);


        function updateToggleButton() {
            // Chỉ đổi màu, không tạo lại icon/text
            toggleBtn.style.backgroundColor =
                isActive
                    ? "#4f46e5"
                    : "#475569";

            toggleBtn.style.opacity =
                isActive
                    ? "1"
                    : "0.88";

            toggleBtn.title =
                isActive
                    ? "Auto Take Task: ON"
                    : "Auto Take Task: OFF";

            toggleBtn.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        }


        updateToggleButton();


        toggleBtn.addEventListener("mouseenter", () => {
            toggleBtn.style.opacity = "0.92";
        });


        toggleBtn.addEventListener("mouseleave", () => {
            toggleBtn.style.opacity =
                isActive
                    ? "1"
                    : "0.88";
        });


        toggleBtn.onclick = event => {
            event.preventDefault();
            event.stopPropagation();

            isActive = !isActive;

            localStorage.setItem(
                STORAGE_KEYS.active,
                JSON.stringify(isActive)
            );

            updateToggleButton();

            if (isActive) {
                stopped = false;

                if (!cycleRunning) {
                    clearTimeout(timer);
                    tick();
                }
            } else {
                stop();
            }
        };


        wrapper.appendChild(toggleBtn);


        wrapper.appendChild(
            toggleBtn
        );

        // ============================================================
        // INSERT TOPBAR
        // ============================================================

        if (isMobile) {
            appHeader.insertAdjacentElement(
                "afterend",
                wrapper
            );

        } else if (themeToggleBtn) {
            themeToggleBtn.insertAdjacentElement(
                "beforebegin",
                wrapper
            );

        } else {
            appHeader.appendChild(
                wrapper
            );
        }


        // ============================================================
        // EARNINGS UPDATE
        // ============================================================

        updateMyEarnings();

        if (!window.__TB_EARNINGS_TIMER__) {
            window.__TB_EARNINGS_TIMER__ =
                setInterval(
                    updateMyEarnings,
                    15000
                );
        }
    }

    // ---------------------------------------------------------------------
    // 12.1B - TASK MONITOR SETTINGS IN USER MENU
    // ---------------------------------------------------------------------

    function createUserMenuSettingField({
        label,
        description,
        value,
        unit,
        step,
        min
    }) {
        const field =
            document.createElement("label");

        field.style.cssText = `
        display: block;
        margin-top: 8px;
        cursor: default;
    `;


        // ============================================================
        // LABEL ROW
        // ============================================================

        const labelRow =
            document.createElement("div");

        labelRow.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
    `;


        const labelElement =
            document.createElement("span");

        labelElement.textContent =
            label;

        labelElement.className =
            "text-xs font-medium text-fg-2";


        const descriptionElement =
            document.createElement("span");

        descriptionElement.textContent =
            description;

        descriptionElement.className =
            "text-[9px] text-fg-faint";

        descriptionElement.style.cssText = `
        white-space: nowrap;
    `;


        labelRow.appendChild(
            labelElement
        );

        labelRow.appendChild(
            descriptionElement
        );


        // ============================================================
        // INPUT BOX
        // ============================================================

        const inputBox =
            document.createElement("div");

        inputBox.className =
            "flex items-center overflow-hidden rounded-md " +
            "border border-tb-border bg-canvas";

        inputBox.style.cssText = `
        width: 100%;
        height: 30px;
        box-sizing: border-box;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background-color 0.15s ease;
    `;


        const input =
            document.createElement("input");

        input.type =
            "number";

        input.value =
            String(value);

        input.step =
            String(step);

        input.min =
            String(min);

        input.inputMode =
            "decimal";

        input.className =
            "min-w-0 flex-1 bg-transparent px-2 " +
            "text-right text-xs font-semibold text-fg " +
            "outline-none";

        input.style.cssText = `
        height: 100%;
        min-width: 0;
        border: none;
        background: transparent;
        color: inherit;
        outline: none;
        box-shadow: none;
    `;


        const unitElement =
            document.createElement("span");

        unitElement.textContent =
            unit;

        unitElement.className =
            "border-l border-tb-border text-fg-faint";

        unitElement.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        min-width: 40px;
        padding: 0 8px;
        font-size: 10px;
        font-weight: 600;
        user-select: none;
    `;


        // ============================================================
        // FOCUS STYLE
        // ============================================================

        input.addEventListener(
            "focus",
            () => {
                inputBox.style.borderColor =
                    "#3b82f6";

                inputBox.style.boxShadow =
                    "0 0 0 2px rgba(59, 130, 246, 0.14)";

                inputBox.style.backgroundColor =
                    "rgba(59, 130, 246, 0.04)";
            }
        );


        input.addEventListener(
            "blur",
            () => {
                inputBox.style.borderColor =
                    "";

                inputBox.style.boxShadow =
                    "";

                inputBox.style.backgroundColor =
                    "";
            }
        );


        // Không để click/input đóng user menu
        [
            "click",
            "pointerdown",
            "mousedown"
        ].forEach(eventName => {
            input.addEventListener(
                eventName,
                event => {
                    event.stopPropagation();
                }
            );

            inputBox.addEventListener(
                eventName,
                event => {
                    event.stopPropagation();
                }
            );
        });


        inputBox.appendChild(
            input
        );

        inputBox.appendChild(
            unitElement
        );

        field.appendChild(
            labelRow
        );

        field.appendChild(
            inputBox
        );


        return {
            field,
            input,
            inputBox
        };
    }


    function showSettingsSavedState(
        inputBox,
        textElement
    ) {
        const originalText =
            textElement.textContent;

        inputBox.style.borderColor =
            "#10b981";

        inputBox.style.boxShadow =
            "0 0 0 2px rgba(16, 185, 129, 0.12)";

        textElement.textContent =
            "Saved";

        textElement.style.color =
            "#10b981";


        clearTimeout(
            inputBox.__tbSavedTimer
        );

        inputBox.__tbSavedTimer =
            setTimeout(() => {
                inputBox.style.borderColor =
                    "";

                inputBox.style.boxShadow =
                    "";

                textElement.textContent =
                    originalText;

                textElement.style.color =
                    "";
            }, 1000);
    }


    function injectToolSettingsToUserMenu() {
        const menu = document.querySelector(
            '[data-testid="user-menu"]'
        );

        if (!menu) {
            return;
        }


        // Tránh inject trùng khi React cập nhật DOM
        if (
            menu.querySelector(
                '[data-tbrain-tool-settings="true"]'
            )
        ) {
            return;
        }


        // Đồng bộ dữ liệu mới nhất trong localStorage
        loadTaskMonitorSettings();


        // ============================================================
        // ROOT SETTINGS
        // ============================================================

        const settings = document.createElement("div");

        settings.setAttribute(
            "data-tbrain-tool-settings",
            "true"
        );

        settings.style.cssText = `
        width: 100%;
        box-sizing: border-box;

        margin: 5px 0;
        padding: 8px;

        border-top: 1px solid rgba(148, 163, 184, 0.18);
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    `;


        // Ngăn việc click vào setting làm đóng menu
        [
            "click",
            "mousedown",
            "pointerdown"
        ].forEach(eventName => {
            settings.addEventListener(
                eventName,
                event => {
                    event.stopPropagation();
                }
            );
        });


        // ============================================================
        // HEADER
        // ============================================================

        const header = document.createElement("div");

        header.style.cssText = `
        height: 16px;

        display: flex;
        align-items: center;
        justify-content: space-between;

        margin-bottom: 7px;
    `;


        const title = document.createElement("span");

        title.textContent = "TASK MONITOR";

        title.style.cssText = `
        color: #94a3b8;

        font-size: 10px;
        font-weight: 600;
        line-height: 1;

        letter-spacing: 0.5px;
    `;


        const status = document.createElement("span");

        status.textContent = "";

        status.style.cssText = `
        color: #10b981;

        font-size: 9px;
        font-weight: 500;
        line-height: 1;

        opacity: 0;

        transition: opacity 0.15s ease;
    `;


        header.appendChild(title);
        header.appendChild(status);

        settings.appendChild(header);


        // ============================================================
        // SAVED INDICATOR
        // ============================================================

        function showSaved() {
            status.textContent = "Saved";
            status.style.opacity = "1";

            clearTimeout(status.__tbSavedTimer);

            status.__tbSavedTimer =
                setTimeout(() => {
                    status.style.opacity = "0";
                }, 1000);
        }


        // ============================================================
        // ERROR INDICATOR
        // ============================================================

        function showInputError(inputBox) {
            inputBox.style.borderColor = "#ef4444";
            inputBox.style.boxShadow =
                "0 0 0 2px rgba(239, 68, 68, 0.12)";

            setTimeout(() => {
                inputBox.style.borderColor =
                    "rgba(148, 163, 184, 0.22)";

                inputBox.style.boxShadow = "none";
            }, 1000);
        }


        // ============================================================
        // COMPACT NUMBER FIELD
        // ============================================================

        function createCompactField({
            label,
            value,
            unit,
            step = 1,
            min = 0,
            title = ""
        }) {
            const row = document.createElement("div");

            row.style.cssText = `
            min-height: 28px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 8px;

            margin-bottom: 5px;
        `;


            const labelElement =
                document.createElement("span");

            labelElement.textContent = label;

            labelElement.style.cssText = `
            flex: 1;
            min-width: 0;

            color: #cbd5e1;

            font-size: 11px;
            font-weight: 500;
            line-height: 13px;

            white-space: nowrap;
        `;


            const inputBox =
                document.createElement("div");

            inputBox.style.cssText = `
            width: 92px;
            height: 26px;

            display: flex;
            align-items: center;

            overflow: hidden;

            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 7px;

            background: rgba(2, 6, 23, 0.68);

            box-sizing: border-box;

            transition:
                border-color 0.15s ease,
                box-shadow 0.15s ease,
                background-color 0.15s ease;
        `;


            const input = document.createElement("input");

            input.type = "number";
            input.value = String(value);
            input.step = String(step);
            input.min = String(min);
            input.inputMode = "decimal";
            input.title = title;

            input.style.cssText = `
            width: 100%;
            min-width: 0;
            height: 100%;

            padding: 0 7px;
            margin: 0;

            border: none;
            outline: none;
            box-shadow: none;

            background: transparent;
            color: #f8fafc;

            font-family: inherit;
            font-size: 11px;
            font-weight: 600;
            line-height: 1;

            text-align: right;

            appearance: textfield;
            -moz-appearance: textfield;
        `;


            const unitElement =
                document.createElement("span");

            unitElement.textContent = unit;

            unitElement.style.cssText = `
            min-width: 31px;

            align-self: stretch;

            display: inline-flex;
            align-items: center;
            justify-content: center;

            padding: 0 6px;

            border-left: 1px solid rgba(148, 163, 184, 0.14);

            color: #94a3b8;

            font-size: 9px;
            font-weight: 600;
            line-height: 1;

            user-select: none;
        `;


            input.addEventListener("focus", () => {
                inputBox.style.borderColor = "#6366f1";

                inputBox.style.boxShadow =
                    "0 0 0 2px rgba(99, 102, 241, 0.12)";

                inputBox.style.backgroundColor =
                    "rgba(15, 23, 42, 0.95)";
            });


            input.addEventListener("blur", () => {
                inputBox.style.borderColor =
                    "rgba(148, 163, 184, 0.22)";

                inputBox.style.boxShadow = "none";

                inputBox.style.backgroundColor =
                    "rgba(2, 6, 23, 0.68)";
            });


            input.addEventListener(
                "wheel",
                event => {
                    if (
                        document.activeElement === input
                    ) {
                        event.preventDefault();
                    }
                },
                {
                    passive: false
                }
            );


            inputBox.appendChild(input);
            inputBox.appendChild(unitElement);

            row.appendChild(labelElement);
            row.appendChild(inputBox);


            return {
                row,
                input,
                inputBox
            };
        }


        // ============================================================
        // CHECK INTERVAL
        // User nhập seconds
        // Tool lưu milliseconds
        // 1.9 sec -> 1900 ms
        // ============================================================

        const pollField = createCompactField({
            label: "Check every",
            value: POLL_INTERVAL / 1000,
            unit: "sec",
            step: 0.1,
            min: 0.5,
            title: "Time between task checks"
        });


        function savePollInterval() {
            const seconds = Number(
                pollField.input.value
            );

            if (
                !Number.isFinite(seconds) ||
                seconds < 0.5
            ) {
                pollField.input.value = String(
                    POLL_INTERVAL / 1000
                );

                showInputError(
                    pollField.inputBox
                );

                return;
            }


            const milliseconds = Math.round(
                seconds * 1000
            );


            POLL_INTERVAL = milliseconds;


            localStorage.setItem(
                STORAGE_KEYS.poll,
                String(milliseconds)
            );


            pollField.input.value = String(
                milliseconds / 1000
            );


            showSaved();


            console.log(
                `[TBRAIN] Check interval: ` +
                `${seconds} sec -> ` +
                `${milliseconds} ms`
            );
        }


        pollField.input.addEventListener(
            "change",
            savePollInterval
        );


        pollField.input.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                savePollInterval();
                pollField.input.blur();
            }
        );


        // ============================================================
        // MIN TASK LENGTH
        // User nhập minutes
        // Tool lưu seconds
        // 50 min -> 3000 sec
        // ============================================================

        const durationField = createCompactField({
            label: "Min length",
            value: MIN_DURATION_SECONDS / 60,
            unit: "min",
            step: 1,
            min: 0,
            title: "Minimum task length in minutes"
        });


        function saveTaskDuration() {
            const minutes = Number(
                durationField.input.value
            );

            if (
                !Number.isFinite(minutes) ||
                minutes < 0
            ) {
                durationField.input.value =
                    String(
                        MIN_DURATION_SECONDS / 60
                    );

                showInputError(
                    durationField.inputBox
                );

                return;
            }


            const seconds = Math.round(
                minutes * 60
            );


            MIN_DURATION_SECONDS = seconds;


            localStorage.setItem(
                STORAGE_KEYS.duration,
                String(seconds)
            );


            durationField.input.value =
                String(seconds / 60);


            showSaved();


            console.log(
                `[TBRAIN] Min task length: ` +
                `${minutes} min -> ` +
                `${seconds} sec`
            );
        }


        durationField.input.addEventListener(
            "change",
            saveTaskDuration
        );


        durationField.input.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                saveTaskDuration();
                durationField.input.blur();
            }
        );


        settings.appendChild(
            pollField.row
        );

        settings.appendChild(
            durationField.row
        );


        // ============================================================
        // GROQ API KEY
        // ============================================================

        const keyRow = document.createElement("div");

        keyRow.style.cssText = `
        min-height: 28px;

        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 8px;

        margin-top: 2px;
        padding-top: 7px;

        border-top: 1px solid rgba(148, 163, 184, 0.14);
    `;


        const keyLabel = document.createElement("span");

        keyLabel.textContent = "Groq key";

        keyLabel.style.cssText = `
        flex: 1;

        color: #cbd5e1;

        font-size: 11px;
        font-weight: 500;
        line-height: 13px;

        white-space: nowrap;
    `;


        const keyBox = document.createElement("div");

        keyBox.style.cssText = `
        width: 122px;
        height: 26px;

        display: flex;
        align-items: center;

        overflow: hidden;

        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 7px;

        background: rgba(2, 6, 23, 0.68);

        box-sizing: border-box;

        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background-color 0.15s ease;
    `;


        const keyInput = document.createElement("input");

        keyInput.type = "password";
        keyInput.value = getStoredApiKey() || "";
        keyInput.placeholder = "gsk_...";
        keyInput.autocomplete = "off";

        keyInput.style.cssText = `
        flex: 1;
        min-width: 0;
        height: 100%;

        padding: 0 7px;
        margin: 0;

        border: none;
        outline: none;
        box-shadow: none;

        background: transparent;
        color: #f8fafc;

        font-family: inherit;
        font-size: 10px;
        line-height: 1;
    `;


        const showKeyButton =
            document.createElement("button");

        showKeyButton.type = "button";
        showKeyButton.textContent = "Show";

        showKeyButton.style.cssText = `
        height: 100%;

        padding: 0 7px;
        margin: 0;

        border: none;
        border-left: 1px solid rgba(148, 163, 184, 0.14);

        background: transparent;
        color: #94a3b8;

        font-family: inherit;
        font-size: 9px;
        font-weight: 600;
        line-height: 1;

        cursor: pointer;
    `;


        showKeyButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();

                const isHidden =
                    keyInput.type === "password";

                keyInput.type =
                    isHidden
                        ? "text"
                        : "password";

                showKeyButton.textContent =
                    isHidden
                        ? "Hide"
                        : "Show";
            }
        );


        keyInput.addEventListener("focus", () => {
            keyBox.style.borderColor = "#6366f1";

            keyBox.style.boxShadow =
                "0 0 0 2px rgba(99, 102, 241, 0.12)";

            keyBox.style.backgroundColor =
                "rgba(15, 23, 42, 0.95)";
        });


        keyInput.addEventListener("blur", () => {
            keyBox.style.borderColor =
                "rgba(148, 163, 184, 0.22)";

            keyBox.style.boxShadow = "none";

            keyBox.style.backgroundColor =
                "rgba(2, 6, 23, 0.68)";
        });


        function saveGroqKey() {
            const value =
                keyInput.value.trim();

            saveStoredApiKey(value);

            showSaved();

            console.log(
                value
                    ? "[TBRAIN] Groq API key saved"
                    : "[TBRAIN] Groq API key cleared"
            );
        }


        keyInput.addEventListener(
            "change",
            saveGroqKey
        );


        keyInput.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                saveGroqKey();
                keyInput.blur();
            }
        );


        keyBox.appendChild(keyInput);
        keyBox.appendChild(showKeyButton);

        keyRow.appendChild(keyLabel);
        keyRow.appendChild(keyBox);

        settings.appendChild(keyRow);


        // ============================================================
        // INSERT TRƯỚC LOGOUT
        // ============================================================

        const logout = menu.querySelector(
            '[data-testid="user-menu-logout"]'
        );


        if (logout) {
            const divider =
                logout.previousElementSibling;

            if (
                divider &&
                divider.classList.contains(
                    "border-t"
                )
            ) {
                menu.insertBefore(
                    settings,
                    divider
                );
            } else {
                menu.insertBefore(
                    settings,
                    logout
                );
            }
        } else {
            menu.appendChild(settings);
        }
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
        // ============================================================
        // CTRL + S = SAVE DRAFT
        // ============================================================

        if (
            e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            e.key.toLowerCase() === 's'
        ) {
            // Chặn Save Page mặc định của browser
            e.preventDefault();
            e.stopPropagation();

            const saveBtn = [
                ...document.querySelectorAll('button')
            ].find(btn =>
                btn.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes('save draft')
            );

            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();

                console.log('💾 Save Draft');
            } else {
                console.warn(
                    '[TBRAIN] Không tìm thấy button Save Draft.'
                );
            }

            return;
        }

        // Ctrl + Shift + C = Copy
        if (
            e.ctrlKey &&
            e.shiftKey &&
            !e.altKey &&
            e.key.toLowerCase() === 'c'
        ) {
            e.preventDefault();
            e.stopPropagation();

            const btn =
                document.getElementById('tb-inject-copy');

            if (btn && !btn.disabled) {
                btn.click();
            }

            return;
        }


        // Ctrl + Shift + V = Paste
        if (
            e.ctrlKey &&
            e.shiftKey &&
            !e.altKey &&
            e.key.toLowerCase() === 'v'
        ) {
            e.preventDefault();
            e.stopPropagation();

            const btn =
                document.getElementById('tb-inject-paste');

            if (btn && !btn.disabled) {
                btn.click();
            }

            return;
        }

        // ============================================================
        // CTRL + SHIFT + ENTER = FILL ALL
        // ============================================================

        if (
            e.ctrlKey &&
            e.shiftKey &&
            !e.altKey &&
            e.key === "Enter"
        ) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const btn =
                document.getElementById("tb-inject-loop");

            if (btn && !btn.disabled) {
                btn.click();
            } else {
                console.warn(
                    "[TBRAIN] Fill All button not found or disabled."
                );
            }

            return;
        }

        // ============================================================
        // CTRL + E = FOCUS L3 INPUT
        // ============================================================

        if (
            e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            e.key.toLowerCase() === "e"
        ) {
            e.preventDefault();
            e.stopPropagation();

            const input =
                document.getElementById(
                    "tb-l3-custom-input"
                );

            if (input) {
                input.focus();

                // Đặt con trỏ cuối text hiện tại
                const len = input.value.length;

                input.setSelectionRange(
                    len,
                    len
                );
            }

            return;
        }


        // ============================================================
        // CTRL + ENTER = FILL L3 ALL
        // ============================================================

        if (
            e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            e.key === "Enter"
        ) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const btn =
                document.getElementById(
                    "tb-inject-l3-loop"
                );

            if (
                btn &&
                !btn.disabled
            ) {
                btn.click();
            }

            return;
        }

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
        injectToolSettingsToUserMenu();
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

    // =====================================================================
    // CODE PATH: 12.5 - LOAD ADD-ON REPORT
    // =====================================================================

    const ADDON_REPORT_URL =
        'https://raw.githubusercontent.com/derekdao02/AutoTranslate/refs/heads/main/AddOnReport.js';

    async function loadAddOnReport() {
        // Chống load trùng
        if (window.__TB_ADDON_REPORT_LOADING__) return;
        if (window.__TB_ADDON_REPORT_LOADED__) return;

        window.__TB_ADDON_REPORT_LOADING__ = true;

        try {
            console.log('⏳ Loading AddOnReport.js...');

            const response = await fetch(
                ADDON_REPORT_URL,
                {
                    cache: 'no-store'
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status} ${response.statusText}`
                );
            }

            const code = await response.text();

            if (!code.trim()) {
                throw new Error('AddOnReport.js is empty');
            }

            // Chạy ở global scope.
            // CSP hiện tại có 'unsafe-eval'.
            (0, eval)(
                `${code}\n//# sourceURL=AddOnReport.js`
            );

            window.__TB_ADDON_REPORT_LOADED__ = true;

            console.log('✅ AddOnReport.js loaded successfully.');

        } catch (error) {

            window.__TB_ADDON_REPORT_LOADED__ = false;

            console.error(
                '❌ Failed to load AddOnReport.js:',
                error
            );

        } finally {

            window.__TB_ADDON_REPORT_LOADING__ = false;
        }
    }


    // ============================================================
    // LOAD SAU KHI PAGE LOAD XONG
    // ============================================================

    if (document.readyState === 'complete') {

        loadAddOnReport();

    } else {

        window.addEventListener(
            'load',
            () => loadAddOnReport(),
            { once: true }
        );

    }

    // Nếu trang load xong rồi thì chạy luôn.
    // Nếu chưa thì chờ toàn bộ page load xong.
    if (document.readyState === 'complete') {
        loadAddOnReport();
    } else {
        window.addEventListener(
            'load',
            loadAddOnReport,
            { once: true }
        );
    }

    console.log('✅ Master Tbrain Script (No Tool in Activity) is ready.');


    /* =====================================================================
 * CODE PATH: 13 - RESIZE SELECTED SEGMENT END TO PLAYHEAD
 * ---------------------------------------------------------------------
 * W:
 * - Lấy segment đang selected
 * - Lấy vị trí timing line / playhead hiện tại
 * - Resize cạnh RIGHT / END của segment tới timing line
 * - Giữ nguyên Start
 * - Không tạo segment mới
 * ===================================================================== */

    (() => {

        // ============================================================
        // 13.1 - HELPERS
        // ============================================================

        function getSelectedSegment() {
            return document.querySelector(
                '[data-selected="true"][data-key]'
            );
        }


        function getRecordingLane(segment) {
            return (
                segment?.closest(
                    '[data-testid="recording-lane"]'
                ) ||
                document.querySelector(
                    '[data-testid="recording-lane"]'
                )
            );
        }


        function getRightHandle(segment) {
            return segment?.querySelector(
                '[data-handle="r"]'
            );
        }

        function getLeftHandle(segment) {
            return segment?.querySelector(
                '[data-handle="l"]'
            );
        }

        // ============================================================
        // 13.2 - FIND CURRENT PLAYHEAD
        // ============================================================

        function getSegmentPlayhead(lane) {
            if (!lane) return null;

            const laneRect =
                lane.getBoundingClientRect();

            const candidates = [
                ...document.querySelectorAll(
                    '[style*="left:"]'
                )
            ]
                .map(el => ({
                    el,
                    rect: el.getBoundingClientRect(),
                    className:
                        typeof el.className === "string"
                            ? el.className
                            : ""
                }))
                .filter(({ rect, className }) => (
                    rect.width > 0 &&
                    rect.width <= 3 &&

                    rect.height >= 30 &&

                    rect.left >= laneRect.left &&
                    rect.left <= laneRect.right &&

                    rect.top < laneRect.bottom &&
                    rect.bottom > laneRect.top &&

                    className.includes("absolute") &&
                    className.includes("bg-brand-blue")
                ))
                .sort(
                    (a, b) =>
                        b.rect.height -
                        a.rect.height
                );

            return candidates[0]?.el || null;
        }


        // ============================================================
        // 13.3 - WAIT FOR REACT UPDATE
        // ============================================================

        function waitResizeFrame() {
            return new Promise(resolve => {

                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });

            });
        }


        // ============================================================
        // 13.4 - POINTER EVENT
        // ============================================================

        function dispatchResizePointer(
            target,
            type,
            x,
            y,
            pointerId
        ) {

            const released =
                type === "pointerup" ||
                type === "pointercancel" ||
                type === "lostpointercapture";


            const event =
                new PointerEvent(type, {

                    bubbles: true,
                    cancelable: true,
                    composed: true,

                    pointerId,
                    pointerType: "mouse",
                    isPrimary: true,

                    clientX: x,
                    clientY: y,

                    button: 0,

                    buttons:
                        released
                            ? 0
                            : 1,

                    pressure:
                        released
                            ? 0
                            : 0.5
                });


            target.dispatchEvent(event);

            return event;
        }


        // ============================================================
        // 13.5 - CLEANUP RESIZE STATE
        // ============================================================

        function cleanupSegmentResize(
            lane,
            x,
            y,
            pointerId
        ) {

            // Pointer Up
            try {

                dispatchResizePointer(
                    lane,
                    "pointerup",
                    x,
                    y,
                    pointerId
                );

            } catch { }


            // Pointer Cancel
            try {

                dispatchResizePointer(
                    lane,
                    "pointercancel",
                    x,
                    y,
                    pointerId
                );

            } catch { }


            // Lost Pointer Capture
            try {

                dispatchResizePointer(
                    lane,
                    "lostpointercapture",
                    x,
                    y,
                    pointerId
                );

            } catch { }


            // Release Pointer Capture
            try {

                if (
                    lane.hasPointerCapture?.(
                        pointerId
                    )
                ) {

                    lane.releasePointerCapture(
                        pointerId
                    );

                }

            } catch { }

        }


        // ============================================================
        // 13.6 - RESIZE END → PLAYHEAD
        // ============================================================

        async function resizeSelectedSegmentStart() {

            const segment =
                getSelectedSegment();

            if (!segment) {
                console.warn(
                    "[Segment Resize] No selected segment."
                );

                return false;
            }


            const lane =
                getRecordingLane(segment);

            if (!lane) {
                console.warn(
                    "[Segment Resize] recording-lane not found."
                );

                return false;
            }


            const handle =
                getLeftHandle(segment);

            if (!handle) {
                console.warn(
                    "[Segment Resize] Start handle not found."
                );

                return false;
            }


            const playhead =
                getSegmentPlayhead(lane);

            if (!playhead) {
                console.warn(
                    "[Segment Resize] Playhead not found."
                );

                return false;
            }


            // ========================================================
            // POSITIONS
            // ========================================================

            const segmentRect =
                segment.getBoundingClientRect();

            const handleRect =
                handle.getBoundingClientRect();

            const playheadRect =
                playhead.getBoundingClientRect();


            // Current Start
            const startX =
                handleRect.left +
                handleRect.width / 2;


            // New Start
            const targetX =
                playheadRect.left +
                playheadRect.width / 2;


            const y =
                segmentRect.top +
                segmentRect.height / 2;


            // ========================================================
            // VALIDATION
            // ========================================================

            /*
             * Start mới phải nằm trước End hiện tại.
             */
            if (
                targetX >=
                segmentRect.right - 2
            ) {
                console.warn(
                    "[Segment Resize] Playhead is after segment End."
                );

                return false;
            }


            // Gần bằng Start hiện tại thì bỏ qua
            if (
                Math.abs(
                    targetX - startX
                ) < 1
            ) {
                return true;
            }


            // ========================================================
            // POINTER
            // ========================================================

            const pointerId =
                Math.floor(
                    10000 +
                    Math.random() * 50000
                );


            try {

                // Activate LEFT handle
                dispatchResizePointer(
                    handle,
                    "pointerdown",
                    startX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                // Move Start → timing line
                dispatchResizePointer(
                    lane,
                    "pointermove",
                    targetX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                // Second move để vượt drag threshold
                dispatchResizePointer(
                    lane,
                    "pointermove",
                    targetX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                // Commit
                dispatchResizePointer(
                    lane,
                    "pointerup",
                    targetX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                return true;


            } catch (error) {

                console.error(
                    "[Segment Resize Start] Failed:",
                    error
                );

                return false;


            } finally {

                cleanupSegmentResize(
                    lane,
                    targetX,
                    y,
                    pointerId
                );

            }
        }

        async function resizeSelectedSegmentEnd() {

            const segment =
                getSelectedSegment();


            // --------------------------------------------------------
            // Selected segment
            // --------------------------------------------------------

            if (!segment) {

                console.warn(
                    "[Segment Resize] No selected segment."
                );

                return false;
            }


            // --------------------------------------------------------
            // Recording lane
            // --------------------------------------------------------

            const lane =
                getRecordingLane(segment);


            if (!lane) {

                console.warn(
                    "[Segment Resize] recording-lane not found."
                );

                return false;
            }


            // --------------------------------------------------------
            // RIGHT / END handle
            // --------------------------------------------------------

            const handle =
                getRightHandle(segment);


            if (!handle) {

                console.warn(
                    "[Segment Resize] End handle not found."
                );

                return false;
            }


            // --------------------------------------------------------
            // Current playhead
            // --------------------------------------------------------

            const playhead =
                getSegmentPlayhead(lane);


            if (!playhead) {

                console.warn(
                    "[Segment Resize] Playhead not found."
                );

                return false;
            }


            // ========================================================
            // GET POSITIONS
            // ========================================================

            const segmentRect =
                segment.getBoundingClientRect();


            const handleRect =
                handle.getBoundingClientRect();


            const playheadRect =
                playhead.getBoundingClientRect();


            // Current END
            const startX =
                handleRect.left +
                handleRect.width / 2;


            // New END
            const targetX =
                playheadRect.left +
                playheadRect.width / 2;


            // Vertical center of segment
            const y =
                segmentRect.top +
                segmentRect.height / 2;


            // ========================================================
            // VALIDATION
            // ========================================================

            // Không cho End <= Start
            if (
                targetX <=
                segmentRect.left + 2
            ) {

                console.warn(
                    "[Segment Resize] Playhead is before segment Start."
                );

                return false;
            }


            // Nếu End đã gần bằng playhead thì không cần resize
            if (
                Math.abs(
                    targetX - startX
                ) < 1
            ) {

                return true;
            }


            // ========================================================
            // UNIQUE POINTER ID
            // ========================================================

            const pointerId =
                Math.floor(
                    10000 +
                    Math.random() * 50000
                );


            // ========================================================
            // RESIZE
            // ========================================================

            try {

                // ----------------------------------------------------
                // STEP 1
                // Activate RIGHT resize handle
                // ----------------------------------------------------

                dispatchResizePointer(
                    handle,
                    "pointerdown",
                    startX,
                    y,
                    pointerId
                );


                /*
                 * React cần thời gian cập nhật:
                 *
                 * side = "r"
                 * idx  = selected segment
                 */

                await waitResizeFrame();


                // ----------------------------------------------------
                // STEP 2
                // Move END to playhead
                // ----------------------------------------------------

                dispatchResizePointer(
                    lane,
                    "pointermove",
                    targetX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                /*
                 * Gửi lần thứ 2.
                 *
                 * Tbrain có drag threshold,
                 * nên lần này giúp đảm bảo resize được apply.
                 */

                dispatchResizePointer(
                    lane,
                    "pointermove",
                    targetX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                // ----------------------------------------------------
                // STEP 3
                // Commit resize
                // ----------------------------------------------------

                dispatchResizePointer(
                    lane,
                    "pointerup",
                    targetX,
                    y,
                    pointerId
                );


                await waitResizeFrame();


                return true;


            } catch (error) {

                console.error(
                    "[Segment Resize] Failed:",
                    error
                );

                return false;


            } finally {

                /*
                 * Quan trọng:
                 *
                 * luôn reset resize state để segment
                 * không bị dính theo con trỏ chuột.
                 */

                cleanupSegmentResize(
                    lane,
                    targetX,
                    y,
                    pointerId
                );

            }
        }

        // ============================================================
        // FOCUS TASK DESCRIPTION
        // ============================================================
        function focusDescriptionInput() {
            // Chờ segment mới render xong
            setTimeout(() => {
                const descInput = document.querySelector(
                    'textarea[data-testid="label-task-description"]'
                );

                if (!descInput) {
                    console.warn("[TBRAIN] Description textarea not found.");
                    return;
                }

                // Focus
                descInput.focus();

                // Đưa con trỏ xuống cuối nội dung
                const len = descInput.value.length;
                descInput.setSelectionRange(len, len);

                console.log("[TBRAIN] Description focused.");
            }, 150);
        }

        // ============================================================
        // TAB / SHIFT+TAB = NEXT / PREVIOUS SEGMENT
        // ============================================================
        function selectAdjacentSegment(direction = 1) {
            const rows = [
                ...document.querySelectorAll(
                    '[data-testid^="episode-index-row-"]'
                )
            ];

            if (!rows.length) {
                console.warn("[TBRAIN] No segment rows found.");
                return false;
            }

            // Tìm segment đang active
            const currentIndex = rows.findIndex(row =>
                String(row.className).includes(
                    "inset_2px_0_0_var(--color-brand-blue)"
                )
            );

            if (currentIndex < 0) {
                console.warn("[TBRAIN] Current segment not found.");
                return false;
            }

            const targetIndex = currentIndex + direction;

            // Không đi quá segment đầu/cuối
            if (targetIndex < 0) {
                console.log("[TBRAIN] Already at first segment.");
                return false;
            }

            if (targetIndex >= rows.length) {
                console.log("[TBRAIN] Already at last segment.");
                return false;
            }

            const targetRow = rows[targetIndex];

            targetRow.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });

            targetRow.click();

            // Sau khi chuyển segment -> focus Description
            focusDescriptionInput();

            console.log(
                `[TBRAIN] Segment ${currentIndex + 1} -> ${targetIndex + 1}`
            );

            return true;
        }

        // ============================================================
        // 13.7 - W HOTKEY
        // ============================================================

        async function handleSegmentResizeHotkey(event) {
            // ============================================================
            // TAB / SHIFT+TAB = NEXT / PREVIOUS SEGMENT
            // Hoạt động cả khi đang focus input / textarea
            // ============================================================
            if (
                event.key === "Tab" &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey &&
                !event.repeat
            ) {
                // Chặn hoàn toàn hành vi Tab mặc định
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                if (event.shiftKey) {
                    // Shift + Tab = Previous Segment
                    selectAdjacentSegment(-1);
                } else {
                    // Tab = Next Segment
                    selectAdjacentSegment(1);
                }

                return;
            }

            // Chỉ W - Q
            const key =
                event.key.toLowerCase();


            if (
                (key !== "q" && key !== "w") ||
                event.repeat
            ) {
                return;
            }


            // Không chạy cùng modifier
            if (
                event.ctrlKey ||
                event.altKey ||
                event.metaKey
            ) {
                return;
            }


            // --------------------------------------------------------
            // Không chạy khi đang nhập text
            // --------------------------------------------------------

            const active =
                document.activeElement;


            if (
                active?.matches(
                    [
                        "input",
                        "textarea",
                        "select",
                        '[contenteditable="true"]'
                    ].join(",")
                )
            ) {
                return;
            }


            // --------------------------------------------------------
            // Chỉ chặn W nếu thực sự có selected segment
            // --------------------------------------------------------

            const selected =
                getSelectedSegment();


            if (!selected) {
                return;
            }


            event.preventDefault();

            event.stopPropagation();

            event.stopImmediatePropagation();


            if (key === "q") {

                await resizeSelectedSegmentStart();

            } else if (key === "w") {

                await resizeSelectedSegmentEnd();

            }


            updateSegmentResizeUI();
        }

        // ============================================================
        // 13.7 - SET END UI
        // ============================================================

        function updateSegmentResizeUI() {

            const btnStart =
                document.getElementById(
                    "tb-set-start"
                );

            const btnEnd =
                document.getElementById(
                    "tb-set-end"
                );


            if (
                !btnStart ||
                !btnEnd
            ) {
                return;
            }


            const segment =
                getSelectedSegment();


            // Không có selected segment
            if (!segment) {

                btnStart.disabled = true;
                btnEnd.disabled = true;

                btnStart.title =
                    "Select a segment first";

                btnEnd.title =
                    "Select a segment first";

                return;
            }


            // Có selected segment
            btnStart.disabled = false;
            btnEnd.disabled = false;


            btnStart.title =
                "Set segment Start to current timing line — Q";


            btnEnd.title =
                "Set segment End to current timing line — W";
        }


        // ============================================================
        // INJECT SET END BUTTON
        // ============================================================

        function injectSegmentResizeUI() {

            // ============================================================
            // 1. FIND BENCH TOOLS
            // ============================================================

            const benchTools =
                document.querySelector(
                    '[data-testid="bench-tools"]'
                );

            if (!benchTools) {
                return;
            }


            // ============================================================
            // 2. FIND ZOOM GROUP
            // ============================================================

            const zoomGroup =
                [
                    ...benchTools.querySelectorAll(
                        'div[role="group"]'
                    )
                ].find(
                    el =>
                        el.getAttribute("aria-label") ===
                        "Zoom the timeline"
                );


            if (!zoomGroup) {
                return;
            }


            // ============================================================
            // 3. CHECK EXISTING BUTTONS
            // ============================================================

            const existingStart =
                document.getElementById(
                    "tb-set-start"
                );

            const existingEnd =
                document.getElementById(
                    "tb-set-end"
                );


            // Nếu cả 2 đã tồn tại
            // thì chỉ update trạng thái
            if (
                existingStart &&
                existingEnd
            ) {

                updateSegmentResizeUI();

                return;
            }


            // Nếu chỉ tồn tại 1 button do lần inject trước bị lỗi
            // thì remove để tạo lại sạch cả cặp
            if (existingStart) {
                existingStart.remove();
            }

            if (existingEnd) {
                existingEnd.remove();
            }


            // ============================================================
            // 4. CREATE SET START BUTTON
            // ============================================================

            const btnStart =
                document.createElement(
                    "button"
                );


            btnStart.id =
                "tb-set-start";


            btnStart.type =
                "button";


            // Style giống button native Zoom
            btnStart.className =
                "relative flex h-7 items-center gap-1.5 rounded border " +
                "border-line px-2 text-[11px] text-fg-2 " +
                "hover:z-[1] hover:bg-hover " +
                "disabled:opacity-40 aria-disabled:opacity-40";


            btnStart.title =
                "Set segment Start to current timing line — Q";


            btnStart.innerHTML = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M19 12H6"></path>
            <path d="m10 8-4 4 4 4"></path>
            <path d="M5 5v14"></path>
        </svg>

        <span>Set Start</span>

        <kbd
            class="rounded bg-elevated px-1 font-mono text-2xs text-fg-faint"
        >
            Q
        </kbd>
    `;


            // ============================================================
            // 5. SET START CLICK
            // ============================================================

            btnStart.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    event.stopPropagation();


                    await resizeSelectedSegmentStart();


                    updateSegmentResizeUI();


                    btnStart.blur();
                }
            );


            // ============================================================
            // 6. CREATE SET END BUTTON
            // ============================================================

            const btnEnd =
                document.createElement(
                    "button"
                );


            btnEnd.id =
                "tb-set-end";


            btnEnd.type =
                "button";


            // Style giống button native Zoom
            btnEnd.className =
                "relative flex h-7 items-center gap-1.5 rounded border " +
                "border-line px-2 text-[11px] text-fg-2 " +
                "hover:z-[1] hover:bg-hover " +
                "disabled:opacity-40 aria-disabled:opacity-40";


            btnEnd.title =
                "Set segment End to current timing line — W";


            btnEnd.innerHTML = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M5 12h13"></path>
            <path d="m14 8 4 4-4 4"></path>
            <path d="M19 5v14"></path>
        </svg>

        <span>Set End</span>

        <kbd
            class="rounded bg-elevated px-1 font-mono text-2xs text-fg-faint"
        >
            W
        </kbd>
    `;


            // ============================================================
            // 7. SET END CLICK
            // ============================================================

            btnEnd.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    event.stopPropagation();


                    await resizeSelectedSegmentEnd();


                    updateSegmentResizeUI();


                    btnEnd.blur();
                }
            );


            // ============================================================
            // 8. INSERT BUTTONS BEFORE ZOOM
            // ============================================================

            benchTools.insertBefore(
                btnStart,
                zoomGroup
            );


            benchTools.insertBefore(
                btnEnd,
                zoomGroup
            );


            // ============================================================
            // 9. UPDATE STATE
            // ============================================================

            updateSegmentResizeUI();
        }


        // ============================================================
        // EXPOSE FOR CODE PATH 12.4
        // ============================================================

        window.__tbInjectSegUI =
            injectSegmentResizeUI;


        injectSegmentResizeUI();




        // ============================================================
        // 13.8 - REGISTER
        // ============================================================

        /*
         * Nếu script bị inject lại,
         * remove listener cũ trước.
         */

        if (
            window.__TB_SEGMENT_RESIZE_W_HANDLER__
        ) {

            document.removeEventListener(
                "keydown",
                window.__TB_SEGMENT_RESIZE_W_HANDLER__,
                true
            );

        }


        window.__TB_SEGMENT_RESIZE_W_HANDLER__ =
            handleSegmentResizeHotkey;


        document.addEventListener(
            "keydown",
            window.__TB_SEGMENT_RESIZE_W_HANDLER__,
            true
        );


        // ============================================================
        // 13.9 - OPTIONAL DEBUG ACCESS
        // ============================================================

        window.resizeSelectedSegmentEnd =
            resizeSelectedSegmentEnd;

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
