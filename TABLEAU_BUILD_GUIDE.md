# Tableau Public Build Guide

This guide rebuilds the Workplace Utilization Dashboard in Tableau Public from the CSV files in this repository. The finished workbook mirrors the web version: a site header, hyperlinked section names, a floor selector and a date range on every view.

The data-entry screen (Log Observation) exists only in the web version, because Tableau Public workbooks are read-only. In the original program, community managers entered floor-walk counts through a form and Tableau reported on the compiled data.

---

## 1. Set up

1. Download and install Tableau Public (free) from public.tableau.com and sign in.
2. Download the nine CSV files from this repository to one folder on your computer.

## 2. Connect the data

1. Open Tableau Public. Under **Connect**, choose **Text file** and open `attendance_daily.csv`.
2. Tableau renames fields automatically (for example `badge_swipes` becomes **Badge Swipes**). Confirm **Date** is a Date and **Floor** is a Number (whole).
3. Add each remaining CSV as its own data source (**Data > New Data Source > Text file**):
   `room_bookings_monthly.csv`, `focus_room_hourly.csv`, `space_observations_weekly.csv`, `clean_desk_weekly.csv`, `tech_tickets_monthly.csv`, `booking_channel_monthly.csv`, `floors.csv`.
4. For the monthly files, change **Month** to a Date: right-click the field > **Change Data Type > Date**. For weekly files, confirm **Week Start** is a Date.

Separate data sources keep each table at its own grain, which avoids double counting when daily, weekly and monthly data sit in one view.

## 3. Create the shared parameters

Parameters work across every data source, which is what lets one floor selector drive the whole workbook.

1. **Select Floor**: Data type String, Allowable values List: `All`, `1`, `2`, `3`, `4`, `5`, `6`, `7`. Current value `All`.
2. **Start Month**: Data type Date, Current value 1 November 2022.
3. **End Month**: Data type Date, Current value 30 September 2025.

Right-click each parameter > **Show Parameter**.

## 4. Create calculated fields

Create these in each data source where the named fields exist (**Analysis > Create Calculated Field**).

**Floor Filter** (every data source with Floor)
```
[Select Floor] = "All" OR STR([Floor]) = [Select Floor]
```

**In Date Range** (use the date field for that source: Date, Month or Week Start)
```
[Date] >= [Start Month] AND [Date] <= [End Month]
```

**Attendance Rate** (attendance_daily)
```
SUM([Badge Swipes]) / SUM([Assigned Headcount])
```
Worked example: Floor 4 on 13 March 2024 had 218 swipes and 300 assigned employees. 218 / 300 = 72.7%.

**Desk Occupancy** (attendance_daily)
```
SUM([Observed Headcount]) / SUM([Desks])
```
Worked example: 200 counted at 10:20 / 225 desks = 88.9%.

**Weekday Group** (attendance_daily)
```
IF [Weekday] = "Tue" OR [Weekday] = "Wed" OR [Weekday] = "Thu" THEN "Midweek peak" ELSE "Monday and Friday" END
```

**Room Utilization** (room_bookings_monthly)
```
SUM([Booked Hours]) / SUM([Available Hours])
```
Worked example: Floor 4 focus room, March 2024: 126.0 booked hours / 210 available hours = 60.0%.

**Unbooked Occupancy** (focus_room_hourly)
```
AVG([Occupied Pct]) - AVG([Booked Pct])
```
Worked example: Floor 4 at 12:00 in March 2024: 84.6% occupied - 38.7% booked = 46.0 points.

**Lunch Window** (focus_room_hourly)
```
IF [Hour] >= 11 AND [Hour] <= 13 THEN "Lunch, 11:00 to 13:59" ELSE "Other hours" END
```

**Locker Utilization** (space_observations_weekly)
```
SUM([Lockers In Use]) / SUM([Lockers Total])
```
Worked example: Floor 4, week of 11 March 2024: 154 / 250 = 61.6%.

**Soft Seating Utilization** (space_observations_weekly)
```
SUM([Soft Seating Peak]) / SUM([Soft Seats Total])
```

**Noncompliance Rate** (clean_desk_weekly)
```
SUM([Desks Tagged Noncompliant]) / SUM([Desks Total])
```
Worked example: Floor 4, week of 11 March 2024: 7 / 225 = 3.1%.

**Self-Service Share** (booking_channel_monthly)
```
SUM([Self Service Bookings]) / (SUM([Self Service Bookings]) + SUM([Mailbox Requests]))
```
Worked example: March 2024: 4,583 / (4,583 + 60) = 98.7%.

