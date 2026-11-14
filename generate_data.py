#!/usr/bin/env python3
"""
Synthetic data generator for the Workplace Utilization Dashboard.

Reconstructs the data model of a hybrid-workplace KPI program run at a
seven-floor, 242,000 sq ft financial services campus (November 2022 to
September 2025). Every value is synthetic: the generator reproduces the
methodology, scale and observed patterns, not any firm's actual data.

Outputs
  *.csv               Tidy tables for Tableau Public
  data.js             Compact copy of the same tables for the web dashboard

Run:  python3 generate_data.py
"""
import csv
import json
import math
import random
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

SEED = 2022
random.seed(SEED)

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT
ASSET_DIR = ROOT

START = date(2022, 11, 1)
END = date(2025, 9, 30)

SITE = {
    "client": "Global Financial Services Firm",
    "site": "Baltimore Waterfront Campus",
    "square_feet": 242000,
    "floors": 7,
    "program_start": START.isoformat(),
    "program_end": END.isoformat(),
}

# floor, assigned headcount, desks, lockers, soft seats, amenity, wellness room
FLOORS = [
    (1, 180, 130, 150, 60, "Cafe", False),
    (2, 320, 240, 270, 36, "", True),
    (3, 320, 240, 270, 36, "", True),
    (4, 300, 225, 250, 32, "Mail room", False),
    (5, 320, 240, 270, 36, "", True),
    (6, 320, 240, 270, 36, "", True),
    (7, 290, 215, 240, 44, "Reception", False),
]
FLOOR = {f[0]: f for f in FLOORS}
TOTAL_ASSIGNED = sum(f[1] for f in FLOORS)

ROOM_TYPES = ["Conference", "Huddle", "Team", "Phone", "Focus"]
ROOM_CODE = {"Conference": "CNF", "Huddle": "HDL", "Team": "TEM",
             "Phone": "PHN", "Focus": "FOC", "Wellness": "WEL"}
# base utilization (booked hours / available hours) and average booking length
ROOM_PROFILE = {
    "Conference": (0.62, 1.00),
    "Huddle": (0.48, 0.75),
    "Team": (0.58, 1.50),
    "Phone": (0.41, 0.50),
    "Focus": (0.55, 1.25),
    "Wellness": (0.22, 0.50),
}
BOOKABLE_HOURS_PER_DAY = 10  # 08:00 to 18:00

MANAGERS = ["M. Bennett", "R. Alvarez", "K. Owens"]
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
WEEKDAY_BASE = [0.45, 0.74, 0.79, 0.72, 0.31]

HOLIDAYS = {date.fromisoformat(d) for d in [
    "2022-11-24", "2022-11-25", "2022-12-26",
    "2023-01-02", "2023-01-16", "2023-02-20", "2023-05-29", "2023-06-19",
    "2023-07-04", "2023-09-04", "2023-11-23", "2023-11-24", "2023-12-25",
    "2024-01-01", "2024-01-15", "2024-02-19", "2024-05-27", "2024-06-19",
    "2024-07-04", "2024-09-02", "2024-11-28", "2024-11-29", "2024-12-25",
    "2025-01-01", "2025-01-20", "2025-02-17", "2025-05-26", "2025-06-19",
    "2025-07-04", "2025-09-01",
]}


def noise(sd):
    return random.gauss(1.0, sd)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def poisson(lam):
    if lam <= 0:
        return 0
    if lam > 30:
        return max(0, round(random.gauss(lam, math.sqrt(lam))))
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= random.random()
        if p <= limit:
            return k
        k += 1


def months_since_start(d):
    return (d.year - START.year) * 12 + (d.month - START.month) + d.day / 31


def month_key(d):
    return f"{d.year:04d}-{d.month:02d}"


def business_days():
    d = START
    while d <= END:
        if d.weekday() < 5 and d not in HOLIDAYS:
            yield d
        d += timedelta(days=1)


