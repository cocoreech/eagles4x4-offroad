# Admin Customers List + Export (Design)

**Date:** 2026-07-02
**Status:** approved (brainstorm) — pending spec review
**Related:** `src/app/admin/page.tsx` (the `comingSoon` "Customers" tile), `public.profiles`, `public.bookings`

## 1. Summary

Give admins a roster of everyone who signed up: a `/admin/customers` page listing all `role = 'customer'` profiles with a booking count, plus two exports — **CSV** (opens in Excel/Sheets) and **print-to-PDF** (browser "Save as PDF"). Zero new dependencies. Turns the existing greyed-out "Customers" hub tile into a real page.

## 2. Scope

**In scope:**
- `/admin/customers` — admin-only list of customers (Preferred name, Full name, Email, Phone, Joined, Bookings).
- CSV download (Excel-compatible) built from a pure, tested serializer.
- "Save as PDF" via a print-optimized view (`window.print()` + `print:` styles).
- Wire the "Customers" hub tile.

**Out of scope (YAGNI):**
- Search / pagination / column sorting (small list; Ctrl-F + export suffice).
- Per-customer detail drill-down page.
- True `.xlsx` and one-click server-generated PDF (would need SheetJS / jsPDF — user opted for the zero-dependency route).
- Editing / deleting customers.

## 3. Data

Load, via the admin's RLS-scoped client (`requireAdmin`; admins may `select` all profiles/bookings):
- `profiles` where `role = 'customer'`, columns `id, preferred_name, full_name, email, phone, created_at`, ordered by `created_at desc`.
- `bookings` `customer_id` (all non-null) → tally counts per `customer_id` in JS → attach `bookings` count to each row. One extra query; fine at shop scale.

Row shape: `{ preferredName, fullName, email, phone, joined, bookings }` (strings; `joined` = `created_at` date; `bookings` = number).

## 4. CSV serializer

`src/lib/admin/customersCsv.ts` — pure:
```
interface CustomerCsvRow { preferredName: string; fullName: string; email: string; phone: string; joined: string; bookings: number }
toCustomersCsv(rows: CustomerCsvRow[]): string
```
Header: `Preferred Name,Full Name,Email,Phone,Joined,Bookings`. Each field RFC-4180 escaped (wrap in quotes and double internal quotes when it contains `,`, `"`, or a newline). Rows joined with `\r\n`. Unit-tested (header, values, escaping, empty list → header only).

## 5. Components

- `src/app/admin/customers/page.tsx` (RSC): loads the data, maps to rows, renders the table + `<CustomerExportBar rows={rows} />`. The table and export buttons use `print:` utilities so printing shows only the table.
- `src/app/admin/customers/CustomerExportBar.tsx` (`"use client"`):
  - **Export CSV (Excel)** — `toCustomersCsv(rows)` → `Blob` → temporary `<a download="customers-YYYY-MM-DD.csv">` click.
  - **Save as PDF** — `window.print()`.
  - Both hidden when printing (`print:hidden`).
- `src/app/admin/page.tsx`: change the "Customers" tile from `comingSoon` to `href="/admin/customers"` + `ready`.

## 6. Security

`requireAdmin` gate; read-only; RLS admin-select on `profiles`/`bookings`. No writes, no new env vars, no new dependencies.

## 7. Testing

- **Unit (TDD):** `toCustomersCsv` — header present; a row's values in order; a name containing a comma/quote is quoted+escaped; empty input yields just the header.
- **Runtime:** `/admin/customers` lists customers with correct booking counts; CSV downloads and opens in Excel with intact columns; "Save as PDF" prints a clean table without the nav/buttons.

## 8. Build order

1. `toCustomersCsv` + test (pure).
2. `CustomerExportBar` client component.
3. `/admin/customers` page + tile wiring + print styles.
4. Verify.
