---
trigger: always_on
---

# Fixlo UI & Frontend Guidelines

## Frameworks

- Next.js (App Router), Tailwind CSS, shadcn/ui, Lucide React, Recharts.

## Coding Conventions

- Use modern, minimalist design suitable for Fintech. Always use `shadcn/ui` components when applicable.
- Verify import paths for UI components (e.g., `@/components/ui/...`).
- State Management: Default to Server Components. Only use `'use client'` when hooks or interactivity are strictly required.
