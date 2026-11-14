/* Workplace Utilization Dashboard
 * Author: Montrell Bennett
 * Reads window.DASHBOARD_DATA (data.js) and renders one section at a time,
 * driven by the URL hash, a floor filter and a month range.
 */
(function () {
  'use strict';

  const D = window.DASHBOARD_DATA;
  const toObjs = (t) => t.rows.map((r) => { const o = {}; t.cols.forEach((c, i) => { o[c] = r[i]; }); return o; });

  const ATT = toObjs(D.attendance_daily);
  const ROOMS = toObjs(D.room_bookings_monthly);
  const FOCUS = toObjs(D.focus_room_hourly);
  const SPACE = toObjs(D.space_observations_weekly);
  const CLEAN = toObjs(D.clean_desk_weekly);
  const TICKETS = toObjs(D.tech_tickets_monthly);
  const CHANNEL = toObjs(D.booking_channel_monthly);
  const EVENTS = toObjs(D.events);
  const SITES = toObjs(D.sites);
  const SITE_SPEND = toObjs(D.site_event_spend_monthly);
  const CATERING = toObjs(D.catering_orders);
  const COMPLAINTS = toObjs(D.complaints);
  const CSAT = toObjs(D.csat_monthly);
  const RCS = toObjs(D.rcs_log);
  const CSAT_TARGET = D.csat_target;
  const EVENT_BUDGET = D.event_budget;
  const FLOORS = D.floors;
  const MONTHS = D.months;

  const C = {
    blue: '#4E79A7', orange: '#F28E2B', red: '#E15759', teal: '#76B7B2',
    green: '#59A14F', yellow: '#EDC948', purple: '#B07AA1', pink: '#FF9DA7',
    brown: '#9C755F', grey: '#BAB0AC', lightBlue: '#A0CBE8',
  };
  const CATEGORY_COLORS = [C.blue, C.orange, C.teal, C.grey];

  const SECTIONS = [
    { id: 'summary', label: 'Executive Summary' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'conference', label: 'Conference Rooms', room: 'Conference' },
    { id: 'huddle', label: 'Huddle Rooms', room: 'Huddle' },
    { id: 'team', label: 'Team Rooms', room: 'Team' },
    { id: 'phone', label: 'Phone Rooms', room: 'Phone' },
    { id: 'focus', label: 'Focus Rooms', room: 'Focus' },
    { id: 'wellness', label: 'Wellness Rooms', room: 'Wellness' },
    { id: 'lockers', label: 'Locker Utilization' },
    { id: 'soft-seating', label: 'Soft Seating' },
    { id: 'pantries', label: 'Pantries' },
    { id: 'clean-desk', label: 'Clean Desk' },
    { id: 'technology', label: 'Technology Adoption' },
    { id: 'events', label: 'Events' },
    { id: 'catering', label: 'Catering' },
    { id: 'csat', label: 'CSAT', noFloor: true },
    { id: 'complaints', label: 'Complaints' },
    { id: 'rcs', label: 'RCS Log' },
    { id: 'sites', label: 'Sites', noFloor: true },
    { id: 'log', label: 'Log Observation' },
  ];

  const EVENT_CATS = ['Firm-sponsored', 'Social', 'Wellness'];
  const EVENT_COLORS = { 'Social': '#4E79A7', 'Wellness': '#76B7B2', 'Firm-sponsored': '#F28E2B' };
  let eventCat = 'all';
  const sel = { buCat: 'all', complaintCat: 'all', rcsBy: 'all' };
  const PALETTE = ['#4E79A7', '#F28E2B', '#76B7B2', '#E15759', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'];
  const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const moneyK = (v) => (Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1000).toLocaleString('en-US') + 'K');
  const selectBox = (id, label, allLabel, opts, cur) => '<div class="filters" style="padding:0 0 12px"><label>' + esc(label) + '<select id="' + id + '"><option value="all">' + esc(allLabel) + '</option>' + opts.map((o) => '<option value="' + esc(o) + '"' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></label></div>';
  const bindSelect = (id, key) => { const el = $(id); if (el) el.addEventListener('change', (e) => { sel[key] = e.target.value; render(); }); };
  const uniq = (rows, k) => Array.from(new Set(rows.map((r) => r[k]))).sort();
  const countBy = (rows, k) => { const m = groupBy(rows, (r) => r[k]); return sortedKeys(m).map((x) => [x, m.get(x).length]); };
  const moneyAxis = { beginAtZero: true, ticks: { callback: (v) => moneyK(v) } };
  const moneyTip = { callbacks: { label: (ctx) => (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + money(ctx.parsed.y !== undefined && ctx.chart.config.options.indexAxis !== 'y' ? ctx.parsed.y : ctx.parsed.x) } };
  function moneyBar(id, labels, datasets, opts = {}) {
    makeChart(id, {
      type: 'bar',
      data: { labels, datasets: datasets.map((d) => Object.assign({ backgroundColor: C.blue, maxBarThickness: 42 }, d)) },
      options: {
        indexAxis: opts.horizontal ? 'y' : 'x',
        scales: opts.horizontal ? { x: moneyAxis, y: { grid: { display: false }, stacked: !!opts.stacked } } : { x: { grid: { display: false }, stacked: !!opts.stacked, ticks: { maxRotation: 0, autoSkipPadding: 10 } }, y: Object.assign({ stacked: !!opts.stacked }, moneyAxis) },
        plugins: { legend: { display: datasets.length > 1 }, tooltip: moneyTip },
      },
    });
  }
  function monthsInRange() { return MONTHS.filter((m) => m >= state.from && m <= state.to); }

  const state = { section: 'summary', floor: 'all', from: MONTHS[0], to: MONTHS[MONTHS.length - 1] };
  let charts = [];

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const pct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) + '%' : 'n/a');
  const num = (v) => (isFinite(v) ? Math.round(v).toLocaleString('en-US') : 'n/a');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = (m) => MON[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  const shortMonth = (m) => MON[+m.slice(5, 7) - 1] + " '" + m.slice(2, 4);
  const shortWeek = (w) => MON[+w.slice(5, 7) - 1] + ' ' + (+w.slice(8, 10)) + " '" + w.slice(2, 4);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const inRange = (key) => { const m = key.slice(0, 7); return m >= state.from && m <= state.to; };
  const floorOk = (f) => state.floor === 'all' || Number(state.floor) === f;
  const filt = (rows, key) => rows.filter((r) => inRange(r[key]) && (r.floor === undefined || floorOk(r.floor)));
  const groupBy = (rows, keyFn) => {
    const m = new Map();
    rows.forEach((r) => { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return m;
  };
  const sortedKeys = (m) => Array.from(m.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const floorsInScope = () => FLOORS.filter((f) => floorOk(f.floor));
  const scopeLabel = () => (state.floor === 'all' ? 'All floors' : 'Floor ' + state.floor);
  const rangeLabel = () => monthLabel(state.from) + ' to ' + monthLabel(state.to);

  /* ---------- chart helpers ---------- */
  if (window.Chart) {
    Chart.defaults.font.family = 'Arial, Helvetica, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#555';
    Chart.defaults.borderColor = '#e6e6e6';
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.animation.duration = 300;
  }

  function destroyCharts() { charts.forEach((c) => c.destroy()); charts = []; }

  function makeChart(id, config) {
    const el = $(id);
    if (!el || !window.Chart) return;
    charts.push(new Chart(el, config));
  }

  const pctAxis = (max) => ({
    beginAtZero: true,
    max: max,
    ticks: { callback: (v) => Math.round(v * 100) + '%' },
  });
  const pctTooltip = { callbacks: { label: (ctx) => (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + pct(ctx.parsed.y !== undefined && ctx.chart.config.options.indexAxis !== 'y' ? ctx.parsed.y : ctx.parsed.x) } };

  function lineChart(id, labels, datasets, opts = {}) {
    makeChart(id, {
      type: 'line',
      data: { labels, datasets: datasets.map((d, i) => Object.assign({
        borderColor: d.color || [C.blue, C.orange, C.teal, C.red][i],
        backgroundColor: d.color || [C.blue, C.orange, C.teal, C.red][i],
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25,
      }, d)) },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 } }, y: opts.pct ? pctAxis(opts.max) : { beginAtZero: true } },
        plugins: { legend: { display: datasets.length > 1 }, tooltip: opts.pct ? pctTooltip : {} },
      },
    });
  }

  function barChart(id, labels, datasets, opts = {}) {
    makeChart(id, {
      type: 'bar',
      data: { labels, datasets: datasets.map((d) => Object.assign({ backgroundColor: C.blue, maxBarThickness: 42 }, d)) },
      options: {
        indexAxis: opts.horizontal ? 'y' : 'x',
        scales: (function () {
          const valueAxis = opts.pct ? pctAxis(opts.max) : { beginAtZero: true, stacked: !!opts.stacked };
          const catAxis = { grid: { display: false }, stacked: !!opts.stacked, ticks: { maxRotation: 0, autoSkipPadding: 10 } };
          return opts.horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis };
        })(),
        plugins: { legend: { display: datasets.length > 1 }, tooltip: opts.pct ? pctTooltip : {} },
      },
    });
  }

  /* ---------- markup helpers ---------- */
  const kpi = (label, value, sub) => '<div class="kpi"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>';
  const sheet = (id, title, wide) => '<div class="sheet' + (wide ? ' wide' : '') + '"><h3>' + esc(title) + '</h3><div class="chart"><canvas id="' + id + '" role="img" aria-label="' + esc(title) + '"></canvas></div></div>';
  const insight = (lines) => '<div class="insight">' + lines.map((l) => '<p>' + l + '</p>').join('') + '</div>';
  const header = (title, lede) => { const sec = SECTIONS.find((x) => x.id === state.section); return '<h2>' + esc(title) + '</h2><p class="lede">' + esc(lede) + ' ' + (sec && sec.noFloor ? '' : esc(scopeLabel()) + ', ') + esc(rangeLabel()) + '.</p>'; };
  const empty = (msg) => '<div class="notice">' + esc(msg) + '</div>';

  /* ---------- shared aggregations ---------- */
  function dailySite(att) {
    // sum floors per date, then return rows {date, weekday, assigned, badge, observed}
    const byDate = groupBy(att, (r) => r.date);
    return sortedKeys(byDate).map((d) => {
      const rows = byDate.get(d);
      return { date: d, weekday: rows[0].weekday, assigned: sum(rows.map((r) => r.assigned_headcount)),
        badge: sum(rows.map((r) => r.badge_swipes)), observed: sum(rows.map((r) => r.observed_headcount)),
        desks: sum(rows.map((r) => r.desks)) };
    });
  }

  function weekdayRates(att) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const g = groupBy(att, (r) => r.weekday);
    return days.map((d) => {
      const rows = g.get(d) || [];
      return sum(rows.map((r) => r.badge_swipes)) / sum(rows.map((r) => r.assigned_headcount));
    });
  }

  /* ---------- sections ---------- */
  function renderSummary() {
    const att = filt(ATT, 'date');
    if (!att.length) return empty('No data in the selected range.');
    const rate = sum(att.map((r) => r.badge_swipes)) / sum(att.map((r) => r.assigned_headcount));
    const wd = weekdayRates(att);
    const midweek = mean(wd.slice(1, 4));
    const edges = mean([wd[0], wd[4]]);
    const rooms = filt(ROOMS, 'month');
    const roomUtil = sum(rooms.map((r) => r.booked_hours)) / sum(rooms.map((r) => r.available_hours));
    const clean = filt(CLEAN, 'week_start');
    const weeks = sortedKeys(groupBy(clean, (r) => r.week_start));
    const cleanRate = (ws) => { const rows = clean.filter((r) => ws.includes(r.week_start)); return sum(rows.map((r) => r.desks_tagged_noncompliant)) / sum(rows.map((r) => r.desks_total)); };
    const firstQ = cleanRate(weeks.slice(0, 13));
    const lastQ = cleanRate(weeks.slice(-13));
    const chan = filt(CHANNEL, 'month');
    const mb0 = mean(chan.slice(0, 3).map((r) => r.mailbox_requests));
    const mb1 = mean(chan.slice(-3).map((r) => r.mailbox_requests));

    let html = header('Executive Summary', 'Program-level view prepared for business unit and senior site leadership.');
    html += '<div class="kpis">' +
      kpi('Average daily attendance', pct(rate), 'Badge swipes / assigned headcount') +
      kpi('Midweek attendance (Tue to Thu)', pct(midweek), 'vs ' + pct(edges) + ' on Mon and Fri') +
      kpi('Room utilization, all types', pct(roomUtil), 'Booked hours / available hours') +
      kpi('Clean desk noncompliance', pct(lastQ), 'Latest 13 weeks, from ' + pct(firstQ)) +
      kpi('Mailbox booking requests', num(mb1) + '/mo', 'Down from ' + num(mb0) + '/mo (site level)') +
      '</div>';
    html += insight([
      'Attendance concentrates Tuesday to Thursday, which sets peak demand for desks, lockers and rooms while Monday and Friday capacity sits largely idle.',
      'Focus rooms show their heaviest occupancy from 11:00 to 13:59 while bookings dip in the same window: employees are using them through lunch without reservations.',
      'Self-service adoption reduced manual booking requests to the corporate services mailbox by ' + pct((mb0 - mb1) / mb0, 0) + ' across the selected period.',
    ]);
    html += '<div class="grid">' +
      sheet('ch-sum-trend', 'Average daily attendance rate by month', true) +
      sheet('ch-sum-weekday', 'Attendance rate by weekday') +
      sheet('ch-sum-rooms', 'Room utilization by room type') +
      '</div>';
    $('view').innerHTML = html;

    const daily = dailySite(att);
    const byMonth = groupBy(daily, (r) => r.date.slice(0, 7));
    const months = sortedKeys(byMonth);
    lineChart('ch-sum-trend', months.map(shortMonth), [{ label: 'Attendance rate', data: months.map((m) => { const r = byMonth.get(m); return sum(r.map((x) => x.badge)) / sum(r.map((x) => x.assigned)); }) }], { pct: true });
    barChart('ch-sum-weekday', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], [{ label: 'Attendance rate', data: wd, backgroundColor: wd.map((_, i) => (i >= 1 && i <= 3 ? C.blue : C.lightBlue)) }], { pct: true });
    const types = ['Conference', 'Team', 'Focus', 'Huddle', 'Phone', 'Wellness'];
    const typeUtil = types.map((t) => { const r = rooms.filter((x) => x.room_type === t); return r.length ? sum(r.map((x) => x.booked_hours)) / sum(r.map((x) => x.available_hours)) : 0; });
    barChart('ch-sum-rooms', types, [{ label: 'Utilization', data: typeUtil }], { pct: true, horizontal: true, max: 1 });
  }

  function renderAttendance() {
    const att = filt(ATT, 'date');
    if (!att.length) return empty('No data in the selected range.');
    const daily = dailySite(att);
    const rate = sum(daily.map((r) => r.badge)) / sum(daily.map((r) => r.assigned));
    const peakDesk = Math.max(...att.map((r) => r.desk_occupancy));
    const wd = weekdayRates(att);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const peakIdx = wd.indexOf(Math.max(...wd));

    let html = header('Attendance', 'Daily badge swipes for employees assigned to each floor, compared with the community manager\'s visual headcount.');
    html += '<div class="kpis">' +
      kpi('Avg daily badge swipes', num(mean(daily.map((r) => r.badge))), 'Unique employees, ' + scopeLabel().toLowerCase()) +
      kpi('Avg visual headcount', num(mean(daily.map((r) => r.observed))), 'Community manager floor walk') +
      kpi('Attendance rate', pct(rate), 'Badge swipes / assigned headcount') +
      kpi('Peak weekday', days[peakIdx], pct(wd[peakIdx]) + ' average attendance') +
      kpi('Highest desk occupancy', pct(peakDesk), 'Visual headcount / desks, single floor-day') +
      '</div>';
    html += insight(['Tuesday to Thursday averaged ' + pct(mean(wd.slice(1, 4))) + ' attendance against ' + pct(mean([wd[0], wd[4]])) + ' on Monday and Friday.']);
    html += '<div class="grid">' +
      sheet('ch-att-trend', 'Average daily badge swipes and visual headcount by month', true) +
      sheet('ch-att-weekday', 'Attendance rate by weekday') +
      sheet('ch-att-floor', 'Attendance rate by floor') +
      '</div>';
    const recent = att.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.floor - b.floor)).slice(0, 14);
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Latest floor observations</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Floor</th><th>Time</th><th>Community manager</th><th class="num">Visual headcount</th><th class="num">Badge swipes</th><th class="num">Assigned</th></tr></thead><tbody>' +
      recent.map((r) => '<tr><td>' + r.date + '</td><td>' + r.floor + '</td><td>' + r.observation_time + '</td><td>' + esc(r.community_manager) + '</td><td class="num">' + r.observed_headcount + '</td><td class="num">' + r.badge_swipes + '</td><td class="num">' + r.assigned_headcount + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;

    const byMonth = groupBy(daily, (r) => r.date.slice(0, 7));
    const months = sortedKeys(byMonth);
    lineChart('ch-att-trend', months.map(shortMonth), [
      { label: 'Badge swipes', data: months.map((m) => mean(byMonth.get(m).map((r) => r.badge))) },
      { label: 'Visual headcount', data: months.map((m) => mean(byMonth.get(m).map((r) => r.observed))), color: C.orange },
    ]);
    barChart('ch-att-weekday', days, [{ label: 'Attendance rate', data: wd, backgroundColor: wd.map((_, i) => (i >= 1 && i <= 3 ? C.blue : C.lightBlue)) }], { pct: true });
    const fl = floorsInScope();
    barChart('ch-att-floor', fl.map((f) => 'Floor ' + f.floor), [{ label: 'Attendance rate', data: fl.map((f) => { const r = att.filter((x) => x.floor === f.floor); return sum(r.map((x) => x.badge_swipes)) / sum(r.map((x) => x.assigned_headcount)); }) }], { pct: true });
  }

  function renderRooms(sec) {
    const type = sec.room;
    const rows = filt(ROOMS, 'month').filter((r) => r.room_type === type);
    const title = sec.label;
    if (!rows.length) {
      if (type === 'Wellness') {
        const wf = FLOORS.filter((f) => f.has_wellness_room === 'Yes').map((f) => f.floor).join(', ');
        return empty('There is no wellness room on ' + scopeLabel() + '. The campus has four wellness rooms, on floors ' + wf + '.');
      }
      return empty('No data in the selected range.');
    }
    const util = sum(rows.map((r) => r.booked_hours)) / sum(rows.map((r) => r.available_hours));
    const bookings = sum(rows.map((r) => r.bookings));
    const roomCount = new Set(rows.map((r) => r.room_id)).size;
    const byMonth = groupBy(rows, (r) => r.month);
    const months = sortedKeys(byMonth);

    let html = header(title, 'Monthly reservation data from the room booking system, one ' + type.toLowerCase() + ' room per floor' + (type === 'Wellness' ? ' on the four floors that have one' : '') + '.');
    html += '<div class="kpis">' +
      kpi('Rooms in scope', num(roomCount), scopeLabel()) +
      kpi('Utilization', pct(util), 'Booked hours / available hours') +
      kpi('Total bookings', num(bookings), rangeLabel()) +
      kpi('Avg bookings per room per month', num(bookings / roomCount / months.length), '') +
      kpi('Avg booking length', (sum(rows.map((r) => r.booked_hours)) / bookings * 60).toFixed(0) + ' min', '') +
      '</div>';

    let focusData = null;
    if (type === 'Focus') {
      const fr = filt(FOCUS, 'month');
      const byHour = groupBy(fr, (r) => r.hour);
      const hours = sortedKeys(byHour);
      focusData = {
        hours,
        booked: hours.map((h) => mean(byHour.get(h).map((r) => r.booked_pct))),
        occupied: hours.map((h) => mean(byHour.get(h).map((r) => r.occupied_pct))),
        dwell: hours.map((h) => mean(byHour.get(h).map((r) => r.avg_dwell_minutes))),
      };
      const lunch = fr.filter((r) => r.hour >= 11 && r.hour <= 13);
      const other = fr.filter((r) => r.hour < 11 || r.hour > 13);
      html += insight([
        'From 11:00 to 13:59, focus rooms were occupied ' + pct(mean(lunch.map((r) => r.occupied_pct)), 0) + ' of the time but booked only ' + pct(mean(lunch.map((r) => r.booked_pct)), 0) + '.',
        'Average dwell time in that window was ' + num(mean(lunch.map((r) => r.avg_dwell_minutes))) + ' minutes, against ' + num(mean(other.map((r) => r.avg_dwell_minutes))) + ' minutes at other hours, indicating employees camping in focus rooms through lunch.',
      ]);
    }

    html += '<div class="grid">' + sheet('ch-room-trend', 'Utilization by month', true) + sheet('ch-room-floor', 'Utilization by floor');
    if (focusData) html += sheet('ch-focus-hour', 'Booked vs occupied by hour of day') + sheet('ch-focus-dwell', 'Average dwell time by hour (minutes)');
    html += '</div>';
    $('view').innerHTML = html;

    lineChart('ch-room-trend', months.map(shortMonth), [{ label: 'Utilization', data: months.map((m) => { const r = byMonth.get(m); return sum(r.map((x) => x.booked_hours)) / sum(r.map((x) => x.available_hours)); }) }], { pct: true });
    const byFloor = groupBy(rows, (r) => r.floor);
    const floors = sortedKeys(byFloor);
    barChart('ch-room-floor', floors.map((f) => 'Floor ' + f), [{ label: 'Utilization', data: floors.map((f) => { const r = byFloor.get(f); return sum(r.map((x) => x.booked_hours)) / sum(r.map((x) => x.available_hours)); }) }], { pct: true, max: 1 });
    if (focusData) {
      const labels = focusData.hours.map((h) => String(h).padStart(2, '0') + ':00');
      lineChart('ch-focus-hour', labels, [
        { label: 'Occupied', data: focusData.occupied, color: C.orange, pointRadius: 3 },
        { label: 'Booked', data: focusData.booked, color: C.blue, pointRadius: 3 },
      ], { pct: true, max: 1 });
      barChart('ch-focus-dwell', labels, [{ label: 'Minutes', data: focusData.dwell, backgroundColor: focusData.hours.map((h) => (h >= 11 && h <= 13 ? C.orange : C.lightBlue)) }]);
    }
  }

  function renderWeekly(cfg) {
    const rows = filt(SPACE, 'week_start');
    if (!rows.length) return empty('No data in the selected range.');
    const byWeek = groupBy(rows, (r) => r.week_start);
    const weeks = sortedKeys(byWeek);
    const byFloor = groupBy(rows, (r) => r.floor);
    const floors = sortedKeys(byFloor);
    let html = header(cfg.title, cfg.lede);
    html += '<div class="kpis">' + cfg.kpis(rows, weeks) + '</div>';
    if (cfg.insight) html += insight([cfg.insight(rows)]);
    html += '<div class="grid">' + sheet('ch-wk-trend', cfg.trendTitle, true) + sheet('ch-wk-floor', cfg.floorTitle) + sheet('ch-wk-weekday', 'Weekly average by month of year') + '</div>';
    $('view').innerHTML = html;
    lineChart('ch-wk-trend', weeks.map(shortWeek), [{ label: cfg.seriesLabel, data: weeks.map((w) => cfg.agg(byWeek.get(w))) }], { pct: cfg.pct, max: cfg.pct ? 1 : undefined });
    barChart('ch-wk-floor', floors.map((f) => 'Floor ' + f), [{ label: cfg.seriesLabel, data: floors.map((f) => cfg.floorAgg ? cfg.floorAgg(byFloor.get(f)) : cfg.agg(byFloor.get(f))) }], { pct: cfg.pct, max: cfg.pct ? 1 : undefined });
    const byMoy = groupBy(rows, (r) => +r.week_start.slice(5, 7));
    const moy = sortedKeys(byMoy);
    barChart('ch-wk-weekday', moy.map((m) => MON[m - 1]), [{ label: cfg.seriesLabel, data: moy.map((m) => cfg.floorAgg ? cfg.floorAgg(byMoy.get(m)) : cfg.agg(byMoy.get(m))), backgroundColor: C.teal }], { pct: cfg.pct, max: cfg.pct ? 1 : undefined });
  }

  function renderLockers() {
    const rows = filt(SPACE, 'week_start');
    if (!rows.length) return empty('No data in the selected range.');
    const byWeek = groupBy(rows, (r) => r.week_start);
    const weeks = sortedKeys(byWeek);
    const total = sum(floorsInScope().map((f) => f.lockers));
    const avgAssigned = sum(rows.map((r) => r.lockers_assigned)) / weeks.length;
    const avgInUse = sum(rows.map((r) => r.lockers_in_use)) / weeks.length;
    const lastWk = weeks[weeks.length - 1];
    const last = byWeek.get(lastWk);
    let html = header('Locker Utilization', 'Lockers assigned to employees in the locker system, logged by floor alongside lockers in use from the weekly floor walk.');
    html += '<div class="kpis">' +
      kpi('Lockers in scope', num(total), scopeLabel()) +
      kpi('Avg lockers assigned', num(avgAssigned), pct(avgAssigned / total) + ' of lockers') +
      kpi('Avg lockers in use', num(avgInUse), pct(avgInUse / total) + ' of lockers') +
      kpi('In use of assigned', pct(avgInUse / avgAssigned), 'Lockers in use / lockers assigned') +
      kpi('Latest week', num(sum(last.map((r) => r.lockers_assigned))) + ' / ' + num(sum(last.map((r) => r.lockers_in_use))), 'Assigned / in use, week of ' + lastWk) +
      '</div>';
    html += insight([
      'On average ' + num(avgAssigned - avgInUse) + ' assigned lockers sat unused each week (' + pct(1 - avgInUse / avgAssigned, 0) + ' of assignments), the gap that informs locker release and reassignment.',
      'Assignments climbed as hot desking matured: employees who initially carried belongings floor to floor adopted lockers once the booking workflow was familiar.',
    ]);
    html += '<div class="grid">' + sheet('ch-lk-trend', 'Lockers assigned and in use by week', true) + sheet('ch-lk-floor', 'Lockers assigned and in use by floor (weekly average)') + sheet('ch-lk-rate', 'Assignment and utilization rate by floor') + '</div>';
    const fl = floorsInScope();
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Latest week by floor: ' + lastWk + '</h3><div class="table-wrap"><table><thead><tr><th>Floor</th><th class="num">Total lockers</th><th class="num">Assigned</th><th class="num">In use</th><th class="num">Assigned rate</th><th class="num">Utilization</th><th class="num">In use of assigned</th></tr></thead><tbody>' +
      fl.map((f) => { const r = last.find((x) => x.floor === f.floor); return r ? '<tr><td>Floor ' + f.floor + '</td><td class="num">' + r.lockers_total + '</td><td class="num">' + r.lockers_assigned + '</td><td class="num">' + r.lockers_in_use + '</td><td class="num">' + pct(r.lockers_assigned / r.lockers_total) + '</td><td class="num">' + pct(r.lockers_in_use / r.lockers_total) + '</td><td class="num">' + pct(r.lockers_in_use / r.lockers_assigned) + '</td></tr>' : ''; }).join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;
    lineChart('ch-lk-trend', weeks.map(shortWeek), [
      { label: 'Assigned', data: weeks.map((w) => sum(byWeek.get(w).map((r) => r.lockers_assigned))) },
      { label: 'In use', data: weeks.map((w) => sum(byWeek.get(w).map((r) => r.lockers_in_use))), color: C.orange },
      { label: 'Total lockers', data: weeks.map(() => total), color: C.grey, borderDash: [6, 4], borderWidth: 1.5 },
    ]);
    const byFloor = groupBy(rows, (r) => r.floor);
    const n = (f) => byFloor.get(f.floor).length;
    barChart('ch-lk-floor', fl.map((f) => 'Floor ' + f.floor), [
      { label: 'Assigned', data: fl.map((f) => sum(byFloor.get(f.floor).map((r) => r.lockers_assigned)) / n(f)), backgroundColor: C.blue },
      { label: 'In use', data: fl.map((f) => sum(byFloor.get(f.floor).map((r) => r.lockers_in_use)) / n(f)), backgroundColor: C.orange },
    ]);
    barChart('ch-lk-rate', fl.map((f) => 'Floor ' + f.floor), [
      { label: 'Assigned rate', data: fl.map((f) => sum(byFloor.get(f.floor).map((r) => r.lockers_assigned)) / sum(byFloor.get(f.floor).map((r) => r.lockers_total))), backgroundColor: C.blue },
      { label: 'Utilization', data: fl.map((f) => sum(byFloor.get(f.floor).map((r) => r.lockers_in_use)) / sum(byFloor.get(f.floor).map((r) => r.lockers_total))), backgroundColor: C.orange },
    ], { pct: true, max: 1 });
  }

  function renderSoftSeating() {
    renderWeekly({
      title: 'Soft Seating', lede: 'Peak occupied lounge and soft seating observed during the weekly floor walk.',
      seriesLabel: 'Soft seating utilization', pct: true,
      trendTitle: 'Peak soft seating utilization by week', floorTitle: 'Soft seating utilization by floor',
      agg: (r) => sum(r.map((x) => x.soft_seating_peak)) / sum(r.map((x) => x.soft_seats_total)),
      kpis: (rows, weeks) => kpi('Soft seats in scope', num(sum(floorsInScope().map((f) => f.soft_seats))), scopeLabel()) +
        kpi('Avg peak occupied', num(sum(rows.map((r) => r.soft_seating_peak)) / weeks.length), 'Seats per weekly observation') +
        kpi('Utilization', pct(sum(rows.map((r) => r.soft_seating_peak)) / sum(rows.map((r) => r.soft_seats_total))), rangeLabel()),
      insight: () => 'Floor 1 soft seating runs highest because it adjoins the cafe and doubles as overflow dining.',
    });
  }

  function renderPantries() {
    renderWeekly({
      title: 'Pantries', lede: 'Peak number of people observed in each floor pantry at the lunch-hour walk.',
      seriesLabel: 'Peak pantry count', pct: false,
      trendTitle: 'Peak pantry count by week (sum of floors in scope)', floorTitle: 'Average peak pantry count by floor',
      agg: (r) => sum(r.map((x) => x.pantry_peak_count)),
      floorAgg: (r) => mean(r.map((x) => x.pantry_peak_count)),
      kpis: (rows, weeks) => kpi('Pantries in scope', num(floorsInScope().length), 'One per floor') +
        kpi('Avg peak count, all pantries', num(sum(rows.map((r) => r.pantry_peak_count)) / weeks.length), 'People per weekly observation') +
        kpi('Busiest observation', num(Math.max(...rows.map((r) => r.pantry_peak_count))), 'Single pantry, single week'),
    });
  }

  function renderCleanDesk() {
    const rows = filt(CLEAN, 'week_start');
    if (!rows.length) return empty('No data in the selected range.');
    const byWeek = groupBy(rows, (r) => r.week_start);
    const weeks = sortedKeys(byWeek);
    const rateOf = (r) => sum(r.map((x) => x.desks_tagged_noncompliant)) / sum(r.map((x) => x.desks_total));
    const first = rows.filter((r) => weeks.slice(0, 13).includes(r.week_start));
    const last = rows.filter((r) => weeks.slice(-13).includes(r.week_start));
    let html = header('Clean Desk', 'Desks tagged noncompliant by the community manager and bags of personal items collected, by week.');
    html += '<div class="kpis">' +
      kpi('Desks tagged noncompliant', num(sum(rows.map((r) => r.desks_tagged_noncompliant))), rangeLabel()) +
      kpi('Bags of personal items collected', num(sum(rows.map((r) => r.bags_collected))), rangeLabel()) +
      kpi('Noncompliance rate, first 13 weeks', pct(rateOf(first)), 'Tagged desks / desks') +
      kpi('Noncompliance rate, latest 13 weeks', pct(rateOf(last)), 'Change: ' + pct(rateOf(last) - rateOf(first)) + ' pts') +
      '</div>';
    html += insight(['Noncompliance fell as the clean desk standard became routine; tagging and weekly collection gave each floor a visible, measurable feedback loop.']);
    html += '<div class="grid">' + sheet('ch-cd-trend', 'Desks tagged and bags collected by week', true) + sheet('ch-cd-floor', 'Noncompliance rate by floor') + sheet('ch-cd-rate', 'Noncompliance rate by month') + '</div>';
    $('view').innerHTML = html;
    makeChart('ch-cd-trend', {
      type: 'bar',
      data: { labels: weeks.map(shortWeek), datasets: [
        { type: 'bar', label: 'Desks tagged', data: weeks.map((w) => sum(byWeek.get(w).map((r) => r.desks_tagged_noncompliant))), backgroundColor: C.blue },
        { type: 'line', label: 'Bags collected', data: weeks.map((w) => sum(byWeek.get(w).map((r) => r.bags_collected))), borderColor: C.orange, backgroundColor: C.orange, borderWidth: 2, pointRadius: 0, tension: 0.25 },
      ] },
      options: { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 } }, y: { beginAtZero: true } } },
    });
    const byFloor = groupBy(rows, (r) => r.floor);
    const floors = sortedKeys(byFloor);
    barChart('ch-cd-floor', floors.map((f) => 'Floor ' + f), [{ label: 'Noncompliance', data: floors.map((f) => rateOf(byFloor.get(f))) }], { pct: true });
    const byMonth = groupBy(rows, (r) => r.week_start.slice(0, 7));
    const months = sortedKeys(byMonth);
    lineChart('ch-cd-rate', months.map(shortMonth), [{ label: 'Noncompliance', data: months.map((m) => rateOf(byMonth.get(m))), color: C.red }], { pct: true });
  }

  function renderTechnology() {
    const t = filt(TICKETS, 'month');
    const ch = filt(CHANNEL, 'month');
    if (!t.length) return empty('No data in the selected range.');
    const cats = ['Desk booking', 'Lockers', 'Room booking', 'AV and other'];
    const byMonth = groupBy(t, (r) => r.month);
    const months = sortedKeys(byMonth);
    const mb0 = mean(ch.slice(0, 3).map((r) => r.mailbox_requests));
    const mb1 = mean(ch.slice(-3).map((r) => r.mailbox_requests));
    const share1 = sum(ch.slice(-3).map((r) => r.self_service_bookings)) / sum(ch.slice(-3).map((r) => r.total_bookings));
    let html = header('Technology Adoption', 'Support tickets for workplace technology and booking requests sent to the corporate services mailbox.');
    html += '<div class="kpis">' +
      kpi('Support tickets', num(sum(t.map((r) => r.tickets))), scopeLabel()) +
      kpi('Tickets, first 3 months', num(sum(t.filter((r) => months.slice(0, 3).includes(r.month)).map((r) => r.tickets)) / Math.min(3, months.length)) + '/mo', '') +
      kpi('Tickets, latest 3 months', num(sum(t.filter((r) => months.slice(-3).includes(r.month)).map((r) => r.tickets)) / Math.min(3, months.length)) + '/mo', '') +
      kpi('Mailbox booking requests', num(mb1) + '/mo', 'From ' + num(mb0) + '/mo, site level') +
      kpi('Self-service booking share', pct(share1), 'Latest 3 months, site level') +
      '</div>';
    html += insight(['Adoption is measured by declining demand for help: fewer support tickets and fewer requests to have corporate services book on an employee\'s behalf.' + (state.floor !== 'all' ? ' Mailbox and self-service figures are site level and do not change with the floor filter.' : '')]);
    html += '<div class="grid">' + sheet('ch-tech-tickets', 'Support tickets by category and month', true) + sheet('ch-tech-mailbox', 'Mailbox booking requests by month (site)') + sheet('ch-tech-share', 'Self-service booking share by month (site)') + '</div>';
    $('view').innerHTML = html;
    barChart('ch-tech-tickets', months.map(shortMonth), cats.map((c, i) => ({ label: c, data: months.map((m) => sum(byMonth.get(m).filter((r) => r.category === c).map((r) => r.tickets))), backgroundColor: CATEGORY_COLORS[i] })), { stacked: true });
    lineChart('ch-tech-mailbox', ch.map((r) => shortMonth(r.month)), [{ label: 'Mailbox requests', data: ch.map((r) => r.mailbox_requests), color: C.orange }]);
    lineChart('ch-tech-share', ch.map((r) => shortMonth(r.month)), [{ label: 'Self-service share', data: ch.map((r) => r.self_service_share), color: C.green }], { pct: true });
  }

  function renderEvents() {
    const all = filt(EVENTS, 'date');
    const ev = eventCat === 'all' ? all : all.filter((e) => e.category === eventCat);
    const catLabel = eventCat === 'all' ? 'All categories' : eventCat;
    let html = header('Events', 'Workplace experience programming by category: social, wellness and firm-sponsored. Events are counted on the floor where they were hosted.');
    html += '<div class="filters" style="padding:0 0 12px"><label>Event category<select id="event-cat"><option value="all">All categories</option>' +
      EVENT_CATS.map((c) => '<option value="' + c + '"' + (c === eventCat ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label></div>';
    if (!ev.length) {
      $('view').innerHTML = html + empty('No ' + (eventCat === 'all' ? '' : eventCat.toLowerCase() + ' ') + 'events were hosted on ' + scopeLabel() + ' in the selected range.');
      $('event-cat').addEventListener('change', (e) => { eventCat = e.target.value; render(); });
      return;
    }
    const attendees = sum(ev.map((e) => e.attendees));
    const rsvps = sum(ev.map((e) => e.rsvps));
    const responses = sum(ev.map((e) => e.survey_responses));
    const sat = sum(ev.map((e) => e.satisfaction_score * e.survey_responses)) / responses;
    const cost = sum(ev.map((e) => e.cost_usd));
    const socialAtt = sum(ev.filter((e) => e.category === 'Social').map((e) => e.attendees));

    // attendance on event days vs other days, Tue to Thu only so the comparison is like for like
    const att = filt(ATT, 'date').filter((r) => ['Tue', 'Wed', 'Thu'].includes(r.weekday));
    const evDates = new Set(ev.map((e) => e.date));
    const allEvDates = new Set(all.map((e) => e.date));
    const on = att.filter((r) => evDates.has(r.date));
    const off = att.filter((r) => !allEvDates.has(r.date) && r.event_day === 'No');
    const rateOf = (rows) => sum(rows.map((r) => r.badge_swipes)) / sum(rows.map((r) => r.assigned_headcount));
    const onRate = on.length ? rateOf(on) : NaN;
    const offRate = off.length ? rateOf(off) : NaN;

    html += '<div class="kpis">' +
      kpi('Events held', num(ev.length), catLabel + ', ' + scopeLabel().toLowerCase()) +
      kpi('Total attendees', num(attendees), 'Checked in at the event') +
      kpi('Avg attendees per event', num(attendees / ev.length), '') +
      kpi('RSVP show rate', pct(attendees / rsvps), 'Attendees / RSVPs') +
      kpi('Avg satisfaction', sat.toFixed(2) + ' / 5', num(responses) + ' survey responses') +
      kpi('Contract event spend', money(cost), eventCat === 'Wellness' ? 'Covered by wellness provider partnership' : eventCat === 'Firm-sponsored' ? 'Funded by the firm' : 'Social events only') +
      (socialAtt ? kpi('Cost per social attendee', '$' + (cost / socialAtt).toFixed(2), 'Contract spend / social attendees') : '') +
      '</div>';
    const byCat = EVENT_CATS.map((c) => all.filter((e) => e.category === c));
    const lines = [];
    if (isFinite(onRate) && isFinite(offRate)) lines.push('On Tuesday to Thursday event days, attendance averaged ' + pct(onRate) + ' against ' + pct(offRate) + ' on days with no event, a lift of ' + ((onRate - offRate) * 100).toFixed(1) + ' points.');
    const shows = byCat.map((r) => (r.length ? sum(r.map((e) => e.attendees)) / sum(r.map((e) => e.rsvps)) : NaN));
    if (shows.every(isFinite)) {
      const rank = EVENT_CATS.map((c, i) => [c, shows[i]]).sort((x, y) => y[1] - x[1]);
      lines.push(rank[0][0] + ' events convert RSVPs best (' + pct(rank[0][1], 0) + ' show rate), ' + rank[1][0].toLowerCase() + ' events follow (' + pct(rank[1][1], 0) + '), and ' + rank[2][0].toLowerCase() + ' events run lowest (' + pct(rank[2][1], 0) + '), which sets how far to over-invite for each type.');
    }
    lines.push('Only social events draw on the contract event budget, driven by catering and beverage service. Wellness programming is delivered through the wellness provider partnership and firm-sponsored events are funded by the firm, so both carry no contract cost.');
    if (lines.length) html += insight(lines);
    html += '<div class="grid">' +
      sheet('ch-ev-month', 'Events by month and category', true) +
      sheet('ch-ev-att', 'Total attendees by category') +
      sheet('ch-ev-avg', 'Average attendees per event by category') +
      sheet('ch-ev-spend', 'Contract event spend by month (social events)') +
      sheet('ch-ev-show', 'RSVP show rate by category') +
      sheet('ch-ev-sat', 'Average satisfaction by category (1 to 5)') +
      sheet('ch-ev-lift', 'Attendance rate, event days vs other days (Tue to Thu)') +
      '</div>';
    const recent = ev.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 15);
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Latest events</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Start</th><th>Event</th><th>Category</th><th>Floor</th><th>Venue</th><th class="num">RSVPs</th><th class="num">Attendees</th><th class="num">Show rate</th><th class="num">Satisfaction</th><th>Funded by</th></tr></thead><tbody>' +
      recent.map((e) => '<tr><td>' + e.date + '</td><td>' + e.start_time + '</td><td>' + esc(e.event_name) + '</td><td>' + esc(e.category) + '</td><td>' + e.floor + '</td><td>' + esc(e.venue) + '</td><td class="num">' + e.rsvps + '</td><td class="num">' + e.attendees + '</td><td class="num">' + pct(e.show_rate, 0) + '</td><td class="num">' + e.satisfaction_score.toFixed(1) + '</td><td>' + esc(e.funding_source) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;
    $('event-cat').addEventListener('change', (e) => { eventCat = e.target.value; render(); });

    const months = MONTHS.filter((m) => m >= state.from && m <= state.to);
    const cats = eventCat === 'all' ? EVENT_CATS : [eventCat];
    barChart('ch-ev-month', months.map(shortMonth), cats.map((c) => ({ label: c, backgroundColor: EVENT_COLORS[c], data: months.map((m) => ev.filter((e) => e.category === c && e.date.slice(0, 7) === m).length) })), { stacked: true });
    barChart('ch-ev-att', cats, [{ label: 'Attendees', data: cats.map((c) => sum(ev.filter((e) => e.category === c).map((e) => e.attendees))), backgroundColor: cats.map((c) => EVENT_COLORS[c]) }]);
    barChart('ch-ev-avg', cats, [{ label: 'Avg attendees', data: cats.map((c) => { const r = ev.filter((e) => e.category === c); return r.length ? sum(r.map((e) => e.attendees)) / r.length : 0; }), backgroundColor: cats.map((c) => EVENT_COLORS[c]) }]);
    moneyBar('ch-ev-spend', months.map(shortMonth), [{ label: 'Contract spend', backgroundColor: EVENT_COLORS.Social, data: months.map((m) => sum(ev.filter((e) => e.date.slice(0, 7) === m).map((e) => e.cost_usd))) }]);
    barChart('ch-ev-lift', ['Event days', 'Other days'], [{ label: 'Attendance rate', data: [onRate, offRate], backgroundColor: [C.blue, C.lightBlue] }], { pct: true, max: 1 });
    barChart('ch-ev-show', cats, [{ label: 'Show rate', data: cats.map((c) => { const r = ev.filter((e) => e.category === c); return r.length ? sum(r.map((e) => e.attendees)) / sum(r.map((e) => e.rsvps)) : 0; }), backgroundColor: cats.map((c) => EVENT_COLORS[c]) }], { pct: true, max: 1 });
    makeChart('ch-ev-sat', {
      type: 'bar',
      data: { labels: cats, datasets: [{ label: 'Satisfaction', maxBarThickness: 42, backgroundColor: cats.map((c) => EVENT_COLORS[c]), data: cats.map((c) => { const r = ev.filter((e) => e.category === c); const n = sum(r.map((e) => e.survey_responses)); return n ? sum(r.map((e) => e.satisfaction_score * e.survey_responses)) / n : 0; }) }] },
      options: { scales: { x: { grid: { display: false } }, y: { min: 0, max: 5 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.parsed.y.toFixed(2) + ' / 5' } } } },
    });
  }

  /* ---------- catering ---------- */
  function renderCatering() {
    const allRows = filt(CATERING, 'date');
    const rows = sel.buCat === 'all' ? allRows : allRows.filter((r) => r.business_unit === sel.buCat);
    let html = header('Catering', 'Catering ordered by business units for their meetings and charged back to each business unit. This spend sits outside the workplace experience event budget; the workplace team handles ordering, confirmation, dietary requests and charge-back administration.');
    html += selectBox('bu-cat', 'Business unit', 'All business units', uniq(CATERING, 'business_unit'), sel.buCat);
    if (!rows.length) { $('view').innerHTML = html + empty('No catering orders for this selection.'); bindSelect('bu-cat', 'buCat'); return; }
    const total = sum(rows.map((r) => r.order_total));
    const acc = rows.filter((r) => r.order_accurate === 'Yes').length / rows.length;
    const coded = rows.filter((r) => r.chargeback_coded_correctly === 'Yes').length / rows.length;
    const rush = rows.filter((r) => r.rush_order === 'Yes').length / rows.length;
    const byMonth = groupBy(rows, (r) => r.date.slice(0, 7));
    const months = sortedKeys(byMonth);
    const firstM = months.slice(0, 3).flatMap((m) => byMonth.get(m));
    const lastM = months.slice(-3).flatMap((m) => byMonth.get(m));
    html += '<div class="kpis">' +
      kpi('Orders processed', num(rows.length), scopeLabel()) +
      kpi('Charged back to business units', moneyK(total), rangeLabel()) +
      kpi('Average order', money(total / rows.length), num(mean(rows.map((r) => r.headcount))) + ' guests on average') +
      kpi('Order accuracy', pct(acc), 'Delivered as ordered') +
      kpi('Avg days to charge back', mean(rows.map((r) => r.days_to_chargeback)).toFixed(1), 'Order date to business unit charge') +
      kpi('Rush orders', pct(rush, 0), 'Less than 2 days lead time') +
      kpi('Admin hours', num(sum(rows.map((r) => r.admin_minutes)) / 60), 'Ordering, confirmation and charge-back') +
      kpi('Dietary requests', num(sum(rows.map((r) => r.dietary_requests))), 'Vegan, allergy and other needs') +
      '</div>';
    html += insight([
      'Days to charge back fell from ' + mean(firstM.map((r) => r.days_to_chargeback)).toFixed(1) + ' to ' + mean(lastM.map((r) => r.days_to_chargeback)).toFixed(1) + ' between the first and latest three months, and cost center coding accuracy reached ' + pct(lastM.filter((r) => r.chargeback_coded_correctly === 'Yes').length / lastM.length, 0) + '.',
      'Incorrect cost center coding is the main driver of admin time: each miscoded order adds a correction cycle and about six days to the charge-back.',
    ]);
    html += '<div class="grid">' + sheet('ch-ct-month', 'Catering charged back by month', true) + sheet('ch-ct-bu', 'Charged back by business unit') + sheet('ch-ct-type', 'Orders by type') + sheet('ch-ct-days', 'Average days to charge back by month') + sheet('ch-ct-acc', 'Order and coding accuracy by month') + '</div>';
    const recent = rows.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Latest orders</h3><div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Business unit</th><th>Floor</th><th>Type</th><th class="num">Guests</th><th class="num">Total</th><th class="num">Lead days</th><th>Accurate</th><th>Coded correctly</th><th class="num">Days to charge back</th></tr></thead><tbody>' +
      recent.map((r) => '<tr><td>' + r.order_id + '</td><td>' + r.date + '</td><td>' + esc(r.business_unit) + '</td><td>' + r.floor + '</td><td>' + esc(r.order_type) + '</td><td class="num">' + r.headcount + '</td><td class="num">' + money(r.order_total) + '</td><td class="num">' + r.lead_time_days + '</td><td>' + r.order_accurate + '</td><td>' + r.chargeback_coded_correctly + '</td><td class="num">' + r.days_to_chargeback + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;
    bindSelect('bu-cat', 'buCat');
    moneyBar('ch-ct-month', months.map(shortMonth), [{ label: 'Charged back', data: months.map((m) => sum(byMonth.get(m).map((r) => r.order_total))) }]);
    const bus = groupBy(rows, (r) => r.business_unit);
    const buKeys = sortedKeys(bus).sort((a, b) => sum(bus.get(b).map((r) => r.order_total)) - sum(bus.get(a).map((r) => r.order_total)));
    moneyBar('ch-ct-bu', buKeys, [{ label: 'Charged back', data: buKeys.map((k) => sum(bus.get(k).map((r) => r.order_total))) }], { horizontal: true });
    const types = countBy(rows, 'order_type').sort((a, b) => b[1] - a[1]);
    barChart('ch-ct-type', types.map((t) => t[0]), [{ label: 'Orders', data: types.map((t) => t[1]), backgroundColor: C.teal }], { horizontal: true });
    lineChart('ch-ct-days', months.map(shortMonth), [{ label: 'Days to charge back', data: months.map((m) => mean(byMonth.get(m).map((r) => r.days_to_chargeback))), color: C.orange }]);
    lineChart('ch-ct-acc', months.map(shortMonth), [
      { label: 'Order accuracy', data: months.map((m) => byMonth.get(m).filter((r) => r.order_accurate === 'Yes').length / byMonth.get(m).length) },
      { label: 'Coding accuracy', data: months.map((m) => byMonth.get(m).filter((r) => r.chargeback_coded_correctly === 'Yes').length / byMonth.get(m).length), color: C.green },
    ], { pct: true, max: 1 });
  }

  /* ---------- CSAT ---------- */
  function renderCsat() {
    const rows = filt(CSAT, 'month');
    if (!rows.length) return empty('No data in the selected range.');
    const rate = (r) => sum(r.map((x) => x.satisfied_responses)) / sum(r.map((x) => x.responses));
    const byMonth = groupBy(rows, (r) => r.month);
    const months = sortedKeys(byMonth);
    const monthly = months.map((m) => rate(byMonth.get(m)));
    const hit = monthly.filter((v) => v >= CSAT_TARGET).length;
    const firstHit = months[monthly.findIndex((v) => v >= CSAT_TARGET)];
    const last3 = rate(months.slice(-3).flatMap((m) => byMonth.get(m)));
    let html = header('CSAT', 'Customer satisfaction against the ' + pct(CSAT_TARGET, 0) + ' target, collected through QR codes on table tent cards, the weekly newsletter survey and feedback on the Jive intranet. Site level.');
    html += '<div class="kpis">' +
      kpi('CSAT, selected period', pct(rate(rows)), 'Responses rating 4 or 5 of 5') +
      kpi('CSAT, latest 3 months', pct(last3), (last3 >= CSAT_TARGET ? 'Above' : 'Below') + ' the ' + pct(CSAT_TARGET, 0) + ' target') +
      kpi('Months at or above target', hit + ' of ' + months.length, firstHit ? 'First reached ' + monthLabel(firstHit) : 'Target not yet reached') +
      kpi('Survey responses', num(sum(rows.map((r) => r.responses))), '3 feedback channels') +
      '</div>';
    const cafe = CSAT.filter((r) => r.service_area === 'Cafe and catering');
    const pre = rate(cafe.filter((r) => r.month >= '2023-03' && r.month <= '2023-08'));
    const post = rate(cafe.filter((r) => r.month >= '2023-10' && r.month <= '2024-03'));
    html += insight([
      'CSAT ' + (firstHit ? 'first reached the ' + pct(CSAT_TARGET, 0) + ' target in ' + monthLabel(firstHit) + ' and has held at or above it in ' + hit + ' of ' + months.length + ' months.' : 'has not reached the target in this range.'),
      'Cafe and catering satisfaction rose from ' + pct(pre) + ' in the six months before the rotating vegan selection launched to ' + pct(post) + ' in the six months after (site level, March 2023 to March 2024).',
    ]);
    html += '<div class="grid">' + sheet('ch-cs-month', 'CSAT by month against the ' + pct(CSAT_TARGET, 0) + ' target', true) + sheet('ch-cs-src', 'CSAT by feedback channel') + sheet('ch-cs-area', 'CSAT by service area') + sheet('ch-cs-resp', 'Responses by channel and month', true) + '</div>';
    $('view').innerHTML = html;
    lineChart('ch-cs-month', months.map(shortMonth), [
      { label: 'CSAT', data: monthly, pointRadius: 2 },
      { label: pct(CSAT_TARGET, 0) + ' target', data: months.map(() => CSAT_TARGET), color: C.red, borderDash: [6, 4], borderWidth: 1.5 },
    ], { pct: true, max: 1 });
    charts[charts.length - 1].options.scales.y.min = 0.7; charts[charts.length - 1].update();
    const srcs = ['QR table cards', 'Newsletter survey', 'Jive'];
    barChart('ch-cs-src', srcs, [{ label: 'CSAT', data: srcs.map((s) => rate(rows.filter((r) => r.source === s))), backgroundColor: srcs.map((s) => (rate(rows.filter((r) => r.source === s)) >= CSAT_TARGET ? C.blue : C.lightBlue)) }], { pct: true, max: 1 });
    const areas = uniq(rows, 'service_area');
    barChart('ch-cs-area', areas, [{ label: 'CSAT', data: areas.map((a) => rate(rows.filter((r) => r.service_area === a))), backgroundColor: areas.map((a) => (rate(rows.filter((r) => r.service_area === a)) >= CSAT_TARGET ? C.blue : C.lightBlue)) }], { pct: true, max: 1, horizontal: true });
    barChart('ch-cs-resp', months.map(shortMonth), srcs.map((s, i) => ({ label: s, backgroundColor: [C.blue, C.orange, C.teal][i], data: months.map((m) => sum(byMonth.get(m).filter((r) => r.source === s).map((r) => r.responses))) })), { stacked: true });
  }

  /* ---------- complaints ---------- */
  function renderComplaints() {
    const allRows = filt(COMPLAINTS, 'date_logged');
    const rows = sel.complaintCat === 'all' ? allRows : allRows.filter((r) => r.category === sel.complaintCat);
    let html = header('Complaints', 'Complaints captured from QR table cards, the newsletter survey, Jive, email and in person, tracked from logging through resolution.');
    html += selectBox('cp-cat', 'Category', 'All categories', Object.keys(COMPLAINTS.reduce((o, r) => { o[r.category] = 1; return o; }, {})).sort(), sel.complaintCat);
    if (!rows.length) { $('view').innerHTML = html + empty('No complaints for this selection.'); bindSelect('cp-cat', 'complaintCat'); return; }
    const resolved = rows.filter((r) => r.status === 'Resolved');
    const vegan = COMPLAINTS.filter((r) => r.category === 'Not enough vegan options');
    const fix = D.vegan_fix;
    const preV = vegan.filter((r) => r.date_logged < fix && r.date_logged >= '2023-03-11').length / 6;
    const postV = vegan.filter((r) => r.date_logged >= fix && r.date_logged < '2024-03-11').length / 6;
    html += '<div class="kpis">' +
      kpi('Complaints logged', num(rows.length), scopeLabel()) +
      kpi('Resolved', pct(resolved.length / rows.length, 0), num(rows.length - resolved.length) + ' open') +
      kpi('Median days to resolve', (function () { const v = resolved.map((r) => r.days_to_resolve).sort((x, y) => x - y); return v.length ? String(v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 'n/a'; })(), 'Logged to resolved') +
      kpi('Vegan option complaints', preV.toFixed(1) + ' to ' + postV.toFixed(1) + '/mo', 'Six months before vs after the fix, site level') +
      '</div>';
    html += insight([
      '"Not enough vegan options" was the leading complaint in 2023. Introducing a rotating selection of vegan options on ' + fix + ' cut those complaints from about ' + Math.round(preV) + ' a month to about ' + Math.round(postV) + '.',
      'Temperature complaints cluster in January, February, July and August and resolve fastest through IFM partner work orders.',
    ]);
    html += '<div class="grid">' + sheet('ch-cp-month', 'Complaints by month and category', true) + sheet('ch-cp-vegan', 'Vegan option complaints by month (site level)', true) + sheet('ch-cp-cat', 'Complaints by category') + sheet('ch-cp-days', 'Median days to resolve by category') + sheet('ch-cp-src', 'Complaints by source') + '</div>';
    const recent = rows.slice().sort((a, b) => (a.date_logged < b.date_logged ? 1 : -1)).slice(0, 12);
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Latest complaints</h3><div class="table-wrap"><table><thead><tr><th>ID</th><th>Logged</th><th>Source</th><th>Category</th><th>Floor</th><th>Status</th><th class="num">Days to resolve</th><th>Resolution</th></tr></thead><tbody>' +
      recent.map((r) => '<tr><td>' + r.complaint_id + '</td><td>' + r.date_logged + '</td><td>' + esc(r.source) + '</td><td>' + esc(r.category) + '</td><td>' + r.floor + '</td><td>' + r.status + '</td><td class="num">' + (r.days_to_resolve === '' ? '' : r.days_to_resolve) + '</td><td>' + esc(r.resolution) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;
    bindSelect('cp-cat', 'complaintCat');
    const months = monthsInRange();
    const cats = uniq(rows, 'category');
    barChart('ch-cp-month', months.map(shortMonth), cats.map((c, i) => ({ label: c, backgroundColor: PALETTE[i % PALETTE.length], data: months.map((m) => rows.filter((r) => r.category === c && r.date_logged.slice(0, 7) === m).length) })), { stacked: true });
    const vm = groupBy(vegan, (r) => r.date_logged.slice(0, 7));
    barChart('ch-cp-vegan', months.map(shortMonth), [{ label: 'Vegan option complaints', data: months.map((m) => (vm.get(m) || []).length), backgroundColor: months.map((m) => (m === fix.slice(0, 7) ? C.orange : m < fix.slice(0, 7) ? C.red : C.lightBlue)) }]);
    const cc = countBy(rows, 'category').sort((a, b) => b[1] - a[1]);
    barChart('ch-cp-cat', cc.map((c) => c[0]), [{ label: 'Complaints', data: cc.map((c) => c[1]) }], { horizontal: true });
    const rc = groupBy(resolved, (r) => r.category);
    const rk = sortedKeys(rc);
    const med = (arr) => { const v = arr.slice().sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
    barChart('ch-cp-days', rk, [{ label: 'Days', data: rk.map((k) => med(rc.get(k).map((r) => r.days_to_resolve))), backgroundColor: C.teal }], { horizontal: true });
    const sc = countBy(rows, 'source').sort((a, b) => b[1] - a[1]);
    barChart('ch-cp-src', sc.map((c) => c[0]), [{ label: 'Complaints', data: sc.map((c) => c[1]), backgroundColor: C.orange }]);
  }

  /* ---------- RCS log ---------- */
  function renderRcs() {
    const inScope = RCS.filter((r) => inRange(r.meeting_date) && (state.floor === 'all' || r.floor === 0 || floorOk(r.floor)));
    const rows = sel.rcsBy === 'all' ? inScope : inScope.filter((r) => r.raised_by === sel.rcsBy);
    let html = header('RCS Log', 'Items raised at the weekly regional client services (RCS) meeting by the IFM partner, service vendors, the VP of Regional Client Services and the workplace experience team. Site-wide items appear under every floor.');
    html += selectBox('rcs-by', 'Raised by', 'All sources', uniq(RCS, 'raised_by'), sel.rcsBy);
    if (!rows.length) { $('view').innerHTML = html + empty('No RCS items for this selection.'); bindSelect('rcs-by', 'rcsBy'); return; }
    const closed = rows.filter((r) => r.status === 'Closed');
    const meetings = new Set(rows.map((r) => r.meeting_date)).size;
    html += '<div class="kpis">' +
      kpi('Items logged', num(rows.length), num(meetings) + ' weekly meetings') +
      kpi('Closed', pct(closed.length / rows.length, 0), num(rows.length - closed.length) + ' open or monitoring') +
      kpi('Avg days to close', mean(closed.map((r) => r.days_open)).toFixed(1), 'Meeting date to closure') +
      kpi('High priority items', num(rows.filter((r) => r.priority === 'High').length), 'Avg ' + mean(closed.filter((r) => r.priority === 'High').map((r) => r.days_open)).toFixed(1) + ' days to close') +
      '</div>';
    const cat = groupBy(closed, (r) => r.category);
    const slow = sortedKeys(cat).sort((a, b) => mean(cat.get(b).map((r) => r.days_open)) - mean(cat.get(a).map((r) => r.days_open)))[0];
    html += insight(['The RCS meeting averaged ' + (rows.length / Math.max(1, meetings)).toFixed(1) + ' items a week. ' + (slow ? slow + ' items take longest to close (' + mean(cat.get(slow).map((r) => r.days_open)).toFixed(0) + ' days on average) because they run across multiple phases and vendors.' : '')]);
    html += '<div class="grid">' + sheet('ch-rc-month', 'Items by month and source', true) + sheet('ch-rc-cat', 'Items by category') + sheet('ch-rc-days', 'Average days to close by category') + '</div>';
    const recent = rows.slice().sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1)).slice(0, 15);
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Latest items</h3><div class="table-wrap"><table><thead><tr><th>ID</th><th>Meeting</th><th>Raised by</th><th>Category</th><th>Item</th><th>Floor</th><th>Priority</th><th>Owner</th><th>Status</th><th class="num">Days open</th></tr></thead><tbody>' +
      recent.map((r) => '<tr><td>' + r.item_id + '</td><td>' + r.meeting_date + '</td><td>' + esc(r.raised_by) + '</td><td>' + esc(r.category) + '</td><td>' + esc(r.item) + '</td><td>' + (r.floor === 0 ? 'Site-wide' : r.floor) + '</td><td>' + r.priority + '</td><td>' + esc(r.owner) + '</td><td>' + r.status + '</td><td class="num">' + (r.days_open === '' ? '' : r.days_open) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;
    bindSelect('rcs-by', 'rcsBy');
    const months = monthsInRange();
    const by = uniq(rows, 'raised_by');
    barChart('ch-rc-month', months.map(shortMonth), by.map((b, i) => ({ label: b, backgroundColor: PALETTE[i], data: months.map((m) => rows.filter((r) => r.raised_by === b && r.meeting_date.slice(0, 7) === m).length) })), { stacked: true });
    const cc = countBy(rows, 'category').sort((a, b) => b[1] - a[1]);
    barChart('ch-rc-cat', cc.map((c) => c[0]), [{ label: 'Items', data: cc.map((c) => c[1]) }], { horizontal: true });
    const ck = sortedKeys(cat);
    barChart('ch-rc-days', ck, [{ label: 'Days', data: ck.map((k) => mean(cat.get(k).map((r) => r.days_open))), backgroundColor: C.teal }], { horizontal: true });
  }

  /* ---------- sites ---------- */
  function renderSites() {
    const rows = filt(SITE_SPEND, 'month');
    if (!rows.length) return empty('No data in the selected range.');
    const months = monthsInRange();
    const spend = sum(rows.map((r) => r.spend_usd));
    const home = sum(rows.filter((r) => r.site_id === 'BAL').map((r) => r.spend_usd));
    const staffBy = groupBy(rows, (r) => r.month);
    const staffMonths = sortedKeys(staffBy);
    const staffSeries = staffMonths.map((m) => sum(staffBy.get(m).map((r) => r.workplace_staff)));
    const peak = Math.max(...staffSeries);
    const peakMonth = staffMonths[staffSeries.indexOf(peak)];
    const active = new Set(rows.map((r) => r.site_id)).size;
    let html = header('Sites', 'Contract event budget and workplace experience staffing across the home site and six satellite sites. Satellite sites opened after the home site; some later moved to reduced scope or ended. Event spend covers contract-funded social events.');
    html += '<div class="kpis">' +
      kpi('Contract event budget', moneyK(EVENT_BUDGET), 'Life of contract, all sites') +
      kpi('Spent in selected range', moneyK(spend), pct(spend / EVENT_BUDGET, 0) + ' of total budget') +
      kpi('Home site share', pct(home / spend, 0), 'Baltimore Waterfront Campus') +
      kpi('Sites supported', num(active), 'In selected range') +
      kpi('Peak workplace team', num(peak), monthLabel(peakMonth) + ': 1 manager and ' + (peak - 1) + ' dotted-line reports') +
      '</div>';
    html += insight([
      'The home site used ' + pct(home / spend, 0) + ' of contract event spend; the remaining ' + moneyK(spend - home) + ' supported events at the satellite sites as each opened.',
      'The workplace team peaked at ' + peak + ' people in ' + monthLabel(peakMonth) + ', with day-to-day operations at every site managed from the home site through dotted-line reports.',
    ]);
    html += '<div class="grid">' + sheet('ch-st-month', 'Event spend by month and site', true) + sheet('ch-st-site', 'Event spend by site') + sheet('ch-st-cum', 'Cumulative spend against the contract budget') + sheet('ch-st-staff', 'Workplace experience team by month and site', true) + '</div>';
    html += '<div class="sheet wide" style="margin-top:16px"><h3>Site roster</h3><div class="table-wrap"><table><thead><tr><th>Site</th><th>Region</th><th>Contract start</th><th>Full staffing</th><th>Scope reduced</th><th>Contract ended</th><th>Status</th><th class="num">Peak staff</th><th class="num">Event spend</th><th class="num">Share</th></tr></thead><tbody>' +
      SITES.map((s) => { const sp = sum(rows.filter((r) => r.site_id === s.site_id).map((r) => r.spend_usd)); return '<tr><td>' + esc(s.site_label) + '</td><td>' + esc(s.region) + '</td><td>' + monthLabel(s.contract_start) + '</td><td>' + monthLabel(s.full_staffing_from) + '</td><td>' + (s.scope_reduced ? monthLabel(s.scope_reduced) : '') + '</td><td>' + (s.contract_ended ? monthLabel(s.contract_ended) : '') + '</td><td>' + esc(s.status_at_close) + '</td><td class="num">' + s.peak_staff + '</td><td class="num">' + money(sp) + '</td><td class="num">' + pct(sp / spend) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    $('view').innerHTML = html;
    const ids = SITES.map((s) => s.site_id);
    const label = (id) => SITES.find((s) => s.site_id === id).site_label;
    const cell = (id, m, k) => sum(rows.filter((r) => r.site_id === id && r.month === m).map((r) => r[k]));
    moneyBar('ch-st-month', months.map(shortMonth), ids.map((id, i) => ({ label: label(id), backgroundColor: PALETTE[i], data: months.map((m) => cell(id, m, 'spend_usd')) })), { stacked: true });
    const siteTotals = ids.map((id) => sum(rows.filter((r) => r.site_id === id).map((r) => r.spend_usd)));
    moneyBar('ch-st-site', ids.map(label), [{ label: 'Spend', data: siteTotals, backgroundColor: ids.map((_, i) => PALETTE[i]) }], { horizontal: true });
    let run = 0;
    const cum = months.map((m) => (run += sum(rows.filter((r) => r.month === m).map((r) => r.spend_usd))));
    makeChart('ch-st-cum', {
      type: 'line',
      data: { labels: months.map(shortMonth), datasets: [
        { label: 'Cumulative spend', data: cum, borderColor: C.blue, backgroundColor: C.blue, borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: 'Contract budget', data: months.map(() => EVENT_BUDGET), borderColor: C.red, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 } }, y: moneyAxis }, plugins: { tooltip: moneyTip } },
    });
    barChart('ch-st-staff', months.map(shortMonth), ids.map((id, i) => ({ label: label(id), backgroundColor: PALETTE[i], data: months.map((m) => cell(id, m, 'workplace_staff')) })), { stacked: true });
  }

  /* ---------- log observation (data entry) ---------- */
  const LOG_FIELDS = {
    attendance: [['observed_headcount', 'Visual headcount']],
    conference: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    huddle: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    team: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    phone: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    focus: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    wellness: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    lockers: [['lockers_assigned', 'Lockers assigned'], ['lockers_in_use', 'Lockers in use']],
    'soft-seating': [['seats_occupied', 'Soft seats occupied']],
    pantries: [['pantry_occupancy', 'People in pantry']],
    'clean-desk': [['desks_tagged_noncompliant', 'Desks tagged noncompliant'], ['bags_collected', 'Bags of personal items collected']],
    technology: [['support_tickets', 'Support tickets logged'], ['mailbox_requests', 'Mailbox booking requests']],
    events: [['event_name', 'Event name', 'text'], ['category', 'Event category', EVENT_CATS], ['rsvps', 'RSVPs'], ['attendees', 'Attendees checked in']],
    complaints: [
      ['source', 'Source', ['QR table cards', 'Newsletter survey', 'Jive', 'Email', 'In person']],
      ['category', 'Category', ['Not enough vegan options', 'Cafe pricing', 'Temperature', 'Cleanliness', 'Noise', 'Room booking', 'Pantry stock', 'Lockers', 'Other']],
      ['description', 'Description', 'text'],
      ['status', 'Status', ['Open', 'In progress', 'Resolved']],
      ['resolution', 'Resolution (if resolved)', 'textopt'],
    ],
    rcs: [
      ['raised_by', 'Raised by', ['IFM partner', 'Service vendor', 'VP Regional Client Services', 'Workplace experience team']],
      ['category', 'Category', ['Building project', 'Maintenance', 'Vendor performance', 'Event support', 'Space change', 'Health and safety', 'Workplace programs']],
      ['item', 'Item', 'text'],
      ['scope', 'Applies to', ['Selected floor', 'Site-wide']],
      ['priority', 'Priority', ['High', 'Medium', 'Low']],
      ['owner', 'Owner', ['Workplace experience team', 'IFM partner', 'Service vendor']],
      ['status', 'Status', ['Open', 'Monitoring', 'Closed']],
    ],
  };
  const sessionLog = [];
  let stamp = null;

  function renderLog() {
    const sections = SECTIONS.filter((s) => LOG_FIELDS[s.id]);
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    let html = '<h2>Log Observation</h2><p class="lede">Recreates the community manager entry screen: choose the section, floor, date and your name, generate a timestamp, then type the counts from the floor walk. Entries stay in this browser session and can be exported as CSV.</p>';
    html += '<div class="sheet"><div class="form-grid">' +
      '<label>Section<select id="log-section">' + sections.map((s) => '<option value="' + s.id + '">' + esc(s.label) + '</option>').join('') + '</select></label>' +
      '<label>Floor<select id="log-floor">' + FLOORS.map((f) => '<option value="' + f.floor + '">Floor ' + f.floor + '</option>').join('') + '</select></label>' +
      '<label>Date<input type="date" id="log-date" value="' + iso + '"></label>' +
      '<label>Community manager<select id="log-cm">' + D.managers.map((m) => '<option>' + esc(m) + '</option>').join('') + '</select></label>' +
      '</div>' +
      '<div class="timestamp-row"><button type="button" id="log-stamp">Generate timestamp</button><span class="timestamp" id="log-stamp-out" aria-live="polite">--:--</span></div>' +
      '<div class="form-grid" id="log-fields"></div>' +
      '<p class="form-msg" id="log-msg" aria-live="polite"></p>' +
      '<div class="form-actions"><button type="button" id="log-submit">Submit entry</button><button type="button" class="btn-secondary" id="log-export">Export CSV</button></div>' +
      '</div>';
    html += '<div class="sheet" style="margin-top:16px"><h3>Entries this session</h3><div class="table-wrap" id="log-table"></div></div>';
    $('view').innerHTML = html;

    const drawFields = () => {
      const sec = $('log-section').value;
      $('log-fields').innerHTML = LOG_FIELDS[sec].map(([k, l, t]) => {
        if (Array.isArray(t)) return '<label>' + esc(l) + '<select data-key="' + k + '">' + t.map((o) => '<option>' + esc(o) + '</option>').join('') + '</select></label>';
        if (t === 'text' || t === 'textopt') return '<label>' + esc(l) + '<input type="text" data-key="' + k + '" data-type="' + t + '" data-label="' + esc(l) + '"></label>';
        return '<label>' + esc(l) + '<input type="number" min="0" step="1" inputmode="numeric" data-key="' + k + '"></label>';
      }).join('');
    };
    const drawTable = () => {
      if (!sessionLog.length) { $('log-table').innerHTML = '<p class="lede" style="margin:0">No entries yet.</p>'; return; }
      $('log-table').innerHTML = '<table><thead><tr><th>Section</th><th>Floor</th><th>Date</th><th>Time</th><th>Community manager</th><th>Values</th></tr></thead><tbody>' +
        sessionLog.map((e) => '<tr><td>' + esc(e.section) + '</td><td>' + e.floor + '</td><td>' + e.date + '</td><td>' + e.time + '</td><td>' + esc(e.cm) + '</td><td>' + esc(Object.entries(e.values).map(([k, v]) => k + ': ' + v).join(', ')) + '</td></tr>').join('') +
        '</tbody></table>';
    };
    const msg = (t, cls) => { const m = $('log-msg'); m.textContent = t; m.className = 'form-msg ' + (cls || ''); };

    drawFields();
    drawTable();
    $('log-section').addEventListener('change', drawFields);
    $('log-stamp').addEventListener('click', () => {
      const n = new Date();
      stamp = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
      $('log-stamp-out').textContent = stamp;
      msg('');
    });
    $('log-submit').addEventListener('click', () => {
      if (!stamp) return msg('Generate a timestamp before submitting.', 'error');
      if (!$('log-date').value) return msg('Select a date.', 'error');
      const values = {};
      const inputs = Array.from($('log-fields').querySelectorAll('input, select'));
      for (const inp of inputs) {
        if (inp.tagName === 'SELECT') { values[inp.dataset.key] = inp.value; continue; }
        if (inp.dataset.type === 'textopt') { values[inp.dataset.key] = inp.value.trim(); continue; }
        if (inp.dataset.type === 'text') {
          if (!inp.value.trim()) return msg('Enter the ' + inp.dataset.label.toLowerCase() + '.', 'error');
          values[inp.dataset.key] = inp.value.trim();
          continue;
        }
        if (inp.value === '' || Number(inp.value) < 0) return msg('Enter a whole number of zero or more for every count.', 'error');
        values[inp.dataset.key] = Number(inp.value);
      }
      const sec = SECTIONS.find((s) => s.id === $('log-section').value);
      sessionLog.unshift({ section: sec.label, floor: Number($('log-floor').value), date: $('log-date').value, time: stamp, cm: $('log-cm').value, values });
      inputs.forEach((i) => { if (i.tagName !== 'SELECT') i.value = ''; });
      stamp = null;
      $('log-stamp-out').textContent = '--:--';
      msg('Entry saved for ' + sec.label + ', Floor ' + $('log-floor').value + '.', 'ok');
      drawTable();
    });
    $('log-export').addEventListener('click', () => {
      if (!sessionLog.length) return msg('There are no entries to export yet.', 'error');
      const lines = ['section,floor,date,time,community_manager,metric,value'];
      sessionLog.slice().reverse().forEach((e) => Object.entries(e.values).forEach(([k, v]) => lines.push([e.section, e.floor, e.date, e.time, e.cm, k, v].map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(','))));
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'floor_observations.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  /* ---------- routing and filters ---------- */
  function render() {
    destroyCharts();
    const sec = SECTIONS.find((s) => s.id === state.section) || SECTIONS[0];
    document.querySelectorAll('#section-nav a').forEach((a) => {
      const on = a.dataset.id === sec.id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('filters').hidden = sec.id === 'log';
    $('floor-filter').parentElement.hidden = !!sec.noFloor;
    let out;
    if (sec.id === 'summary') out = renderSummary();
    else if (sec.id === 'attendance') out = renderAttendance();
    else if (sec.room) out = renderRooms(sec);
    else if (sec.id === 'lockers') out = renderLockers();
    else if (sec.id === 'soft-seating') out = renderSoftSeating();
    else if (sec.id === 'pantries') out = renderPantries();
    else if (sec.id === 'clean-desk') out = renderCleanDesk();
    else if (sec.id === 'technology') out = renderTechnology();
    else if (sec.id === 'events') out = renderEvents();
    else if (sec.id === 'catering') out = renderCatering();
    else if (sec.id === 'csat') out = renderCsat();
    else if (sec.id === 'complaints') out = renderComplaints();
    else if (sec.id === 'rcs') out = renderRcs();
    else if (sec.id === 'sites') out = renderSites();
    else out = renderLog();
    if (typeof out === 'string') $('view').innerHTML = '<h2>' + esc(sec.label) + '</h2>' + out;
  }

  function init() {
    $('client-name').textContent = D.site.client;
    $('site-name').textContent = D.site.site + ' | Workplace Utilization Dashboard';
    const assigned = sum(FLOORS.map((f) => f.assigned_headcount));
    $('site-meta').textContent = D.site.square_feet.toLocaleString('en-US') + ' sq ft  ·  ' + D.site.floors + ' floors  ·  ' + assigned.toLocaleString('en-US') + ' assigned employees  ·  ' + monthLabel(MONTHS[0]) + ' to ' + monthLabel(MONTHS[MONTHS.length - 1]);

    $('section-nav').innerHTML = SECTIONS.map((s) => '<a href="#' + s.id + '" data-id="' + s.id + '">' + esc(s.label) + '</a>').join('');
    $('floor-filter').innerHTML = '<option value="all">All floors</option>' + FLOORS.map((f) => '<option value="' + f.floor + '">Floor ' + f.floor + (f.amenity ? ' (' + esc(f.amenity) + ')' : '') + '</option>').join('');
    const monthOpts = MONTHS.map((m) => '<option value="' + m + '">' + monthLabel(m) + '</option>').join('');
    $('from-filter').innerHTML = monthOpts;
    $('to-filter').innerHTML = monthOpts;
    $('from-filter').value = state.from;
    $('to-filter').value = state.to;

    $('floor-filter').addEventListener('change', (e) => { state.floor = e.target.value; render(); });
    $('from-filter').addEventListener('change', (e) => {
      state.from = e.target.value;
      if (state.from > state.to) { state.to = state.from; $('to-filter').value = state.to; }
      render();
    });
    $('to-filter').addEventListener('change', (e) => {
      state.to = e.target.value;
      if (state.to < state.from) { state.from = state.to; $('from-filter').value = state.from; }
      render();
    });
    $('reset-filters').addEventListener('click', () => {
      state.floor = 'all'; state.from = MONTHS[0]; state.to = MONTHS[MONTHS.length - 1];
      $('floor-filter').value = 'all'; $('from-filter').value = state.from; $('to-filter').value = state.to;
      render();
    });

    const route = () => { const h = location.hash.replace('#', ''); state.section = SECTIONS.some((s) => s.id === h) ? h : 'summary'; render(); };
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
