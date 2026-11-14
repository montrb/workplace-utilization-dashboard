# Workplace Utilization Dashboard

An interactive recreation of the hybrid-workplace KPI dashboard I designed and ran for a seven-floor, 242,000 sq ft financial services campus in Baltimore, serving more than 2,000 assigned employees, with an average of about 1,200 on site each day, from November 2022 to September 2025.

**Live dashboard:** https://montrb.github.io/workplace-utilization-dashboard/
**Tableau Public version:** see [TABLEAU_BUILD_GUIDE.md](TABLEAU_BUILD_GUIDE.md)

> **Data notice.** The client is anonymized as a Global Financial Services Firm, Baltimore Waterfront Campus. Every figure in this repository is synthetic. The generator reproduces the program's methodology, scale and observed patterns; it contains no client data.

---

## Business context

As Workplace Experience Manager (Lead), I served as the on-site lead for the firm's New Way of Working program, which moved the campus to hot desking, hoteling, day-use lockers and self-service booking technology. Leadership needed evidence of whether the model was being adopted, where space was over- or under-used, and which policies needed adjustment.

I self-initiated a Tableau dashboard that combined these sources:

1. **Badge-access data** for employees assigned to each floor
2. **Community manager floor walks**: visual headcounts and space observations entered by floor, date and time
3. **System data**: monthly room reservations, support tickets and requests sent to the corporate services mailbox
4. **Event records**: RSVPs, check-ins and post-event survey scores for social, wellness and firm-sponsored programming that supported the return-to-office effort
5. **Business unit catering orders**, placed through the workplace team and charged back to each business unit
6. **Feedback channels**: QR codes on table tent cards, the weekly newsletter survey and the Jive intranet, used for CSAT and complaint tracking
7. **Weekly regional client services (RCS) meeting log**, with items raised by the integrated facilities management (IFM) partner, service vendors and the VP of Regional Client Services
8. **Multi-site budget and staffing records** for the home site and six satellite sites

Monthly results fed an executive data summary presented to business unit and senior site leadership, informing space-planning and hybrid-policy decisions. The approach was later adopted at other community manager sites.

## What the dashboard tracks

| Section | Source | Grain |
|---|---|---|
| Executive Summary | All sources | Program level |
| Attendance | Badge swipes and visual headcount | Floor, business day |
| Conference, Huddle, Team, Phone, Focus Rooms | Room reservations | Room, month (one of each type per floor) |
| Wellness Rooms | Room reservations | Room, month (four rooms: floors 2, 3, 5, 6) |
| Lockers, Soft Seating, Pantries | Community manager floor walk | Floor, week |
| Clean Desk | Desks tagged noncompliant, bags of personal items collected | Floor, week |
| Technology Adoption | Support tickets, mailbox booking requests | Floor and site, month |
| Events | Event calendar, RSVPs, check-ins and post-event surveys; filter by Social, Wellness or Firm-sponsored | Event |
| Catering | Business unit orders, charge-backs and order administration; filter by business unit | Order |
| CSAT | Survey responses by channel and service area against the 88% target | Channel, service area, month |
| Complaints | Complaints from logging to resolution; filter by category | Complaint |
| RCS Log | Weekly RCS meeting items; filter by who raised them | Item |
| Sites | Contract event budget and team staffing across seven sites | Site, month |
| Log Observation | Recreated community manager entry screen | Entry |

Every view responds to a **month range**, and floor-level views also respond to a **floor filter (Floors 1 to 7)**; CSAT and Sites are site level. Section names in the header are hyperlinks, mirroring the original layout. Floor amenities: cafe on Floor 1, mail room on Floor 4, reception on Floor 7.

## Key findings surfaced by the data

- **Tuesday to Thursday peaks.** Midweek attendance runs roughly double Monday and Friday, so peak-day demand, not average demand, sets desk, locker and room requirements.
- **Lunch-hour camping in focus rooms.** Between 11:00 and 13:59, focus rooms are occupied far more often than they are booked, and average dwell time roughly doubles. Employees were using focus rooms through lunch without reservations.
- **Technology adoption.** Support tickets and manual booking requests to the corporate services mailbox fell sharply as employees moved to self-service booking.
- **Events bring people in.** Tuesday to Thursday attendance runs about 3.6 points higher on days with an event than on days without one. Firm-sponsored events draw the largest audiences (about 410 per event), followed by social (about 240) and wellness (about 95).
- **Only social events draw on the contract budget.** Wellness programming was delivered through a wellness provider partnership and firm-sponsored events were funded by the firm. Social events, with catering and beverage service, account for all contract event spend.
- **A $750,000 event budget across seven sites.** The home site used 65% of the contract event budget; the rest supported six satellite sites that opened after it, some of which later moved to reduced scope or ended. The workplace team peaked at 14 people in July 2024: one manager and 13 dotted-line reports.
- **Vegan options drove the top complaint.** "Not enough vegan options" led complaints through mid-2023. A rotating selection of vegan options, introduced in September 2023, cut those complaints from about 9 a month to about 1, and cafe and catering CSAT rose about eight points.
- **CSAT above target.** Overall CSAT first reached the 88% target in September 2023 and held at or above it from then on.
- **Faster catering charge-backs.** Better cost center coding cut average days from order to business unit charge-back from about 12 to about 6.
- **Clean desk compliance.** Tagging noncompliant desks and collecting personal items weekly drove the noncompliance rate down steadily after launch.

