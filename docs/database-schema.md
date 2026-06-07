# Eagles 4x4 — Database Schema Plan

> **Status:** Draft for review. No SQL written yet.
> **Database:** Supabase PostgreSQL (free tier, Singapore region)
> **Project ref:** `pkkgzsknvkpoowvukrqs`

---

## At a glance

15 tables, organised into 6 domains:

| Domain | Tables |
|---|---|
| **Users & Vehicles** | `profiles`, `vehicles` |
| **Content (admin-editable)** | `services`, `products`, `builds`, `site_content` |
| **Bookings & Live Tracking** | `bookings`, `booking_items`, `booking_status_history` |
| **Quotes** | `quotes`, `quote_items` |
| **Events & Community** | `events`, `event_rsvps` |
| **System** | `availability`, `media` |

Plus 1 storage bucket: `eagles-media` (for all uploaded images).

---

## 1. Users & Vehicles

### `profiles`
Extends Supabase `auth.users`. Every signed-up user gets a row here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Same as `auth.users.id` |
| `full_name` | TEXT | |
| `phone` | TEXT | PH mobile (09XX XXX XXXX) |
| `email` | TEXT | Mirror from auth |
| `role` | TEXT | `customer` / `staff` / `admin` / `super_admin` |
| `avatar_url` | TEXT | Storage path, nullable |
| `facebook_url` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Trigger:** Auto-create row on `auth.users` insert.

### `vehicles`
Trucks owned by customers.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `owner_id` | UUID FK → profiles | Cascade delete |
| `make` | TEXT | e.g. Toyota |
| `model` | TEXT | e.g. Hilux |
| `year` | SMALLINT | |
| `transmission` | TEXT | `automatic` / `manual` |
| `plate_number` | TEXT | Optional |
| `existing_mods` | TEXT | Free-text notes |
| `created_at` | TIMESTAMPTZ | |

---

## 2. Content (admin-editable)

