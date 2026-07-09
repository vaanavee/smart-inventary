# User Stories
## Smart Inventory Management System

This document translates the Functional Requirements from the PRD into standard Agile user stories to guide development and testing.

---

### **Epic 1: Warehouse Worker Operations**
*Focus: Logging in, identifying stock, and picking items efficiently without extra manual paperwork.*

* **US-1.1: Automated Entry Logging**
  * **As a** warehouse worker,
  * **I want to** scan my RFID tag at the stock room entry door,
  * **So that** the system automatically logs my entry time and identity without me having to sign a physical logbook.
  * *Acceptance Criteria:* Valid RFID scan records timestamp and User ID in the database. Invalid scans trigger an error indicator.

* **US-1.2: Rack Contents Lookup**
  * **As a** warehouse worker,
  * **I want to** scan a rack's unique QR code using my Employee Mobile Guide app,
  * **So that** I can instantly see a list of all products currently stored on that specific rack.
  * *Acceptance Criteria:* App displays correct product list mapped to the scanned QR code.

* **US-1.3: Mobile Scan History**
  * **As a** warehouse worker,
  * **I want to** view my recent scan and pick history on my mobile app,
  * **So that** I can keep track of the items I have moved during my shift.
  * *Acceptance Criteria:* App displays a chronological log of verified picks associated with the worker's ID.

* **US-1.4: Manual Product Scan Logging**
  * **As a** warehouse worker,
  * **I want to** scan a product's RFID tag when I pick it from the rack,
  * **So that** the system logs the item, rack location, my name, and the timestamp before it goes to AI verification.
  * *Acceptance Criteria:* System captures Labour Name, Rack ID, Product ID, Quantity (1), and Timestamp upon scan.

---

### **Epic 2: AI Verification Engine**
*Focus: Automatically verifying that the manually scanned items match the actual physical items taken.*

* **US-2.1: Automated Physical Counting**
  * **As the** system,
  * **I want to** trigger an overhead RT-DETR camera when items are placed in the verification tray,
  * **So that** I can use AI to physically count the exact number of products taken.
  * *Acceptance Criteria:* Camera captures a clear image under LED lighting; AI model returns an integer count of detected items.

* **US-2.2: Transaction Match (Auto-Approval)**
  * **As a** warehouse supervisor,
  * **I want** the system to automatically save the transaction to the database if the AI count matches the manual RFID scan count exactly,
  * **So that** accurate transactions process instantly without manual review.
  * *Acceptance Criteria:* When AI count == Manual count, status is marked "Verified" and committed to the database.

* **US-2.3: Transaction Mismatch (Alerting)**
  * **As a** warehouse supervisor,
  * **I want** the system to halt auto-saving and trigger an alert if the AI count differs from the manual RFID scan,
  * **So that** I can manually review discrepancies (e.g., worker taking two items but only scanning one) before inventory numbers are skewed.
  * *Acceptance Criteria:* When AI count != Manual count, transaction is marked as a "Mismatch" and withheld from auto-store. An alert is sent to the dashboard.

---

### **Epic 3: Management Dashboard & Monitoring**
*Focus: Giving supervisors real-time visibility into inventory health and worker actions.*

* **US-3.1: Total Stock Visibility**
  * **As a** warehouse supervisor,
  * **I want to** see the total number of products currently in stock on my web dashboard,
  * **So that** I always have an accurate, real-time understanding of warehouse inventory.
  * *Acceptance Criteria:* Dashboard prominently displays an aggregated total stock metric.

* **US-3.2: Low-Stock Alerts**
  * **As a** warehouse supervisor,
  * **I want to** see clear visual alerts on the dashboard when specific items fall below their designated threshold,
  * **So that** I know exactly when to trigger reordering workflows.
  * *Acceptance Criteria:* Dashboard lists all products whose current count is below their predefined minimum stock level.

* **US-3.3: Real-Time Movement Feed**
  * **As a** warehouse supervisor,
  * **I want to** view a live feed of today's stock movements,
  * **So that** I can monitor warehouse activity and track who moved what, and when.
  * *Acceptance Criteria:* Dashboard displays a chronological list of verified transactions (Labour, Rack, Product, Qty, Time).

* **US-3.4: Active Discrepancy Review**
  * **As a** warehouse supervisor,
  * **I want to** see a dedicated section for active mismatch alerts (where AI counts did not match manual scans),
  * **So that** I can investigate potential theft, counting errors, or system issues immediately.
  * *Acceptance Criteria:* Dashboard highlights mismatch transactions prominently, showing Expected (Manual) vs Actual (AI) counts.

---

### **Epic 4: System Administration & Hardware**
*Focus: Infrastructure, reliability, and configuration.*

* **US-4.1: Intermittent Connectivity Handling**
  * **As a** system administrator,
  * **I want** the ESP32 hardware controllers to buffer scan data locally if the warehouse Wi-Fi drops,
  * **So that** no transaction records are lost during brief network outages.
  * *Acceptance Criteria:* If cloud connection fails, ESP32 retries transmission until successful.

* **US-4.2: Hardware Management**
  * **As a** system administrator,
  * **I want to** configure which products belong to which racks via the admin panel,
  * **So that** the QR codes accurately reflect physical storage changes.
  * *Acceptance Criteria:* Admin panel allows mapping Product IDs to specific Rack IDs/QR Codes.
