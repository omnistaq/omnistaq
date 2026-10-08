<?php
defined('OMNISTAQ') or exit;
/*
 * OmniStaq - configuration
 *
 * Do NOT put real passwords in this file if you upload the project to GitHub.
 * Instead use ONE of these (both are optional and override the defaults below):
 *   1) create a file named  config.local.php  next to this file (it is git-ignored):
 *          <?php
 *          define('DB_HOST', 'localhost');
 *          define('DB_NAME', 'omnistaq');
 *          define('DB_USER', 'my_user');
 *          define('DB_PASS', 'my_password');
 *   2) set environment variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, BASE_URL, DEBUG ...
 *
 * XAMPP defaults (user "root", empty password) work without any change.
 */
if (is_file(__DIR__ . '/config.local.php')) { require __DIR__ . '/config.local.php'; }

function omni_env($key, $default) {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
}
function omni_define($name, $default) { if (!defined($name)) define($name, omni_env($name, $default)); }

omni_define('DB_HOST', '127.0.0.1');
omni_define('DB_PORT', 3306);
omni_define('DB_NAME', 'omnistaq');      // created automatically on first visit (if the MySQL user may create databases)
omni_define('DB_USER', 'root');
omni_define('DB_PASS', '');

omni_define('APP_TZ', 'Asia/Colombo');
omni_define('MIN_PASSWORD', 10);         // admin password minimum length

// Show technical error details in API responses. Set DEBUG=0 (or define it false) on a public server.
if (!defined('DEBUG')) define('DEBUG', !in_array(strtolower((string)omni_env('DEBUG', '0')), ['0', 'false', 'off', 'no'], true));

// Card payments (PayHere) - leave empty to keep card checkout disabled.
omni_define('BASE_URL', '');             // e.g. https://www.yourdomain.lk  (no trailing slash)
// Static front-end (GitHub Pages) + this PHP backend on another host:
//   FRONTEND_URL    = address of the front-end pages, used in customer tracking links (e.g. https://omnistaq.github.io/omnistaq)
//   ALLOWED_ORIGINS = comma separated sites allowed to call api.php from the browser
omni_define('FRONTEND_URL', '');
omni_define('ALLOWED_ORIGINS', '');

// First-time admin setup on a live (non-local) server needs this secret, so nobody else can claim the admin account.
// Put e.g.  define('SETUP_KEY', 'a-long-random-text');  in config.local.php, then type it on setup.html.
omni_define('SETUP_KEY', '');

omni_define('PAYHERE_MERCHANT_ID', '');
omni_define('PAYHERE_MERCHANT_SECRET', '');
omni_define('PAYHERE_MODE', 'sandbox');  // sandbox or live
