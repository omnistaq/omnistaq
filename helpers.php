<?php
// Shared helpers. Not a page: never run directly.
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) { http_response_code(403); exit; }
define('OMNISTAQ', true);
require_once __DIR__ . '/config.php';
date_default_timezone_set(APP_TZ);

define('ROOT_DIR', __DIR__);
define('SESSION_AGE', 12 * 3600);
define('SCHEMA_VERSION', 8);
define('KINDS', ['pos', 'hardware', 'addon', 'service']);
define('KIND_ORDER_SQL', "FIELD(kind,'pos','hardware','addon','service')");
define('MEDIA_RE', '#^media\.php\?id=[a-f0-9]{32}$#');   // admin-uploaded images are stored in MySQL and served by media.php

const DEFAULT_SETTINGS = [
    'whatsapp' => '', 'bankName' => '', 'accountName' => '', 'accountNumber' => '', 'bankBranch' => '',
    'supportHours' => 'Monday – Saturday, 9 AM – 6 PM', 'heroImage' => '', 'demoVideo' => '',
    'setupText' => 'Installation and training tailored to your business.',
    'updateText' => 'Ask our team about the available update and support plans.',
];

class ApiError extends Exception {
    public $status;
    public function __construct($message, $status = 400) { parent::__construct($message); $this->status = $status; }
}

/* ---------- basic output ---------- */
function json_out($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function fail($message, $status = 400) { json_out(['error' => $message], $status); }

function clean($s, $limit = 200) {
    $s = trim((string)($s === null ? '' : $s));
    return function_exists('mb_substr') ? mb_substr($s, 0, $limit) : substr($s, 0, $limit);
}
function now_str() { return date('Y-m-d H:i:s'); }
function is_https() {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}
function site_base_url() {
    // Public address of this website (used in the tracking links sent to customers on WhatsApp).
    if (BASE_URL !== '') return rtrim(BASE_URL, '/');
    $host = (string)($_SERVER['HTTP_HOST'] ?? 'localhost');
    if (!preg_match('/^[A-Za-z0-9.\-:\[\]]+$/', $host)) $host = 'localhost';
    $dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');
    return (is_https() ? 'https' : 'http') . '://' . $host . $dir;
}
function new_order_token() { return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '='); }
function client_ip() { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }
function money_cents($v) {
    if (!is_numeric($v)) throw new ApiError('Invalid price');
    return (int) round(((float)$v) * 100);
}
function valid_date($s) {
    if ($s === '' || $s === null) return '';
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string)$s, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        throw new ApiError('Use a valid date (YYYY-MM-DD).');
    }
    return $s;
}
function valid_datetime($s) {
    $s = trim((string)$s);
    if ($s === '') return '';
    $t = strtotime(str_replace('T', ' ', $s));
    if ($t === false) throw new ApiError('Use a valid date and time.');
    return date('Y-m-d H:i:00', $t);
}
function body_json() {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) < 2 || strlen($raw) > 7 * 1024 * 1024) throw new ApiError('Request size is invalid.');
    $v = json_decode($raw, true);
    if (!is_array($v)) throw new ApiError('Invalid JSON request.');
    return $v;
}
function allowed_origin() {
    // Returns the request Origin when it is one of the front-end sites allowed to use this API, otherwise ''.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return '';
    $list = array_map(function ($x) { return rtrim(trim($x), '/'); }, explode(',', ALLOWED_ORIGINS . ',' . (FRONTEND_URL !== '' ? (parse_url(FRONTEND_URL, PHP_URL_SCHEME) . '://' . parse_url(FRONTEND_URL, PHP_URL_HOST) . (parse_url(FRONTEND_URL, PHP_URL_PORT) ? ':' . parse_url(FRONTEND_URL, PHP_URL_PORT) : '')) : '')));
    foreach ($list as $a) if ($a !== '' && strcasecmp($a, $origin) === 0) return $origin;
    return '';
}
function frontend_url() { return FRONTEND_URL !== '' ? rtrim(FRONTEND_URL, '/') : site_base_url(); }
function same_origin() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    if (allowed_origin() !== '') return true;
    $p = parse_url($origin);
    if (!$p || empty($p['host'])) return false;
    $host = $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    return strcasecmp($host, $_SERVER['HTTP_HOST'] ?? '') === 0;
}