def ramp(d):
    """Return-to-office adoption curve plus two policy steps."""
    m = months_since_start(d)
    r = 0.72 + 0.28 * (1 - math.exp(-m / 5))
    if d >= date(2024, 9, 1):
        r += 0.05
    if d >= date(2025, 1, 6):
        r += 0.04
    return r


def season(d):
    s = 1.0
    if (d.month == 12 and d.day >= 18) or (d.month == 1 and d.day <= 2):
        s *= 0.60
    if d.month == 8:
        s *= 0.88
    if d.month == 7:
        s *= 0.92
    if d.month in (6, 7, 8) and d.weekday() == 4:
        s *= 0.80
    return s


FLOOR_AFFINITY = {1: 1.05}
for f in range(2, 8):
    FLOOR_AFFINITY[f] = random.uniform(0.95, 1.05)


def months_list():
    out, y, m = [], START.year, START.month
    while (y, m) <= (END.year, END.month):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


MONTHS = months_list()


EVENT_CATALOG = {
    # category: [(event name, venue floor, venue, capacity, start, minutes)]
    "Social": [
        ("Coffee and Connect", 1, "Cafe", 400, "08:30", 90),
        ("Harbor View Happy Hour", 7, "Reception lounge", 450, "16:30", 120),
        ("Trivia Lunch", 1, "Cafe", 260, "12:00", 60),
        ("Heritage Month Celebration", 1, "Cafe", 450, "12:00", 90),
        ("Ice Cream Social", 7, "Reception lounge", 550, "14:00", 90),
        ("Floor Breakfast", 0, "Floor pantry", 200, "08:30", 60),
    ],
    "Wellness": [
        ("Chair Massage", 0, "Wellness room", 48, "10:00", 300),
        ("Lunchtime Yoga", 7, "Reception lounge", 60, "12:15", 45),
        ("Mindfulness Session", 1, "Cafe", 120, "12:00", 45),
        ("Flu Shot Clinic", 4, "Mail room annex", 350, "09:00", 420),
        ("Nutrition Talk", 1, "Cafe", 150, "12:00", 60),
        ("Blood Drive", 1, "Cafe", 120, "09:00", 360),
    ],
    "Firm-sponsored": [
        ("Site Town Hall", 1, "Cafe and broadcast", 900, "11:00", 60),
        ("Business Unit Quarterly Meeting", 1, "Cafe", 600, "10:00", 90),
        ("Leadership Fireside Chat", 7, "Reception lounge", 450, "15:00", 60),
        ("Learning Lunch", 1, "Cafe", 300, "12:00", 60),
        ("Community Volunteer Day", 1, "Cafe", 350, "09:00", 240),
        ("Charity Drive Kickoff", 1, "Cafe", 400, "12:00", 60),
    ],
}
# attendance lift applied site-wide on the day of an event, by category
EVENT_LIFT = {"Social": 1.05, "Wellness": 1.02, "Firm-sponsored": 1.10}
CATEGORY_CADENCE = {"Social": 2.6, "Wellness": 2.2, "Firm-sponsored": 2.6}


