<?php
// PHP HOST ONLY: copy as config.local.php and enter your real values.
// Never upload config.local.php to GitHub, even through the web upload interface.
defined('OMNISTAQ') or exit;
define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'YOUR_HOSTING_DATABASE_NAME');
define('DB_USER', 'YOUR_DATABASE_USER');
define('DB_PASS', 'YOUR_DATABASE_PASSWORD');
define('DEBUG', false);
define('SETUP_KEY', 'REPLACE_WITH_A_LONG_RANDOM_SECRET');
define('BASE_URL', 'https://YOUR-PHP-HOST/omnistaq');
define('FRONTEND_URL', 'https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY');
// Origins have no repository path. FRONTEND_URL's origin is also allowed automatically.
define('ALLOWED_ORIGINS', 'https://YOUR-GITHUB-USERNAME.github.io');