/* ---------- database ---------- */
function db() {
    static $pdo = null;
    if ($pdo) return $pdo;
    $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
    $opts[PDO::ATTR_TIMEOUT] = 5;                                   // give up connecting after 5 s instead of waiting forever
    if (defined('PDO::MYSQL_ATTR_READ_TIMEOUT')) $opts[PDO::MYSQL_ATTR_READ_TIMEOUT] = 25;   // and stop waiting for a stuck query
    if (!extension_loaded('pdo_mysql')) throw new ApiError('Enable the PHP pdo_mysql extension on your PHP host.', 503);
    $base = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
    try {
        $pdo = new PDO($base . ';dbname=' . DB_NAME, DB_USER, DB_PASS, $opts);
    } catch (PDOException $e) {
        if ((string)$e->getCode() === '1049' || strpos($e->getMessage(), 'Unknown database') !== false) {
            $tmp = new PDO($base, DB_USER, DB_PASS, $opts);
            $tmp->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '``', DB_NAME) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $pdo = new PDO($base . ';dbname=' . DB_NAME, DB_USER, DB_PASS, $opts);
        } else {
            throw $e;
        }
    }
    try { $pdo->exec('SET SESSION lock_wait_timeout=10, SESSION innodb_lock_wait_timeout=10'); } catch (PDOException $e) { /* older servers */ }
    try { ensure_schema($pdo); } catch (Throwable $e) { $pdo = null; throw $e; }   // do not cache a half-prepared connection
    return $pdo;
}

function schema_sql() {
    $t = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    return [
        "CREATE TABLE IF NOT EXISTS admin (id TINYINT UNSIGNED NOT NULL PRIMARY KEY, password_hash VARCHAR(255) NOT NULL, updated_at DATETIME NOT NULL) $t",
        "CREATE TABLE IF NOT EXISTS rate_hits (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, bucket VARCHAR(40) NOT NULL, ip VARCHAR(45) NOT NULL, ts INT UNSIGNED NOT NULL, KEY idx_rate (bucket, ip, ts)) $t",
        "CREATE TABLE IF NOT EXISTS settings (k VARCHAR(60) NOT NULL PRIMARY KEY, v TEXT NOT NULL) $t",
        "CREATE TABLE IF NOT EXISTS products (id VARCHAR(90) NOT NULL PRIMARY KEY, name VARCHAR(70) NOT NULL, category VARCHAR(40) NOT NULL DEFAULT '', kind VARCHAR(12) NOT NULL DEFAULT 'pos', description VARCHAR(400) NOT NULL, features TEXT NOT NULL, price_cents BIGINT UNSIGNED NOT NULL DEFAULT 0, discount TINYINT UNSIGNED NOT NULL DEFAULT 0, discount_start DATE NULL, discount_end DATE NULL, featured TINYINT(1) NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, icon VARCHAR(16) NOT NULL DEFAULT '', image_url VARCHAR(300) NOT NULL DEFAULT '', created_at DATETIME NOT NULL) $t",
        "CREATE TABLE IF NOT EXISTS campaign (id TINYINT UNSIGNED NOT NULL PRIMARY KEY, active TINYINT(1) NOT NULL DEFAULT 0, title VARCHAR(80) NOT NULL DEFAULT '', message VARCHAR(300) NOT NULL DEFAULT '', discount_text VARCHAR(40) NOT NULL DEFAULT '', cta_label VARCHAR(40) NOT NULL DEFAULT '', image_url VARCHAR(300) NOT NULL DEFAULT '', start_at DATETIME NULL, end_at DATETIME NULL, updated_at DATETIME NOT NULL) $t",
        "CREATE TABLE IF NOT EXISTS demos (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ref VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL, phone VARCHAR(30) NOT NULL, business VARCHAR(80) NOT NULL DEFAULT '', shop_type VARCHAR(50) NOT NULL DEFAULT '', message VARCHAR(600) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'new', notes VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, KEY idx_demo_created (created_at)) $t",
        "CREATE TABLE IF NOT EXISTS orders (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ref VARCHAR(30) NOT NULL UNIQUE, access_hash CHAR(64) NOT NULL, name VARCHAR(80) NOT NULL, phone VARCHAR(30) NOT NULL, email VARCHAR(120) NOT NULL DEFAULT '', business VARCHAR(80) NOT NULL DEFAULT '', business_type VARCHAR(60) NOT NULL DEFAULT '', business_categories TEXT NULL, address VARCHAR(150) NOT NULL DEFAULT '', city VARCHAR(80) NOT NULL DEFAULT '', payment_method VARCHAR(10) NOT NULL, items MEDIUMTEXT NOT NULL, amount_cents BIGINT UNSIGNED NULL, status VARCHAR(20) NOT NULL, proof_file VARCHAR(80) NOT NULL DEFAULT '', access_token VARCHAR(64) NOT NULL DEFAULT '', admin_notes VARCHAR(1000) NOT NULL DEFAULT '', gateway_payment_id VARCHAR(100) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, KEY idx_order_created (created_at)) $t",
        "CREATE TABLE IF NOT EXISTS media (id CHAR(32) NOT NULL PRIMARY KEY, kind VARCHAR(10) NOT NULL DEFAULT 'public', mime VARCHAR(30) NOT NULL, size INT UNSIGNED NOT NULL, data MEDIUMBLOB NOT NULL, created_at DATETIME NOT NULL, KEY idx_media_kind (kind)) $t",
        "CREATE TABLE IF NOT EXISTS events (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, type VARCHAR(30) NOT NULL, created_at DATETIME NOT NULL, KEY idx_event (type, created_at)) $t",
    ];
}