def build_events():
    """Event calendar on its own random stream so other tables are unaffected."""
    rng = random.Random(SEED + 101)
    days_by_month = defaultdict(list)
    for d in business_days():
        days_by_month[month_key(d)].append(d)
    events, eid = [], 0
    for mk in MONTHS:
        days = days_by_month[mk]
        m = months_since_start(days[0])
        maturity = 0.65 + 0.35 * (1 - math.exp(-m / 6))
        plan = []
        for cat, cadence in CATEGORY_CADENCE.items():
            n = max(1, round(rng.gauss(cadence * maturity, 0.7)))
            plan += [cat] * n
        if mk.endswith("-12"):
            plan.append("Holiday")
        for cat in plan:
            midweek = [d for d in days if d.weekday() in (1, 2, 3)] or days
            d = rng.choice(midweek if rng.random() < 0.8 else days)
            if cat == "Holiday":
                name, fl, venue, cap, start, mins = ("Holiday Celebration", 1, "Cafe and reception lounge", 1400, "15:00", 180)
                cat = "Social"
            else:
                name, fl, venue, cap, start, mins = rng.choice(EVENT_CATALOG[cat])
            if fl == 0:
                fl = rng.choice([f for f in FLOOR if FLOOR[f][6]]) if venue == "Wellness room" else rng.randint(2, 7)
            appeal = {"Social": 0.78, "Wellness": 0.86, "Firm-sponsored": 0.92}[cat]
            fill = clamp(rng.gauss(appeal, 0.08) * (0.75 + 0.3 * maturity), 0.3, 1.0)
            rsvps = round(cap * fill)
            show = clamp(rng.gauss({"Social": 0.74, "Wellness": 0.82, "Firm-sponsored": 0.88}[cat]
                                   * (0.9 + 0.1 * maturity), 0.06), 0.45, 1.0)
            if d.weekday() in (0, 4):
                show *= 0.88
            attendees = min(cap, round(rsvps * show))
            score = round(clamp(rng.gauss({"Social": 4.4, "Wellness": 4.6, "Firm-sponsored": 4.2}[cat], 0.2), 3.2, 5.0), 1)
            responses = round(attendees * rng.uniform(0.18, 0.32))
            cost = round(attendees * {"Social": 34, "Wellness": 16, "Firm-sponsored": 9}[cat] * rng.uniform(0.85, 1.15), -1)
            eid += 1
            events.append([f"EV{eid:04d}", d.isoformat(), WEEKDAYS[d.weekday()], start, mins, fl,
                           venue, cat, name, cap, rsvps, attendees, round(attendees / rsvps, 4),
                           responses, score, int(cost)])
    events.sort(key=lambda r: (r[1], r[3]))
    for i, e in enumerate(events, 1):
        e[0] = f"EV{i:04d}"
    return events


