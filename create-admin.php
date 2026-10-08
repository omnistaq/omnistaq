<?php
// Set or reset the admin password from the command line:
//   C:\xampp\php\php.exe create-admin.php          (asks for the password)
//   php create-admin.php "MyNewPassword123"
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Run this file from the command line only.'); }
require __DIR__ . '/helpers.php';
try {
    $pw = $argv[1] ?? null;
    if ($pw === null) {
        echo 'New admin password (min ' . MIN_PASSWORD . " characters, it will be visible): ";
        $pw = trim((string)fgets(STDIN));
    }
    set_admin_password($pw);
    echo "Admin password saved. Sign in at admin.html\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}
