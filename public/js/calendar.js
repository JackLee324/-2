// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════
const BASE_API_URL    = '';
const MONTH_NAMES_ZH  = ['','一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const MONTH_NAMES_EN  = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ABBR     = ['','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const WEEKDAY_NAME_ZH = ['周日','周一','周二','周三','周四','周五','周六'];

const EVENT_TYPES = {
    ParentEvent:   { label: '家长在园日',   color: '#9B59B6', textColor: '#fff' },
    SchoolDay:     { label: '上学日',       color: '#F1C40F', textColor: '#333' },
    OnCampusEvent: { label: '活动日',       color: '#E91E8C', textColor: '#fff' },
    PDDay:         { label: '培训/工作日',  color: '#95A5A6', textColor: '#fff' },
    Holiday:       { label: '假期',         color: '#27AE60', textColor: '#fff' }
};

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let allEvents      = [];
let monthlyThemes  = [];
let currentYear    = new Date().getFullYear();
let currentMonth   = new Date().getMonth() + 1; // 1-12
let selectedDate   = null;   // 'YYYY-MM-DD' string
let beijingToday   = null;   // 'YYYY-MM-DD' string (from server)
let beijingYear    = null;
let beijingMonth   = null;
let venueMap       = {};     // venueId -> venue object for name lookup

// ═══════════════════════════════════════════════
// INIT — Sync Beijing Time
// ═══════════════════════════════════════════════
async function init() {
    await syncBeijingTime();
    await Promise.all([loadCalendarData(), loadVenueMap()]);
    goToMonth(beijingYear, beijingMonth);
    initFloatingNotice();
}

// ─── Floating Notice ──────────────────────────────────────────────────────────
function initFloatingNotice() {
    const pill     = document.getElementById('floatingNotice');
    const dot      = document.getElementById('noticeDot');
    const textEl   = document.getElementById('noticeText');
    const closeBtn = document.getElementById('noticeClose');
    if (!pill) return;

    // Read notice from window.globalNotice (set by loadCalendarData)
    const notice = window.globalNotice || {};
    const SESSION_KEY = 'noticeClosedHash';

    if (!notice.isActive || !notice.content) return;

    // Store a hash of the content so updated notices still show
    const contentHash = simpleHash(notice.content);
    if (sessionStorage.getItem(SESSION_KEY) === contentHash) return;

    // Set content + type
    textEl.textContent = notice.content;
    dot.className = 'notice-type-dot ' + (notice.type || 'info');

    // Smart marquee: duplicate text if it overflows container
    requestAnimationFrame(() => {
        const container = textEl.parentElement;
        if (container && textEl.scrollWidth > container.clientWidth + 4) {
            // Text overflows — duplicate for seamless loop
            textEl.textContent = notice.content + '    ·    ' + notice.content + '    ·    ' + notice.content;
            textEl.classList.add('marquee');
        }
    });

    // Show pill with spring animation
    requestAnimationFrame(() => pill.classList.add('show'));

    // Close button: dismiss + remember content hash
    closeBtn.addEventListener('click', () => {
        pill.classList.remove('show');
        sessionStorage.setItem(SESSION_KEY, contentHash);
    });
}

// Simple hash of notice content to detect changes
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

// Sync with server time (Beijing timezone)
async function syncBeijingTime() {
    try {
        const res = await fetch(BASE_API_URL + '/api/time?t=' + Date.now());
        const json = await res.json();
        if (json.success) {
            const d = new Date(json.beijing || json.time);
            beijingYear  = d.getFullYear();
            beijingMonth = d.getMonth() + 1;
            const bd = d.getDate();
            const bm = String(beijingMonth).padStart(2, '0');
            beijingToday = `${beijingYear}-${bm}-${String(bd).padStart(2, '0')}`;
        }
    } catch (e) {
        // Fallback to local time if server unreachable
        const d = new Date();
        beijingYear  = d.getFullYear();
        beijingMonth = d.getMonth() + 1;
        const bd = d.getDate();
        const bm = String(beijingMonth).padStart(2, '0');
        beijingToday = `${beijingYear}-${bm}-${String(bd).padStart(2, '0')}`;
    }
}

// Load calendar data from server
async function loadCalendarData() {
    try {
        const res  = await fetch(BASE_API_URL + '/api/calendar?t=' + Date.now());
        const json  = await res.json();
        if (json.success) {
            allEvents     = json.data.events     || [];
            monthlyThemes = json.data.monthlyThemes || [];
            window.globalNotice = json.data.globalNotice || { isActive: false, type: 'info', content: '' };
        }
    } catch (e) {
        allEvents     = [];
        monthlyThemes = [];
        window.globalNotice = { isActive: false, type: 'info', content: '' };
    }
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function navigateMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    if (currentMonth < 1)  { currentMonth = 12; currentYear--; }
    selectedDate = null; // reset selection on manual nav
    renderAll();
}

function goToToday() {
    currentYear  = beijingYear;
    currentMonth = beijingMonth;
    selectedDate = beijingToday;
    renderAll();
}

function goToMonth(year, month) {
    currentYear  = year;
    currentMonth = month;
    selectedDate  = beijingToday; // auto-select today when loading
    renderAll();
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
function renderAll() {
    try { renderMonthNav(); } catch(e) { console.error('nav', e); }
    try { renderThemeBanner(); } catch(e) { console.error('banner', e); }
    try {
        renderCalendarGrid();
        renderEventSidebar();
    } catch (err) {
        console.error('日历渲染失败:', err);
        // Fallback: show grid skeleton
        const grid = document.getElementById('calGrid');
        if (grid) {
            grid.innerHTML = '<div style="padding:2rem;text-align:center;color:#94A3B8;font-size:0.9rem;">日历加载失败，请刷新重试</div>';
        }
    }
}

function renderMonthNav() {
    document.getElementById('calMonthName').textContent =
        `${MONTH_NAMES_ZH[currentMonth]} ${MONTH_NAMES_EN[currentMonth]}`;
    document.getElementById('calYear').textContent = currentYear;
}

function renderThemeBanner() {
    const theme = monthlyThemes.find(t => t.month === currentMonth);
    const themeMonthEl = document.getElementById('themeMonth');
    const themeNameEl  = document.getElementById('themeName');
    const themeNameEnEl = document.getElementById('themeNameEn');

    if (theme) {
        themeMonthEl.textContent = MONTH_ABBR[currentMonth];
        themeNameEl.textContent  = theme.theme.split(' ')[0]; // Chinese part
        themeNameEnEl.textContent = theme.themeEn || '';
    } else {
        themeMonthEl.textContent = MONTH_ABBR[currentMonth];
        themeNameEl.textContent  = MONTH_NAMES_ZH[currentMonth];
        themeNameEnEl.textContent = MONTH_NAMES_EN[currentMonth];
    }
}

function renderCalendarGrid() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const year   = currentYear;
    const month  = currentMonth;
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
    const totalCells = firstDay + daysInMonth;
    const rows = Math.ceil(totalCells / 7);

    // ─── Helpers ───────────────────────────────────────────────────────────────
    const safeHex = (hex) => {
        if (!hex || typeof hex !== 'string') return '#999999';
        const clean = hex.startsWith('#') ? hex.slice(1, 7) : hex.slice(0, 6);
        return /^[0-9A-Fa-f]{6}$/.test(clean) ? '#' + clean : '#999999';
    };

    const hexToRgba = (hex, alpha) => {
        const h = safeHex(hex).replace('#', '');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const nextDateStr = (ds) => {
        try {
            const [y, m, d] = ds.split('-').map(Number);
            const dt = new Date(y, m - 1, d + 1);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        } catch { return ds; } // Guard against malformed dates
    };

    // ─── Build events-by-date map (string comparison, no Date objects) ─────────
    const eventsByDate = {};
    try {
        allEvents.forEach(ev => {
            if (!ev || !ev.date) return;
            const start = ev.date;
            const end   = ev.endDate || ev.date;
            if (start > end) return; // Guard: bad data
            let d = start;
            while (d <= end) {
                if (!eventsByDate[d]) eventsByDate[d] = [];
                eventsByDate[d].push(ev);
                const next = nextDateStr(d);
                if (next === d) break; // Guard: infinite loop
                d = next;
            }
        });
    } catch (e) { console.error('events map error', e); }

    // ─── Conflict resolution ───────────────────────────────────────────────────
    const PRIORITY = { Holiday: 3, SchoolDay: 2, OnCampusEvent: 1, ParentEvent: 1, PDDay: 0 };
    const resolveConflicts = (evs) => {
        if (!evs || !evs.length) return { top: null, mode: 0, events: [] };
        const safe = evs.filter(Boolean);
        const sorted = [...safe].sort((a, b) => {
            const pa = PRIORITY[a.type] ?? 0;
            const pb = PRIORITY[b.type] ?? 0;
            if (pb !== pa) return pb - pa;
            return (b.backgroundColor || '').localeCompare(a.backgroundColor || '');
        });
        if (sorted.length === 1) return { top: sorted[0], mode: 1, events: sorted };
        if (sorted.length === 2) return { top: sorted[0], second: sorted[1], mode: 2, events: sorted };
        return { top: sorted[0], events: sorted.slice(0, 3), mode: 3, hidden: sorted.slice(3) };
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    let cellIndex = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 7; c++) {
            cellIndex++;
            let dayNum, dateStr, isOtherMonth = false, isFiller = false;

            if (cellIndex <= firstDay) {
                // Filler cell: invisible placeholder so 1st lands on correct weekday
                const fillerEl = document.createElement('div');
                fillerEl.className = 'day-cell other-month';
                fillerEl.style.visibility = 'hidden';
                fillerEl.innerHTML = '<div class="day-number">—</div>';
                grid.appendChild(fillerEl);
                continue;
            } else if (cellIndex <= firstDay + daysInMonth) {
                dayNum  = cellIndex - firstDay;
                dateStr = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
            } else {
                dayNum  = cellIndex - firstDay - daysInMonth;
                const nextM = month === 12 ? 1 : month + 1;
                const nextY = month === 12 ? year + 1 : year;
                dateStr = `${nextY}-${String(nextM).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                isOtherMonth = true;
            }

            const isToday    = dateStr === beijingToday;
            const isSelected = dateStr === selectedDate;
            const weekday   = c; // 0=Sun (row-start), 6=Sat (row-end)

            const evs = eventsByDate[dateStr] || [];

            // Build ribbon flags per event
            const evsWithFlags = evs.map(ev => {
                const evStart = ev.date;
                const evEnd   = ev.endDate || ev.date;
                return {
                    ev,
                    isStart: dateStr === evStart,
                    isEnd:   dateStr === evEnd,
                    showText: (dateStr === evStart) || (weekday === 0)
                };
            });

            const resolved = resolveConflicts(evs);
            const mode = resolved.mode;

            // ── Background ──
            let cellStyle = '';
            if (mode === 1 && resolved.top) {
                const bg = safeHex(resolved.top.backgroundColor || EVENT_TYPES[resolved.top.type]?.color);
                cellStyle = `background:${hexToRgba(bg, 0.12)};`;
            } else if (mode === 2 && resolved.top && resolved.second) {
                const c1 = safeHex(resolved.top.backgroundColor    || EVENT_TYPES[resolved.top.type]?.color);
                const c2 = safeHex(resolved.second.backgroundColor || EVENT_TYPES[resolved.second.type]?.color);
                cellStyle = `background:linear-gradient(to bottom,${hexToRgba(c1,0.12)} 50%,${hexToRgba(c2,0.12)} 50%);`;
            } else if (mode >= 3 && resolved.top) {
                const c = safeHex(resolved.top.backgroundColor || EVENT_TYPES[resolved.top.type]?.color);
                cellStyle = `background:${hexToRgba(c, 0.12)};`;
            }

            // ── Ribbon classes ──
            const ribbonParts = evsWithFlags.map(e => {
                if (!e.isStart && !e.isEnd) return 'ribbon-mid';
                const p = ['ribbon'];
                if (e.isStart) p.push('ribbon-start');
                if (e.isEnd)   p.push('ribbon-end');
                return p.join(' ');
            });
            const ribbonClass = ribbonParts.join(' ');

            // ── Event chips / badges ──
            let eventDisplay = '';
            if (mode === 1 && resolved.top) {
                const ev  = resolved.top;
                const bg  = safeHex(ev.backgroundColor || EVENT_TYPES[ev.type]?.color || '#999');
                const show = evsWithFlags.find(x => x.ev === ev)?.showText;
                eventDisplay = `<div class="day-event-chip">
                    <div class="day-event-dot" style="background:${bg}"></div>
                    ${show ? `<div class="day-event-text">${escapeHtml((ev.title||'').split(' ')[0])}</div>` : ''}
                </div>`;
            } else if (mode === 2 && resolved.top && resolved.second) {
                const dots = [resolved.top, resolved.second].map(ev => {
                    const bg = safeHex(ev.backgroundColor || EVENT_TYPES[ev.type]?.color || '#999');
                    return `<div style="width:6px;height:6px;border-radius:50%;background:${bg};flex-shrink:0;"></div>`;
                }).join('');
                eventDisplay = `<div style="display:flex;gap:3px;align-items:center;">${dots}</div>`;
            } else if (mode >= 3) {
                const dots = (resolved.events || []).map(ev => {
                    const bg = safeHex(ev.backgroundColor || EVENT_TYPES[ev.type]?.color || '#999');
                    return `<div style="width:7px;height:7px;border-radius:50%;background:${bg};flex-shrink:0;"></div>`;
                }).join('');
                eventDisplay = `<div style="display:flex;gap:2px;flex-wrap:wrap;">${dots}</div>`;
            }

            const cellClass = [
                'day-cell',
                isOtherMonth ? 'other-month' : '',
                isToday ? 'today' : '',
                isSelected ? 'selected' : '',
                ribbonClass
            ].filter(Boolean).join(' ');

            const cell = document.createElement('div');
            cell.className = cellClass;
            if (cellStyle) cell.setAttribute('style', cellStyle);
            cell.dataset.date = dateStr;
            cell.innerHTML = `
                <div class="day-number">${dayNum}</div>
                <div class="day-events">${eventDisplay}</div>
            `;
            cell.addEventListener('click', () => onDayClick(dateStr));
            grid.appendChild(cell);
        }
    }
}

// Advance YYYY-MM-DD string by one day
function nextDateStr(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function onDayClick(dateStr) {
    selectedDate = dateStr;
    document.querySelectorAll('.day-cell').forEach(cell => {
        cell.classList.toggle('selected', cell.dataset.date === dateStr);
    });
    scrollSidebarToSelected();
    renderEventSidebar();
    loadVenueReservations(dateStr);
}

function scrollSidebarToSelected() {
    const cards = document.querySelectorAll('.event-detail-card[data-date="' + selectedDate + '"]');
    const card = cards[0];
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Premium focus flash animation
        card.classList.remove('focus-flash');
        void card.offsetWidth;
        card.classList.add('focus-flash');
        setTimeout(() => card.classList.remove('focus-flash'), 700);
    }
}

// ─── Venue Reservations ────────────────────────────────────────────────────────
async function loadVenueMap() {
    try {
        var res = await fetch(BASE_API_URL + '/api/venues?t=' + Date.now());
        var json = await res.json();
        if (json.success) {
            var all = (json.data.coreVenues || []).concat(json.data.auxVenues || []);
            venueMap = {};
            all.forEach(function (v) { venueMap[v.id] = v; });
        }
    } catch (e) { console.error('Failed to load venue map:', e); }
}

async function loadVenueReservations(dateStr) {
    var panel = document.getElementById('venueReservationsPanel');
    var list = document.getElementById('venueReservationList');
    var dateLabel = document.getElementById('reservationDateLabel');
    if (!list || !dateLabel) return;

    // Show the date in the panel header
    var parts = dateStr.split('-');
    dateLabel.textContent = parts[1] + '月' + parseInt(parts[2]) + '日';

    try {
        var res = await fetch(BASE_API_URL + '/api/calendar/reservations?date=' + encodeURIComponent(dateStr));
        var json = await res.json();
        if (json.success && json.data.length > 0) {
            renderVenueReservations(json.data, dateStr);
        } else {
            list.innerHTML = '<div class="event-detail-empty"><div class="emoji">🏟️</div><h3>' + dateLabel.textContent + ' 暂无场地预约</h3><p>当天没有场地预约安排</p></div>';
        }
    } catch (e) {
        list.innerHTML = '<div class="event-detail-empty"><div class="emoji">⚠️</div><h3>加载失败</h3><p>' + e.message + '</p></div>';
    }
}

function renderVenueReservations(reservations, dateStr) {
    var list = document.getElementById('venueReservationList');
    if (!list) return;

    var html = '';
    reservations.forEach(function (r) {
        var venue = venueMap[r.venueId] || { name: r.venueId, image: '' };
        var imgHtml = venue.image ? '<img src="' + venue.image + '" alt="' + venue.name + '" class="venue-res-card-img" onerror="this.style.display=\'none\'">' : '';
        html += '<div class="venue-res-card">' +
            '<div class="venue-res-card-img-wrap">' + imgHtml + '</div>' +
            '<div class="venue-res-card-body">' +
            '<div class="venue-res-card-name">' + venue.name + '</div>' +
            '<div class="venue-res-card-info">' +
            '<span class="venue-res-class">' + r.className + '</span>' +
            '<span class="venue-res-time">🕐 ' + r.timeSlot + '</span>' +
            '</div></div></div>';
    });
    list.innerHTML = html;
}

// ─── Event Sidebar ─────────────────────────────────────────────────────────────
function renderEventSidebar() {
    const list = document.getElementById('eventDetailList');

    // Always show ALL events for the current displayed month
    const yearStr  = String(currentYear);
    const monthStr = String(currentMonth).padStart(2, '0');
    const prefix   = yearStr + '-' + monthStr;

    const monthEvents = allEvents
        .filter(ev => {
            // Event overlaps this month if: ev.date <= last-day-of-month AND ev.endDate >= first-day-of-month
            const evStart = ev.date; // YYYY-MM-DD
            const evEnd   = ev.endDate || ev.date;
            const monthLast = `${yearStr}-${monthStr}-${daysInMonth(currentYear, currentMonth)}`;
            return evStart <= monthLast && evEnd >= `${prefix}-01`;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    if (monthEvents.length === 0) {
        list.innerHTML = `
            <div class="event-detail-empty">
                <div class="emoji">☕</div>
                <h3>本月暂无重要事项安排</h3>
                <p>切换其他月份或前往后台添加校历事件</p>
            </div>`;
        return;
    }

    // Build all event cards for the month
    let html = '';
    monthEvents.forEach(ev => {
        const typeInfo = EVENT_TYPES[ev.type] || { label: ev.type, color: '#999', textColor: '#fff' };
        const bg   = ev.backgroundColor || typeInfo.color;
        const txt  = ev.textColor || typeInfo.textColor;
        const isMulti = ev.endDate && ev.endDate !== ev.date;

        // Parse display date from ev.date
        const [ey, em, ed] = ev.date.split('-').map(Number);
        const wday = WEEKDAY_NAME_ZH[new Date(ey, em - 1, ed).getDay()];
        const monthName = MONTH_NAMES_EN[em];
        const isSelected = ev.date === selectedDate;

        html += `
        <div class="event-detail-card${isSelected ? ' selected-card' : ''}" data-date="${ev.date}">
            <div class="event-detail-header">
                <div class="event-detail-date">
                    <div class="event-detail-day">${ed}</div>
                    <div class="event-detail-month-yr">${monthName}<br>${wday}</div>
                </div>
                <span class="event-type-pill" style="background:${bg};color:${txt}">${typeInfo.label}</span>
            </div>
            <div class="event-detail-title">${escapeHtml(ev.title || '')}</div>
            ${ev.titleEn ? `<div class="event-detail-title-en">${escapeHtml(ev.titleEn)}</div>` : ''}
            ${ev.description ? `<div class="event-detail-desc">${escapeHtml(ev.description)}</div>` : ''}
            ${isMulti ? `<div class="event-detail-range">📅 ${ev.date} → ${ev.endDate}</div>` : ''}
        </div>`;
    });

    list.innerHTML = html;
}

// Helper: days in a given month
function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Navigation active-route ───────────────────
(function activateNavLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === '/') {
            if (path === '/' || path === '/index.html' || path === '/index.htm') link.classList.add('active');
        } else if (href && path.includes(href.replace(/^\//, ''))) {
            link.classList.add('active');
        }
    });
})();

// ─── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