### `services`
Service catalog shown on `/services` page.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE | e.g. `lift-kits-leveling` |
| `name` | TEXT | |
| `description` | TEXT | |
| `category` | TEXT | `suspension` / `protection` / `recovery` / `lighting` / `full-builds` / `accessories` |
| `icon` | TEXT | Emoji or icon name |
| `starting_price` | NUMERIC(10,2) | PHP |
| `duration_hours` | NUMERIC(4,1) | Est. install time |
| `image_url` | TEXT | Optional cover image |
| `is_active` | BOOLEAN | Default true |
| `display_order` | INTEGER | For drag-to-reorder |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `products`
Shop inventory shown on `/services` page (Products tab).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE | |
| `name` | TEXT | |
| `brand` | TEXT | e.g. ARB, KYB |
| `description` | TEXT | |
| `category` | TEXT | `suspension` / `wheels-tires` / `recovery` / `lighting` / `protection` |
| `price` | NUMERIC(10,2) | |
| `stock` | INTEGER | Default 0 |
| `image_url` | TEXT | |
| `is_active` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `builds`
Portfolio entries shown on `/builds` page.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE | |
| `title` | TEXT | e.g. "4" Lift + ARB Bull Bar Setup" |
| `vehicle_make` | TEXT | |
| `vehicle_model` | TEXT | |
| `vehicle_year` | SMALLINT | |
| `location` | TEXT | e.g. "Cavite" |
| `description` | TEXT | Long-form story |
| `build_date` | DATE | |
| `duration_days` | INTEGER | |
| `is_featured` | BOOLEAN | One featured at top |
| `cover_image_url` | TEXT | |
| `gallery_image_urls` | TEXT[] | Array of images |
| `tags` | TEXT[] | `['Lift Kit', 'Winch', ...]` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `site_content`
Editable copy/data scattered through the site (hero text, About paragraphs, stats, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `key` | TEXT UNIQUE | e.g. `about.headline`, `hero.cta`, `stats.builds_completed` |
| `value` | JSONB | Flexible structure |
| `updated_by` | UUID FK → profiles | |
| `updated_at` | TIMESTAMPTZ | |

---

## 3. Bookings & Live Tracking

### `bookings`
Service appointments.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `booking_code` | TEXT UNIQUE | e.g. `EG-2026-0148` (auto-gen) |
| `customer_id` | UUID FK → profiles | |
| `vehicle_id` | UUID FK → vehicles | |
| `scheduled_date` | DATE | |
| `scheduled_time` | TIME | |
| `backup_date` | DATE | Nullable |
| `assigned_tech_id` | UUID FK → profiles | Nullable |
| `service_bay` | TEXT | e.g. "Bay #3" |
| `status` | TEXT | See enum below |
| `subtotal` | NUMERIC(10,2) | |
| `labor_cost` | NUMERIC(10,2) | |
| `total_amount` | NUMERIC(10,2) | |
| `notes` | TEXT | Customer notes |
| `contact_phone` | TEXT | |
| `contact_facebook` | TEXT | Nullable |
| `contact_email` | TEXT | Nullable |
| `estimated_ready_at` | TIMESTAMPTZ | Nullable |
| `completed_at` | TIMESTAMPTZ | Nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Status enum:** `pending` → `confirmed` → `in_progress` → `parts_installed` → `quality_check` → `ready` → `completed` (or `cancelled`)

### `booking_items`
Line items: services + products + add-ons in a booking.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `booking_id` | UUID FK → bookings | Cascade |
| `item_type` | TEXT | `service` / `product` / `addon` |
| `service_id` | UUID FK → services | Nullable |
| `product_id` | UUID FK → products | Nullable |
| `name_snapshot` | TEXT | Frozen at booking time |
| `price_snapshot` | NUMERIC(10,2) | Frozen at booking time |
| `quantity` | INTEGER | Default 1 |
| `created_at` | TIMESTAMPTZ | |

### `booking_status_history`
Timeline for the live tracking page.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `booking_id` | UUID FK → bookings | Cascade |
| `status` | TEXT | Same enum as bookings |
| `updated_by` | UUID FK → profiles | The tech |
| `title` | TEXT | e.g. "Front suspension mounted" |
| `notes` | TEXT | |
| `photo_urls` | TEXT[] | Progress photos |
| `created_at` | TIMESTAMPTZ | |

---

## 4. Quotes

### `quotes`
Saved quotes from the calculator. Can be anonymous (no account needed).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `quote_code` | TEXT UNIQUE | e.g. `QT-2026-0023` |
| `customer_id` | UUID FK → profiles | Nullable for anonymous |
| `customer_name` | TEXT | For anonymous |
| `customer_phone` | TEXT | |
| `customer_email` | TEXT | |
| `subtotal` | NUMERIC(10,2) | |
| `labor_estimate` | NUMERIC(10,2) | |
| `total` | NUMERIC(10,2) | |
| `status` | TEXT | `draft` / `sent` / `converted` / `expired` |
| `converted_booking_id` | UUID FK → bookings | Set when converted |
| `expires_at` | TIMESTAMPTZ | Default +30 days |
| `created_at` | TIMESTAMPTZ | |

### `quote_items`
Same shape as `booking_items` but linked to quotes.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `quote_id` | UUID FK → quotes | Cascade |
| `item_type` | TEXT | `service` / `product` |
| `service_id` | UUID FK → services | Nullable |
| `product_id` | UUID FK → products | Nullable |
| `name_snapshot` | TEXT | |
| `price_snapshot` | NUMERIC(10,2) | |
| `quantity` | INTEGER | Default 1 |

---

## 5. Events & Community

### `events`
Trail runs, meets, workshops, brand events.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE | |
| `title` | TEXT | |
| `description` | TEXT | |
| `event_type` | TEXT | `trail_run` / `meet` / `workshop` / `brand_event` |
| `starts_at` | TIMESTAMPTZ | |
| `ends_at` | TIMESTAMPTZ | |
| `location` | TEXT | |
| `difficulty` | TEXT | `beginner` / `intermediate` / `advanced` / `n/a` |
| `max_attendees` | INTEGER | Cap |
| `cover_image_url` | TEXT | |
| `gallery_image_urls` | TEXT[] | Photos after event |
| `is_featured` | BOOLEAN | One featured at top |
| `is_published` | BOOLEAN | Default false (draft state) |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `event_rsvps`
Customer registrations.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `event_id` | UUID FK → events | Cascade |
| `customer_id` | UUID FK → profiles | Cascade |
| `vehicle_id` | UUID FK → vehicles | Optional |
| `status` | TEXT | `going` / `maybe` / `cancelled` |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Constraint:** UNIQUE (event_id, customer_id) — one RSVP per event per customer.

---

## 6. System

### `availability`
Admin's calendar overrides — block dates, custom hours, capacity caps.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `date` | DATE UNIQUE | |
| `is_closed` | BOOLEAN | True = no bookings allowed |
| `opens_at` | TIME | Override default hours |
| `closes_at` | TIME | Override default hours |
| `max_bookings` | INTEGER | Cap for this date |
| `notes` | TEXT | e.g. "Holiday", "Limited" |

Default shop hours (Mon–Sat 8–6) live in `site_content` as a config key.

### `media`
Central image library for the admin to manage uploads in one place.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `storage_path` | TEXT | Supabase Storage path |
| `public_url` | TEXT | Cached public URL |
| `file_name` | TEXT | Original |
| `mime_type` | TEXT | |
| `size_bytes` | INTEGER | |
| `width` / `height` | INTEGER | For images |
| `alt_text` | TEXT | Accessibility |
| `uploaded_by` | UUID FK → profiles | |
| `tags` | TEXT[] | e.g. `['build', 'hilux']` |
| `created_at` | TIMESTAMPTZ | |

---

## Row Level Security (RLS) Plan

| Table | Public read | Owner read | Admin write |
|---|:-:|:-:|:-:|
| `profiles` | ❌ | ✅ own | ✅ |
| `vehicles` | ❌ | ✅ own | ✅ |
| `services` | ✅ active only | — | ✅ |
| `products` | ✅ active only | — | ✅ |
| `builds` | ✅ all | — | ✅ |
| `bookings` | ❌ | ✅ own | ✅ |
| `booking_items` | ❌ | ✅ via booking | ✅ |
| `booking_status_history` | ❌ | ✅ via booking | ✅ |
| `quotes` | ❌ | ✅ own | ✅ |
| `quote_items` | ❌ | ✅ via quote | ✅ |
| `events` | ✅ published | — | ✅ |
| `event_rsvps` | ❌ | ✅ own | ✅ |
| `availability` | ✅ all | — | ✅ |
| `site_content` | ✅ all | — | ✅ |
| `media` | ✅ (signed URLs) | — | ✅ uploader/admin |

---

## Indexes (for query performance)

- `bookings(customer_id)`, `bookings(scheduled_date)`, `bookings(status)`
- `vehicles(owner_id)`
- `booking_status_history(booking_id, created_at DESC)`
- `event_rsvps(event_id)`, `event_rsvps(customer_id)`
- `services(category, is_active)`
- `products(category, is_active)`
- `builds(is_featured, build_date DESC)`
- `events(starts_at, is_published)`
- `quotes(customer_id)`, `quotes(status)`

---

## Triggers / Functions

1. **`handle_new_user()`** — when `auth.users` insert happens, auto-create matching `profiles` row with role = `customer`.
2. **`set_updated_at()`** — applied to every table with `updated_at` column.
3. **`generate_booking_code()`** — auto-fill `bookings.booking_code` as `EG-{YYYY}-{NNNN}` on insert.
4. **`generate_quote_code()`** — auto-fill `quotes.quote_code` as `QT-{YYYY}-{NNNN}` on insert.
5. **`log_booking_status_change()`** — when `bookings.status` changes, auto-insert a row into `booking_status_history`.

---

## Storage Buckets

- **`eagles-media`** — single public bucket for all uploaded images (builds, products, services, events, status update photos).
  - Folder structure: `builds/`, `products/`, `services/`, `events/`, `status/`, `avatars/`
  - Public read; authenticated write; admin can delete.

---

## What's NOT in this schema (per locked decisions)

- ❌ Payment tables (no online payments)
- ❌ SMS log tables (no Semaphore in initial build)
- ❌ AI conversation tables (no OpenAI follow-ups in initial build)
- ❌ Facebook Messenger webhook tables

These can be added in later migrations after launch when those features come online.

---

## Review checklist for Jay

Before I write any SQL, confirm:

- [ ] All 15 tables make sense
- [ ] Booking status pipeline matches what you want (`pending → confirmed → in_progress → parts_installed → quality_check → ready → completed`)
- [ ] Role list is correct (`customer`, `staff`, `admin`, `super_admin`) — or do we just need `customer` and `admin`?
- [ ] Anonymous quotes are allowed (customer can use calculator without signing up) — OK?
- [ ] Single shared `eagles-media` storage bucket — OK?
- [ ] No tables missing that you expect?
