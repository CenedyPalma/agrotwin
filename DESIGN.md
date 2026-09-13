---
name: AgroTwin Design Specification
version: 1.0.0
tokens:
  colors:
    background: "#f6f8f6"
    background_dark: "#0b0f0c"
    surface: "#ffffff"
    surface_dark: "#121812"
    surface_2: "#f0f3f0"
    surface_2_dark: "#171f17"
    border: "#e2e8e2"
    border_dark: "#223022"
    foreground: "#121813"
    foreground_dark: "#edf2ed"
    muted_text: "#5c6b5f"
    muted_text_dark: "#93a396"
    brand: "#16a34a"
    brand_dark: "#0f7a37"
    healthy: "#22c55e"
    attention: "#eab308"
    problem: "#ef4444"
  typography:
    font_family_sans: "Geist Sans, system-ui, sans-serif"
    font_family_mono: "Geist Mono, monospace"
  radius:
    default: "0.625rem"
---

# AgroTwin Design Specification

## 1. Visual Philosophy
AgroTwin is an agricultural digital twin and drone intelligence platform designed for farmers, agronomists, and GIS professionals.
The interface rejects the cluttered, archaic aesthetic of traditional GIS software and embraces a modern, high-contrast, data-dense SaaS experience.

## 2. Core Color Palette
- **Brand Green** (`#16a34a` / `#22c55e` in dark mode): Evokes healthy vegetative canopy, vitality, and precision agriculture.
- **Agricultural Status Tiers**:
  - 🟢 **Healthy** (`#22c55e`): High biomass / vigor (NDVI > 0.6).
  - 🟡 **Needs Attention** (`#eab308`): Moderate biomass or emerging vegetation stress (NDVI 0.3 - 0.6).
  - 🔴 **Problem Area** (`#ef4444`): Bare soil, emergence gaps, weed clusters, or severe stress (NDVI < 0.3).
- **Dark Mode Priority**:
  - Drone multispectral rasters, 3D Gaussian splats, and terrain meshes are inspected with high contrast against dark panel backgrounds (`#121812`).

## 3. Component System
- Built on top of **Tailwind CSS v4** and **shadcn/ui** primitives (Button, Card, Badge, Input, Tooltip).
- Soft rounded edges (`border-radius: 0.625rem`).
- Cesium viewer isolated client-side with floating non-intrusive HUD toolbars.
