<?php
// Used only by PHP's built-in server:  php -S 127.0.0.1:8080 router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/(config|config\.local|helpers|catalog|router|create-admin)\.php$#', $path)
    || preg_match('#\.(sql|log|md|bat|sh)$#i', $path) || preg_match('#^/\.#', $path)) {
    http_response_code(403); echo 'Forbidden'; return true;
}
return false; // serve the requested file normally
