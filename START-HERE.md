# OmniStaq v4 — GitHub Pages + PHP + MySQL

IMPORTANT: This is configured code, not a live deployment. You must enter your own PHP hosting URL and database details. GitHub Pages alone cannot run PHP or MySQL. No hosting account or database credentials were provided with this ZIP.

## 1. PHP / MySQL hosting

1. Use an HTTPS PHP host with MySQL, PHP 8.2+ recommended, PDO MySQL and sessions enabled. PHP must allow request bodies of at least 8 MB; MySQL max_allowed_packet should be at least 16 MB.
2. Create a database and database user in your hosting control panel. Grant that user permissions on that database. Use the full hosting-prefixed names.
3. Upload the complete contents of this ZIP, including the bundled images, into your PHP website folder (for example public_html/omnistaq). Upload .htaccess too on Apache.
4. On that host ONLY, copy config.local.example.php to config.local.php and replace ALL placeholders. Database credentials belong here, never in config.js. Use a long random SETUP_KEY. Set BASE_URL to the PHP folder URL and FRONTEND_URL to the exact GitHub Pages website URL (including its repository path).
5. The app automatically creates/updates tables. Existing orders/admin/uploads remain. Alternatively select your existing database in phpMyAdmin and import database.sql; its v7 schema marker intentionally triggers the v8 image migration on the next API request.
6. Open https://YOUR-PHP-HOST/omnistaq/connection.html and click Test PHP + MySQL. Then open setup.html and create your admin. Existing installations: sign in at admin.html instead.
7. In admin Settings enter your bank details and WhatsApp number. Add prices and upload your product/hero/campaign images. Zero-price products request a quote.

## 2. GitHub Pages

1. Edit config.js:
   window.OMNI_API_BASE = 'https://YOUR-PHP-HOST/omnistaq/';
   Use the folder URL, not the URL of api.php, not a database hostname, and not your GitHub URL.
2. Upload only *.html, *.css, *.js, *.png, *.webp, favicon.ico and manifest.webmanifest from this ZIP to your GitHub repository root. Do not upload config.local.php, SQL files or database backups. .gitignore does NOT protect secrets manually uploaded through GitHub's website.
3. GitHub repository Settings → Pages → Deploy from a branch → main → /(root).
4. Open your published connection.html and click Test. The test must say MySQL connected. Then open index.html.
5. GitHub admin.html/setup.html automatically redirect to your PHP host. This avoids blocked third-party admin session cookies. Customer pages stay on GitHub.
6. Replace old files on BOTH hosts. Hard refresh with Ctrl+F5. Setup/admin show v4.0.0; script URLs have a v4 cache version.

Custom domains: FRONTEND_URL must be your actual public site URL. If several frontends are required, add their HTTPS origins (no paths) to ALLOWED_ORIGINS, separated by commas.

## Storage

- Product, hero and campaign uploads: media.data (MEDIUMBLOB), kind=public; served by media.php.
- Bank receipts: media.data (MEDIUMBLOB), kind=proof. orders.proof_file stores the media ID. Only authenticated admins can retrieve receipt bytes. Knowing a media ID does not expose receipts publicly.
- Receipt replacement/deletion is transactional and locks the order row. A failed replacement rolls back without deleting the previous receipt.
- Uploaded images are validated as PNG/JPEG/WebP (public: 2 MB; receipts: 3 MB; maximum 40 megapixels). Public media references must exist in MySQL before product/settings/campaign save.
- Bundled supermarket/retail/restaurant product photographs are imported into MySQL automatically on the v8 migration. Existing custom product images are retained.
- Static branding assets (logo, favicon, social preview and decorative page artwork) remain bundled files so the website shell loads independently of MySQL. All admin-uploaded images and receipts are database-backed.
- Back up the complete MySQL database, including media BLOBs. The downloadable code ZIP is not a backup of live customer data.

## Troubleshooting

- “Backend not configured”: edit config.js with your actual PHP URL.
- “Cannot reach PHP backend”: check HTTPS certificate, hosting availability, and FRONTEND_URL/ALLOWED_ORIGINS. Some hosts put browser challenges in front of APIs; these must not block api.php/media.php.
- “Non-JSON response”: PHP is not running, api.php is missing, or the host returned an error/challenge page.
- “Database error”: check database/user/password/hostname and permissions on the PHP host. Consult the private PHP error log; DEBUG is off by default.
- “Database upgrade is busy”: retry after a few seconds.
- “Enable pdo_mysql”: enable the extension in your hosting PHP settings.
- Large upload fails: verify PHP/web server request limits and MySQL max_allowed_packet.

Single PHP host: leave OMNI_API_BASE empty, use the same PHP site for all pages, and set FRONTEND_URL accordingly.
Local PHP server: php -S 127.0.0.1:8080 router.php (requires an independently running MySQL server).
Nginx: deny access to internal PHP helpers/config, SQL, logs and dotfiles; .htaccess only applies to Apache.
