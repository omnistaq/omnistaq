<?php
defined('OMNISTAQ') or exit;
/*
 * Starter catalogue. Every price is 0 = "Request a quote" (no invented prices).
 * Admin → POS offers lets you edit names, descriptions, prices, images and visibility.
 * Row: [id, kind, name, category label, description, features, icon, featured]
 */
return [
    // ---------- POS SYSTEMS ----------
    ['supermarket-pos', 'pos', 'Supermarket & Grocery POS', 'SUPERMARKET & GROCERY', 'Quick checkout for busy grocery counters, with weight-based products, scale barcodes and promotions.', ['Fast checkout', 'Weight & scale barcodes', 'Bulk barcode printing', 'Promotions & offers'], '🛒', 1],
    ['retail-pos', 'pos', 'Retail POS', 'SHOPS & RETAIL STORES', 'A practical counter setup for shops that need fast billing, product control and clear daily reports.', ['Fast billing', 'Barcode-ready workflow', 'Stock & reports'], '🏪', 0],
    ['restaurant-pos', 'pos', 'Restaurant POS', 'CAFÉS & RESTAURANTS', 'Explore an order and menu setup for your café or restaurant with a guided OmniStaq demo.', ['Dine-in & takeaway', 'Kitchen orders (KOT)', 'Split bills', 'Sales insights'], '🍽️', 0],
    ['pharmacy-pos', 'pos', 'Pharmacy POS', 'PHARMACIES', 'Sell medicines with batch and expiry tracking, prescription notes and generic or brand name search.', ['Batch & expiry tracking', 'Prescription notes', 'Generic / brand names', 'Expiry alerts'], '💊', 0],
    ['fashion-pos', 'pos', 'Fashion Shop POS', 'FASHION & CLOTHING', 'Manage size and colour variants, seasonal collections and brands with a clear SKU matrix.', ['Size & colour variants', 'Seasonal collections', 'Brand & style tags', 'Variant barcodes'], '👗', 0],
    ['electronics-pos', 'pos', 'Electronics & Mobile Shop POS', 'ELECTRONICS & MOBILE SHOPS', 'Track serial numbers and IMEI, warranty periods and repair or replacement history for every sale.', ['Serial / IMEI tracking', 'Warranty tracking', 'Customer history', 'Accessories & variants'], '📱', 0],
    ['service-pos', 'pos', 'Service & Repair POS', 'SERVICES & REPAIR SHOPS', 'Bill services and service charges, take appointments and follow repair jobs from intake to delivery.', ['Service charges', 'Appointments & bookings', 'Repair jobs', 'Technician assignment'], '🔧', 0],
    ['multibranch-pos', 'pos', 'Multi-Branch POS', 'GROWING & MULTI-BRANCH BUSINESSES', 'Run several shops and warehouses with branch stock, transfers and branch-wise sales and profit reports.', ['Branches & warehouses', 'Stock transfers', 'Branch-wise reports', 'Sync between branches'], '🏢', 0],

    // ---------- HARDWARE ----------
    ['pos-terminal', 'hardware', 'POS Terminal / Touch Screen', 'COUNTER DEVICES', 'A counter computer or touch-screen terminal to run your OmniStaq POS. Models and specifications are confirmed by our team.', ['Touch or standard display', 'Counter-ready', 'Installation available'], '🖥️', 0],
    ['tablet-pos', 'hardware', 'Tablet / Mobile POS Device', 'COUNTER DEVICES', 'A tablet or handheld device for mobile billing, table-side orders and quick stock checks.', ['Portable billing', 'Table-side orders', 'Stock checks'], '📲', 0],
    ['barcode-scanner', 'hardware', 'Barcode Scanner (Wired)', 'SCANNERS', 'Plug-in barcode scanner for fast product lookup and billing at the counter.', ['Plug & play', 'Fast scanning', 'Counter or hand-held use'], '📷', 0],
    ['wireless-scanner', 'hardware', 'Barcode Scanner (Wireless)', 'SCANNERS', 'Cordless scanner for larger counters, stock counts and shelf checks.', ['Cordless', 'Stock count friendly', 'Dock / charging option'], '📡', 0],
    ['receipt-80', 'hardware', '80mm Thermal Receipt Printer', 'PRINTERS', 'Standard-width thermal receipt printer for customer bills.', ['80mm paper', 'Thermal printing', 'Cash-drawer connection'], '🧾', 0],
    ['receipt-58', 'hardware', '58mm Thermal Receipt Printer', 'PRINTERS', 'Compact thermal printer for small counters and mobile billing.', ['58mm paper', 'Compact size', 'Thermal printing'], '🧾', 0],
    ['label-printer', 'hardware', 'Barcode / Label Printer', 'PRINTERS', 'Print product barcode labels and price tags in the label sizes you need.', ['Barcode labels', 'Custom label sizes', 'Bulk label printing'], '🏷️', 0],
    ['a4-printer', 'hardware', 'A4 Invoice Printer', 'PRINTERS', 'Office-size printer for A4 invoices, quotations and reports.', ['A4 invoices', 'Quotations', 'Reports'], '🖨️', 0],
    ['kitchen-printer', 'hardware', 'Kitchen (KOT) Printer', 'KITCHEN', 'Prints kitchen order tickets so orders reach the kitchen instantly.', ['Kitchen order tickets', 'Heat-resistant use', 'Network or USB options'], '🍳', 0],
    ['kds-screen', 'hardware', 'Kitchen Display Screen', 'KITCHEN', 'A screen for the kitchen to follow orders as preparing, ready and completed.', ['Live kitchen orders', 'Order status', 'Cooking-time view'], '🍲', 0],
    ['cash-drawer', 'hardware', 'Cash Drawer', 'CASH & DISPLAY', 'Secure cash drawer that opens from your receipt printer when a sale is completed.', ['Printer-triggered', 'Secure lock', 'Note & coin trays'], '💵', 0],
    ['customer-display', 'hardware', 'Customer Display', 'CASH & DISPLAY', 'A second screen that shows items and totals to the customer while you bill.', ['Clear totals', 'Builds trust', 'Counter mounting'], '📺', 0],
    ['weight-scale', 'hardware', 'Weighing Scale', 'WEIGHING', 'Counter scale for weight-based products, connected to your billing screen.', ['Weight-based billing', 'Scale barcode support', 'Grocery & produce'], '⚖️', 0],
    ['consumables', 'hardware', 'Receipt & Label Rolls', 'CONSUMABLES', 'Thermal receipt paper and barcode label rolls. Sizes are confirmed to match your printer.', ['Receipt rolls', 'Label rolls', 'Bulk packs'], '🎫', 0],

    // ---------- ADD-ON MODULES ----------
    ['mod-loyalty', 'addon', 'Loyalty & Membership', 'ADD-ON MODULE', 'Reward repeat customers with points, membership levels, redemption and birthday offers.', ['Loyalty points', 'Membership levels', 'Birthday offers'], '⭐', 0],
    ['mod-purchasing', 'addon', 'Purchasing & Suppliers', 'ADD-ON MODULE', 'Purchase orders, goods received notes, supplier balances, payments and purchase returns.', ['Purchase orders & GRN', 'Supplier statements', 'Due payments'], '📥', 0],
    ['mod-credit', 'addon', 'Customer Credit & Dues', 'ADD-ON MODULE', 'Sell on credit, take partial payments and follow outstanding balances with reminders.', ['Credit sales', 'Partial payments', 'Outstanding reports'], '🧮', 0],
    ['mod-accounting', 'addon', 'Accounting & Expenses', 'ADD-ON MODULE', 'Track income and expenses, profit & loss, cash flow, receivables, payables and the ledger.', ['Profit & loss', 'Cash flow', 'Expense categories'], '📒', 0],
    ['mod-staff', 'addon', 'Staff, Attendance & Payroll', 'ADD-ON MODULE', 'Employee profiles, roles, shifts, attendance, salary, overtime and payslips.', ['Roles & permissions', 'Attendance', 'Payslips'], '👥', 0],
    ['mod-promotions', 'addon', 'Promotions & Coupons', 'ADD-ON MODULE', 'Product and category discounts, buy-1-get-1, combo deals, coupon codes and scheduled offers.', ['Combo deals', 'Coupon codes', 'Seasonal offers'], '🎁', 0],
    ['mod-online', 'addon', 'Online Orders & E-commerce', 'ADD-ON MODULE', 'Receive website, pickup and delivery orders and keep stock in sync with your online store.', ['Website orders', 'Stock sync', 'Order status'], '🛍️', 0],
    ['mod-delivery', 'addon', 'Delivery Management', 'ADD-ON MODULE', 'Manage delivery orders, status, delivery fees and driver assignment.', ['Delivery status', 'Driver assignment', 'Delivery fees'], '🚚', 0],
    ['mod-messaging', 'addon', 'SMS / WhatsApp / Email', 'ADD-ON MODULE', 'Send invoices, daily reports, payment reminders and promotions to your customers.', ['Invoice sending', 'Daily reports', 'Customer messages'], '💬', 0],
    ['mod-analytics', 'addon', 'Reports & Smart Analytics', 'ADD-ON MODULE', 'Sales, profit, stock, tax and cashier reports, plus reorder suggestions and slow-moving product insight.', ['Sales & profit reports', 'Reorder suggestions', 'Slow-moving products'], '📈', 0],
    ['mod-backup', 'addon', 'Backup, Sync & Offline Mode', 'ADD-ON MODULE', 'Automatic and manual backups, cloud backup, and continued selling when the internet is down.', ['Automatic backup', 'Cloud sync', 'Offline selling'], '☁️', 0],
    ['mod-language', 'addon', 'Multi-language & Multi-currency', 'ADD-ON MODULE', 'Use the system in Sinhala, English or Tamil and sell in LKR, USD and other currencies.', ['Sinhala / English / Tamil', 'Exchange rates', 'Currency-wise sales'], '🌍', 0],

    // ---------- SERVICES ----------
    ['svc-install', 'service', 'Installation & Setup', 'SERVICE', 'On-site or remote installation, printer and scanner setup, and first-time configuration.', ['Device setup', 'Receipt & label setup', 'Go-live support'], '🧰', 0],
    ['svc-training', 'service', 'Staff Training', 'SERVICE', 'Hands-on training for cashiers, managers and stock staff so your team is ready on day one.', ['Cashier training', 'Manager training', 'User guides'], '🎓', 0],
    ['svc-import', 'service', 'Product & Data Import', 'SERVICE', 'We import your products, customers and suppliers from Excel or CSV files.', ['Excel / CSV import', 'Barcode clean-up', 'Category setup'], '📄', 0],
    ['svc-support', 'service', 'Support & Updates Plan', 'SERVICE', 'Ongoing help, software updates and remote support. Plan details are confirmed by our team.', ['Remote support', 'Software updates', 'Priority help'], '🛟', 0],
];