## Metric definitions

Each metric below shows its formula and a worked example from the dataset (Floor 4, March 2024).

**Attendance rate** = unique badge swipes / assigned headcount
Example, Wednesday 27 March 2024: 236 swipes / 300 assigned = **78.7%**

**Desk occupancy** = visual headcount / desks on the floor
Example, same day: community manager counted 217 people at 11:18 / 225 desks = **96.4%**

The visual headcount runs below badge swipes because some badged employees are in meetings, at lunch or off the floor at the time of the walk. The gap between the two figures is itself a useful indicator of how much of the floor is actually used at a point in time.

**Room utilization** = booked hours / available hours
Available hours = business days in the month x 10 bookable hours (08:00 to 18:00)
Example, Floor 4 focus room, March 2024: 21 business days x 10 = 210 available hours; 126.1 booked hours / 210 = **60.0%**

**Unbooked occupancy (focus rooms)** = observed occupancy rate - booked rate, by hour
Example, Floor 4, 12:00, March 2024: occupied 84.6% - booked 38.7% = **46.0 points** of occupancy with no reservation behind it; average dwell 93 minutes

**Locker utilization** = lockers in use / total lockers
Example, week of 11 March 2024: 173 / 250 = **69.2%**

**Soft seating utilization** = peak soft seats occupied / total soft seats
Example, same week: 22 / 32 = **68.8%**

**Clean desk noncompliance rate** = desks tagged noncompliant / total desks
Example, same week: 7 / 225 = **3.1%**, with 4 bags of personal items collected

**Self-service booking share** = self-service bookings / (self-service bookings + mailbox requests)
Example, site level, March 2024: 4,587 / (4,587 + 60) = **98.7%**

**Event show rate** = attendees checked in / RSVPs
Example, Site Town Hall, 24 June 2025 (Floor 1, Firm-sponsored): 831 / 900 = **92.3%**

**Average satisfaction** = sum of (event score x survey responses) / total survey responses, so larger events carry more weight than small ones
Example, two events scored 4.0 with 100 responses and 5.0 with 20 responses: (4.0 x 100 + 5.0 x 20) / 120 = **4.17**, not the simple average of 4.5

**Cost per social attendee** = contract event spend / social event attendees (wellness and firm-sponsored events carry no contract cost)
Example, home site: $487,520 / 21,317 = **$22.87**

**Home site share of the event budget** = home site contract event spend / total contract event spend
Example: $487,520 / $750,000 = **65.0%**

**Peak workplace team** = sum of workplace experience staff across active sites in a month
Example, July 2024: 7 sites x 2 people = **14** (1 manager and 13 dotted-line reports)

**Catering order total** = headcount x cost per head, charged back to the ordering business unit
Example, order CT00501, 1 November 2023, Human Resources working lunch: 32 x $27.81 = **$889.92**, charged back 7 days later

**Order accuracy** = orders delivered as ordered / orders processed
Example, full period: 1,525 / 1,610 = **94.7%**

**CSAT** = responses rating 4 or 5 on a 5-point scale / total responses, compared with the 88% target
Example, QR table cards, March 2024: (69 + 69 + 73 + 66) / (77 + 73 + 79 + 75) = 277 / 304 = **91.1%**, above target

**Days to resolve (complaints)** = date resolved - date logged; reported as a median so long-running items do not distort the typical case
Example, complaint CP0180, "Not enough vegan options," logged 7 July 2023 and resolved when the rotating vegan selection launched on 11 September 2023 = **66 days**

**Days to close (RCS items)** = date closed - meeting date raised
Example, item RCS0073, furniture refresh on floor 1, raised 23 March 2023 and closed 23 April 2023 = **31 days**

**Event-day attendance lift** = attendance rate on Tuesday to Thursday event days - attendance rate on Tuesday to Thursday days with no event
Example, all floors, full period: 76.0% - 72.4% = **3.6 points**. Limiting both sides to Tuesday to Thursday keeps the comparison fair, because most events are scheduled midweek.

