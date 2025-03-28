# AI Development Instructions

This document outlines design and development preferences for the Ventryx project. AI assistants and developers should follow these guidelines to maintain consistency.

## UI/UX Design Preferences

### Visual Design

1. **Clean, Minimalist UI**
   - Remove unnecessary text labels when function is obvious
   - Maintain visual balance and proper spacing between elements
   - Use consistent styling across similar components
   - Prefer subtle gradients for visual interest

2. **Color Scheme**
   - Primary palette: Purple, pink, and blue gradients
   - Secondary elements: purple-50/purple-300 for backgrounds/borders
   - Text: purple-600/purple-800 for consistency
   - Transactions: red for outgoing, green for incoming
   - Use opacity and subtle backgrounds to indicate state

3. **Layout**
   - Group related functionality together (e.g., date filters next to calendar)
   - Prefer flexible layouts that scale well (flex-grow vs fixed widths)
   - Use equal spacing between major components (gap-6 for main sections)
   - Right-align secondary controls like calendar pickers
   - Use justify-between for space distribution

4. **Input Controls**
   - Make controls consistent height (h-10)
   - Rounded corners on all inputs
   - Search boxes should be more prominent (max-w-md, flex-grow)
   - Filter controls should be grouped logically
   - Date-related controls should be adjacent

### Component-Specific Guidelines

1. **User Avatar**
   - Always provide fallback for missing images (user initials)
   - Use purple-to-blue gradient for fallback backgrounds
   - Keep consistent sizing between avatar states

2. **Transaction Feed**
   - Clear visual distinction between transaction types
   - Interactive elements for filtering (categories, vendors)
   - Visual indicators for transaction amounts (colored backgrounds)
   - Subtle shadows and hover effects for interactivity cues

3. **Filter Controls**
   - Search functionality should be prominent
   - Date-related filters grouped together
   - Clear filter option when filters are active
   - Consistent styling across all filter elements

## Code Style Preferences

1. **Component Organization**
   - Keep related state variables grouped together
   - Prefer clean, modular component structure
   - Maintain consistent naming conventions
   - Use TypeScript interfaces for prop definitions

2. **React Patterns**
   - Use functional components with hooks
   - Group related state with useState
   - Keep side effects in useEffect with proper dependencies
   - Extract reusable logic to custom hooks when appropriate

3. **Styling Approach**
   - Use Tailwind CSS for styling
   - Maintain consistent class ordering
   - Group related styles together (layout, then appearance)
   - Use className interpolation for conditional styles

## Git Workflow

1. **Commit Style**
   - Descriptive commit messages starting with the type of change
   - Example format: "UI improvement: [specific change description]"
   - Group related changes in single commits

2. **Change Process**
   - Prefer incremental UI improvements
   - Focus on one aspect at a time (layout, then styling, then behavior)
   - Test changes visually before committing
   - Push to development branch for review

## General Development Principles

1. **Progressive Enhancement**
   - Focus on core functionality first
   - Add visual refinements after basic functionality works
   - Consider responsive design for all screen sizes

2. **Performance Considerations**
   - Minimize unnecessary renders
   - Use appropriate memoization (useMemo, useCallback)
   - Be mindful of large data processing operations

3. **Accessibility**
   - Maintain proper contrast ratios
   - Ensure keyboard navigation support
   - Use semantic HTML elements appropriately

This document should be updated as project preferences evolve. 