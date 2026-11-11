(() => {
    // =========================================================
    // WORK OVERVIEW
    // Sidebar button + large statistics modal
    // =========================================================
    const BTN_ID = 'custom-work-time-btn';
    const OVERLAY_ID = 'custom-work-time-overlay';
    const POPUP_ID = 'custom-work-time-popup';
    const STYLE_ID = 'custom-work-time-style';

    // Dừng bản cũ (nếu đang chạy) trước khi load lại
    try { window.WorkOverview?.stop?.(); } catch (_) { }
    try { window.WorkOverview?.observer?.disconnect?.(); } catch (_) { }
    try { window.WorkOverview?._cleanup?.(); } catch (_) { }

    // =========================================================
    // 0. CLEAN OLD VERSION
    // =========================================================
    document.getElementById(BTN_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(POPUP_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();

    // =========================================================
    // 1. CSS
    // =========================================================
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        /* ================= SIDEBAR BUTTON ================= */
        #${BTN_ID} {
            cursor: pointer;
            border: 0;
            background: transparent;
            font-family: inherit;
            color: inherit;
        }

        /* ================= OVERLAY ================= */
        #${OVERLAY_ID} {
            position: fixed;
            inset: 0;
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(2, 6, 20, 0.78);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 180ms ease, visibility 180ms ease;
        }
        #${OVERLAY_ID}.show {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }

        /* ================= MAIN POPUP ================= */
        #${POPUP_ID} {
            width: 70vw;
            height: 85vh;
            min-width: 700px;
            min-height: 470px;
            max-width: 1400px;
            max-height: 1100px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: #060a18;
            color: #f4f7ff;
            border: 1px solid #25314d;
            border-radius: 14px;
            box-shadow:
                0 24px 80px rgba(0, 0, 0, 0.55),
                0 0 0 1px rgba(100, 120, 200, 0.03);
            font-family: inherit;
            opacity: 0;
            transform: translateY(12px) scale(0.97);
            transition: transform 180ms ease, opacity 180ms ease;
        }
        #${OVERLAY_ID}.show #${POPUP_ID} {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        /* ================= HEADER ================= */
        .work-time-header {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px;
            background: #080c1c;
            border-bottom: 1px solid #1c263e;
        }
        .work-time-header-left {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .work-time-title {
            font-size: 17px;
            line-height: 1.3;
            font-weight: 600;
            color: #ffffff;
        }
        .work-time-description {
            font-size: 12px;
            color: #8292b4;
        }

        /* ================= CLOSE BUTTON ================= */
        .work-time-close {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #8d9ab5;
            cursor: pointer;
            transition: background 150ms ease, color 150ms ease;
        }
        .work-time-close:hover {
            background: #141d32;
            color: #ffffff;
        }

        /* ================= BODY ================= */
        .work-time-body {
            position: relative;
            flex: 1;
            min-height: 0;
            padding: 22px;
            overflow-y: auto;
            overflow-x: hidden;
            background: #060a18;
            display: flex;
            flex-direction: column;
        }

        /* ================= SECTION HEAD + ACTIONS ================= */
        .work-overview-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
            min-height: 30px;
        }
        .work-overview-section-title {
            font-size: 13px;
            font-weight: 600;
            color: #f3f6ff;
        }
        .work-overview-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .work-sync-status {
            font-size: 11px;
            color: #7890bf;
            white-space: nowrap;
        }
        .work-sync-status.warn {
            color: #f5a524;
        }
        .work-action-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #34466e;
            background: #121a2d;
            color: #c9d6ff;
            font-family: inherit;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .work-action-btn:hover {
            background: #182340;
            border-color: #6274ff;
            color: #ffffff;
        }
        .work-action-btn.warn-btn:hover {
            border-color: #f5a524;
            color: #fcd34d;
        }
        .work-action-btn.danger:hover {
            border-color: #ef4444;
            color: #fca5a5;
        }
        .work-action-btn[hidden] {
            display: none;
        }
        .work-action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .work-action-btn.icon-only {
            width: 30px;
            padding: 0;
            justify-content: center;
        }
        .work-action-btn.loading svg {
            animation: work-spin 0.9s linear infinite;
        }
        @keyframes work-spin {
            to { transform: rotate(360deg); }
        }

        /* ================= WIDGET GRID ================= */
        .work-overview-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
        }

        /* ================= WIDGET CARD ================= */
        .work-overview-card {
            position: relative;
            min-height: 125px;
            padding: 16px;
            overflow: hidden;
            border-radius: 16px;
            background: #121a2d;
            border: 1px solid #34466e;
            border-top: 3px solid #6274ff;
            transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
        }
        .work-overview-card:hover {
            transform: translateY(-2px);
            background: #151e33;
            border-color: #4b5e91;
        }
        .work-overview-card-icon {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        .work-overview-card-label {
            margin-bottom: 20px;
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.03em;
            color: #9bb9ff;
        }
        .work-overview-card-value {
            font-size: 25px;
            line-height: 1.15;
            font-weight: 700;
            color: #ffffff;
            white-space: nowrap;
        }
        .work-overview-card-money {
            margin-top: 5px;
            font-size: 13px;
            line-height: 1.3;
            font-weight: 600;
            color: #00bf81;
            white-space: nowrap;
        }
        .work-overview-card-sub {
            margin-top: 5px;
            font-size: 11px;
            color: #7890bf;
        }

        /* ================= CARD ACCENTS ================= */
        .work-overview-card.today { border-top-color: #6574ff; }
        .work-overview-card.today .work-overview-card-icon {
            color: #7280ff;
            background: rgba(101, 116, 255, 0.15);
        }
        .work-overview-card.week { border-top-color: #3b82f6; }
        .work-overview-card.week .work-overview-card-icon {
            color: #5da0ff;
            background: rgba(59, 130, 246, 0.15);
        }
        .work-overview-card.month { border-top-color: #00bf81; }
        .work-overview-card.month .work-overview-card-icon {
            color: #00bf81;
            background: rgba(0, 191, 129, 0.14);
        }
        .work-overview-card.current { border-top-color: #22c3ee; }
        .work-overview-card.current .work-overview-card-icon {
            color: #38cdf0;
            background: rgba(34, 195, 238, 0.14);
        }
        .work-overview-card.all { border-top-color: #8b70ff; }
        .work-overview-card.all .work-overview-card-icon {
            color: #a08cff;
            background: rgba(139, 112, 255, 0.15);
        }

        /* ================= LOWER CONTENT BOX ================= */
        .work-overview-content {
            margin-top: 20px;
            min-height: 210px;
            padding: 18px;
            border-radius: 12px;
            border: 1px dashed #25314d;
            background: #080d1d;
        }
        .work-overview-placeholder {
            height: 100%;
            min-height: 170px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 7px;
            color: #52617d;
        }
        .work-overview-placeholder-title {
            font-size: 13px;
            color: #8a99b8;
        }
        .work-overview-placeholder-sub {
            font-size: 11px;
            color: #53617d;
        }

        /* ================= SCROLLBAR ================= */
        .work-time-body::-webkit-scrollbar { width: 7px; }
        .work-time-body::-webkit-scrollbar-track { background: transparent; }
        .work-time-body::-webkit-scrollbar-thumb {
            background: #26314b;
            border-radius: 20px;
        }
        .work-time-body::-webkit-scrollbar-thumb:hover { background: #35415f; }

        /* ================= RESPONSIVE ================= */
        @media (max-width: 1250px) {
            .work-overview-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }
        }
        @media (max-width: 1050px) {
            .work-overview-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }
        @media (max-width: 850px) {
            #${OVERLAY_ID} { padding: 10px; }
            #${POPUP_ID} {
                width: 92vw;
                height: 85vh;
                min-width: 0;
                min-height: 0;
            }
            .work-overview-section-head {
                flex-wrap: wrap;
            }
        }
        @media (max-width: 600px) {
            .work-overview-grid { grid-template-columns: 1fr; }
        }

        /* ================= DAILY CHART ================= */
        .work-overview-content.has-chart {
            border-style: solid;
            flex: 1;                  /* chiếm phần còn lại của popup */
            display: flex;
            flex-direction: column;
            min-height: 300px;        /* màn hình thấp thì cuộn */
        }
        .work-overview-section-head,
        .work-overview-grid {
            flex-shrink: 0;
        }
        .work-chart-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
        }
        .work-chart-title { font-size: 13px; font-weight: 600; color: #f3f6ff; }
        .work-chart-desc { margin-top: 2px; font-size: 11px; color: #7890bf; }
        .work-chart-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .work-chart-chip {
            padding: 5px 10px;
            border-radius: 8px;
            border: 1px solid #25314d;
            background: #121a2d;
            font-size: 11px;
            color: #7890bf;
            white-space: nowrap;
        }
        .work-chart-chip b { margin-left: 4px; color: #ffffff; }
        .work-chart-chip.max b { color: #00bf81; }
        .work-chart-wrap {
            position: relative;
            flex: 1;
            min-height: 200px;
        }
        .work-chart-wrap svg { display: block; width: 100%; height: 100%; overflow: visible; }
        .work-chart-tooltip {
            position: absolute;
            z-index: 2;
            pointer-events: none;
            padding: 6px 9px;
            border-radius: 8px;
            border: 1px solid #34466e;
            background: #121a2d;
            font-size: 11px;
            color: #c9d6ff;
            white-space: nowrap;
            transform: translate(-50%, calc(-100% - 10px));
            opacity: 0;
            transition: opacity 120ms ease;
        }
        .work-chart-tooltip.show { opacity: 1; }
        .work-chart-tooltip b { display: block; font-size: 12px; color: #00bf81; }
    `;
    document.head.appendChild(style);

    // =========================================================
    // 2. CREATE OVERLAY
    // =========================================================
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    // =========================================================
    // 3. CREATE POPUP
    // =========================================================
    const popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.innerHTML = `
        <!-- ================= HEADER ================= -->
        <div class="work-time-header">
            <div class="work-time-header-left">
                <div class="work-time-title">Work overview</div>
                <div class="work-time-description">Your work time and activity</div>
            </div>
            <button class="work-time-close" type="button" title="Close">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                </svg>
            </button>
        </div>

        <!-- ================= BODY ================= -->
        <div class="work-time-body">

            <!-- SECTION HEAD + ACTIONS -->
            <div class="work-overview-section-head">
                <div class="work-overview-section-title">Work time</div>

                <div class="work-overview-actions">
                    <span id="work-sync-status" class="work-sync-status"></span>

                    <button id="work-continue-btn" class="work-action-btn" type="button" hidden>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 1 1-3-6.7"></path>
                            <path d="M21 3v6h-6"></path>
                        </svg>
                        <span data-label>Tải tiếp</span>
                    </button>

                    <button id="work-stop-btn" class="work-action-btn danger" type="button" hidden>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                        </svg>
                        <span>Stop</span>
                    </button>

                    <button id="work-refresh-all-btn" class="work-action-btn warn-btn" type="button"
                        title="Xoá cache và tải lại toàn bộ task">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M8 6V4h8v2"></path>
                            <path d="M19 6l-1 14H6L5 6"></path>
                            <path d="M10 11v5M14 11v5"></path>
                        </svg>
                        <span>Refresh all</span>
                    </button>

                    <button id="work-refresh-btn" class="work-action-btn icon-only" type="button" title="Refresh">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                            <path d="M21 3v5h-5"></path>
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                            <path d="M3 21v-5h5"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- SUMMARY GRID -->
            <div class="work-overview-grid">

                <!-- TODAY -->
                <div class="work-overview-card today">
                    <div class="work-overview-card-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9"></circle>
                            <path d="M12 7v5l3 2"></path>
                        </svg>
                    </div>
                    <div class="work-overview-card-label">TODAY</div>
                    <div class="work-overview-card-value" id="work-time-today">-- h -- min</div>
                    <div class="work-overview-card-money" id="work-money-today">-- đ</div>
                    <div class="work-overview-card-sub">worked today</div>
                </div>

                <!-- THIS WEEK -->
                <div class="work-overview-card week">
                    <div class="work-overview-card-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                            <path d="M16 3v4"></path>
                            <path d="M8 3v4"></path>
                            <path d="M3 11h18"></path>
                        </svg>
                    </div>
                    <div class="work-overview-card-label">THIS WEEK</div>
                    <div class="work-overview-card-value" id="work-time-week">-- h -- min</div>
                    <div class="work-overview-card-money" id="work-money-week">-- đ</div>
                    <div class="work-overview-card-sub">worked this week</div>
                </div>

                <!-- THIS MONTH -->
                <div class="work-overview-card month">
                    <div class="work-overview-card-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="17" rx="2"></rect>
                            <path d="M8 2v4"></path>
                            <path d="M16 2v4"></path>
                            <path d="M3 10h18"></path>
                        </svg>
                    </div>
                    <div class="work-overview-card-label">THIS MONTH</div>
                    <div class="work-overview-card-value" id="work-time-month">-- h -- min</div>
                    <div class="work-overview-card-money" id="work-money-month">-- đ</div>
                    <div class="work-overview-card-sub">worked this month</div>
                </div>

                <!-- CURRENT (approvedSeconds - thời gian & tiền hiện tại) -->
                <div class="work-overview-card current">
                    <div class="work-overview-card-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                            <circle cx="12" cy="12" r="2.5"></circle>
                            <path d="M6 12h.01M18 12h.01"></path>
                        </svg>
                    </div>
                    <div class="work-overview-card-label">CURRENT</div>
                    <div class="work-overview-card-value" id="work-time-current">-- h -- min</div>
                    <div class="work-overview-card-money" id="work-money-current">-- đ</div>
                    <div class="work-overview-card-sub">current approved</div>
                </div>

                <!-- ALL TIME (tổng tất cả task) -->
                <div class="work-overview-card all">
                    <div class="work-overview-card-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 3v18h18"></path>
                            <path d="m7 16 4-5 4 3 5-7"></path>
                        </svg>
                    </div>
                    <div class="work-overview-card-label">ALL TIME</div>
                    <div class="work-overview-card-value" id="work-time-all">-- h -- min</div>
                    <div class="work-overview-card-money" id="work-money-all">-- đ</div>
                    <div class="work-overview-card-sub">all tasks</div>
                </div>
            </div>

            <!-- DAILY EARNINGS CHART -->
            <div class="work-overview-content has-chart">
                <div class="work-chart-head">
                    <div>
                        <div class="work-chart-title">Daily earnings</div>
                        <div class="work-chart-desc">Last 30 days</div>
                    </div>
                    <div class="work-chart-chips">
                        <span class="work-chart-chip max">Max<b id="work-chart-max">--</b></span>
                        <span class="work-chart-chip">Avg / ngày làm<b id="work-chart-avg">--</b></span>
                        <span class="work-chart-chip">30 ngày<b id="work-chart-total">--</b></span>
                    </div>
                </div>
                <div class="work-chart-wrap" id="work-chart-wrap">
                    <svg id="work-chart-svg"></svg>
                    <div class="work-chart-tooltip" id="work-chart-tooltip"></div>
                </div>
            </div>
        </div>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // =========================================================
    // 4. CREATE SIDEBAR BUTTON
    // =========================================================
    const button = document.createElement('button');
    button.id = BTN_ID;
    button.type = 'button';
    button.title = 'Work overview';
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
        </svg>
        <span data-work-time-label class="flex-1 truncate text-left">Work overview</span>
    `;

    // =========================================================
    // 5. FIND SIDEBAR GROUP
    // =========================================================
    function getSidebarGroup() {
        const myProjects = document.querySelector('[data-testid="nav-my-projects"]');
        return myProjects ? myProjects.parentElement : null;
    }

    // =========================================================
    // 6. DETECT SIDEBAR EXPANDED
    // =========================================================
    function isSidebarExpanded() {
        const qualification = document.querySelector('[data-testid="nav-qualifications"]');
        if (!qualification) return false;
        return !!qualification.querySelector('span');
    }

    // =========================================================
    // 7. UPDATE SIDEBAR BUTTON MODE
    // =========================================================
    const CLASS_EXPANDED =
        'flex w-full items-center rounded-md py-[7px] text-[13px] text-fg-2 ' +
        'transition-colors hover:bg-hover gap-2 px-2';

    const CLASS_COLLAPSED =
        'flex w-full items-center rounded-md py-[7px] text-[13px] text-fg-2 ' +
        'transition-colors hover:bg-hover justify-center px-0';

    function updateSidebarMode() {
        if (!button.isConnected) return;

        const label = button.querySelector('[data-work-time-label]');
        const expanded = isSidebarExpanded();
        const nextClass = expanded ? CLASS_EXPANDED : CLASS_COLLAPSED;

        // Chỉ set khi khác để tránh thay đổi DOM thừa
        if (button.className !== nextClass) {
            button.className = nextClass;
        }

        if (label) {
            const display = expanded ? '' : 'none';
            if (label.style.display !== display) {
                label.style.display = display;
            }
        }
    }

    // =========================================================
    // 8. INSERT BUTTON
    // =========================================================
    function insertButton() {
        if (button.isConnected) {
            updateSidebarMode();
            return true;
        }

        const group = getSidebarGroup();
        if (!group) return false;

        const myProjects = group.querySelector('[data-testid="nav-my-projects"]');

        if (myProjects) {
            myProjects.insertAdjacentElement('afterend', button);
        } else {
            group.appendChild(button);
        }

        updateSidebarMode();
        return true;
    }

    // =========================================================
    // 9. MODAL STATE
    // =========================================================
    let oldBodyOverflow = '';

    // =========================================================
    // 10. OPEN
    // =========================================================
    function openPopup() {
        if (overlay.classList.contains('show')) return;

        oldBodyOverflow = document.body.style.overflow;
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        // LOAD REPORT DATA
        updateAllTime();
        updatePeriodStats();
    }

    // =========================================================
    // 11. CLOSE
    // =========================================================
    function closePopup() {
        if (!overlay.classList.contains('show')) return;

        overlay.classList.remove('show');
        document.body.style.overflow = oldBodyOverflow;
    }

    // =========================================================
    // 12. TOGGLE
    // =========================================================
    function togglePopup() {
        if (overlay.classList.contains('show')) {
            closePopup();
        } else {
            openPopup();
        }
    }

    // =========================================================
    // 13. SIDEBAR BUTTON EVENT
    // =========================================================
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePopup();
    });

    // =========================================================
    // 14. CLOSE BUTTON EVENT
    // =========================================================
    popup.querySelector('.work-time-close').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePopup();
    });

    // =========================================================
    // 15. CLICK INSIDE POPUP
    // =========================================================
    popup.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // =========================================================
    // 16. CLICK OVERLAY
    // =========================================================
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closePopup();
        }
    });

    // =========================================================
    // 17. ESC
    // =========================================================
    function onKeyDown(event) {
        if (event.key === 'Escape' && overlay.classList.contains('show')) {
            closePopup();
        }
    }
    document.addEventListener('keydown', onKeyDown);

    // =========================================================
    // 18. WATCH REACT RERENDER
    // =========================================================
    let updateScheduled = false;

    const observer = new MutationObserver(() => {
        if (updateScheduled) return;

        updateScheduled = true;

        requestAnimationFrame(() => {
            updateScheduled = false;

            // React có thể render lại sidebar -> thêm lại button
            if (!button.isConnected) {
                insertButton();
            } else {
                updateSidebarMode();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // =========================================================
    // 19. INITIALIZE
    // =========================================================
    let waitForSidebar = null;

    if (!insertButton()) {
        waitForSidebar = setInterval(() => {
            if (insertButton()) {
                clearInterval(waitForSidebar);
                waitForSidebar = null;
            }
        }, 500);
    }

    // =========================================================
    // 20. COMMON: API BASE / TOKEN / FORMAT
    // =========================================================
    const WORK_OVERVIEW_API_BASE = 'https://api.tbrain.ai';

    const WORK_OVERVIEW_PROJECT_ID = 'cfbe006a-9012-41bc-ba3c-afa8a3338139';

    function findWorkOverviewToken() {
        const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
        const tokens = [];

        function scan(value) {
            if (typeof value !== 'string' || value.length < 20) return;

            JWT_RE.lastIndex = 0;
            let match;

            while ((match = JWT_RE.exec(value)) !== null) {
                tokens.push(match[0]);
            }
        }

        // localStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) scan(localStorage.getItem(key));
            }
        } catch (_) { }

        // sessionStorage
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key) scan(sessionStorage.getItem(key));
            }
        } catch (_) { }

        // Cookies
        try {
            scan(document.cookie);
        } catch (_) { }

        // Validate expiry
        for (const token of tokens) {
            try {
                let payload = token.split('.')[1]
                    .replace(/-/g, '+')
                    .replace(/_/g, '/');

                payload += '='.repeat((4 - payload.length % 4) % 4);

                const decoded = JSON.parse(decodeURIComponent(escape(atob(payload))));

                if (!decoded.exp) return token;

                if (decoded.exp * 1000 > Date.now() + 5000) return token;
            } catch (_) { }
        }

        return null;
    }

    // seconds -> "83 h 52 min"
    function formatWorkTime(totalSeconds) {
        totalSeconds = Math.max(0, Number(totalSeconds) || 0);

        const totalMinutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return `${hours} h ${minutes} min`;
    }

    // =========================================================
    // 21. RATE LIMIT + API GET (dùng chung cho mọi request)
    // =========================================================
    const WORK_MAX_RETRIES = 4;
    const WORK_RETRY_BASE_MS = 3000;       // 3s -> 6s -> 12s -> 24s
    const WORK_RETRY_MAX_MS = 60000;

    const WORK_GAP_MIN_MS = 0;             // khoảng cách tối thiểu giữa 2 request
    const WORK_GAP_MAX_MS = 4000;

    let workGapMs = WORK_GAP_MIN_MS;       // tự điều chỉnh khi gặp 429
    let workCooldownUntil = 0;             // cooldown chung cho tất cả request
    let workLastRequestAt = 0;
    let workStopped = false;
    let workStopReason = '';               // 'rate' | 'user'

    // Sleep có thể dừng (bấm Stop)
    async function workSleep(ms, stoppable = true) {
        const end = Date.now() + ms;

        while (Date.now() < end) {
            if (stoppable && workStopped) return;

            await new Promise((resolve) =>
                setTimeout(resolve, Math.min(250, end - Date.now()))
            );
        }
    }

    function makeStopError() {
        const err = new Error('Stopped');
        err.stopped = true;
        return err;
    }

    function isRetryableStatus(status) {
        return status === 408 || status === 429 || status >= 500;
    }

    // Retry-After: số giây hoặc HTTP date
    function parseRetryAfter(value) {
        if (!value) return null;

        const seconds = Number(value);
        if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

        const date = Date.parse(value);
        return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
    }

    function getBackoff(attempt) {
        return Math.min(WORK_RETRY_MAX_MS, WORK_RETRY_BASE_MS * 2 ** attempt)
            + Math.floor(Math.random() * 500);
    }

    // Chờ hết cooldown chung + đủ khoảng cách giữa 2 request
    async function waitForWorkSlot(stoppable) {
        while (!(stoppable && workStopped)) {
            const now = Date.now();

            const wait = Math.max(
                workCooldownUntil - now,
                workLastRequestAt + workGapMs - now
            );

            if (wait <= 0) break;

            await workSleep(wait, stoppable);
        }

        workLastRequestAt = Date.now();
    }

    // options.stoppable = false -> request không bị nút Stop huỷ (vd: All time)
    async function workApiGet(path, token, options = {}) {
        const { stoppable = true } = options;

        let currentToken = token;
        let tokenRefreshed = false;
        let lastError = null;

        for (let attempt = 0; attempt <= WORK_MAX_RETRIES; attempt++) {

            await waitForWorkSlot(stoppable);

            if (stoppable && workStopped) throw makeStopError();

            let response;

            // ---------- Lỗi mạng ----------
            try {
                response = await fetch(`${WORK_OVERVIEW_API_BASE}${path}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                        Accept: '*/*'
                    },
                    credentials: 'include',
                    cache: 'no-store'
                });
            } catch (err) {
                lastError = err;

                if (attempt < WORK_MAX_RETRIES) {
                    await workSleep(getBackoff(attempt), stoppable);
                }

                continue;
            }

            // ---------- Thành công: giảm dần gap ----------
            if (response.ok) {
                workGapMs = Math.max(WORK_GAP_MIN_MS, workGapMs - 25);
                return response.json();
            }

            // ---------- 401: lấy token mới, thử lại 1 lần ----------
            if (response.status === 401 && !tokenRefreshed) {
                tokenRefreshed = true;

                const newToken = findWorkOverviewToken();

                if (newToken && newToken !== currentToken) {
                    currentToken = newToken;
                    attempt--;
                    continue;
                }
            }

            const error = new Error(`HTTP ${response.status} - ${path}`);
            error.status = response.status;

            // 400 / 403 / 404... gọi lại vẫn lỗi
            if (!isRetryableStatus(response.status)) throw error;

            lastError = error;

            if (attempt >= WORK_MAX_RETRIES) break;

            let delay = getBackoff(attempt);

            // ---------- 429: giãn gap + cooldown chung ----------
            if (response.status === 429) {
                workGapMs = Math.min(WORK_GAP_MAX_MS, workGapMs * 2);

                const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));

                if (retryAfter !== null) {
                    delay = Math.max(delay, retryAfter);
                }

                workCooldownUntil = Math.max(workCooldownUntil, Date.now() + delay);

                setSyncStatus(`Too many requests · chờ ${Math.ceil(delay / 1000)}s`, true);
            }

            console.warn(
                `[WorkOverview] ${error.message}, ` +
                `retry ${attempt + 1}/${WORK_MAX_RETRIES} sau ${delay}ms (gap ${workGapMs}ms)`
            );

            await workSleep(delay, stoppable);
        }

        if (stoppable && workStopped) throw makeStopError();

        throw lastError || new Error(`Request failed - ${path}`);
    }

    // =========================================================
    // 22. CURRENT - APPROVED TIME FROM STATS API
    // =========================================================
    const WORK_MONEY_PER_HOUR = 50000;

    async function updateAllTime() {
        const allTimeEl = document.getElementById('work-time-current');
        const moneyEl = document.getElementById('work-money-current');

        if (!allTimeEl) return;

        allTimeEl.textContent = 'Loading...';

        const token = findWorkOverviewToken();

        if (!token) {
            allTimeEl.textContent = '-- h -- min';
            console.warn('[WorkOverview] Không tìm thấy Tbrain JWT');
            return;
        }

        try {
            const data = await workApiGet(
                `/api/v1/tasks/my-stats?projectId=${WORK_OVERVIEW_PROJECT_ID}`,
                token,
                { stoppable: false }
            );

            // Cùng giá trị AutoTool dùng để tính tiền
            const approvedSeconds = Number(data?.approvedSeconds) || 0;
            const totalMoney = (approvedSeconds / 3600) * WORK_MONEY_PER_HOUR;

            allTimeEl.textContent = formatWorkTime(approvedSeconds);
            allTimeEl.title = `Approved time: ${approvedSeconds.toLocaleString('vi-VN')} seconds`;

            if (moneyEl) {
                moneyEl.textContent = `${Math.round(totalMoney).toLocaleString('vi-VN')} đ`;
            }

            console.log('[WorkOverview] Current loaded:', {
                approvedSeconds,
                formatted: formatWorkTime(approvedSeconds),
                money: Math.round(totalMoney)
            });

            return { approvedSeconds, totalMoney, data };

        } catch (error) {
            console.error('[WorkOverview] Không thể tải Current:', error);

            allTimeEl.textContent = '-- h -- min';
            if (moneyEl) moneyEl.textContent = '-- đ';

            return null;
        }
    }

    // =========================================================
    // 23. TODAY / WEEK / MONTH - FROM TASK EPISODES
    // =========================================================
    const WORK_CACHE_KEY = 'tb_work_overview_tasks_v2';

    const WORK_PAGE_SIZE = 100;            // task / request khi lấy list
    const WORK_LIST_TTL_MS = 10 * 60e3;    // cache task list 10 phút
    const WORK_BATCH_LIMIT = Infinity;     // tải hết 1 lần
    const WORK_CONCURRENCY = 10;           // 10 task / lúc

    let workStatsLoading = false;

    // ---------------------------------------------------------
    // CACHE
    // ---------------------------------------------------------
    //
    // {
    //   projectId, updatedAt, listFetchedAt,
    //   pending: [{ id, createdAt, status }],      // task chưa tải
    //   tasks: {
    //     [taskId]: { createdAt, status, submissionId,
    //                 submittedAt, seconds, episodes, cachedAt }
    //   }
    // }
    //
    function createEmptyWorkCache() {
        return {
            projectId: WORK_OVERVIEW_PROJECT_ID,
            updatedAt: 0,
            listFetchedAt: 0,
            pending: [],
            tasks: {}
        };
    }

    function loadWorkCache() {
        try {
            const cache = JSON.parse(localStorage.getItem(WORK_CACHE_KEY));

            if (cache?.projectId === WORK_OVERVIEW_PROJECT_ID && cache.tasks) {
                return {
                    ...createEmptyWorkCache(),
                    ...cache,
                    pending: Array.isArray(cache.pending) ? cache.pending : []
                };
            }
        } catch (_) { }

        return createEmptyWorkCache();
    }

    function saveWorkCache(cache) {
        try {
            cache.updatedAt = Date.now();
            localStorage.setItem(WORK_CACHE_KEY, JSON.stringify(cache));
        } catch (err) {
            console.warn('[WorkOverview] Không lưu được cache:', err);
        }
    }

    function clearWorkCache() {
        localStorage.removeItem(WORK_CACHE_KEY);
        localStorage.removeItem('tb_work_overview_tasks_v1');   // cache bản cũ
        console.log('[WorkOverview] Cache cleared');
    }

    // ---------------------------------------------------------
    // UI: STATUS + BUTTONS
    // ---------------------------------------------------------
    const workStatusEl = popup.querySelector('#work-sync-status');
    const workContinueBtn = popup.querySelector('#work-continue-btn');
    const workStopBtn = popup.querySelector('#work-stop-btn');

    function setSyncStatus(text, warn = false) {
        if (!workStatusEl) return;

        workStatusEl.textContent = text || '';
        workStatusEl.classList.toggle('warn', warn);
    }

    const workRefreshBtn = popup.querySelector('#work-refresh-btn');
    const workRefreshAllBtn = popup.querySelector('#work-refresh-all-btn');

    function updateActionButtons(remaining = 0) {
        if (workRefreshBtn) {
            workRefreshBtn.disabled = workStatsLoading;
            workRefreshBtn.classList.toggle('loading', workStatsLoading);
        }

        if (workRefreshAllBtn) {
            workRefreshAllBtn.disabled = workStatsLoading;
        }

        if (workStopBtn) {
            workStopBtn.hidden = !workStatsLoading;
        }

        if (workContinueBtn) {
            workContinueBtn.hidden = workStatsLoading || remaining <= 0;

            const label = workContinueBtn.querySelector('[data-label]');
            if (label) label.textContent = `Tải tiếp (${remaining})`;
        }
    }

    function stopLoading() {
        if (!workStatsLoading) return;

        workStopped = true;
        workStopReason = 'user';

        setSyncStatus('Đang dừng...');
    }

    workContinueBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        updatePeriodStats();
    });

    // Refresh thủ công: All time + lấy lại task list (bỏ cache 10 phút)
    async function manualRefresh() {
        if (workStatsLoading) return;

        setSyncStatus('Đang refresh...');

        await Promise.all([
            updateAllTime(),
            updatePeriodStats({ refreshList: true })
        ]);
    }

    workRefreshBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        manualRefresh();
    });

    // Refresh all: xoá cache, tải lại toàn bộ task từ đầu
    async function refreshAll() {
        if (workStatsLoading) return;

        const ok = confirm(
            'Xoá cache và tải lại toàn bộ task?\n' +
            'Việc này sẽ gọi lại API cho tất cả task.'
        );

        if (!ok) return;

        clearWorkCache();

        // Reset UI 4 widget về trạng thái loading
        ['today', 'week', 'month', 'all'].forEach((key) => {
            const t = document.getElementById(`work-time-${key}`);
            const m = document.getElementById(`work-money-${key}`);
            if (t) t.textContent = '-- h -- min';
            if (m) m.textContent = '-- đ';
        });

        setSyncStatus('Đang tải lại toàn bộ...');

        await Promise.all([
            updateAllTime(),
            updatePeriodStats({ force: true })
        ]);
    }

    workRefreshAllBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        refreshAll();
    });

    workStopBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        stopLoading();
    });

    // ---------------------------------------------------------
    // 1. TASK LIST (tất cả page)
    // ---------------------------------------------------------
    async function fetchAllTasks(token) {
        const map = new Map();

        let page = 1;
        let total = Infinity;

        while (map.size < total) {
            const res = await workApiGet(
                `/api/v1/tasks?page=${page}&pageSize=${WORK_PAGE_SIZE}` +
                `&projectId=${WORK_OVERVIEW_PROJECT_ID}`,
                token
            );

            const items = Array.isArray(res?.data) ? res.data : [];

            total = Number(res?.pagination?.total) || 0;

            for (const t of items) {
                map.set(t.id, {
                    id: t.id,
                    createdAt: t.createdAt,
                    status: t.status
                });
            }

            setSyncStatus(`Đang lấy danh sách ${map.size}/${total}`);

            if (!items.length) break;

            page++;
        }

        return [...map.values()];
    }

    // ---------------------------------------------------------
    // 2. THỜI GIAN 1 TASK: task -> submission -> episodes
    // ---------------------------------------------------------
    function sumEpisodeSeconds(submission) {
        let seconds = 0;
        let count = 0;

        for (const artifact of submission?.artifacts || []) {
            const episodes = artifact?.data?.episodes;

            if (!Array.isArray(episodes)) continue;

            for (const ep of episodes) {
                const start = Number(ep?.start_seconds);
                const end = Number(ep?.end_seconds);

                if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                    seconds += end - start;
                    count++;
                }
            }
        }

        return { seconds, count };
    }

    async function fetchTaskDuration(task, token) {
        // Task detail -> submission.id
        const detail = await workApiGet(`/api/v1/tasks/${task.id}`, token);

        const submissionId = detail?.submission?.id || null;

        const base = {
            createdAt: task.createdAt,
            status: task.status,
            submissionId,
            submittedAt: null,
            seconds: 0,
            episodes: 0,
            cachedAt: Date.now()
        };

        if (!submissionId) return base;

        // Submission -> episodes
        const submission = await workApiGet(`/api/v1/submissions/${submissionId}`, token);

        const { seconds, count } = sumEpisodeSeconds(submission);

        return {
            ...base,
            submittedAt: submission?.submittedAt || null,
            seconds,
            episodes: count
        };
    }

    // ---------------------------------------------------------
    // 3. CHẠY GIỚI HẠN SONG SONG (dừng khi Stop / 429)
    // ---------------------------------------------------------
    async function runWithLimit(items, limit, worker) {
        let index = 0;

        const runners = Array.from(
            { length: Math.min(limit, items.length) },
            async () => {
                while (index < items.length && !workStopped) {
                    await worker(items[index++]);
                }
            }
        );

        await Promise.all(runners);
    }

    // ---------------------------------------------------------
    // 4. KHOẢNG THỜI GIAN (giờ local, tuần bắt đầu thứ 2)
    // ---------------------------------------------------------
    function getWorkRanges() {
        const now = new Date();

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const day = today.getDay();                 // 0 = CN
        const week = new Date(today);
        week.setDate(today.getDate() - (day === 0 ? 6 : day - 1));

        const month = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
            today: today.getTime(),
            week: week.getTime(),
            month: month.getTime()
        };
    }

    // ---------------------------------------------------------
    // 5. GOM THEO NGÀY / TUẦN / THÁNG (theo createdAt)
    // ---------------------------------------------------------
    function aggregateWorkStats(cache) {
        const ranges = getWorkRanges();

        const result = {
            today: { seconds: 0, tasks: 0 },
            week: { seconds: 0, tasks: 0 },
            month: { seconds: 0, tasks: 0 },
            all: { seconds: 0, tasks: 0 },
            daily: {}                      // { 'YYYY-MM-DD': { seconds, tasks } }
        };

        for (const item of Object.values(cache.tasks)) {
            const seconds = Number(item.seconds) || 0;

            // ALL TIME: tổng tất cả task
            result.all.seconds += seconds;
            result.all.tasks++;

            const time = new Date(item.createdAt).getTime();

            if (!Number.isFinite(time)) continue;

            // Gom theo ngày (giờ local)
            const dayKey = toDayKey(new Date(time));
            const day = result.daily[dayKey] || (result.daily[dayKey] = { seconds: 0, tasks: 0 });
            day.seconds += seconds;
            day.tasks++;

            for (const key of ['today', 'week', 'month']) {
                if (time >= ranges[key]) {
                    result[key].seconds += seconds;
                    result[key].tasks++;
                }
            }
        }

        return result;
    }

    // ---------------------------------------------------------
    // 6. RENDER 4 WIDGET (today / week / month / all)
    // ---------------------------------------------------------
    function renderWorkStats(stats) {
        const map = {
            today: { id: 'work-time-today', sub: 'worked today' },
            week: { id: 'work-time-week', sub: 'worked this week' },
            month: { id: 'work-time-month', sub: 'worked this month' },
            all: { id: 'work-time-all', sub: 'all tasks' }
        };

        for (const [key, cfg] of Object.entries(map)) {
            const valueEl = document.getElementById(cfg.id);

            if (!valueEl) continue;

            const { seconds, tasks } = stats[key];

            valueEl.textContent = formatWorkTime(seconds);
            valueEl.title = `${Math.round(seconds).toLocaleString('vi-VN')} seconds`;

            // Tiền = giờ × 50.000đ
            const moneyEl = document.getElementById(`work-money-${key}`);
            if (moneyEl) {
                const money = (seconds / 3600) * WORK_MONEY_PER_HOUR;
                moneyEl.textContent = `${Math.round(money).toLocaleString('vi-VN')} đ`;
            }

            const subEl = valueEl
                .closest('.work-overview-card')
                ?.querySelector('.work-overview-card-sub');

            if (subEl) subEl.textContent = `${cfg.sub} · ${tasks} tasks`;
        }

        renderDailyChart(stats.daily);
    }

    // ---------------------------------------------------------
    // 6b. DAILY EARNINGS CHART (30 ngày)
    // ---------------------------------------------------------
    const WORK_CHART_DAYS = 30;
    let lastDailyData = null;

    function toDayKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatChartDate(date) {
        return `${String(date.getDate()).padStart(2, '0')}/` +
            `${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatMoney(value) {
        return `${Math.round(value).toLocaleString('vi-VN')} đ`;
    }

    // Nhãn trục Y gọn: 1.5tr, 750k
    function formatMoneyShort(value) {
        if (value >= 1e6) return `${+(value / 1e6).toFixed(1)}tr`;
        if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
        return `${Math.round(value)}`;
    }

    // Làm tròn đỉnh trục Y cho đẹp
    function niceMax(value) {
        if (!value || value <= 0) return 100000;
        const p = 10 ** Math.floor(Math.log10(value));
        return (Math.ceil((value / p) * 2) / 2) * p;
    }

    // 30 ngày liên tục, ngày không làm = 0
    function buildDailySeries(daily = {}) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const series = [];

        for (let i = WORK_CHART_DAYS - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            const item = daily[toDayKey(date)] || { seconds: 0, tasks: 0 };

            series.push({
                date,
                seconds: item.seconds,
                tasks: item.tasks,
                money: (item.seconds / 3600) * WORK_MONEY_PER_HOUR
            });
        }

        return series;
    }

    function renderDailyChart(daily) {
        lastDailyData = daily || {};

        const wrap = popup.querySelector('#work-chart-wrap');
        const svg = popup.querySelector('#work-chart-svg');
        const tip = popup.querySelector('#work-chart-tooltip');

        if (!wrap || !svg) return;

        const series = buildDailySeries(lastDailyData);

        // ---------- Chips: Max / Avg / Total ----------
        const maxIndex = series.reduce(
            (best, item, i) => (item.money > series[best].money ? i : best), 0
        );
        const maxItem = series[maxIndex];
        const total = series.reduce((sum, item) => sum + item.money, 0);
        const workedDays = series.filter((item) => item.money > 0).length;
        const avg = workedDays ? total / workedDays : 0;

        const setText = (id, text) => {
            const el = popup.querySelector(`#${id}`);
            if (el) el.textContent = text;
        };

        setText('work-chart-max', maxItem.money > 0
            ? `${formatMoney(maxItem.money)} · ${formatChartDate(maxItem.date)}`
            : '--');
        setText('work-chart-avg', workedDays ? formatMoney(avg) : '--');
        setText('work-chart-total', formatMoney(total));

        // ---------- Kích thước ----------
        const W = wrap.clientWidth || 800;
        const H = wrap.clientHeight || 240;
        const pad = { top: 22, right: 16, bottom: 26, left: 46 };
        const cw = W - pad.left - pad.right;
        const ch = H - pad.top - pad.bottom;

        const yMax = niceMax(maxItem.money);
        const n = series.length;

        const x = (i) => pad.left + (n === 1 ? cw / 2 : (i * cw) / (n - 1));
        const y = (v) => pad.top + ch - (v / yMax) * ch;

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

        let html = `
            <defs>
                <linearGradient id="work-chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6274ff" stop-opacity="0.35"></stop>
                    <stop offset="100%" stop-color="#6274ff" stop-opacity="0"></stop>
                </linearGradient>
            </defs>
        `;

        // ---------- Grid + nhãn trục Y ----------
        for (let g = 0; g <= 4; g++) {
            const value = (yMax / 4) * g;
            const gy = y(value);

            html += `
                <line x1="${pad.left}" x2="${W - pad.right}" y1="${gy}" y2="${gy}"
                    stroke="#1c263e" stroke-width="1"></line>
                <text x="${pad.left - 8}" y="${gy + 3}" text-anchor="end"
                    font-size="10" fill="#53617d">${formatMoneyShort(value)}</text>
            `;
        }

        // ---------- Nhãn trục X (mỗi 5 ngày + ngày cuối) ----------
        series.forEach((item, i) => {
            if (i % 5 !== 0 && i !== n - 1) return;

            html += `
                <text x="${x(i)}" y="${H - 6}" text-anchor="middle"
                    font-size="10" fill="#53617d">${formatChartDate(item.date)}</text>
            `;
        });

        // ---------- Area + Line ----------
        const linePath = series
            .map((item, i) => `${i ? 'L' : 'M'}${x(i)},${y(item.money)}`)
            .join(' ');

        const areaPath =
            `${linePath} L${x(n - 1)},${pad.top + ch} L${x(0)},${pad.top + ch} Z`;

        html += `
            <path d="${areaPath}" fill="url(#work-chart-grad)"></path>
            <path d="${linePath}" fill="none" stroke="#6274ff" stroke-width="2"
                stroke-linejoin="round" stroke-linecap="round"></path>
        `;

        // ---------- Đường Max ----------
        if (maxItem.money > 0) {
            const my = y(maxItem.money);

            html += `
                <line x1="${pad.left}" x2="${W - pad.right}" y1="${my}" y2="${my}"
                    stroke="#00bf81" stroke-width="1" stroke-dasharray="4 4"
                    opacity="0.6"></line>
                <text x="${W - pad.right}" y="${my - 6}" text-anchor="end"
                    font-size="10" font-weight="600" fill="#00bf81">
                    Max ${formatMoneyShort(maxItem.money)}
                </text>
            `;
        }

        // ---------- Điểm ----------
        series.forEach((item, i) => {
            if (item.money <= 0) return;

            const isMax = i === maxIndex;

            html += `
                <circle cx="${x(i)}" cy="${y(item.money)}" r="${isMax ? 5 : 3}"
                    fill="${isMax ? '#00bf81' : '#6274ff'}"
                    stroke="#060a18" stroke-width="2"></circle>
            `;
        });

        // ---------- Đường hover + vùng hover ----------
        html += `
            <line id="work-chart-hover" x1="0" x2="0" y1="${pad.top}" y2="${pad.top + ch}"
                stroke="#8292b4" stroke-width="1" stroke-dasharray="3 3"
                opacity="0"></line>
        `;

        const colW = n === 1 ? cw : cw / (n - 1);

        series.forEach((_, i) => {
            html += `
                <rect data-i="${i}" x="${x(i) - colW / 2}" y="${pad.top}"
                    width="${colW}" height="${ch}" fill="transparent"></rect>
            `;
        });

        svg.innerHTML = html;

        // ---------- Tooltip ----------
        const hoverLine = svg.querySelector('#work-chart-hover');

        svg.onmousemove = (event) => {
            const rect = event.target.closest?.('[data-i]');
            if (!rect || !tip) return;

            const i = Number(rect.dataset.i);
            const item = series[i];
            const px = x(i);

            hoverLine.setAttribute('x1', px);
            hoverLine.setAttribute('x2', px);
            hoverLine.setAttribute('opacity', '1');

            tip.innerHTML = `
                ${formatChartDate(item.date)}
                <b>${formatMoney(item.money)}</b>
                ${formatWorkTime(item.seconds)} · ${item.tasks} tasks
            `;

            tip.style.left = `${Math.min(Math.max(px, 70), W - 70)}px`;
            tip.style.top = `${y(item.money)}px`;
            tip.classList.add('show');
        };

        svg.onmouseleave = () => {
            hoverLine?.setAttribute('opacity', '0');
            tip?.classList.remove('show');
        };
    }

    // Vẽ lại khi popup đổi kích thước
    const workChartWrapEl = popup.querySelector('#work-chart-wrap');
    let workChartResizeObserver = null;

    if (workChartWrapEl && 'ResizeObserver' in window) {
        workChartResizeObserver = new ResizeObserver(() => {
            if (lastDailyData) renderDailyChart(lastDailyData);
        });
        workChartResizeObserver.observe(workChartWrapEl);
    }

    // ---------------------------------------------------------
    // 7. MAIN
    // ---------------------------------------------------------
    //
    // updatePeriodStats()                      -> tải tiếp phần còn thiếu
    // updatePeriodStats({ refreshList: true }) -> lấy lại task list
    // updatePeriodStats({ force: true })       -> bỏ cache, tải lại toàn bộ
    //
    async function updatePeriodStats(options = {}) {
        const { force = false, refreshList = false } =
            typeof options === 'boolean' ? { force: options } : options;

        if (workStatsLoading) return;

        workStatsLoading = true;
        workStopped = false;
        workStopReason = '';
        workCooldownUntil = 0;

        const cache = force ? createEmptyWorkCache() : loadWorkCache();

        updateActionButtons(cache.pending.length);

        try {
            // Hiện cache ngay cho nhanh
            if (Object.keys(cache.tasks).length) {
                renderWorkStats(aggregateWorkStats(cache));
            }

            const token = findWorkOverviewToken();

            if (!token) {
                setSyncStatus('Không tìm thấy token', true);
                return null;
            }

            // ---------- Task list: dùng cache nếu còn mới ----------
            const listFresh =
                !force &&
                !refreshList &&
                cache.listFetchedAt &&
                Date.now() - cache.listFetchedAt < WORK_LIST_TTL_MS;

            if (!listFresh) {
                const tasks = await fetchAllTasks(token);

                // Xoá task không còn tồn tại
                const liveIds = new Set(tasks.map((t) => t.id));

                for (const id of Object.keys(cache.tasks)) {
                    if (!liveIds.has(id)) delete cache.tasks[id];
                }

                // Task mới / đổi status / chưa có submission
                cache.pending = tasks.filter((task) => {
                    const c = cache.tasks[task.id];
                    return !c || c.status !== task.status || !c.submissionId;
                });

                cache.listFetchedAt = Date.now();

                saveWorkCache(cache);
            }

            // ---------- Tải theo lượt ----------
            const totalPending = cache.pending.length;
            const batch = cache.pending.slice(0, WORK_BATCH_LIMIT);
            const doneIds = new Set();

            console.log(
                `[WorkOverview] Còn ${totalPending} task, lượt này tải ${batch.length}`
            );

            if (batch.length) {
                setSyncStatus(`Đang tải 0/${batch.length} · còn ${totalPending}`);
            }

            await runWithLimit(batch, WORK_CONCURRENCY, async (task) => {
                try {
                    cache.tasks[task.id] = await fetchTaskDuration(task, token);
                    doneIds.add(task.id);

                } catch (err) {
                    if (err.stopped) return;

                    // Retry hết mà vẫn 429 -> dừng lượt này
                    if (err.status === 429) {
                        workStopped = true;
                        workStopReason = 'rate';
                        return;
                    }

                    // Lỗi khác (404...): bỏ qua lượt này,
                    // lần lấy lại list sẽ thử lại
                    console.warn('[WorkOverview] Lỗi task', task.id, err);
                    doneIds.add(task.id);
                    return;
                }

                setSyncStatus(
                    `Đang tải ${doneIds.size}/${batch.length} · ` +
                    `còn ${totalPending - doneIds.size}`
                );

                // Lưu + render dần mỗi 10 task
                if (doneIds.size % 10 === 0) {
                    cache.pending = cache.pending.filter((t) => !doneIds.has(t.id));
                    saveWorkCache(cache);
                    renderWorkStats(aggregateWorkStats(cache));
                }
            });

            cache.pending = cache.pending.filter((t) => !doneIds.has(t.id));

            saveWorkCache(cache);

            const stats = aggregateWorkStats(cache);

            renderWorkStats(stats);

            // ---------- Trạng thái cuối ----------
            const remaining = cache.pending.length;

            if (workStopReason === 'rate') {
                setSyncStatus(`Bị giới hạn request · còn ${remaining} task`, true);
            } else if (workStopReason === 'user') {
                setSyncStatus(`Đã dừng · còn ${remaining} task`, true);
            } else if (remaining > 0) {
                setSyncStatus(`Còn ${remaining} task chưa tải`);
            } else {
                setSyncStatus(
                    `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}`
                );
            }

            console.log('[WorkOverview] Period stats:', {
                today: formatWorkTime(stats.today.seconds),
                week: formatWorkTime(stats.week.seconds),
                month: formatWorkTime(stats.month.seconds),
                remaining,
                raw: stats
            });

            return stats;

        } catch (err) {
            if (!err.stopped) {
                console.error('[WorkOverview] Lỗi tính today/week/month:', err);
            }

            saveWorkCache(cache);

            if (Object.keys(cache.tasks).length) {
                renderWorkStats(aggregateWorkStats(cache));
            }

            setSyncStatus(
                err.stopped
                    ? 'Đã dừng'
                    : err.status === 429
                        ? 'Too many requests · thử lại sau'
                        : 'Lỗi tải danh sách task',
                true
            );

            return null;

        } finally {
            workStatsLoading = false;
            updateActionButtons(cache.pending.length);
        }
    }

    // =========================================================
    // 24. HELPER - SET WORK TIME (thủ công / test UI)
    // =========================================================
    //
    // WorkOverview.setTime({
    //     today: '6 h 42 min',
    //     week: '31 h 15 min',
    //     month: '83 h 52 min',
    //     all: '315 h 20 min'
    // });
    //
    function setTime(data = {}) {
        const map = {
            today: '#work-time-today',
            week: '#work-time-week',
            month: '#work-time-month',
            current: '#work-time-current',
            all: '#work-time-all'
        };

        Object.entries(map).forEach(([key, selector]) => {
            if (data[key] === undefined || data[key] === null) return;

            const element = popup.querySelector(selector);
            if (element) element.textContent = String(data[key]);
        });
    }

    // =========================================================
    // 25. GLOBAL DEBUG API
    // =========================================================
    window.WorkOverview = {
        open: openPopup,
        close: closePopup,
        toggle: togglePopup,
        setTime,

        refresh: manualRefresh,

        refreshAll,

        refreshCurrent: updateAllTime,

        // Tải tiếp phần còn thiếu
        continueLoading: () => updatePeriodStats(),

        // Lấy lại task list (bỏ qua cache 10 phút)
        refreshPeriods: () => updatePeriodStats({ refreshList: true }),

        // Bỏ cache, tải lại toàn bộ
        rebuildPeriods: () => updatePeriodStats({ force: true }),

        stop: stopLoading,
        clearCache: clearWorkCache,

        popup,
        overlay,
        button,
        observer,

        // Dọn dẹp khi chạy lại script
        _cleanup: () => {
            observer.disconnect();
            workChartResizeObserver?.disconnect();
            document.removeEventListener('keydown', onKeyDown);
            if (waitForSidebar) clearInterval(waitForSidebar);
            document.body.style.overflow = oldBodyOverflow;
        }
    };

    // =========================================================
    // DONE
    // =========================================================
    console.log(
        '%c[WorkOverview] Loaded successfully',
        'color:#00bf81;font-weight:bold;'
    );
})();