function schema_version(PDO $pdo) {
    try { $r = $pdo->query("SELECT v FROM settings WHERE k='schema_version'")->fetch(); return $r ? (int)$r['v'] : 0; }
    catch (PDOException $e) { return 0; }
}
function ensure_schema(PDO $pdo) {
    if (schema_version($pdo) >= SCHEMA_VERSION) return;
    // only ONE request may build/upgrade the tables at a time (parallel page requests used to block each other)
    $got = (int)$pdo->query("SELECT GET_LOCK('omnistaq_schema', 15)")->fetchColumn();
    if ($got !== 1) throw new ApiError('Database upgrade is busy. Retry in a few seconds.', 503);
    try {
        if (schema_version($pdo) >= SCHEMA_VERSION) return;      // another request finished it while we waited
        foreach (schema_sql() as $sql) $pdo->exec($sql);          // IF NOT EXISTS: safe on existing installs
        migrate_columns($pdo);
        seed_defaults($pdo);
        seed_catalog_images($pdo);
        $pdo->prepare('INSERT INTO settings(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)')->execute(['schema_version', (string)SCHEMA_VERSION]);
    } finally {
        if ($got) { $pdo->query("SELECT RELEASE_LOCK('omnistaq_schema')")->fetchColumn(); }
    }
}

function add_column_if_missing(PDO $pdo, $table, $column, $definition) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
    $st->execute([$table, $column]);
    if ((int)$st->fetchColumn() === 0) {
        try { $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition"); } catch (PDOException $e) { /* created by a parallel request */ }
    }
}
function migrate_columns(PDO $pdo) {
    add_column_if_missing($pdo, 'products', 'kind', "VARCHAR(12) NOT NULL DEFAULT 'pos'");
    add_column_if_missing($pdo, 'orders', 'business_type', "VARCHAR(60) NOT NULL DEFAULT ''");
    add_column_if_missing($pdo, 'orders', 'business_categories', 'TEXT NULL');
    add_column_if_missing($pdo, 'orders', 'access_token', "VARCHAR(64) NOT NULL DEFAULT ''");
    try { $pdo->exec("ALTER TABLE products MODIFY category VARCHAR(40) NOT NULL DEFAULT ''"); } catch (PDOException $e) {}
}

function seed_defaults(PDO $pdo) {
    $st = $pdo->prepare('INSERT IGNORE INTO settings(k,v) VALUES(?,?)');
    foreach (DEFAULT_SETTINGS as $k => $v) $st->execute([$k, $v]);
    $pdo->prepare("INSERT IGNORE INTO campaign(id,active,title,message,discount_text,cta_label,image_url,updated_at) VALUES(1,0,?,?,?,?,'',?)")
        ->execute(['A special offer for your business', 'Chat with our team to learn more about this offer.', 'SPECIAL OFFER', 'Claim this offer', now_str()]);
    // The old generic "POS Hardware" starter card is replaced by the individual hardware items (only if untouched).
    $pdo->prepare("DELETE FROM products WHERE id='pos-hardware' AND name='POS Hardware' AND price_cents=0")->execute();
    $ins = $pdo->prepare('INSERT IGNORE INTO products(id,kind,name,category,description,features,price_cents,discount,featured,active,sort_order,icon,created_at) VALUES(?,?,?,?,?,?,0,0,?,1,?,?,?)');
    $i = 0;
    foreach (require __DIR__ . '/catalog.php' as $r) {
        $i++;
        $ins->execute([$r[0], $r[1], $r[2], $r[3], $r[4], json_encode($r[5], JSON_UNESCAPED_UNICODE), $r[7], $i, $r[6], now_str()]);
    }
}

