# Andromeda Studio: Master Technical Specification (Phase 01)

## 1. Core Architectural Strategy
- **Primary Engine:** Local BiRefNet (CPU-Optimized).
- **Target Hardware:** i5-1235U | 8GB RAM.
- **Workflow:** Single-image high-precision background extraction.

## 2. Current Module: Background Removal
- **Model:** `ZhengPeng7/BiRefNet` (General Weights).
- **Input Handling:** 1024x1024 tensor resizing for edge accuracy.
- **Precision Goal:** Maintain fine detail (hair/edges) while staying under 7GB total system RAM usage.

## 3. UI/UX (Andromeda Playground)
- **Status:** Passport and Object Removal features are **DEFERRED**.
- **UI Element:** Only the "Background Removal" tool is active in the function selector.
- **Output:** Immediate transparent PNG preview with 2026 "Nebula Zen" styling.