// ============================================================
// Marketing copy — editable static text for all pages
// ============================================================
// Organized by page/section for easy discovery and swapping.

export const copy = {
  // ──────────────────────────────────────────────────────────
  // Homepage
  // ──────────────────────────────────────────────────────────

  home: {
    // Hero section
    hero: {
      headline_line1: 'Lift kits, suspension, full builds.',
      headline_line2_italic: 'Every bolt.',
      headline_line3_italic: 'Every trail.',
      subheading:
        'Lift kits, suspension overhauls, full builds — done in-house\nby 4×4 owners, for 4×4 owners.',
      cta_primary: 'Book a Service',
      cta_secondary: 'View Builds',
    },

    // Stats bar
    stats: [
      { num: '500+', label: 'Builds Completed' },
      { num: '8+', label: 'Years Experience' },
      { num: '4.9★', label: 'Customer Rating' },
      { num: 'Mon–Sat', label: '8 AM – 6 PM' },
    ],

    // Builds carousel section
    builds: {
      label: 'Featured Work',
      headline_line1: 'Built by hand.',
      headline_line2_italic: 'Proven on dirt.',
    },

    // Testimonials section
    testimonials: {
      label: 'From Our Customers',
      headline_line1: 'Trusted by the',
      headline_line2_italic: 'community.',
    },

    // Booking CTA section
    booking_cta: {
      label: 'Ready for Your Build',
      headline_line1: 'Your truck.',
      headline_line2_italic: 'Our hands.',
      subheading: 'Book a service, get a quote, or just talk through your vision.',
      cta: 'Start a Booking',
    },

    // About section
    about: {
      headline_line1: 'Born from the',
      headline_line2_italic: 'brotherhood.',
      proud_member: 'Proud Member',
    },

    // Footer
    footer: {
      tagline: 'Building serious rigs for serious off-roaders.',
      footer_services: ['Lift Kits', 'Suspension', 'Bull Bars', 'Full Builds', 'Accessories'],
      footer_company: ['About', 'Builds', 'Events', 'Contact'],
    },
  },

  // ──────────────────────────────────────────────────────────
  // Services page
  // ──────────────────────────────────────────────────────────

  services: {
    headline: 'What We Offer',
    subheading: 'Premium modifications, backed by 8+ years of 4×4 expertise.',
    why_label: 'Why Eagles 4×4',
    why_headline_line1: '3 Pillars',
    why_headline_line2_italic: 'of excellence.',
    pillars: [
      {
        num: '01',
        title: 'In-House',
        desc: 'We don\'t outsource. Every job — fabrication, installation, tuning — happens in our shop.',
      },
      {
        num: '02',
        title: 'Expert',
        desc: 'Built by 4×4 owners, for 4×4 owners. We understand what serious off-roaders need.',
      },
      {
        num: '03',
        title: 'Honest',
        desc: 'Transparent pricing, no surprises. We tell you what your truck needs, not what we want to sell.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // Booking flow
  // ──────────────────────────────────────────────────────────

  booking: {
    new_booking_headline: 'Start Your Build',
    vehicle_section: 'About Your Vehicle',
    services_section: 'What Would You Like Done?',
    review_section: 'Review & Submit',
    success_message: 'Booking submitted. We\'ll reach out within 24 hours.',
  },

  // ──────────────────────────────────────────────────────────
  // Global / Navigation
  // ──────────────────────────────────────────────────────────

  nav: {
    home: 'Home',
    services: 'Services',
    builds: 'Builds',
    events: 'Events',
    contact: 'Contact',
    book: 'Book Now',
    admin: 'Admin →',
  },

  // ──────────────────────────────────────────────────────────
  // Auth pages
  // ──────────────────────────────────────────────────────────

  auth: {
    login_headline_line1: 'Join',
    login_headline_line2_italic: '4×4.',
    login_subheading: 'One-time setup with your email — no passwords. After this, you\'re in for good.',
    login_hint: 'before? Same email keeps your bookings & history.',
  },
} as const