// One-time v8 migration: retain custom uploads and copy supplied catalogue photographs into MySQL.
function seed_catalog_images(PDO $pdo) {
    foreach (['supermarket-pos'=>'retail-pos.webp', 'retail-pos'=>'retail-pos.webp', 'restaurant-pos'=>'restaurant-pos.webp'] as $product => $file) {
        $st = $pdo->prepare('SELECT image_url FROM products WHERE id=?'); $st->execute([$product]);
        if ($st->fetchColumn() !== '') continue;
        $bin = file_get_contents(__DIR__ . '/' . $file);
        if ($bin === false) throw new ApiError('Missing bundled image: ' . $file, 503);
        $id = md5('omnistaq-bundled-v4:' . $file);
        $ins = $pdo->prepare("INSERT IGNORE INTO media(id,kind,mime,size,data,created_at) VALUES(?,'public','image/webp',?,?,?)");
        $ins->execute([$id, strlen($bin), $bin, now_str()]);
        $pdo->prepare("UPDATE products SET image_url=? WHERE id=? AND image_url=''")->execute([media_url($id), $product]);
    }
}

/* ---------- settings ---------- */
function get_settings() {
    $out = DEFAULT_SETTINGS;
    foreach (db()->query('SELECT k,v FROM settings')->fetchAll() as $r) {
        if (array_key_exists($r['k'], DEFAULT_SETTINGS)) $out[$r['k']] = $r['v'];
    }
    return $out;
}
function save_settings(array $values) {
    $st = db()->prepare('INSERT INTO settings(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)');
    foreach ($values as $k => $v) $st->execute([$k, $v]);
}

/* ---------- sessions / admin auth ---------- */
function start_session() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.gc_maxlifetime', (string)SESSION_AGE);
    ini_set('session.use_strict_mode', '1');
    session_name('omnistaq_session');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
function admin_session() {
    start_session();
    if (empty($_SESSION['admin'])) return null;
    if (time() - (int)($_SESSION['seen'] ?? 0) > SESSION_AGE) { $_SESSION = []; return null; }
    $_SESSION['seen'] = time();
    return ['csrf' => $_SESSION['csrf']];
}
function require_admin($write) {
    $s = admin_session();
    if (!$s) fail('Your session expired. Please sign in again.', 401);
    if ($write) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!hash_equals($s['csrf'], (string)$token)) fail('Security token expired. Refresh the page and sign in again.', 403);
    }
}
function has_admin() { return (bool) db()->query('SELECT 1 FROM admin WHERE id=1')->fetch(); }
function set_admin_password($password, $onlyIfMissing = false) {
    if (strlen($password) < MIN_PASSWORD) throw new ApiError('Use at least ' . MIN_PASSWORD . ' characters for the admin password.');
    if ($onlyIfMissing && has_admin()) throw new ApiError('Admin is already configured.', 403);
    $sql = 'INSERT INTO admin(id,password_hash,updated_at) VALUES(1,?,?)';
    if (!$onlyIfMissing) $sql .= ' ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), updated_at=VALUES(updated_at)';
    try { db()->prepare($sql)->execute([password_hash($password, PASSWORD_DEFAULT), now_str()]); }
    catch (PDOException $e) { if ($onlyIfMissing && (int)($e->errorInfo[1] ?? 0) === 1062) throw new ApiError('Admin is already configured.', 409); throw $e; }
}

/* ---------- rate limiting ---------- */
function rate_count($bucket, $window = 900) {
    $st = db()->prepare('SELECT COUNT(*) FROM rate_hits WHERE bucket=? AND ip=? AND ts>?');
    $st->execute([$bucket, client_ip(), time() - $window]);
    return (int)$st->fetchColumn();
}
function rate_hit($bucket) {
    db()->prepare('INSERT INTO rate_hits(bucket,ip,ts) VALUES(?,?,?)')->execute([$bucket, client_ip(), time()]);
    if (mt_rand(1, 40) === 1) db()->prepare('DELETE FROM rate_hits WHERE ts<?')->execute([time() - 86400]);
}
function public_rate_limit($bucket, $max) {
    if (rate_count($bucket) >= $max) throw new ApiError('Too many requests. Please try again later.', 429);
    rate_hit($bucket);
}

