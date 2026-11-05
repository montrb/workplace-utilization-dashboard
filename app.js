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
    { id: 'lockers', label: 'Lockers' },
    { id: 'soft-seating', label: 'Soft Seating' },
    { id: 'pantries', label: 'Pantries' },
    { id: 'clean-desk', label: 'Clean Desk' },
    { id: 'technology', label: 'Technology Adoption' },
    { id: 'log', label: 'Log Observation' },
  ];

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
  const header = (title, lede) => '<h2>' + esc(title) + '</h2><p class="lede">' + esc(lede) + ' ' + esc(scopeLabel()) + ', ' + esc(rangeLabel()) + '.</p>';
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
    renderWeekly({
      title: 'Lockers', lede: 'Weekly count of lockers in use from the locker system, observed midweek.',
      seriesLabel: 'Locker utilization', pct: true,
      trendTitle: 'Locker utilization by week', floorTitle: 'Locker utilization by floor',
      agg: (r) => sum(r.map((x) => x.lockers_in_use)) / sum(r.map((x) => x.lockers_total)),
      kpis: (rows, weeks) => {
        const last = rows.filter((r) => r.week_start === weeks[weeks.length - 1]);
        return kpi('Lockers in scope', num(sum(floorsInScope().map((f) => f.lockers))), scopeLabel()) +
          kpi('Avg lockers in use', num(sum(rows.map((r) => r.lockers_in_use)) / weeks.length), 'Per weekly observation') +
          kpi('Utilization', pct(sum(rows.map((r) => r.lockers_in_use)) / sum(rows.map((r) => r.lockers_total))), rangeLabel()) +
          kpi('Latest week', pct(sum(last.map((r) => r.lockers_in_use)) / sum(last.map((r) => r.lockers_total))), 'Week of ' + weeks[weeks.length - 1]);
      },
      insight: () => 'Locker use climbed as hot desking matured: employees who initially carried belongings floor to floor adopted assigned-for-the-day lockers once the booking workflow was familiar.',
    });
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

  /* ---------- log observation (data entry) ---------- */
  const LOG_FIELDS = {
    attendance: [['observed_headcount', 'Visual headcount']],
    conference: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    huddle: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    team: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    phone: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    focus: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    wellness: [['occupants', 'Occupants observed'], ['reservation_on_file', 'Reservation on file (1 = yes, 0 = no)']],
    lockers: [['lockers_in_use', 'Lockers in use']],
    'soft-seating': [['seats_occupied', 'Soft seats occupied']],
    pantries: [['pantry_occupancy', 'People in pantry']],
    'clean-desk': [['desks_tagged_noncompliant', 'Desks tagged noncompliant'], ['bags_collected', 'Bags of personal items collected']],
    technology: [['support_tickets', 'Support tickets logged'], ['mailbox_requests', 'Mailbox booking requests']],
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
      $('log-fields').innerHTML = LOG_FIELDS[sec].map(([k, l]) => '<label>' + esc(l) + '<input type="number" min="0" step="1" inputmode="numeric" data-key="' + k + '"></label>').join('');
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
      const inputs = Array.from($('log-fields').querySelectorAll('input'));
      for (const inp of inputs) {
        if (inp.value === '' || Number(inp.value) < 0) return msg('Enter a whole number of zero or more for every field.', 'error');
        values[inp.dataset.key] = Number(inp.value);
      }
      const sec = SECTIONS.find((s) => s.id === $('log-section').value);
      sessionLog.unshift({ section: sec.label, floor: Number($('log-floor').value), date: $('log-date').value, time: stamp, cm: $('log-cm').value, values });
      inputs.forEach((i) => { i.value = ''; });
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
    let out;
    if (sec.id === 'summary') out = renderSummary();
    else if (sec.id === 'attendance') out = renderAttendance();
    else if (sec.room) out = renderRooms(sec);
    else if (sec.id === 'lockers') out = renderLockers();
    else if (sec.id === 'soft-seating') out = renderSoftSeating();
    else if (sec.id === 'pantries') out = renderPantries();
    else if (sec.id === 'clean-desk') out = renderCleanDesk();
    else if (sec.id === 'technology') out = renderTechnology();
    else out = renderLog();
    if (typeof out === 'string') $('view').innerHTML = '<h2>' + esc(sec.label) + '</h2>' + out;
  }

  function init() {
    $('client-name').textContent = D.site.client;
    $('site-name').textContent = D.site.site + ' | Workplace Utilization Dashboard';
    const assigned = sum(FLOORS.map((f) => f.assigned_headcount));
    $('site-meta').textContent = D.site.square_feet.toLocaleString('en-US') + ' sq ft  ·  ' + D.site.floors + ' floors  ·  ' + assigned.toLocaleString('en-US') + ' assigned employees  ·  ' + monthLabel(MONTHS[0]) + ' to ' + monthLabel(MONTHS[MONTHS.length - 1]) + '  ·  Synthetic data';

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
