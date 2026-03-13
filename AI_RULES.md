# AI Development Rules

This document outlines the technology stack and coding conventions for this project to ensure consistency and maintainability.

## Technology Stack

The application is built using a simple and efficient stack, focusing on web standards:

*   **HTML5**: The core structure of the application is built with semantic HTML5.
*   **Tailwind CSS**: For all styling and layout. It's included via a CDN, allowing for rapid prototyping and a consistent design system.
*   **Vanilla JavaScript**: Used for all client-side interactivity and logic. We avoid heavy frameworks to keep the application lightweight and fast.
*   **Google Fonts**: Provides a wide range of fonts to maintain the desired typography.
*   **Lucide Icons**: For clean and consistent icons throughout the application.

## Library and Tooling Rules

To maintain a clean and simple codebase, please adhere to the following rules:

*   **Styling**:
    *   **ALWAYS** use [Tailwind CSS](https://tailwindcss.com/) utility classes for styling.
    *   **AVOID** writing custom CSS in `<style>` tags or separate `.css` files. Only use it for very specific cases that Tailwind cannot handle, like complex animations.

*   **JavaScript**:
    *   **ALWAYS** write modern, clean, and readable vanilla JavaScript (ES6+).
    *   For simple DOM manipulation and event handling, vanilla JS is preferred.
    *   If more complex state management or interactivity is needed on a page, we can introduce a lightweight library like [Alpine.js](https://alpinejs.dev/), as it integrates seamlessly with Tailwind CSS.

*   **Icons**:
    *   **ALWAYS** use icons from the [Lucide](https://lucide.dev/) icon set.
    *   Integrate them as inline SVGs or using the Lucide library script for consistency.

*   **Dependencies**:
    *   **PREFER** adding third-party libraries via a CDN to avoid a complex build setup.
    *   Only introduce a build step (like Vite or Parcel) if absolutely necessary for project requirements.

*   **File Structure**:
    *   Keep the file structure flat and simple.
    *   Create separate HTML files for distinct pages (e.g., `index.html`, `about.html`, `contact.html`).
    *   JavaScript for specific pages can be included in `<script>` tags at the bottom of the body or in separate `.js` files if the logic becomes complex.