/* ---------- images (stored inside MySQL, table "media") ---------- */
function media_save($dataUri, $kind = 'public', $limit = 2097152) {
    $comma = is_string($dataUri) ? strpos($dataUri, ',') : false;
    $map = ['data:image/png;base64' => 'image/png', 'data:image/jpeg;base64' => 'image/jpeg', 'data:image/webp;base64' => 'image/webp'];
    $mime = $comma === false ? null : ($map[strtolower(substr($dataUri, 0, $comma))] ?? null);
    if ($mime === null) throw new ApiError('Upload a PNG, JPG or WebP image.');
    $bin = base64_decode(substr($dataUri, $comma + 1), true);
    if ($bin === false) throw new ApiError('Invalid image data.');
    if (strlen($bin) < 32 || strlen($bin) > $limit) throw new ApiError('Image must be under ' . round($limit / 1048576) . ' MB.');
    $ok = $mime === 'image/png' ? strncmp($bin, "\x89PNG\r\n\x1a\n", 8) === 0
        : ($mime === 'image/jpeg' ? strncmp($bin, "\xff\xd8\xff", 3) === 0 : (substr($bin, 0, 4) === 'RIFF' && substr($bin, 8, 4) === 'WEBP'));
    if (!$ok) throw new ApiError('Image type does not match its content.');
    $info = @getimagesizefromstring($bin);
    if (!$info || ($info['mime'] ?? '') !== $mime || $info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > 40000000) throw new ApiError('Invalid image or image exceeds 40 megapixels.');
    $id = bin2hex(random_bytes(16));
    try {
        $st = db()->prepare('INSERT INTO media(id,kind,mime,size,data,created_at) VALUES(?,?,?,?,?,?)');
        $st->bindValue(1, $id); $st->bindValue(2, $kind); $st->bindValue(3, $mime);
        $st->bindValue(4, strlen($bin), PDO::PARAM_INT); $st->bindValue(5, $bin, PDO::PARAM_LOB); $st->bindValue(6, now_str());
        $st->execute();
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'max_allowed_packet') !== false || (int)($e->errorInfo[1] ?? 0) === 1153) {
            throw new ApiError('The database refused this image because it is too large for MySQL setting "max_allowed_packet". Use a smaller image, or raise max_allowed_packet to 16M.', 413);
        }
        throw $e;
    }
    return $id;
}
function media_url($id) { return 'media.php?id=' . $id; }
function media_delete($id) {
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/', $id)) return;
    db()->prepare('DELETE FROM media WHERE id=?')->execute([$id]);
}
function media_release($url) {
    // Delete an uploaded image from the database once nothing references it any more.
    if (!$url || !preg_match(MEDIA_RE, $url)) return;
    $st = db()->prepare("SELECT (SELECT COUNT(*) FROM products WHERE image_url=?) + (SELECT COUNT(*) FROM campaign WHERE image_url=?) + (SELECT COUNT(*) FROM settings WHERE k='heroImage' AND v=?)");
    $st->execute([$url, $url, $url]);
    if ((int)$st->fetchColumn() === 0) media_delete(substr($url, strlen('media.php?id=')));
}
function safe_media($url) {
    $url = clean($url, 300);
    if ($url !== '' && !preg_match(MEDIA_RE, $url)) throw new ApiError('Upload images through the admin form.');
    if ($url !== '') {
        $st = db()->prepare("SELECT 1 FROM media WHERE id=? AND kind='public'");
        $st->execute([substr($url, strlen('media.php?id='))]);
        if (!$st->fetchColumn()) throw new ApiError('This image is missing. Upload it again before saving.');
    }
    return $url;
}

