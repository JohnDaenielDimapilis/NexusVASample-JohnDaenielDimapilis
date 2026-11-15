# Revision 1.3.4.4 — Neumorphism test design

Created November 14, 2026 as an independent copy of compact revision 1.3.4.3. Local preview: http://127.0.0.1:5184/. No deployment or upload was performed.

## Appearance

- Light material: lilac gray, white highlights and soft purple-gray shadows. Dark material: plum gray with subdued highlights. Original Nexus logo shapes are retained.
- Raised cards and action controls; recessed fields, searches, selected navigation and tab groups. Shared styling covers sign-in, Admin/VA/Client dashboards, work boards, requests, directories, templates, attendance, billing, messages, files, calendar, profiles, tools and privacy surfaces.
- Clear keyboard focus outlines, visible control edges, text status labels and semantic success/warning/danger colors. Reduced-motion preferences are respected. This is not a formal accessibility certification.
- Compact owner spacing, date dialog, comparison toggle, detail views and CSV features remain available. Header sizing was adjusted for the assistant timer control. Sidebar labels wrap instead of overflowing.

## Implementation and scope

Shared skin: `public/neumorphism-v1344.css`, loaded by both HTML entry points. Version labels, local launcher and port identify this copy as 1.3.4.4. Business rules and permissions are inherited unchanged from 1.3.4.3.

Run `npm ci` after extracting the source archive; launch with `Open Nexus VA.cmd`. `npm run check` runs existing tests, type checking and a development build. Production configuration remains subject to the inherited environment requirements.

Use sample data only. Local timers record NexusVA interaction intervals and flag uncertain/outside work for review; they cannot prove productivity or inspect other desktop applications. Secure case review requires the connected backend described in earlier documentation.
