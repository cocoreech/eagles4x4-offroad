-- ============================================================
-- Seed initial catalog — services + products
-- Migration 0005
-- ============================================================

-- ─────────────────────────────────────────────
-- SERVICES (6 items, matches design previews)
-- ─────────────────────────────────────────────
insert into public.services (slug, name, description, category, icon, starting_price, duration_hours, display_order)
values
  ('lift-kits-leveling',  'Lift Kits & Leveling',  'Body lifts, suspension lifts — top brands for every PH truck. Increase ground clearance and stance.',                'suspension', '🔧', 15000, 6,  10),
  ('suspension-overhaul', 'Suspension Overhaul',   'Complete suspension rebuild — shocks, springs, upper control arms. Maximum off-road performance.',                  'suspension', '⚙️', 25000, 8,  20),
  ('bull-bars-bumpers',   'Bull Bars & Bumpers',   'Custom-fabricated and brand-name bull bars. Winch-capable front bumpers built for real impact.',                   'protection', '🛡️', 18000, 5,  30),
  ('winch-recovery',      'Winch & Recovery Setup','Warn, Runva, Factor 55 — professionally mounted, wired, and load-tested before you hit the trail.',                'recovery',   '🪝', 12000, 4,  40),
  ('led-light-bar',       'LED Light Bar Install', 'Roof bars, bumper pods, rock lights — fully wired with switches, relays, and clean cable routing.',                'lighting',   '💡',  4500, 3,  50),
  ('full-build-package',  'Full Build Package',    'Your dream rig, fully realized. Sourcing, fabrication, install, final tuning — one team, one build.',              'full-builds','🚙', 80000, 80, 60)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- PRODUCTS (12 items, matches design previews)
-- ─────────────────────────────────────────────
insert into public.products (slug, name, brand, description, category, price, stock)
values
  ('arb-bp51-shocks',       'Old Man Emu BP-51',        'ARB',          'Premium 51mm bypass shocks. Adjustable compression. Trail-tested for Philippine terrain.', 'suspension',    48000, 4),
  ('kyb-skorched-shocks',   'Skorched 4''s Shocks',     'KYB',          'Heavy-duty monotube shocks for daily and weekend trail use. Set of 4.',                   'suspension',    18500, 10),
  ('dobinsons-ims-coils',   'IMS Coil Springs',         'Dobinsons',    'Independent multi-stage coils — comfortable on-road, controlled on trail. Pair.',         'suspension',    14000, 8),
  ('bfg-ko2-285',           'All-Terrain KO2 285/70R17','BFGoodrich',   'The benchmark all-terrain tire. Tough sidewalls, predictable on/off-road.',               'wheels-tires',   9500, 16),
  ('ox-beast-17x9',         'Beast Series 17×9',        'OX Wheels',    'Forged-style alloy wheels with gold trim. Negative offset for aggressive stance. Set of 4.','wheels-tires', 42000, 3),
  ('warn-vr-evo-10s',       'VR EVO 10-S Winch',        'Warn',         '10,000 lb synthetic rope winch. Waterproof, wireless remote included.',                   'recovery',      38500, 5),
  ('stedi-st3303-pro',      'ST3303 Pro 41.5"',         'Stedi',        'Curved LED light bar. 36,160 raw lumens, IP68 waterproof, 5-year warranty.',              'lighting',      13800, 6),
  ('ironman-bull-bar',      'Commercial Bull Bar',      'Ironman 4x4',  'ADR-approved, winch-compatible bull bar. Includes fog light cutouts.',                    'protection',    24000, 4),
  ('rhinorack-pioneer',     'Pioneer Roof Platform',    'Rhino-Rack',   'Modular roof platform. Loads up to 100kg, accessory rails included.',                     'protection',    32000, 3),
  ('maxxis-razr-mt-33',     'Razr MT 33×12.5R17',       'Maxxis',       'Aggressive mud-terrain. Triple-ply sidewalls. Each tire.',                                'wheels-tires',  11500, 12),
  ('safari-arb-snorkel',    'V-Spec Snorkel',           'Safari ARB',   'UV-stable polyethylene snorkel for deep water crossings and dusty trails.',               'protection',    16500, 6),
  ('factor55-prolink-xtv',  'ProLink XTV Shackle',      'Factor 55',    'Closed-system winch shackle mount. Anodized aluminum, made in USA.',                      'recovery',       5800, 8)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- SITE CONTENT (initial editable copy)
-- ─────────────────────────────────────────────
insert into public.site_content (key, value)
values
  ('hero.kicker',        '"Dasmariñas, Cavite · Cavite''s Premier 4×4 Workshop"'::jsonb),
  ('hero.title_line1',   '"Built Tough."'::jsonb),
  ('hero.title_line2',   '"Go Anywhere."'::jsonb),
  ('hero.cta_primary',   '"Book a Service"'::jsonb),
  ('hero.cta_secondary', '"View Builds"'::jsonb),
  ('stats.builds',       '500'::jsonb),
  ('stats.years',        '8'::jsonb),
  ('stats.rating',       '4.9'::jsonb),
  ('about.headline',     '"Born from the Brotherhood."'::jsonb),
  ('about.paragraph1',   '"Eagles 4x4 Offroad is more than a shop. We are part of The Fraternal Order of Eagles — a brotherhood built on honor, service, and a love for the open road. Every truck we build carries that spirit."'::jsonb),
  ('about.paragraph2',   '"Based in Dasmariñas, Cavite, we specialize in 4x4 builds, lift kits, full suspension overhauls, and custom fabrication — all done in-house by our own team. No outsourcing. Full accountability."'::jsonb),
  ('shop.address',       '"Dasmariñas, Cavite, Philippines"'::jsonb),
  ('shop.phone',         '"0917 XXX XXXX"'::jsonb),
  ('shop.facebook',      '"facebook.com/eagles4x4offroad"'::jsonb),
  ('shop.hours',         '{"mon":"8:00 AM – 6:00 PM","tue":"8:00 AM – 6:00 PM","wed":"8:00 AM – 6:00 PM","thu":"8:00 AM – 6:00 PM","fri":"8:00 AM – 6:00 PM","sat":"8:00 AM – 5:00 PM","sun":"Closed"}'::jsonb)
on conflict (key) do nothing;