/* ---------- product / order views ---------- */
function effective_discount(array $r) {
    $d = (int)$r['discount'];
    if ($d <= 0) return 0;
    $today = date('Y-m-d');
    if (!empty($r['discount_start']) && $today < $r['discount_start']) return 0;
    if (!empty($r['discount_end']) && $today > $r['discount_end']) return 0;
    return $d;
}
function product_view(array $r, $admin = false) {
    $p = [
        'id' => $r['id'], 'kind' => $r['kind'] ?? 'pos', 'name' => $r['name'], 'category' => $r['category'], 'description' => $r['description'],
        'features' => json_decode($r['features'], true) ?: [], 'price' => $r['price_cents'] / 100,
        'discount' => effective_discount($r), 'discountEnds' => $r['discount_end'] ?: '',
        'featured' => (bool)$r['featured'], 'icon' => $r['icon'], 'image' => $r['image_url'],
    ];
    if ($admin) {
        $p['rawDiscount'] = (int)$r['discount']; $p['discountStart'] = $r['discount_start'] ?: ''; $p['discountEnd'] = $r['discount_end'] ?: '';
        $p['active'] = (bool)$r['active']; $p['sortOrder'] = (int)$r['sort_order'];
    }
    return $p;
}
function order_view(array $r, $admin = false) {
    $o = [
        'ref' => $r['ref'], 'name' => $r['name'], 'phone' => $r['phone'], 'email' => $r['email'], 'business' => $r['business'],
        'address' => $r['address'], 'city' => $r['city'], 'payment_method' => $r['payment_method'], 'status' => $r['status'],
        'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
        'businessType' => $r['business_type'] ?? '', 'businessCategories' => json_decode($r['business_categories'] ?? '[]', true) ?: [],
        'items' => json_decode($r['items'], true) ?: [], 'amount' => $r['amount_cents'] === null ? null : $r['amount_cents'] / 100,
        'hasProof' => $r['proof_file'] !== '',
    ];
    if ($admin) {
        $o['proofUrl'] = $r['proof_file'] !== '' ? 'api.php?r=admin/orders/' . rawurlencode($r['ref']) . '/proof' : '';
        $o['notes'] = $r['admin_notes'];
    }
    return $o;
}
function campaign_view(array $c, $admin = false) {
    $now = date('Y-m-d H:i:s');
    $live = (bool)$c['active'] && (empty($c['start_at']) || $now >= $c['start_at']) && (empty($c['end_at']) || $now <= $c['end_at']);
    $v = [
        'active' => $admin ? (bool)$c['active'] : $live, 'title' => $c['title'], 'message' => $c['message'],
        'discountText' => $c['discount_text'], 'ctaLabel' => $c['cta_label'], 'image' => $c['image_url'],
        'version' => md5($c['updated_at']),
    ];
    if ($admin) {
        $v['live'] = $live;
        $v['startAt'] = $c['start_at'] ? date('Y-m-d\TH:i', strtotime($c['start_at'])) : '';
        $v['endAt'] = $c['end_at'] ? date('Y-m-d\TH:i', strtotime($c['end_at'])) : '';
    }
    return $v;
}

/* ---------- PayHere ---------- */
function gateway_configured() { return PAYHERE_MERCHANT_ID !== '' && PAYHERE_MERCHANT_SECRET !== '' && BASE_URL !== ''; }
function gateway_checkout(array $row) {
    if (!gateway_configured() || $row['amount_cents'] === null || (int)$row['amount_cents'] <= 0) return null;
    $base = rtrim(BASE_URL, '/');
    $amount = number_format($row['amount_cents'] / 100, 2, '.', '');
    $inner = strtoupper(md5(PAYHERE_MERCHANT_SECRET));
    $hash = strtoupper(md5(PAYHERE_MERCHANT_ID . $row['ref'] . $amount . 'LKR' . $inner));
    $names = preg_split('/\s+/', trim($row['name']), 2);
    return [
        'action' => PAYHERE_MODE === 'live' ? 'https://www.payhere.lk/pay/checkout' : 'https://sandbox.payhere.lk/pay/checkout',
        'fields' => [
            'merchant_id' => PAYHERE_MERCHANT_ID, 'return_url' => frontend_url() . '/order.html?ref=' . $row['ref'], 'cancel_url' => frontend_url() . '/order.html?ref=' . $row['ref'],
            'notify_url' => $base . '/api.php?r=payhere/notify', 'order_id' => $row['ref'], 'items' => 'OmniStaq POS order ' . $row['ref'],
            'currency' => 'LKR', 'amount' => $amount, 'hash' => $hash, 'first_name' => $names[0], 'last_name' => $names[1] ?? 'Customer',
            'email' => $row['email'], 'phone' => $row['phone'], 'address' => $row['address'] ?: 'Sri Lanka', 'city' => $row['city'] ?: 'Colombo', 'country' => 'Sri Lanka',
        ],
    ];
}