def write_csv(name, cols, rows):
    with open(DATA_DIR / name, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        w.writerows(rows)


def main():
    DATA_DIR.mkdir(exist_ok=True)
    ASSET_DIR.mkdir(exist_ok=True)
    tables = {}

    # Floors and rooms ------------------------------------------------------
    floor_cols = ["floor", "assigned_headcount", "desks", "lockers",
                  "soft_seats", "amenity", "has_wellness_room"]
    floor_rows = [[f, a, d, l, s, am, "Yes" if w else "No"]
                  for f, a, d, l, s, am, w in FLOORS]
    tables["floors"] = (floor_cols, floor_rows)

    rooms = []
    for f, *_rest in FLOORS:
        for t in ROOM_TYPES:
            rooms.append((f"{f:02d}-{ROOM_CODE[t]}-01", f, t))
        if FLOOR[f][6]:
            rooms.append((f"{f:02d}-{ROOM_CODE['Wellness']}-01", f, "Wellness"))
    tables["rooms"] = (["room_id", "floor", "room_type"], [list(r) for r in rooms])

    # Events ---------------------------------------------------------------
    events = build_events()
    event_cols = ["event_id", "date", "weekday", "start_time", "duration_minutes", "floor",
                  "venue", "category", "event_name", "capacity", "rsvps", "attendees",
                  "show_rate", "survey_responses", "satisfaction_score", "cost_usd"]
    tables["events"] = (event_cols, events)
    day_lift = {}
    for e in events:
        day_lift[e[1]] = max(day_lift.get(e[1], 1.0), EVENT_LIFT[e[7]])

    # Daily attendance ------------------------------------------------------
    att_cols = ["date", "weekday", "floor", "assigned_headcount", "badge_swipes",
                "observed_headcount", "desks", "attendance_rate", "desk_occupancy",
                "observation_time", "community_manager", "event_day"]
    att_rows = []
    base_badge_total = 0
    month_rates = defaultdict(list)
    week_rates = defaultdict(list)
    for d in business_days():
        wd = d.weekday()
        for f, assigned, desks, *_r in FLOORS:
            rate = WEEKDAY_BASE[wd] * ramp(d) * season(d) * FLOOR_AFFINITY[f] * noise(0.06)
            rate = clamp(rate, 0.05, 0.97)
            base_badge = min(assigned, round(assigned * rate))
            base_badge_total += base_badge
            badge = min(assigned, round(assigned * rate * day_lift.get(d.isoformat(), 1.0)))
            observed = min(desks, round(badge * random.uniform(0.84, 0.93)))
            minutes = random.randint(600, 705)  # 10:00 to 11:45
            obs_time = f"{minutes // 60:02d}:{minutes % 60:02d}"
            cm = MANAGERS[0] if random.random() < 0.85 else random.choice(MANAGERS[1:])
            att_rows.append([d.isoformat(), WEEKDAYS[wd], f, assigned, badge, observed,
                             desks, round(badge / assigned, 4), round(observed / desks, 4),
                             obs_time, cm, "Yes" if d.isoformat() in day_lift else "No"])
            month_rates[(month_key(d), f)].append(base_badge / assigned)
            monday = d - timedelta(days=wd)
            week_rates[(monday.isoformat(), f)].append(base_badge / assigned)
    tables["attendance_daily"] = (att_cols, att_rows)

    overall_rate = base_badge_total / sum(r[3] for r in att_rows)
    site_month_rate = {}
    for mk in MONTHS:
        vals = [v for f in FLOOR for v in month_rates[(mk, f)]]
        site_month_rate[mk] = sum(vals) / len(vals)
    business_days_in_month = defaultdict(int)
    for d in business_days():
        business_days_in_month[month_key(d)] += 1

    # Monthly room bookings -------------------------------------------------
    room_cols = ["month", "floor", "room_id", "room_type", "bookings", "booked_hours",
                 "available_hours", "utilization_pct"]
    room_rows = []
    bookings_by_month = defaultdict(int)
    room_affinity = {r[0]: random.uniform(0.94, 1.06) for r in rooms}
    for mk in MONTHS:
        idx = site_month_rate[mk] / overall_rate
        avail = business_days_in_month[mk] * BOOKABLE_HOURS_PER_DAY
        for rid, f, t in rooms:
            base, length = ROOM_PROFILE[t]
            util = clamp(base * idx ** 0.8 * room_affinity[rid] * noise(0.07), 0.05, 0.95)
            booked = round(util * avail, 1)
            bookings = max(1, round(booked / length * noise(0.05)))
            bookings_by_month[mk] += bookings
            room_rows.append([mk, f, rid, t, bookings, booked, avail, round(booked / avail, 4)])
    tables["room_bookings_monthly"] = (room_cols, room_rows)

    # Focus room hourly profile (lunch-hour camping) -----------------------
    booked_profile = {8: 0.25, 9: 0.50, 10: 0.62, 11: 0.44, 12: 0.38, 13: 0.42,
                      14: 0.55, 15: 0.60, 16: 0.52, 17: 0.33}
    focus_cols = ["month", "floor", "hour", "hour_label", "booked_pct",
                  "occupied_pct", "unbooked_occupancy_pct", "avg_dwell_minutes"]
    focus_rows = []
    for mk in MONTHS:
        idx = site_month_rate[mk] / overall_rate
        for f in FLOOR:
            for h, bp in booked_profile.items():
                booked = clamp(bp * idx * noise(0.05), 0.02, 0.95)
                if 11 <= h <= 13:
                    occupied = clamp(0.86 * idx ** 0.5 * noise(0.04), booked, 0.98)
                    dwell = random.gauss(104, 10)
                else:
                    occupied = clamp(booked * random.gauss(1.08, 0.04), booked, 0.95)
                    dwell = random.gauss(48, 7)
                focus_rows.append([mk, f, h, f"{h:02d}:00", round(booked, 4),
                                   round(occupied, 4), round(occupied - booked, 4),
                                   round(dwell)])
    tables["focus_room_hourly"] = (focus_cols, focus_rows)

    # Weekly space observations and clean desk -----------------------------
    space_cols = ["week_start", "floor", "lockers_total", "lockers_in_use",
                  "locker_utilization", "soft_seats_total", "soft_seating_peak",
                  "soft_seating_utilization", "pantry_peak_count", "avg_attendance_rate"]
    clean_cols = ["week_start", "floor", "desks_total", "desks_tagged_noncompliant",
                  "noncompliance_rate", "bags_collected"]
    space_rows, clean_rows = [], []
    for (wk, f) in sorted(week_rates):
        wr = sum(week_rates[(wk, f)]) / len(week_rates[(wk, f)])
        m = months_since_start(date.fromisoformat(wk))
        _, assigned, desks, lockers, seats, _am, _w = FLOOR[f]
        adopt = 0.45 + 0.50 * (1 - math.exp(-max(m, 0) / 6))
        lock_used = round(lockers * clamp(wr * adopt * 1.25 * noise(0.04), 0.05, 0.96))
        seat_factor = 1.2 if f == 1 else 1.0
        seat_peak = round(seats * clamp((0.28 + 0.75 * wr) * seat_factor * noise(0.06), 0.1, 0.95))
        pantry = max(1, round(assigned * wr * 0.07 * noise(0.10)))
        space_rows.append([wk, f, lockers, lock_used, round(lock_used / lockers, 4),
                           seats, seat_peak, round(seat_peak / seats, 4), pantry, round(wr, 4)])

        nc = (0.025 + 0.12 * math.exp(-max(m, 0) / 7)) * noise(0.15) * (0.7 + 0.5 * wr)
        tagged = max(0, round(desks * clamp(nc, 0.0, 0.3)))
        bags = round(tagged * random.uniform(0.35, 0.60))
        clean_rows.append([wk, f, desks, tagged, round(tagged / desks, 4), bags])
    tables["space_observations_weekly"] = (space_cols, space_rows)
    tables["clean_desk_weekly"] = (clean_cols, clean_rows)

    # Technology adoption ---------------------------------------------------
    categories = [("Desk booking", 0.35), ("Lockers", 0.25),
                  ("Room booking", 0.25), ("AV and other", 0.15)]
    ticket_cols = ["month", "floor", "category", "tickets"]
    ticket_rows = []
    channel_cols = ["month", "mailbox_requests", "self_service_bookings",
                    "total_bookings", "self_service_share"]
    channel_rows = []
    for i, mk in enumerate(MONTHS):
        site_total = 70 * math.exp(-i / 7) + 8
        for f, assigned, *_r in FLOORS:
            share = assigned / TOTAL_ASSIGNED
            for cat, cshare in categories:
                ticket_rows.append([mk, f, cat, poisson(site_total * share * cshare)])
        mailbox = round((360 * math.exp(-i / 6) + 35) * noise(0.08))
        total = bookings_by_month[mk]
        self_service = total - mailbox
        channel_rows.append([mk, mailbox, self_service, total, round(self_service / total, 4)])
    tables["tech_tickets_monthly"] = (ticket_cols, ticket_rows)
    tables["booking_channel_monthly"] = (channel_cols, channel_rows)

    # Write outputs ---------------------------------------------------------
    for name, (cols, rows) in tables.items():
        write_csv(f"{name}.csv", cols, rows)

    payload = {"site": SITE, "months": MONTHS, "managers": MANAGERS,
               "floors": [dict(zip(floor_cols, r)) for r in floor_rows]}
    for name, (cols, rows) in tables.items():
        if name != "floors":
            payload[name] = {"cols": cols, "rows": rows}
    with open(ASSET_DIR / "data.js", "w") as fh:
        fh.write("/* Generated by generate_data.py. Synthetic data. */\n")
        fh.write("window.DASHBOARD_DATA = ")
        json.dump(payload, fh, separators=(",", ":"))
        fh.write(";\n")

    for name, (cols, rows) in tables.items():
        print(f"{name:28s} {len(rows):6d} rows")


if __name__ == "__main__":
    main()
