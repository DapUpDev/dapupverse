# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a high-school student on AP, IB or A Levels who is applying to university, working at a laptop with application essays open in other tabs.

Also real, not primary: university students who got in and now mentor here; one admin (the owner).

## Product Purpose

DapUp connects applicants with student mentors who sat the same exams, wrote the same applications and got into the places they are aiming for. Success for a student is: find a relevant mentor, send a short request, get accepted, start messaging.

## Positioning

Mentors are students who did exactly this recently, each one selected and approved by the owner. Not professional consultants, not an open marketplace. "For students. By students."

## Operating Context

- Browse the mentor directory with search and filters (education system, subject, country or region, university, service type), open a mentor profile, send a connection request.
- A request needs a sign-in, a complete student profile, a purpose (essay review, application advice, subject help) and a 5 to 500 character message.
- The mentor accepts or archives. There is no rejected state anywhere: an archived request still reads as pending to the student.
- Messaging unlocks only after acceptance. An unread badge sits next to Messages. Email goes out for "request sent" and "request accepted" only.
- A mentor's price is private: visible to that mentor, to connected students and to the admin.

## Capabilities and Constraints

- Next.js App Router, React, Tailwind, Base UI components, Clerk for sign-in. The frontend reaches the API only through the repository adapters.
- This redesign changes frontend UI and UX only. No backend, API or infrastructure change.
- Terms and privacy copy is owner-supplied legal text and is not rewritten.
- Vocabulary: mentor, student, connection request, connected, pending.

## Brand Commitments

- The name DapUp.
- The headline "Learn from students who've already made it." stays.
- Nothing else visual is binding: the wordmark treatment, the dark theme, the palette and the typefaces may all be replaced. There is no permanent logo yet.
- Owner-pinned direction: Apple-style restraint with fluid, physical motion; calm, premium, soft and minimalist. It must not read as corporate or enterprise software, and it must not be flashy.

## Evidence on Hand

- Live mentor profiles with real photos, universities and subjects, read from the API (two at the time of writing).
- Real numbers derived from the live directory, such as mentor and university counts.
- No testimonials, press, pricing claims or outcome statistics exist. None may be invented.

## Product Principles

1. The mentor is the proof: a real student who got in outweighs any claim the page makes about itself.
2. Honest state: pending stays pending, and no urgency or proof is manufactured.
3. A desk companion: quick to scan beside open essays, never demanding attention.
4. First contact stays light: one short, specific request, not a long form.

## Accessibility & Inclusion

Kept from the current build: errors announced with role="alert" and wired to their fields, status shown by label and icon rather than colour alone, and reduced-motion preferences respected.
