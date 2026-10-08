-- OmniStaq POS website - complete database (structure + starter data)
-- phpMyAdmin: Import tab -> choose this file -> Go.   (OPTIONAL: the website also creates all of this by itself on first visit.)
-- Uploaded images and bank-transfer receipts are stored in the `media` table (MEDIUMBLOB), so no upload folders are needed.
SET NAMES utf8mb4;
-- Select your hosting database in phpMyAdmin BEFORE importing this file.
-- No CREATE DATABASE / USE statement: supports hosting-prefixed database names.

CREATE TABLE IF NOT EXISTS admin (id TINYINT UNSIGNED NOT NULL PRIMARY KEY, password_hash VARCHAR(255) NOT NULL, updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_hits (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, bucket VARCHAR(40) NOT NULL, ip VARCHAR(45) NOT NULL, ts INT UNSIGNED NOT NULL, KEY idx_rate (bucket, ip, ts)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (k VARCHAR(60) NOT NULL PRIMARY KEY, v TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (id VARCHAR(90) NOT NULL PRIMARY KEY, name VARCHAR(70) NOT NULL, category VARCHAR(40) NOT NULL DEFAULT '', kind VARCHAR(12) NOT NULL DEFAULT 'pos', description VARCHAR(400) NOT NULL, features TEXT NOT NULL, price_cents BIGINT UNSIGNED NOT NULL DEFAULT 0, discount TINYINT UNSIGNED NOT NULL DEFAULT 0, discount_start DATE NULL, discount_end DATE NULL, featured TINYINT(1) NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, icon VARCHAR(16) NOT NULL DEFAULT '', image_url VARCHAR(300) NOT NULL DEFAULT '', created_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign (id TINYINT UNSIGNED NOT NULL PRIMARY KEY, active TINYINT(1) NOT NULL DEFAULT 0, title VARCHAR(80) NOT NULL DEFAULT '', message VARCHAR(300) NOT NULL DEFAULT '', discount_text VARCHAR(40) NOT NULL DEFAULT '', cta_label VARCHAR(40) NOT NULL DEFAULT '', image_url VARCHAR(300) NOT NULL DEFAULT '', start_at DATETIME NULL, end_at DATETIME NULL, updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS demos (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ref VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL, phone VARCHAR(30) NOT NULL, business VARCHAR(80) NOT NULL DEFAULT '', shop_type VARCHAR(50) NOT NULL DEFAULT '', message VARCHAR(600) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'new', notes VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, KEY idx_demo_created (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ref VARCHAR(30) NOT NULL UNIQUE, access_hash CHAR(64) NOT NULL, name VARCHAR(80) NOT NULL, phone VARCHAR(30) NOT NULL, email VARCHAR(120) NOT NULL DEFAULT '', business VARCHAR(80) NOT NULL DEFAULT '', business_type VARCHAR(60) NOT NULL DEFAULT '', business_categories TEXT NULL, address VARCHAR(150) NOT NULL DEFAULT '', city VARCHAR(80) NOT NULL DEFAULT '', payment_method VARCHAR(10) NOT NULL, items MEDIUMTEXT NOT NULL, amount_cents BIGINT UNSIGNED NULL, status VARCHAR(20) NOT NULL, proof_file VARCHAR(80) NOT NULL DEFAULT '', access_token VARCHAR(64) NOT NULL DEFAULT '', admin_notes VARCHAR(1000) NOT NULL DEFAULT '', gateway_payment_id VARCHAR(100) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, KEY idx_order_created (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (id CHAR(32) NOT NULL PRIMARY KEY, kind VARCHAR(10) NOT NULL DEFAULT 'public', mime VARCHAR(30) NOT NULL, size INT UNSIGNED NOT NULL, data MEDIUMBLOB NOT NULL, created_at DATETIME NOT NULL, KEY idx_media_kind (kind)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, type VARCHAR(30) NOT NULL, created_at DATETIME NOT NULL, KEY idx_event (type, created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings(k,v) VALUES
('whatsapp',''),
('bankName',''),
('accountName',''),
('accountNumber',''),
('bankBranch',''),
('supportHours','Monday – Saturday, 9 AM – 6 PM'),
('heroImage',''),
('demoVideo',''),
('setupText','Installation and training tailored to your business.'),
('updateText','Ask our team about the available update and support plans.'),
('schema_version','7');

INSERT IGNORE INTO campaign(id,active,title,message,discount_text,cta_label,image_url,updated_at) VALUES
(1,0,'A special offer for your business','Chat with our team to learn more about this offer.','SPECIAL OFFER','Claim this offer','',NOW());

INSERT IGNORE INTO products(id,kind,name,category,description,features,price_cents,discount,featured,active,sort_order,icon,created_at) VALUES
('supermarket-pos','pos','Supermarket & Grocery POS','SUPERMARKET & GROCERY','Quick checkout for busy grocery counters, with weight-based products, scale barcodes and promotions.','["Fast checkout","Weight & scale barcodes","Bulk barcode printing","Promotions & offers"]',0,0,1,1,1,'🛒',NOW()),
('retail-pos','pos','Retail POS','SHOPS & RETAIL STORES','A practical counter setup for shops that need fast billing, product control and clear daily reports.','["Fast billing","Barcode-ready workflow","Stock & reports"]',0,0,0,1,2,'🏪',NOW()),
('restaurant-pos','pos','Restaurant POS','CAFÉS & RESTAURANTS','Explore an order and menu setup for your café or restaurant with a guided OmniStaq demo.','["Dine-in & takeaway","Kitchen orders (KOT)","Split bills","Sales insights"]',0,0,0,1,3,'🍽️',NOW()),
('pharmacy-pos','pos','Pharmacy POS','PHARMACIES','Sell medicines with batch and expiry tracking, prescription notes and generic or brand name search.','["Batch & expiry tracking","Prescription notes","Generic \\/ brand names","Expiry alerts"]',0,0,0,1,4,'💊',NOW()),
('fashion-pos','pos','Fashion Shop POS','FASHION & CLOTHING','Manage size and colour variants, seasonal collections and brands with a clear SKU matrix.','["Size & colour variants","Seasonal collections","Brand & style tags","Variant barcodes"]',0,0,0,1,5,'👗',NOW()),
('electronics-pos','pos','Electronics & Mobile Shop POS','ELECTRONICS & MOBILE SHOPS','Track serial numbers and IMEI, warranty periods and repair or replacement history for every sale.','["Serial \\/ IMEI tracking","Warranty tracking","Customer history","Accessories & variants"]',0,0,0,1,6,'📱',NOW()),
('service-pos','pos','Service & Repair POS','SERVICES & REPAIR SHOPS','Bill services and service charges, take appointments and follow repair jobs from intake to delivery.','["Service charges","Appointments & bookings","Repair jobs","Technician assignment"]',0,0,0,1,7,'🔧',NOW()),
('multibranch-pos','pos','Multi-Branch POS','GROWING & MULTI-BRANCH BUSINESSES','Run several shops and warehouses with branch stock, transfers and branch-wise sales and profit reports.','["Branches & warehouses","Stock transfers","Branch-wise reports","Sync between branches"]',0,0,0,1,8,'🏢',NOW()),
('pos-terminal','hardware','POS Terminal / Touch Screen','COUNTER DEVICES','A counter computer or touch-screen terminal to run your OmniStaq POS. Models and specifications are confirmed by our team.','["Touch or standard display","Counter-ready","Installation available"]',0,0,0,1,9,'🖥️',NOW()),
('tablet-pos','hardware','Tablet / Mobile POS Device','COUNTER DEVICES','A tablet or handheld device for mobile billing, table-side orders and quick stock checks.','["Portable billing","Table-side orders","Stock checks"]',0,0,0,1,10,'📲',NOW()),
('barcode-scanner','hardware','Barcode Scanner (Wired)','SCANNERS','Plug-in barcode scanner for fast product lookup and billing at the counter.','["Plug & play","Fast scanning","Counter or hand-held use"]',0,0,0,1,11,'📷',NOW()),
('wireless-scanner','hardware','Barcode Scanner (Wireless)','SCANNERS','Cordless scanner for larger counters, stock counts and shelf checks.','["Cordless","Stock count friendly","Dock \\/ charging option"]',0,0,0,1,12,'📡',NOW()),
('receipt-80','hardware','80mm Thermal Receipt Printer','PRINTERS','Standard-width thermal receipt printer for customer bills.','["80mm paper","Thermal printing","Cash-drawer connection"]',0,0,0,1,13,'🧾',NOW()),
('receipt-58','hardware','58mm Thermal Receipt Printer','PRINTERS','Compact thermal printer for small counters and mobile billing.','["58mm paper","Compact size","Thermal printing"]',0,0,0,1,14,'🧾',NOW()),
('label-printer','hardware','Barcode / Label Printer','PRINTERS','Print product barcode labels and price tags in the label sizes you need.','["Barcode labels","Custom label sizes","Bulk label printing"]',0,0,0,1,15,'🏷️',NOW()),
('a4-printer','hardware','A4 Invoice Printer','PRINTERS','Office-size printer for A4 invoices, quotations and reports.','["A4 invoices","Quotations","Reports"]',0,0,0,1,16,'🖨️',NOW()),
('kitchen-printer','hardware','Kitchen (KOT) Printer','KITCHEN','Prints kitchen order tickets so orders reach the kitchen instantly.','["Kitchen order tickets","Heat-resistant use","Network or USB options"]',0,0,0,1,17,'🍳',NOW()),
('kds-screen','hardware','Kitchen Display Screen','KITCHEN','A screen for the kitchen to follow orders as preparing, ready and completed.','["Live kitchen orders","Order status","Cooking-time view"]',0,0,0,1,18,'🍲',NOW()),
('cash-drawer','hardware','Cash Drawer','CASH & DISPLAY','Secure cash drawer that opens from your receipt printer when a sale is completed.','["Printer-triggered","Secure lock","Note & coin trays"]',0,0,0,1,19,'💵',NOW()),
('customer-display','hardware','Customer Display','CASH & DISPLAY','A second screen that shows items and totals to the customer while you bill.','["Clear totals","Builds trust","Counter mounting"]',0,0,0,1,20,'📺',NOW()),
('weight-scale','hardware','Weighing Scale','WEIGHING','Counter scale for weight-based products, connected to your billing screen.','["Weight-based billing","Scale barcode support","Grocery & produce"]',0,0,0,1,21,'⚖️',NOW()),
('consumables','hardware','Receipt & Label Rolls','CONSUMABLES','Thermal receipt paper and barcode label rolls. Sizes are confirmed to match your printer.','["Receipt rolls","Label rolls","Bulk packs"]',0,0,0,1,22,'🎫',NOW()),
('mod-loyalty','addon','Loyalty & Membership','ADD-ON MODULE','Reward repeat customers with points, membership levels, redemption and birthday offers.','["Loyalty points","Membership levels","Birthday offers"]',0,0,0,1,23,'⭐',NOW()),
('mod-purchasing','addon','Purchasing & Suppliers','ADD-ON MODULE','Purchase orders, goods received notes, supplier balances, payments and purchase returns.','["Purchase orders & GRN","Supplier statements","Due payments"]',0,0,0,1,24,'📥',NOW()),
('mod-credit','addon','Customer Credit & Dues','ADD-ON MODULE','Sell on credit, take partial payments and follow outstanding balances with reminders.','["Credit sales","Partial payments","Outstanding reports"]',0,0,0,1,25,'🧮',NOW()),
('mod-accounting','addon','Accounting & Expenses','ADD-ON MODULE','Track income and expenses, profit & loss, cash flow, receivables, payables and the ledger.','["Profit & loss","Cash flow","Expense categories"]',0,0,0,1,26,'📒',NOW()),
('mod-staff','addon','Staff, Attendance & Payroll','ADD-ON MODULE','Employee profiles, roles, shifts, attendance, salary, overtime and payslips.','["Roles & permissions","Attendance","Payslips"]',0,0,0,1,27,'👥',NOW()),
('mod-promotions','addon','Promotions & Coupons','ADD-ON MODULE','Product and category discounts, buy-1-get-1, combo deals, coupon codes and scheduled offers.','["Combo deals","Coupon codes","Seasonal offers"]',0,0,0,1,28,'🎁',NOW()),
('mod-online','addon','Online Orders & E-commerce','ADD-ON MODULE','Receive website, pickup and delivery orders and keep stock in sync with your online store.','["Website orders","Stock sync","Order status"]',0,0,0,1,29,'🛍️',NOW()),
('mod-delivery','addon','Delivery Management','ADD-ON MODULE','Manage delivery orders, status, delivery fees and driver assignment.','["Delivery status","Driver assignment","Delivery fees"]',0,0,0,1,30,'🚚',NOW()),
('mod-messaging','addon','SMS / WhatsApp / Email','ADD-ON MODULE','Send invoices, daily reports, payment reminders and promotions to your customers.','["Invoice sending","Daily reports","Customer messages"]',0,0,0,1,31,'💬',NOW()),
('mod-analytics','addon','Reports & Smart Analytics','ADD-ON MODULE','Sales, profit, stock, tax and cashier reports, plus reorder suggestions and slow-moving product insight.','["Sales & profit reports","Reorder suggestions","Slow-moving products"]',0,0,0,1,32,'📈',NOW()),
('mod-backup','addon','Backup, Sync & Offline Mode','ADD-ON MODULE','Automatic and manual backups, cloud backup, and continued selling when the internet is down.','["Automatic backup","Cloud sync","Offline selling"]',0,0,0,1,33,'☁️',NOW()),
('mod-language','addon','Multi-language & Multi-currency','ADD-ON MODULE','Use the system in Sinhala, English or Tamil and sell in LKR, USD and other currencies.','["Sinhala \\/ English \\/ Tamil","Exchange rates","Currency-wise sales"]',0,0,0,1,34,'🌍',NOW()),
('svc-install','service','Installation & Setup','SERVICE','On-site or remote installation, printer and scanner setup, and first-time configuration.','["Device setup","Receipt & label setup","Go-live support"]',0,0,0,1,35,'🧰',NOW()),
('svc-training','service','Staff Training','SERVICE','Hands-on training for cashiers, managers and stock staff so your team is ready on day one.','["Cashier training","Manager training","User guides"]',0,0,0,1,36,'🎓',NOW()),
('svc-import','service','Product & Data Import','SERVICE','We import your products, customers and suppliers from Excel or CSV files.','["Excel \\/ CSV import","Barcode clean-up","Category setup"]',0,0,0,1,37,'📄',NOW()),
('svc-support','service','Support & Updates Plan','SERVICE','Ongoing help, software updates and remote support. Plan details are confirmed by our team.','["Remote support","Software updates","Priority help"]',0,0,0,1,38,'🛟',NOW());
