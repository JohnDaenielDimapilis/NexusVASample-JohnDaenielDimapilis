# Nexus Virtual Executives — brand refresh

## Goal

Rebrand the existing ticketing prototype for Nexus Virtual Executives, serving business clients, virtual executives, and operations administrators. A successful screen makes the current work, owner, payment state, and next action clear. Preserve every existing workflow and the original purple palette.

## Evidence and asset provenance

- Reference: https://www.instagram.com/nexusvirtualexecutives/
- The public profile identifies the company as **Nexus Virtual Executives** and describes training virtual executives, delivering high-quality outputs, and serving startups and established companies, since 2022.
- The official white Nexus wordmark on purple is the profile image, saved unmodified as `public/brand/nexus-wordmark.jpg`. The available public thumbnail is 100 × 100 px; render it at native size or smaller.
- The profile does not publish original brand font files or a verifiable font-family name. Preserve the lettering in the image. Use the prototype's existing Manrope and DM Sans families for interface text; do not claim these are the company's original fonts.
- Keep the original reference response in the ignored `.local/brand-reference/` folder. No social media metrics or portraits become product proof.

## Visual thesis

A composed executive operations desk: a single deep-purple navigation column, light work surfaces, substantial readable typography, and a restrained purple signal for the next action. Brand expression comes from the actual wordmark, clear language, and deliberate spacing.

## Format and layout

- Desktop: one 248 px sidebar, 76 px toolbar, a maximum 1440 px content area, 32–40 px content gutters.
- Dashboard: heading and action, a review queue with a clear CTA, a flat four-column metric strip, then work and people in a 2:1 layout. Upcoming appointments and recent updates are secondary.
- Mobile: compact toolbar, accessible navigation drawer, two-column metric strip, full-width primary actions where space requires, independently scrolling tables. No document-level horizontal overflow.
- Sign-in: brand and workflow context on the left; account selection or authentication on the right. No fabricated testimonials, avatar piles, orbit effects, or pseudo-product illustration.

## Type system

- Manrope: display and section headings, 600–750 weight; 32/40 px page heading, 20/28 px section heading.
- DM Sans: body and controls, 400–650 weight; 14/22 px body, 13/20 px secondary text, minimum 11 px metadata.
- Use normal sentence case. Remove ornamental uppercase eyebrows from general page titles. Uppercase is reserved for compact brand lettering or genuinely useful table/group labels.

## Palette and material

- Primary purple: `#7560D4`; deep purple: `#292649`; strong purple text: `#514299`.
- Canvas: `#F6F7FB`; surface: `#FFFFFF`; lavender: `#F0EDFC`.
- Text: `#29273B`; secondary: `#69657B`; muted: `#817B91`; borders: `#E7E5EF`.
- Success, pending, and error colors communicate state and are accompanied by labels.
- 6–10 px corner radii; dividers and surface contrast do grouping. Reserve shadows for floating menus and dialogs. No metric-card stripes, gradients behind body text, neon effects, or pulsing status dots.

## Copy and interaction

- Full identity: **Nexus Virtual Executives**. Product descriptor: **Client workspace** / **Executive workspace** / **Admin workspace**.
- Primary task labels remain explicit: New request, Schedule appointment, Review delivery, Request payment, Deliver output, Approve & leave feedback.
- Clearly identify demo accounts and simulated payments. Never imply a live backend connection in demo mode.
- Keep focus states, keyboard navigation, validation, modal focus containment, loading feedback, and reduced-motion behavior.
- Use one icon family already installed: Lucide, consistent stroke weight. Do not use a library icon as the company logo.

## Quality gate

Inspect login, dashboard, tickets, messages, appointments, billing, documents, profile, and admin logs at desktop and mobile sizes. Check text contrast, clipping, long content, dialog scrolling, and a complete request/payment/delivery/feedback journey. Keep the original `prototype-1` release unchanged.

## Original-version backup

- Original commit: `529c303`.
- Original release tag: `prototype-1`.
- Additional local preservation tag: `prototype-1-before-rebrand`.
- Local source archive: `backups/nexus-va-prototype-1-original.zip`.
- The archive contains source code and configuration templates, not browser-local uploads, secrets, or demo storage.