Format every rate as Percentage with one decimal place (right-click > **Default Properties > Number Format**).

## 5. Build the worksheets

On every worksheet, drag **Floor Filter** and **In Date Range** to **Filters** and keep only **True**. (Skip Floor Filter on booking_channel_monthly, which is site level.)

| Sheet | Columns | Rows | Marks |
|---|---|---|---|
| KPI Attendance Rate | | | Text: Attendance Rate |
| Attendance Trend | MONTH(Date), continuous | Attendance Rate | Line |
| Attendance by Weekday | Weekday (sort Mon to Fri) | Attendance Rate | Bar; Color: Weekday Group |
| Attendance by Floor | Floor (discrete) | Attendance Rate | Bar |
| Badge vs Visual Headcount | MONTH(Date) | SUM(Badge Swipes), SUM(Observed Headcount) dual axis, synchronized | Line |
| Latest Observations | Date, Floor, Observation Time, Community Manager | | Text table |
| Room Utilization Trend | MONTH(Month) | Room Utilization | Line; filter Room Type |
| Room Utilization by Floor | Floor | Room Utilization | Bar; filter Room Type |
| Focus Booked vs Occupied | Hour Label | AVG(Booked Pct), AVG(Occupied Pct) | Line; Measure Names on Color |
| Focus Dwell by Hour | Hour Label | AVG(Avg Dwell Minutes) | Bar; Color: Lunch Window |
| Locker Utilization Trend | WEEK(Week Start) | Locker Utilization | Line |
| Soft Seating Trend | WEEK(Week Start) | Soft Seating Utilization | Line |
| Pantry Trend | WEEK(Week Start) | SUM(Pantry Peak Count) | Line |
| Clean Desk Trend | WEEK(Week Start) | SUM(Desks Tagged Noncompliant), SUM(Bags Collected) dual axis | Bar and Line |
| Tickets by Category | MONTH(Month) | SUM(Tickets) | Stacked bar; Color: Category |
| Mailbox Requests | MONTH(Month) | SUM(Mailbox Requests) | Line |

For the six room sections, duplicate the two room sheets and set the Room Type filter to Conference, Huddle, Team, Phone, Focus and Wellness in turn.

Colors: keep Tableau's default **Tableau 10** palette. Use blue for primary measures, light blue for non-peak bars, and orange for highlights such as the lunch window.

## 6. Assemble the dashboards

Create one dashboard per section (**Dashboard > New Dashboard**), sized **Automatic** or 1280 x 900.

1. **Header**: add a Text object at the top: "Global Financial Services Firm" (small, grey) above "Baltimore Waterfront Campus | Workplace Utilization Dashboard" (bold, 20pt).
2. **Section navigation**: below the header, add a Horizontal container of **Navigation** objects (Dashboard > Objects > Navigation), one per section: Executive Summary, Attendance, Conference Rooms, Huddle Rooms, Team Rooms, Phone Rooms, Focus Rooms, Wellness Rooms, Lockers, Soft Seating, Pantries, Clean Desk, Technology Adoption. Set each to **Text** style so it reads as a hyperlink. Copy the finished container onto every dashboard.
3. **Filters**: show the Select Floor, Start Month and End Month parameter controls under the navigation bar on every dashboard.
4. **Content**: KPI sheets across the top, a wide trend sheet in the middle, two supporting sheets side by side below.
5. **Insight text**: add a Text object with the finding for that section, for example "From 11:00 to 13:59, focus rooms are occupied far more often than they are booked."

Example layout, Focus Rooms dashboard:

```
Header
Navigation links
Select Floor | Start Month | End Month
KPI: Utilization | KPI: Total Bookings | KPI: Avg Booking Length
Insight text
Room Utilization Trend (full width)
Focus Booked vs Occupied | Focus Dwell by Hour
```

## 7. Publish

1. **File > Save to Tableau Public As**, name the workbook "Workplace Utilization Dashboard".
2. On your Tableau Public profile, open the workbook, select **Edit Details**, and add a description noting that the data is synthetic.
3. Copy the workbook URL and add it to the repository README beside the live dashboard link.

## 8. Quality checks

- Select Floor 4 and confirm the Wellness Rooms dashboard shows no data (wellness rooms are on floors 2, 3, 5 and 6 only).
- With all floors selected and the full date range, Executive Summary attendance should be about 51.6% and midweek attendance about 64.4%, matching the web version.
- Confirm Tuesday, Wednesday and Thursday are the three tallest bars on Attendance by Weekday.
