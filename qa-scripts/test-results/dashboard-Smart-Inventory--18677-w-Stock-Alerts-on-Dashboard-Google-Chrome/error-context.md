# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.js >> Smart Inventory - Web Dashboard Tests (Module 5) >> TC_05_01: Verify Total Stock and Low-Stock Alerts on Dashboard
- Location: tests\dashboard.spec.js:36:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*\/admin/
Received string:  "http://localhost:5173/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × unexpected value "http://localhost:5173/login"

```

```yaml
- paragraph: Smart Inventory Management
- heading "Admin Login" [level=2]
- text: User ID
- textbox
- text: Password
- textbox
- button "Sign In"
- paragraph: "Demo credentials: admin / admin123"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // Use the Playwright config baseURL (http://localhost:5173)
  4  | 
  5  | test.describe('Smart Inventory - Web Dashboard Tests (Module 5)', () => {
  6  | 
  7  |   // Run before each test: attempt to log in so we can access the /admin dashboard
  8  |   test.beforeEach(async ({ page }) => {
  9  |     // Navigate to login page
  10 |     await page.goto('/login');
  11 |     
  12 |     // Depending on your actual Login UI, these selectors might need a tweak.
  13 |     // We will attempt to find common username/password fields and log in.
  14 |     try {
  15 |       const emailField = page.getByPlaceholder(/email|user/i).first();
  16 |       const passwordField = page.getByPlaceholder(/password/i).first();
  17 |       
  18 |       if (await emailField.isVisible()) {
  19 |         await emailField.fill('admin@example.com');
  20 |         await passwordField.fill('password123');
  21 |         await page.getByRole('button', { name: /login|sign in/i }).click();
  22 |         
  23 |         // Wait for navigation to complete to the admin dashboard
  24 |         await page.waitForURL('**/admin**');
  25 |       } else {
  26 |         // If no login form is visible, we might already have a token or be bypassed
  27 |         await page.goto('/admin');
  28 |       }
  29 |     } catch (e) {
  30 |       console.log('Login form not found or bypassed, proceeding to /admin directly.');
  31 |       await page.goto('/admin');
  32 |     }
  33 |   });
  34 | 
  35 |   // TC_05_01: Verify Total Stock and Low-Stock Alerts
  36 |   test('TC_05_01: Verify Total Stock and Low-Stock Alerts on Dashboard', async ({ page }) => {
  37 |     // We should be on the Admin Dashboard page
> 38 |     await expect(page).toHaveURL(/.*\/admin/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  39 | 
  40 |     // Look for Total Products in Stock metric (case insensitive text match)
  41 |     // You can change 'Total Products' to the exact wording you used on your AdminHome component
  42 |     const totalStockWidget = page.getByText(/Total (Products|Stock)/i);
  43 |     await expect(totalStockWidget.first()).toBeVisible({ timeout: 5000 }).catch(() => {
  44 |       console.warn("Could not find 'Total Stock' widget. Please ensure AdminHome.jsx renders this text.");
  45 |     });
  46 | 
  47 |     // Look for Low-Stock alerts section
  48 |     const lowStockAlerts = page.getByText(/Low-Stock|Low Stock/i);
  49 |     await expect(lowStockAlerts.first()).toBeVisible().catch(() => {
  50 |       console.warn("Could not find 'Low-Stock' alerts section.");
  51 |     });
  52 |   });
  53 | 
  54 |   // TC_05_02: Monitor Real-Time Movement Logs
  55 |   test('TC_05_02: Monitor Real-Time Movement Logs', async ({ page }) => {
  56 |     // The dashboard should contain a feed of recent transactions/movements
  57 |     const movementFeed = page.getByText(/Movement|Recent Activity|Transactions/i);
  58 |     await expect(movementFeed.first()).toBeVisible().catch(() => {
  59 |       console.warn("Could not find movement log feed on dashboard.");
  60 |     });
  61 | 
  62 |     // Here we ensure the dashboard can load data (e.g. checking for a list or table)
  63 |     // await expect(page.locator('table').first()).toBeVisible();
  64 |   });
  65 | 
  66 |   // TC_05_03: Receive Mismatch Alert on Dashboard
  67 |   test('TC_05_03: Receive Mismatch Alert on Dashboard', async ({ page }) => {
  68 |     // The dashboard should contain an area dedicated to mismatch alerts or AI verification failures
  69 |     const mismatchAlerts = page.getByText(/Mismatch|Alerts|Discrepancy/i);
  70 |     await expect(mismatchAlerts.first()).toBeVisible().catch(() => {
  71 |       console.warn("Could not find 'Mismatch Alerts' section on dashboard.");
  72 |     });
  73 |   });
  74 |   
  75 |   test('TC_02_01: Verify Employee Pages load correctly (No Auth required)', async ({ page }) => {
  76 |     // Navigate to employee route
  77 |     await page.goto('/employee');
  78 |     await page.waitForLoadState('domcontentloaded');
  79 |     
  80 |     // Expect some common employee page text
  81 |     const title = await page.title();
  82 |     expect(title).not.toBeNull();
  83 |   });
  84 | 
  85 | });
  86 | 
```