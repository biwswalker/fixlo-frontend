---
trigger: always_on
---

# Fixlo UI & Frontend Guidelines

## Frameworks
* Next.js (App Router), Tailwind CSS, shadcn/ui, Lucide React, Recharts.

## Multi-Project UI Rules
* **Project Switcher:** The Global Header must include a Project Switcher dropdown.
* **URL-Driven State:** Read the current project context from the URL (e.g., `/dashboard/[projectId]`). 
* **Data Badges:** When displaying tables or lists in an "All Projects" view, always include a visual Badge indicating the `project_id` or Project Name (e.g., Source: Juno168).

## Coding Conventions
* Use modern, minimalist design suitable for Fintech. Always use `shadcn/ui` components when applicable.
* Verify import paths for UI components (e.g., `@/components/ui/...`).
* State Management: Default to Server Components. Only use `'use client'` when hooks or interactivity are strictly required.