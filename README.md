# Prism 🌈

**Prism** is a personal web application (PWA) designed to help users reflect on their daily performance and track personal metrics. Inspired by the concept of a prism revealing hidden colors, this app acts as a mirror to uncover insights that often go unnoticed in our daily routines, helping users make better decisions and evolve over time.

---

## 🌟 Purpose

Prism aims to reveal the hidden patterns in everyday life, allowing users to understand how different aspects of their day—such as sleep, exercise, study, social interactions, and mental strategies—interact and influence their overall performance. The app encourages mindfulness and self-awareness, transforming ordinary daily habits into meaningful insights.

---

## 🛠 Features (MVP)

The MVP (Minimum Viable Product) focuses on **core functionalities** to get the app up and running within 14 days:

1. **Custom Parameters**
   - Add and remove daily metrics (e.g., sleep, exercise, study).  
   - Flexible, with default daily parameters, but editable as needed.

2. **Daily Tracking**
   - Rate each parameter from 0 to 10.  
   - Add optional comments for context.  
   - Separate entries for **morning** and **evening** periods.  

3. **Data Visualization**
   - View individual daily records with notes.  
   - Weekly and monthly charts to track progress over time.  

4. **Data Management**
   - Edit or delete past entries.  
   - Filter entries by period, parameter, or date.  

5. **Mobile-Friendly & PWA**
   - Optimized for quick entry on mobile devices.  
   - Minimalist and elegant design for fast, intuitive use.  

6. **Notifications**
   - Optional reminders to track metrics at the end of each period.

---

## 🗂 Project Structure

Prism is built using **Astro** with a modern web stack:

- `src/components/` – Reusable UI components  
- `src/pages/` – App pages (Dashboard, Day View, Settings)  
- `src/assets/` – Images, icons, and styles  
- `src/utils/` – Helper functions (data storage, chart generation)  
- `public/` – Manifest and PWA configuration  

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18  
- npm or yarn  

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/prism.git
cd prism

# Install dependencies
npm install

# Run locally
npm run dev
