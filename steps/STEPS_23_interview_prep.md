# Step 23: Interview Preparation Guide

## What We Did
Created a comprehensive interview preparation document for the SimplyAID project.

## Process

### 1. Full Codebase Analysis
- Read all 14 Mongoose models to understand data relationships
- Read all middleware (auth.js, errorHandler.js)
- Read server.js entry point and db.js configuration
- Read all utility services (expiryScheduler, notificationService, qrService, profileCompletion)
- Read the full incidentController.js (680 lines — largest controller)
- Read authController.js for the authentication flow
- Read App.jsx for routing and layout architecture
- Read AuthContext.jsx and ScannerContext.jsx for state management
- Read api.js for the centralized API service layer
- Read vite.config.js for proxy configuration
- Reviewed package.json files for all dependencies

### 2. Document Created
- **File**: Interview preparation artifact (44 questions across 13 sections)
- **Sections covered**:
  1. Architecture & Tech Stack (4 questions)
  2. Authentication & Authorization (4 questions)
  3. Database Design (5 questions)
  4. Core Workflows — Incident, SOS, QR, Expiry, Notifications (5 questions)
  5. Indian Compliance — Factories Act 1948 (2 questions)
  6. Advanced Technical — Error handling, DB connection, Profile completion, i18n, Risk (5 questions)
  7. Frontend Architecture — State management, Routing, Vite proxy (3 questions)
  8. Security — Measures and vulnerabilities (2 questions)
  9. Performance & Scalability (2 questions)
  10. Testing & Debugging (2 questions)
  11. Design Decisions (3 questions)
  12. Quick-Fire — Middleware, Mongoose, Aggregations, Helmet (7 questions)
  13. Summary Cheat Sheet

### 3. Key Things to Remember
- SimplyAID is a **MERN stack** web app (NOT Android/mobile), built with React + Vite frontend and Express + MongoDB backend
- Compliant with **Indian Factories Act, 1948** (Section 45 first-aid boxes, Section 88 accident reporting, Form 18)
- **9 roles**, **14 models**, **18 route modules**, **80+ API functions**
- Key patterns: JWT auth, RBAC, FIFO stock deduction, pre-save hooks, Mongoose aggregation pipelines
- No Redux — uses React Context API (AuthContext + ScannerContext)
