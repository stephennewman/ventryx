# AI Development Instructions

## Project Overview

### Application Structure
- **Name:** Ventryx
- **Type:** React/TypeScript web application
- **Build System:** Vite
- **Styling:** TailwindCSS
- **Deployment:** Netlify (frontend), Firebase (functions)

### Key Technologies
- **Frontend Framework:** React 18 with TypeScript
- **Backend:** Firebase and Node.js server
- **Authentication:** Firebase Auth
- **Database:** Firebase (Firestore likely)
- **APIs Integration:** 
  - Plaid (financial data)
  - OpenAI (AI functionality)
  - Resend (email services)
- **State Management:** React hooks
- **Testing:** Jest with React Testing Library

### Main Features
- Transaction management (TransactionFeed.tsx, TransactionDrawer.tsx)
- Meal planning system (MealsTab.tsx, functions/meals)
- Chat functionality (ChatDrawer.tsx)
- User onboarding (PostSSOWelcome.tsx)
- Legal documents (TermsOfService.tsx, PrivacyPolicy.tsx)

### Project Architecture
- `/src` - Frontend React application
  - `/components` - UI components
  - `/utils` - Helper functions and API configuration
  - `/config` - Application configuration
- `/functions` - Serverless Firebase functions
  - `/meals` - Meal planning functionality
  - `/server` - Server-side code
    - **`server.js`** - Main backend file containing core server functionality
- `/server` - Node.js server (additional backend services)
- `/public` - Static assets

### Development Workflow
- Run `npm run dev` to start both frontend and backend servers concurrently
- Frontend runs on port 5173
- Tests can be run with `npm test`
- Deployment combines both Firebase functions and Netlify frontend

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

4. **Codebase Analysis**
   - Conduct a comprehensive analysis of the codebase before starting new functionality
   - Review existing components and patterns to ensure consistency
   - Identify reusable code to prevent duplication
   - Understand data flow and state management approaches in place
   - Evaluate integration points with existing systems
   - Document dependencies and affected components before implementation

This document should be updated as project preferences evolve. 