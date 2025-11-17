# 📁 Project Structure Overview

Your project follows a clean separation of **pages**, **components**, **scripts**, and **styles**.
Each folder plays a specific role in composing the UI, handling user interactions, and storing data.

---

## **📂 `src/pages/`**

Pages define the **routes** of your application. Each `.astro` file inside this folder becomes a public-facing page.

### **`index.astro`**

This is your **main application page**, the one that renders when the user opens the site root (`/`).
It usually contains:

* The global layout (header, intro, structure)
* The UI elements for selecting parameters
* The form for creating a new entry
* The component `<EntriesList />` to show all saved entries
* Scripts imported with `<script type="module">`

### **`index.astro.bak`**

This is a **backup** of an older version of your `index.astro`.
It’s not used by Astro — exists only for safety, comparison, or history.

---

## **📂 `src/components/`**

Components are **reusable UI pieces** used inside pages.

### **`EntriesList.astro`**

This component displays **all stored entries** in a table format.
Responsibilities:

* Fetches entries via `getEntries()` from `storage.js`
* Sorts them by creation date
* Renders a complete table (`date`, `parameter`, `rating`, `comment`)
* Shows `"No entries yet"` when the list is empty

Conceptually, this acts as your **history viewer** or **logbook**.

---

## **📂 `src/scripts/`**

Scripts manage logic, data manipulation, and UI behavior.
They do not render anything directly but provide the functionality used by the Astro pages.

### **`storage.js`**

Your **localStorage database layer**.
Handles all persistent data:

* Parameters (`Sleep`, `Study`, etc.)
* Entries (every journal/log record)

Main responsibilities:

* `getParameters()` → load or initialize parameters
* `addParameter()` → create new parameter
* `removeParameter()` → delete parameter
* `getEntries()` → load entries
* `saveEntry()` → create a new entry
* `deleteEntry()` → remove an entry

Essentially: **Your entire persistent data model lives here.**

---

### **`ui.js`**

This file governs **DOM manipulation and UI behavior**, such as:

* Updating dropdowns
* Showing or hiding UI elements
* Handling form responses
* Synchronizing frontend state with storage

It acts as the "connector" between the user interface and the underlying logic.

---

### **`main.js`**

The central **initialization script**.
Common duties include:

* Calling initialization functions from `ui.js`
* Setting event listeners
* Ensuring the app loads correctly when the page opens

Think of it as the **entry point** for all frontend behavior.

---

### **`chart.js`**

Responsible for **rendering charts** (likely using Chart.js or another library).
Handles aggregation and visual representation of your entries — e.g.:

* Bar charts of scores per day
* Radar charts of parameters
* Timeline visualizations

This script consumes storage data and turns it into **visual insights**.

---

## **📂 `src/styles/`**

Project-wide CSS files.

### **`global.css`**

Contains the **base styles** shared across all pages:

* Layout rules
* Typography
* Table styles
* Buttons and inputs
* Reset/normalization rules

It ensures your entire app maintains a consistent aesthetic.

---

# 🧠 Summary Table

| File / Folder                  | Purpose                      |
| ------------------------------ | ---------------------------- |
| `pages/`                       | Public-facing pages (routes) |
| `index.astro`                  | Main app UI                  |
| `components/EntriesList.astro` | Display list of all entries  |
| `scripts/storage.js`           | LocalStorage database layer  |
| `scripts/ui.js`                | DOM logic, UI updates        |
| `scripts/main.js`              | App initialization           |
| `scripts/chart.js`             | Chart rendering              |
| `styles/global.css`            | Global styling               |

---