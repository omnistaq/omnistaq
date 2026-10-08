# OmniStaq POS Website

One flat folder, no sub-folders. It runs in two parts that use the **same files**:

| Part | Where | What |
|---|---|---|
| **Front-end** (pages) | GitHub Pages `https://omnistaq.github.io/omnistaq/` | `index.html`, `order.html`, CSS, JS, images |
| **Back-end** (PHP + MySQL) | Any PHP host with MySQL (cPanel, XAMPP, ...) | `api.php`, `media.php`, database, admin panel |

GitHub Pages cannot run PHP or MySQL, so orders, bank-transfer receipts and the admin panel live on the PHP host.
The pages on GitHub talk to it through `api.php`.

## 1. Back-end (PHP host)
1. Create a MySQL database + user (cPanel -> MySQL Databases). On XAMPP it is created automatically.
2. Upload **all files** of this folder into a folder on the host, e.g. `public_html/omnistaq/`.
3. In that folder create `config.local.php` (never commit it - it is in `.gitignore`):
   ```php
   <?php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'your_db');
   define('DB_USER', 'your_user');
   define('DB_PASS', 'your_password');
   define('DEBUG', false);
   define('FRONTEND_URL', 'https://omnistaq.github.io/omnistaq');   // where the pages are (for customer tracking links)
   ```
   Tables are created automatically on the first request (or import `database.sql` in phpMyAdmin).
4. Add `define('SETUP_KEY', 'a-long-random-text');` to `config.local.php`, then open `https://yourdomain.lk/omnistaq/setup.html`, type that key and create the admin password (min 10 characters).
   The admin panel is always at `https://yourdomain.lk/omnistaq/admin.html` (opening it on github.io redirects there).
5. Bank-transfer receipts need `max_allowed_packet=16M` in MySQL (`my.ini` / `my.cnf`, `[mysqld]`) - ask your host if images fail to save.

## 2. Front-end (GitHub Pages)
1. Edit **`config.js`** and set the address of the folder from step 1.2 (with `https`):
   ```js
   window.OMNI_API_BASE = 'https://yourdomain.lk/omnistaq/';
   ```
2. Upload all files to your GitHub repo `omnistaq` (Add file -> Upload files).
3. Repo Settings -> Pages -> Deploy from branch `main` / `(root)`.
4. If your GitHub address is different, change it in `FRONTEND_URL` (step 1.3) and, only if the site is on another
   domain than `omnistaq.github.io`, add it to `ALLOWED_ORIGINS`.

## One host only (XAMPP / single PHP host)
Leave `window.OMNI_API_BASE = ''` and copy the folder to `htdocs/omnistaq/` (or the host). Website `index.html`, admin `admin.html`.
Local without XAMPP: `php -S 127.0.0.1:8080 router.php`.

## Data storage
Receipts and admin-uploaded images are stored in the MySQL table `media` (MEDIUMBLOB) - no upload folders.
Receipts are private (admin only, through `api.php`); offer/hero/campaign images are public via `media.php`.

## Notes
* The PHP files are visible as plain text on GitHub Pages. They contain no passwords (those live in `config.local.php` on the host).
* On Nginx `.htaccess` is ignored: deny `config*.php`, `helpers.php`, `catalog.php`, `router.php`, `create-admin.php` and `*.sql`.
* Forgot the admin password: `php create-admin.php "NewPassword123"` on the host (command line only).
* `check.php` is a diagnostic page that works only from `localhost`.
