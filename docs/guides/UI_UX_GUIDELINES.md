# UI and UX Guidelines

Tengra aims for a premium, high-performance aesthetic that feels both professional and state-of-the-art. This document outlines the design principles and component standards used throughout the application.

## Core Philosophy

1. **Rich Aesthetics**: Interfaces should be visually striking at first glance. We prioritize vibrant but harmonious colors, dark modes, and subtle glassmorphism.
2. **Dynamic Feedback**: Use micro-animations and hover effects to make the interface feel alive. Every interaction should have a clear, smooth visual response.
3. **Typography over Graphics**: We rely on high-quality typography (Inter, Outfit, or Roboto) to establish hierarchy and readability.
4. **Consistency**: Avoid ad-hoc styling. Use the established design system tokens for colors, spacing, and shadows.

## Design System

### Color Palette
We use a curated HSL-based color system. Avoid hardcoded hex values; instead, use the CSS variables defined in `index.css`.

- **Primary**: Deep purples and blues for actions and focus.
- **Surface**: Dark variations for backgrounds with subtle gradients.
- **Accents**: High-contrast colors for highlights, used sparingly.

### Component standards

#### AnimatedCard
Used for dashboard items and feature highlights.
- **Hover**: Should trigger a 3D rotation or scale effect.
- **Ref Handling**: Always use the callback ref pattern for polymorphic components.

#### TerminalView
Used for log output and command lines.
- **Monospace font**: Use `Fira Code` or `JetBrains Mono` with ligatures enabled.
- **Status indicators**: Use solid colors for success/error/warning states without icons where possible.

## Animations

We utilize Framer Motion for most UI transitions.
- **Enter/Exit**: Use gentle fades and slight y-axis offsets.
- **Duration**: Keep transitions between 200ms and 400ms.
- **Easing**: Prefer `easeInOut` for most transitions to provide a natural feel.

## Layouts

- **Responsive Grid**: Use CSS Grid for main layout structures.
- **Spacing**: Follow an 8px base unit (8, 16, 24, 32, etc.) for margins and padding.
- **Safe Zones**: Ensure interactive elements have at least 44px of hit area on high-density displays.

## Visual Polish

- **Gradients**: Use multi-step gradients for a more premium look.
- **Shadows**: Prefer soft, multi-layered shadows over harsh borders.