**Mailbox request reduction** = (average of first 3 months - average of latest 3 months) / average of first 3 months
Example, full period: (337 - 35) / 337 = **89.6%**

## Data dictionary

All tables are CSV files in the repository root and join on `floor`.

| File | Grain | Key fields |
|---|---|---|
| `floors.csv` | Floor | assigned_headcount, desks, lockers, soft_seats, amenity, has_wellness_room |
| `rooms.csv` | Room | room_id, floor, room_type |
| `attendance_daily.csv` | Floor x business day | badge_swipes, observed_headcount, attendance_rate, desk_occupancy, observation_time, community_manager, event_day |
| `room_bookings_monthly.csv` | Room x month | bookings, booked_hours, available_hours, utilization_pct |
| `focus_room_hourly.csv` | Floor x month x hour | booked_pct, occupied_pct, unbooked_occupancy_pct, avg_dwell_minutes |
| `space_observations_weekly.csv` | Floor x week | lockers_in_use, soft_seating_peak, pantry_peak_count |
| `clean_desk_weekly.csv` | Floor x week | desks_tagged_noncompliant, noncompliance_rate, bags_collected |
| `tech_tickets_monthly.csv` | Floor x month x category | tickets |
| `booking_channel_monthly.csv` | Site x month | mailbox_requests, self_service_bookings, self_service_share |
| `events.csv` | Event | date, start_time, floor, venue, category, event_name, capacity, rsvps, attendees, show_rate, survey_responses, satisfaction_score, cost_usd, funding_source |
| `catering_orders.csv` | Order | date, business_unit, floor, order_type, headcount, cost_per_head, order_total, dietary_requests, lead_time_days, rush_order, order_accurate, days_to_chargeback, chargeback_coded_correctly, admin_minutes |
| `csat_monthly.csv` | Month x channel x service area | responses, satisfied_responses, csat |
| `complaints.csv` | Complaint | date_logged, source, category, floor, status, date_resolved, days_to_resolve, resolution |
| `rcs_log.csv` | RCS item | meeting_date, raised_by, category, item, floor (0 = site-wide), priority, owner, status, date_closed, days_open |
| `sites.csv` | Site | site_label, region, contract_start, full_staffing_from, scope_reduced, contract_ended, status_at_close, peak_staff |
| `site_event_spend_monthly.csv` | Site x month | status, workplace_staff, social_events, attendees, spend_usd |

## How the synthetic data is built

[`generate_data.py`](generate_data.py) uses a fixed random seed so results are reproducible. It models:

- Weekday attendance factors with a Tuesday to Thursday peak
- A return-to-office adoption curve from launch, with policy steps in September 2024 and January 2025
- Seasonal dips (late December, July and August, summer Fridays) and US holidays
- Room demand scaled to monthly attendance, with type-specific utilization and booking lengths
- A lunch-hour gap between focus room occupancy and bookings, with longer dwell times
- Decay curves for clean desk noncompliance, support tickets and mailbox requests after launch
- An event calendar of social, wellness and firm-sponsored programming, mostly midweek, with a holiday celebration each December and a site-wide attendance lift on event days
- A $750,000 contract event budget, 65% at the home site and the remainder across six satellite sites weighted by how long and at what scope each ran
- Business unit catering orders with charge-back administration that improves over time
- CSAT by channel and service area, a vegan-options complaint wave in 2023 and its resolution, and a weekly RCS meeting log

## Repository structure

```
index.html                  Dashboard page
app.js                      Rendering, filters, routing and data entry logic
style.css                   Tableau-style theme (edit the CSS variables to re-theme)
data.js                     Generated data for the web dashboard
chart.umd.min.js            Chart.js (bundled so the page works offline)
*.csv                       Data tables for Tableau Public
generate_data.py            Synthetic data generator
TABLEAU_BUILD_GUIDE.md      Step-by-step Tableau Public build
```

## Run locally

```bash
python3 generate_data.py   # optional: regenerate data
python3 -m http.server 8000        # then open http://localhost:8000
```

Opening `index.html` directly in a browser also works; no build step is required.

## Deploy to GitHub Pages

Repository **Settings > Pages > Build and deployment**: Source "Deploy from a branch", Branch `main`, folder `/ (root)`. The site publishes to `https://montrb.github.io/workplace-utilization-dashboard/`.

## Tools

Tableau (original), Python, JavaScript, HTML/CSS, Chart.js, Excel. Source systems in the original program included badge-access reporting, a room booking platform (Roombook), ServiceNow tickets and a shared corporate services mailbox.

## Author

**Montrell Bennett**, Workplace Experience and Operations
Lean Six Sigma Green Belt | [LinkedIn](https://www.linkedin.com/in/montrellbennett)
