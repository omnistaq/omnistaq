<?php
// Diagnostic page - open http://localhost/OmniStaq-Website/check.php  (this computer only)
// Results are streamed line by line, so you can see exactly WHICH step is slow or failing.
if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) { http_response_code(403); exit('Local access only.'); }
@set_time_limit(60);
@ini_set('zlib.output_compression', '0');
@ini_set('implicit_flush', '1');
while (ob_get_level() > 0) { @ob_end_flush(); }
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Accel-Buffering: no');

function put($html) { echo $html; echo "\n"; @flush(); }
function row($label, $ok, $detail = '') {
    put('<tr><td>' . htmlspecialchars($label) . '</td><td class="' . ($ok ? 'ok' : 'bad') . '">' . ($ok ? '✔' : '✘') . '</td><td>' . htmlspecialchars($detail) . '</td></tr>');
}
function ms($t) { return round((microtime(true) - $t) * 1000) . ' ms'; }

put('<!doctype html><meta charset="utf-8"><title>OmniStaq check</title>');
put('<style>body{font:15px system-ui,sans-serif;background:#061a30;color:#e8f3fb;padding:32px}table{border-collapse:collapse;width:100%;max-width:960px}td{padding:9px 12px;border-bottom:1px solid #1d3f61;vertical-align:top}.ok{color:#3ee0a0}.bad{color:#ff7b7b}a{color:#22d7f8}.note{max-width:960px;color:#9fc0d8;margin:14px 0}.warn{background:#3b2a12;border:1px solid #8a6a2a;padding:10px 14px;border-radius:8px;max-width:960px}</style>');
put('<!-- ' . str_repeat('.', 1200) . ' -->');   // makes the browser start showing results immediately
put('<h1>OmniStaq – system check</h1><table>');

require_once __DIR__ . '/helpers.php';

row('PHP 7.4 or newer', version_compare(PHP_VERSION, '7.4.0', '>='), PHP_VERSION . ' (' . PHP_SAPI . ')');
foreach (['pdo_mysql', 'json', 'mbstring'] as $ext) {
    row("PHP extension: $ext", extension_loaded($ext), extension_loaded($ext) ? 'enabled' : ($ext === 'mbstring' ? 'optional' : 'enable it in php.ini (remove the ; before extension=pdo_mysql)'));
}
row('Website folder', true, ROOT_DIR . '   |   you opened it as: ' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/\\') . '/');
row('Session storage writable', is_writable((string)session_save_path() ?: sys_get_temp_dir()), (string)session_save_path() ?: sys_get_temp_dir());

// ---- step 1: is MySQL listening at all? (3 second limit)
$reachable = false;
$t = microtime(true);
$fp = @fsockopen(DB_HOST, DB_PORT, $errno, $errstr, 3);
if (!$fp) {
    row('MySQL is running on ' . DB_HOST . ':' . DB_PORT, false, 'Nothing is listening there (' . trim($errstr) . '). Open the XAMPP Control Panel and click START next to MySQL. If it turns red straight away, click Logs - another program may be using port 3306.');
} else {
    stream_set_timeout($fp, 3);
    $hello = @fread($fp, 1);
    fclose($fp);
    if ($hello === false || $hello === '') {
        row('MySQL answers connections', false, 'MySQL accepted the connection but did not reply within 3 seconds. In XAMPP click Stop, wait, then Start on MySQL.');
    } else {
        $reachable = true;
        row('MySQL is running on ' . DB_HOST . ':' . DB_PORT, true, 'answered in ' . ms($t));
    }
}

// ---- step 2: can we log in with the settings in config.php (or config.local.php)?
$loginOk = false;
if ($reachable) {
    $t = microtime(true);
    try {
        new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]);
        $loginOk = true;
        row('MySQL login (user "' . DB_USER . '")', true, 'ok in ' . ms($t));
    } catch (Throwable $e) {
        row('MySQL login (user "' . DB_USER . '")', false, $e->getMessage() . '  → check DB_USER / DB_PASS in config.php (or config.local.php)');
    }
}

// ---- step 3: create / upgrade the database
if ($loginOk) {
    put('<tr><td colspan="3" class="note">Preparing database "' . htmlspecialchars(DB_NAME) . '" … (first run can take a few seconds)</td></tr>');
    $t = microtime(true);
    try {
        $pdo = db();
        row('Database "' . DB_NAME . '" ready', true, ms($t));
        foreach (['admin', 'products', 'settings', 'campaign', 'demos', 'orders', 'media', 'events'] as $tbl) {
            $n = (int)$pdo->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn();
            row("Table $tbl", true, "$n rows");
        }
        $pk = (int)$pdo->query('SELECT @@max_allowed_packet')->fetchColumn();
        row('MySQL max_allowed_packet (receipt/image uploads)', $pk >= 8 * 1048576, round($pk / 1048576, 1) . ' MB' . ($pk >= 8 * 1048576 ? '' : '  → raise to 16M in my.ini / my.cnf under [mysqld]: max_allowed_packet=16M, then restart MySQL (needed for payment slips up to 3 MB)'));
        row('Admin account created', has_admin(), has_admin() ? 'yes' : 'not yet - open setup.html');
    } catch (Throwable $e) {
        row('Database "' . DB_NAME . '" ready', false, $e->getMessage());
        put('<tr><td colspan="3"><div class="warn">If this says "lock wait timeout" or stays stuck: open <b>http://localhost/phpmyadmin</b> → SQL tab → run <code>SHOW FULL PROCESSLIST</code>, <code>KILL</code> any stuck query, or simply STOP and START MySQL in XAMPP and reload this page.</div></td></tr>');
    }
}
put('</table>');
put('<p class="note"><a href="index.html">Website</a> · <a href="setup.html">Create admin</a> · <a href="admin.html">Admin</a></p>');
