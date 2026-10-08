<?php
/* OmniStaq JSON API – single entry point:  api.php?r=<route> */
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require_once __DIR__ . '/helpers.php';
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
// CORS: lets the static front-end (e.g. GitHub Pages) call this API. No cookies are shared cross-site: the admin panel runs on this host.
$corsOrigin = allowed_origin();
if ($corsOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $corsOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Order-Token, X-CSRF-Token');
    header('Access-Control-Max-Age: 86400');
}
if ($method === 'OPTIONS') { http_response_code($corsOrigin !== '' ? 204 : 403); exit; }
$route = trim((string)($_GET['r'] ?? ''), '/');
$parts = $route === '' ? [] : explode('/', $route);
$path = $route;

try {
    if (in_array($method, ['POST', 'PUT', 'DELETE'], true) && $path !== 'payhere/notify' && !same_origin()) fail('Invalid request origin.', 403);
    if (isset($parts[0]) && $parts[0] === 'admin' && $path !== 'admin/login') require_admin($method !== 'GET');
    route_request($method, $path, $parts);
    fail('API route not found.', 404);
} catch (ApiError $e) {
    fail($e->getMessage(), $e->status);
} catch (PDOException $e) {
    error_log('DB error: ' . $e->getMessage());
    $hint = 'Database error. Make sure MySQL is running and the DB settings in config.php (or config.local.php) are correct.';
    fail(DEBUG ? $hint . ' [' . $e->getMessage() . ']' : $hint, 500);
} catch (Throwable $e) {
    error_log('Server error: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail(DEBUG ? 'Server error: ' . $e->getMessage() : 'Server error. Please try again.', 500);
}

function route_request($method, $path, $parts) {
    $n = count($parts);
    $pdo = null;

    if ($path === 'health' && $method === 'GET') { db(); json_out(['ok'=>true, 'app'=>'OmniStaq', 'version'=>'4.0.0', 'database'=>'connected', 'mediaStorage'=>'mysql']); }
    if ($path === 'setup/status' && $method === 'GET') json_out(['needed' => !has_admin(), 'needKey' => !in_array(client_ip(), ['127.0.0.1', '::1'], true)]);
    if ($path === 'setup' && $method === 'POST') return api_setup();
    if ($path === 'config' && $method === 'GET') return api_config();
    if ($path === 'demos' && $method === 'POST') { public_rate_limit('demo', 6); return api_demo(); }
    if ($path === 'orders' && $method === 'POST') { public_rate_limit('order', 6); return api_create_order(); }
    if ($path === 'events' && $method === 'POST') return api_event();
    if ($parts && $parts[0] === 'orders' && $n === 2 && $method === 'GET') return api_get_order($parts[1]);
    if ($parts && $parts[0] === 'orders' && $n === 3 && $parts[2] === 'proof' && $method === 'POST') { public_rate_limit('proof', 10); return api_upload_proof($parts[1]); }
    if ($path === 'payhere/notify' && $method === 'POST') return api_payhere_notify();

    if ($path === 'admin/login' && $method === 'POST') return api_login();
    if ($path === 'admin/me' && $method === 'GET') { $s = admin_session(); json_out(['csrf' => $s['csrf']]); }
    if ($path === 'admin/logout' && $method === 'POST') return api_logout();
    if ($path === 'admin/overview' && $method === 'GET') return api_overview();
    if ($path === 'admin/products' && $method === 'POST') return api_save_product();
    if ($n === 3 && $parts[0] === 'admin' && $parts[1] === 'products' && $method === 'DELETE') {
        $st = db()->prepare('SELECT image_url FROM products WHERE id=?'); $st->execute([$parts[2]]); $img = (string)$st->fetchColumn();
        db()->prepare('DELETE FROM products WHERE id=?')->execute([$parts[2]]);
        media_release($img);
        json_out(['ok' => true]);
    }
    if ($path === 'admin/settings' && $method === 'PUT') return api_save_settings();
    if ($path === 'admin/campaign' && $method === 'PUT') return api_save_campaign();
    if ($path === 'admin/upload' && $method === 'POST') {
        $id = media_save(body_json()['image'] ?? '', 'public');
        json_out(['url' => media_url($id)], 201);
    }
    if ($path === 'admin/password' && $method === 'PUT') return api_change_password();
    if ($n === 3 && $parts[0] === 'admin' && $parts[1] === 'demos') {
        if ($method === 'PUT') return api_update_demo($parts[2]);
        if ($method === 'DELETE') { db()->prepare('DELETE FROM demos WHERE ref=?')->execute([$parts[2]]); json_out(['ok' => true]); }
    }
    if ($n === 3 && $parts[0] === 'admin' && $parts[1] === 'orders' && $method === 'PUT') return api_update_order($parts[2]);
    if ($n === 4 && $parts[0] === 'admin' && $parts[1] === 'orders' && $parts[3] === 'link' && $method === 'POST') return api_order_link($parts[2]);
    if ($n === 4 && $parts[0] === 'admin' && $parts[1] === 'orders' && $parts[3] === 'proof' && $method === 'GET') return api_proof($parts[2]);
    if ($n === 4 && $parts[0] === 'admin' && $parts[1] === 'orders' && $parts[3] === 'proof' && $method === 'DELETE') return api_delete_proof($parts[2]);
    if ($n === 3 && $parts[0] === 'admin' && $parts[1] === 'export' && $method === 'GET') return api_export($parts[2]);
}

/* ================= setup & auth ================= */
function api_setup() {
    public_rate_limit('setup', 12);
    $b = body_json();
    if (!in_array(client_ip(), ['127.0.0.1', '::1'], true)) {   // live server: a secret setup key proves you own the server
        if (SETUP_KEY === '') throw new ApiError("To create the admin on a live server, first add  define('SETUP_KEY', 'a-long-random-text');  to config.local.php on the server, then try again.", 403);
        if (!hash_equals(SETUP_KEY, (string)($b['setupKey'] ?? ''))) throw new ApiError('Wrong setup key.', 403);
    }
    $password = (string)($b['password'] ?? ''); $confirm = (string)($b['confirm'] ?? '');
    if ($password !== $confirm) throw new ApiError('The passwords do not match.');
    set_admin_password($password, true);
    json_out(['ok' => true], 201);
}
function api_login() {
    if (rate_count('login_fail') >= 8) throw new ApiError('Too many failed attempts. Please wait 15 minutes and try again.', 429);
    $password = (string)(body_json()['password'] ?? '');
    $row = db()->query('SELECT password_hash FROM admin WHERE id=1')->fetch();
    if (!$row) throw new ApiError('Admin is not set up yet. Open setup.html first.', 409);
    if ($password === '' || !password_verify($password, $row['password_hash'])) {
        rate_hit('login_fail');
        throw new ApiError('Incorrect password.', 401);
    }
    db()->prepare("DELETE FROM rate_hits WHERE bucket='login_fail' AND ip=?")->execute([client_ip()]);
    start_session();
    session_regenerate_id(true);
    $_SESSION = ['admin' => true, 'csrf' => bin2hex(random_bytes(24)), 'seen' => time()];
    if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) set_admin_password($password);
    json_out(['csrf' => $_SESSION['csrf']]);
}
function api_logout() {
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    }
    session_destroy();
    json_out(['ok' => true]);
}
function api_change_password() {
    $b = body_json();
    $row = db()->query('SELECT password_hash FROM admin WHERE id=1')->fetch();
    if (!$row || !password_verify((string)($b['current'] ?? ''), $row['password_hash'])) throw new ApiError('Current password is incorrect.', 403);
    set_admin_password((string)($b['next'] ?? ''));
    start_session();
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

/* ================= public ================= */
function api_config() {
    $pdo = db();
    $products = array_map('product_view', $pdo->query('SELECT * FROM products WHERE active=1 ORDER BY ' . KIND_ORDER_SQL . ', featured DESC, sort_order ASC, created_at ASC')->fetchAll());
    $camp = $pdo->query('SELECT * FROM campaign WHERE id=1')->fetch();
    $s = get_settings();
    unset($s['seeded']);
    json_out(['products' => $products, 'settings' => $s, 'campaign' => campaign_view($camp), 'cardEnabled' => gateway_configured()]);
}
function api_event() {
    $type = clean(body_json()['type'] ?? '', 30);
    if (!in_array($type, ['whatsapp', 'cta_demo', 'cart_add'], true)) throw new ApiError('Unknown event.');
    if (rate_count('event', 600) < 60) { rate_hit('event'); db()->prepare('INSERT INTO events(type,created_at) VALUES(?,?)')->execute([$type, now_str()]); }
    json_out(['ok' => true]);
}
function api_demo() {
    $b = body_json();
    $name = clean($b['name'] ?? '', 80); $phone = clean($b['phone'] ?? '', 30);
    $digits = strlen(preg_replace('/\D/', '', $phone));
    if (strlen($name) < 2 || $digits < 7 || $digits > 15) throw new ApiError('Enter your name and a valid phone number.');
    $ref = 'DM-' . strtoupper(bin2hex(random_bytes(4)));
    db()->prepare('INSERT INTO demos(ref,name,phone,business,shop_type,message,created_at) VALUES(?,?,?,?,?,?,?)')
        ->execute([$ref, $name, $phone, clean($b['business'] ?? '', 80), clean($b['shopType'] ?? '', 50), clean($b['message'] ?? '', 500), now_str()]);
    json_out(['ref' => $ref, 'message' => 'Demo request received. Our team will contact you.'], 201);
}
function bank_details() {
    $s = get_settings();
    return ['bankName' => $s['bankName'], 'accountName' => $s['accountName'], 'accountNumber' => $s['accountNumber'], 'bankBranch' => $s['bankBranch']];
}
function api_create_order() {
    $b = body_json();
    $name = clean($b['name'] ?? '', 80); $phone = clean($b['phone'] ?? '', 30); $email = clean($b['email'] ?? '', 120);
    $method = $b['paymentMethod'] ?? '';
    $digits = strlen(preg_replace('/\D/', '', $phone));
    if (strlen($name) < 2 || $digits < 7 || $digits > 15) throw new ApiError('Enter your name and a valid phone number.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new ApiError('Enter a valid email address.');
    if (!in_array($method, ['bank', 'card'], true)) throw new ApiError('Choose a payment method.');
    if ($method === 'card' && ($email === '' || clean($b['address'] ?? '') === '' || clean($b['city'] ?? '') === '')) throw new ApiError('Card checkout requires email, address and city.');

    // basket lines: [{id, qty}]  (legacy productIds[] is still accepted)
    $lines = [];
    if (isset($b['items']) && is_array($b['items'])) {
        foreach ($b['items'] as $it) {
            if (!is_array($it)) continue;
            $id = (string)($it['id'] ?? ''); $qty = (int)($it['qty'] ?? 1);
            if ($id === '' || isset($lines[$id])) throw new ApiError('Your basket has an invalid or duplicate item.');
            if ($qty < 1 || $qty > 99) throw new ApiError('Quantity must be between 1 and 99.');
            $lines[$id] = $qty;
        }
    } elseif (isset($b['productIds']) && is_array($b['productIds'])) {
        foreach ($b['productIds'] as $id) $lines[(string)$id] = 1;
    }
    if (count($lines) < 1 || count($lines) > 40) throw new ApiError('Choose at least one POS system, device or service.');

    $cats = [];
    foreach ((array)($b['businessCategories'] ?? []) as $c) { $c = clean($c, 40); if ($c !== '' && !in_array($c, $cats, true)) $cats[] = $c; }
    $cats = array_slice($cats, 0, 40);

    $pdo = db();
    $find = $pdo->prepare('SELECT * FROM products WHERE id=? AND active=1');
    $items = []; $total = 0; $quoted = false;
    foreach ($lines as $id => $qty) {
        $find->execute([$id]); $p = $find->fetch();
        if (!$p) throw new ApiError('One of the selected items is no longer available. Please refresh the page.');
        $disc = effective_discount($p);
        $unit = intdiv((int)$p['price_cents'] * (100 - $disc) + 50, 100);
        if ((int)$p['price_cents'] === 0) $quoted = true; else $total += $unit * $qty;
        $items[] = ['id' => $p['id'], 'name' => $p['name'], 'kind' => $p['kind'], 'qty' => $qty,
            'unit' => (int)$p['price_cents'] === 0 ? null : $unit / 100, 'total' => (int)$p['price_cents'] === 0 ? null : $unit * $qty / 100, 'discount' => $disc];
    }
    if ($method === 'card' && ($quoted || !gateway_configured())) throw new ApiError('Card checkout is available only for fixed-price items once the payment gateway is active. Choose bank transfer and we will confirm your quote.');

    $ref = 'OS-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    $token = new_order_token();
    $status = $quoted ? 'needs_quote' : ($method === 'card' ? 'awaiting_payment' : 'new');
    $at = now_str();
    $pdo->prepare('INSERT INTO orders(ref,access_hash,access_token,name,phone,email,business,business_type,business_categories,address,city,payment_method,items,amount_cents,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$ref, hash('sha256', $token), $token, $name, $phone, $email, clean($b['business'] ?? '', 80), clean($b['businessType'] ?? '', 60), json_encode($cats, JSON_UNESCAPED_UNICODE), clean($b['address'] ?? '', 150), clean($b['city'] ?? '', 80), $method, json_encode($items, JSON_UNESCAPED_UNICODE), $quoted ? null : $total, $status, $at, $at]);
    $st = $pdo->prepare('SELECT * FROM orders WHERE ref=?'); $st->execute([$ref]); $row = $st->fetch();
    json_out(['order' => order_view($row), 'token' => $token, 'bank' => $method === 'bank' ? bank_details() : null, 'checkout' => gateway_checkout($row)], 201);
}
function order_auth($ref, $lock = false) {
    $token = (string)($_SERVER['HTTP_X_ORDER_TOKEN'] ?? '');
    if ($token === '') throw new ApiError('Order access token is required.');
    $st = db()->prepare('SELECT * FROM orders WHERE ref=?' . ($lock ? ' FOR UPDATE' : '')); $st->execute([$ref]); $row = $st->fetch();
    if (!$row || !hash_equals($row['access_hash'], hash('sha256', $token))) return null;
    return $row;
}
function api_get_order($ref) {
    $row = order_auth($ref);
    if (!$row) throw new ApiError('Order not found or access link is invalid.', 404);
    json_out([
        'order' => order_view($row),
        'bank' => $row['payment_method'] === 'bank' ? bank_details() : null,
        'whatsapp' => preg_replace('/\D/', '', (string)get_settings()['whatsapp']),
        'checkout' => in_array($row['status'], ['awaiting_payment', 'payment_failed'], true) ? gateway_checkout($row) : null,
    ]);
}
function api_upload_proof($ref) {
    $image = body_json()['image'] ?? '';
    $pdo = db(); $pdo->beginTransaction();
    try {
        $row = order_auth($ref, true);
        if (!$row) throw new ApiError('Order not found or access link is invalid.', 404);
        if ($row['payment_method'] !== 'bank' || in_array($row['status'], ['paid', 'cancelled', 'chargeback'], true)) throw new ApiError('Bank proof cannot be uploaded for this order.');
        $file = media_save($image, 'proof', 3 * 1048576);
        $pdo->prepare("UPDATE orders SET proof_file=?, status='proof_submitted', updated_at=? WHERE ref=?")->execute([$file, now_str(), $ref]);
        if ($row['proof_file'] !== '') media_delete($row['proof_file']);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    json_out(['ok' => true, 'status' => 'proof_submitted']);
}
function api_payhere_notify() {
    $p = $_POST;
    $required = ['merchant_id', 'order_id', 'payhere_amount', 'payhere_currency', 'status_code', 'md5sig'];
    foreach ($required as $k) if (empty($p[$k]) && ($p[$k] ?? '') !== '0') fail('Invalid payment notification.', 403);
    if (!gateway_configured() || $p['merchant_id'] !== PAYHERE_MERCHANT_ID) fail('Invalid payment notification.', 403);
    $sig = strtoupper(md5($p['merchant_id'] . $p['order_id'] . $p['payhere_amount'] . $p['payhere_currency'] . $p['status_code'] . strtoupper(md5(PAYHERE_MERCHANT_SECRET))));
    if (!hash_equals($sig, strtoupper((string)$p['md5sig']))) fail('Payment signature failed.', 403);
    $st = db()->prepare('SELECT * FROM orders WHERE ref=?'); $st->execute([(string)$p['order_id']]); $row = $st->fetch();
    if (!$row || $row['payment_method'] !== 'card' || $row['amount_cents'] === null || $p['payhere_currency'] !== 'LKR' || money_cents($p['payhere_amount']) !== (int)$row['amount_cents']) fail('Payment does not match the order.', 403);
    $map = ['2' => 'paid', '0' => 'awaiting_payment', '-1' => 'cancelled', '-2' => 'payment_failed', '-3' => 'chargeback'];
    $status = $map[(string)$p['status_code']] ?? null;
    if ($status === null) fail('Unknown payment status.', 400);
    if ($row['status'] === 'paid' && !in_array($status, ['paid', 'chargeback'], true)) { header('Content-Type: text/plain'); echo 'OK'; exit; }
    db()->prepare('UPDATE orders SET status=?, gateway_payment_id=?, updated_at=? WHERE ref=?')->execute([$status, clean($p['payment_id'] ?? '', 100), now_str(), $row['ref']]);
    header('Content-Type: text/plain'); echo 'OK'; exit;
}

/* ================= admin ================= */
function api_overview() {
    $pdo = db();
    $products = array_map(function ($r) { return product_view($r, true); }, $pdo->query('SELECT * FROM products ORDER BY ' . KIND_ORDER_SQL . ', sort_order ASC, created_at ASC')->fetchAll());
    $demos = $pdo->query('SELECT * FROM demos ORDER BY id DESC LIMIT 500')->fetchAll();
    $orders = array_map(function ($r) { return order_view($r, true); }, $pdo->query('SELECT * FROM orders ORDER BY id DESC LIMIT 500')->fetchAll());
    $camp = campaign_view($pdo->query('SELECT * FROM campaign WHERE id=1')->fetch(), true);
    $s = get_settings();

    $since7 = date('Y-m-d H:i:s', strtotime('-7 days'));
    $count = function ($sql, $args = []) use ($pdo) { $st = $pdo->prepare($sql); $st->execute($args); return (int)$st->fetchColumn(); };
    $stats = [
        'demosNew' => $count("SELECT COUNT(*) FROM demos WHERE status='new'"),
        'demosTotal' => $count('SELECT COUNT(*) FROM demos'),
        'demos7d' => $count('SELECT COUNT(*) FROM demos WHERE created_at >= ?', [$since7]),
        'ordersOpen' => $count("SELECT COUNT(*) FROM orders WHERE status IN ('new','awaiting_payment','proof_submitted','needs_quote')"),
        'proofsWaiting' => $count("SELECT COUNT(*) FROM orders WHERE status='proof_submitted'"),
        'quotesNeeded' => $count("SELECT COUNT(*) FROM orders WHERE status='needs_quote'"),
        'ordersTotal' => $count('SELECT COUNT(*) FROM orders'),
        'paidRevenue' => $count("SELECT COALESCE(SUM(amount_cents),0) FROM orders WHERE status='paid'") / 100,
        'whatsapp7d' => $count("SELECT COUNT(*) FROM events WHERE type='whatsapp' AND created_at >= ?", [$since7]),
        'whatsappTotal' => $count("SELECT COUNT(*) FROM events WHERE type='whatsapp'"),
        'cartAdds7d' => $count("SELECT COUNT(*) FROM events WHERE type='cart_add' AND created_at >= ?", [$since7]),
    ];
    $daily = [];
    for ($i = 13; $i >= 0; $i--) { $d = date('Y-m-d', strtotime("-$i day")); $daily[$d] = ['date' => $d, 'demos' => 0, 'orders' => 0]; }
    $from = date('Y-m-d 00:00:00', strtotime('-13 day'));
    foreach (['demos', 'orders'] as $tbl) {
        $st = $pdo->prepare("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM $tbl WHERE created_at >= ? GROUP BY DATE(created_at)");
        $st->execute([$from]);
        foreach ($st->fetchAll() as $r) if (isset($daily[$r['d']])) $daily[$r['d']][$tbl] = (int)$r['c'];
    }
    json_out(['products' => $products, 'settings' => $s, 'campaign' => $camp, 'demos' => $demos, 'orders' => $orders, 'stats' => $stats, 'daily' => array_values($daily), 'cardEnabled' => gateway_configured()]);
}
function api_save_product() {
    $b = body_json();
    $name = clean($b['name'] ?? '', 70); $description = clean($b['description'] ?? '', 240);
    if ($name === '' || $description === '') throw new ApiError('Product name and description are required.');
    $kind = (string)($b['kind'] ?? 'pos');
    if (!in_array($kind, KINDS, true)) throw new ApiError('Choose a valid product type.');
    $price = money_cents($b['price'] ?? 0); $discount = (int)($b['discount'] ?? 0);
    if ($price < 0 || $price > 10000000000 || $discount < 0 || $discount > 90) throw new ApiError('Invalid price or discount.');
    $id = clean($b['id'] ?? '', 90);
    if ($id === '') $id = 'offer-' . bin2hex(random_bytes(4));
    if (!preg_match('/^[A-Za-z0-9-]+$/', $id)) throw new ApiError('Invalid product ID.');
    $start = valid_date($b['discountStart'] ?? ''); $end = valid_date($b['discountEnd'] ?? '');
    if ($start !== '' && $end !== '' && $end < $start) throw new ApiError('Discount end date must be after the start date.');
    $features = [];
    foreach ((array)($b['features'] ?? []) as $f) { $f = clean($f, 45); if ($f !== '') $features[] = $f; }
    $features = array_slice($features, 0, 6);
    $image = safe_media($b['image'] ?? '');
    $old = db()->prepare('SELECT image_url FROM products WHERE id=?'); $old->execute([$id]); $oldImage = (string)$old->fetchColumn();
    db()->prepare('INSERT INTO products(id,kind,name,category,description,features,price_cents,discount,discount_start,discount_end,featured,active,sort_order,icon,image_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE kind=VALUES(kind),name=VALUES(name),category=VALUES(category),description=VALUES(description),features=VALUES(features),price_cents=VALUES(price_cents),discount=VALUES(discount),discount_start=VALUES(discount_start),discount_end=VALUES(discount_end),featured=VALUES(featured),active=VALUES(active),sort_order=VALUES(sort_order),icon=VALUES(icon),image_url=VALUES(image_url)')
        ->execute([$id, $kind, $name, clean($b['category'] ?? '', 40), $description, json_encode($features, JSON_UNESCAPED_UNICODE), $price, $discount,
            $start === '' ? null : $start, $end === '' ? null : $end, !empty($b['featured']) ? 1 : 0, array_key_exists('active', $b) ? (empty($b['active']) ? 0 : 1) : 1,
            (int)($b['sortOrder'] ?? 0), clean($b['icon'] ?? '', 8), $image, now_str()]);
    if ($oldImage !== '' && $oldImage !== $image) media_release($oldImage);
    json_out(['id' => $id]);
}
function api_save_settings() {
    $b = body_json(); $v = [];
    foreach (DEFAULT_SETTINGS as $k => $_) $v[$k] = clean($b[$k] ?? '', in_array($k, ['setupText', 'updateText'], true) ? 500 : 300);
    $v['whatsapp'] = preg_replace('/\D/', '', $v['whatsapp']);
    if ($v['whatsapp'] !== '' && strpos($v['whatsapp'], '0') === 0 && strlen($v['whatsapp']) === 10) $v['whatsapp'] = '94' . substr($v['whatsapp'], 1); // 077… -> 9477…
    $v['heroImage'] = safe_media($v['heroImage']);
    if ($v['demoVideo'] !== '' && !preg_match('#^https://#i', $v['demoVideo'])) throw new ApiError('Demo video link must start with https://');
    $oldHero = get_settings()['heroImage'];
    save_settings($v);
    if ($oldHero !== '' && $oldHero !== $v['heroImage']) media_release($oldHero);
    json_out(['ok' => true]);
}
function api_save_campaign() {
    $b = body_json();
    $start = valid_datetime($b['startAt'] ?? ''); $end = valid_datetime($b['endAt'] ?? '');
    if ($start !== '' && $end !== '' && $end <= $start) throw new ApiError('Popup end time must be after the start time.');
    $oldImg = (string)db()->query('SELECT image_url FROM campaign WHERE id=1')->fetchColumn();
    $newImg = safe_media($b['image'] ?? '');
    db()->prepare('UPDATE campaign SET active=?, title=?, message=?, discount_text=?, cta_label=?, image_url=?, start_at=?, end_at=?, updated_at=? WHERE id=1')
        ->execute([!empty($b['active']) ? 1 : 0, clean($b['title'] ?? '', 80), clean($b['message'] ?? '', 240), clean($b['discountText'] ?? '', 36), clean($b['ctaLabel'] ?? '', 40), $newImg, $start === '' ? null : $start, $end === '' ? null : $end, now_str()]);
    if ($oldImg !== '' && $oldImg !== $newImg) media_release($oldImg);
    json_out(['ok' => true]);
}
function api_update_demo($ref) {
    $b = body_json(); $sets = []; $args = [];
    if (array_key_exists('status', $b)) {
        if (!in_array($b['status'], ['new', 'contacted', 'scheduled', 'closed'], true)) throw new ApiError('Invalid demo status.');
        $sets[] = 'status=?'; $args[] = $b['status'];
    }
    if (array_key_exists('notes', $b)) { $sets[] = 'notes=?'; $args[] = clean($b['notes'], 1000); }
    if (!$sets) throw new ApiError('Nothing to update.');
    $args[] = $ref;
    db()->prepare('UPDATE demos SET ' . implode(',', $sets) . ' WHERE ref=?')->execute($args);
    json_out(['ok' => true]);
}
function api_update_order($ref) {
    $b = body_json();
    $st = db()->prepare('SELECT payment_method,status FROM orders WHERE ref=?'); $st->execute([$ref]); $cur = $st->fetch();
    if (!$cur) throw new ApiError('Order not found.', 404);
    $sets = ['updated_at=?']; $args = [now_str()];
    if (array_key_exists('status', $b)) {
        $status = $b['status'];
        if (!in_array($status, ['new', 'awaiting_payment', 'proof_submitted', 'paid', 'needs_quote', 'cancelled', 'payment_failed', 'chargeback'], true)) throw new ApiError('Invalid order status.');
        if ($cur['payment_method'] === 'card' && $status === 'paid') throw new ApiError('Card payments are confirmed only by the verified gateway callback.', 403);
        if ($cur['status'] === 'chargeback' && $status === 'paid') throw new ApiError('A chargeback cannot be manually marked paid.', 403);
        $sets[] = 'status=?'; $args[] = $status;
    }
    if (array_key_exists('amount', $b) && $b['amount'] !== null) {
        $cents = money_cents($b['amount']);
        if ($cents <= 0 || $cents > 10000000000) throw new ApiError('Enter a valid quote amount.');
        if (in_array($cur['status'], ['paid', 'chargeback'], true)) throw new ApiError('A completed payment amount cannot be changed.', 403);
        $sets[] = 'amount_cents=?'; $args[] = $cents;
    }
    if (array_key_exists('notes', $b)) { $sets[] = 'admin_notes=?'; $args[] = clean($b['notes'], 1000); }
    $args[] = $ref;
    db()->prepare('UPDATE orders SET ' . implode(',', $sets) . ' WHERE ref=?')->execute($args);
    json_out(['ok' => true]);
}
function api_order_link($ref) {
    // Private tracking link for one order (admin only) - used by the "WhatsApp + tracking link" button.
    $pdo = db();
    $st = $pdo->prepare('SELECT access_token FROM orders WHERE ref=?'); $st->execute([$ref]); $row = $st->fetch();
    if (!$row) throw new ApiError('Order not found.', 404);
    $token = (string)$row['access_token'];
    if ($token === '') {   // order created before this feature: only a hash was stored, so issue a fresh private token
        $token = new_order_token();
        $pdo->prepare('UPDATE orders SET access_token=?, access_hash=? WHERE ref=?')->execute([$token, hash('sha256', $token), $ref]);
    }
    json_out(['url' => frontend_url() . '/order.html?ref=' . rawurlencode($ref) . '#token=' . rawurlencode($token)]);
}
function api_proof($ref) {
    $st = db()->prepare('SELECT proof_file FROM orders WHERE ref=?'); $st->execute([$ref]); $row = $st->fetch();
    if (!$row || $row['proof_file'] === '') throw new ApiError('Proof not found.', 404);
    $st = db()->prepare("SELECT mime, data FROM media WHERE id=? AND kind='proof'"); $st->execute([$row['proof_file']]); $m = $st->fetch();
    if (!$m) throw new ApiError('Proof image is missing in the database.', 404);
    $data = is_resource($m['data']) ? stream_get_contents($m['data']) : $m['data'];
    header('Content-Type: ' . $m['mime']);
    header('Content-Length: ' . strlen($data));
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    echo $data;
    exit;
}
function api_delete_proof($ref) {
    $pdo = db(); $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT proof_file, status FROM orders WHERE ref=? FOR UPDATE'); $st->execute([$ref]); $row = $st->fetch();
        if (!$row) throw new ApiError('Order not found.', 404);
        if ($row['proof_file'] === '') throw new ApiError('This order has no payment slip.', 404);
        $status = $row['status'] === 'proof_submitted' ? 'awaiting_payment' : $row['status'];
        $pdo->prepare("UPDATE orders SET proof_file='', status=?, updated_at=? WHERE ref=?")->execute([$status, now_str(), $ref]);
        media_delete($row['proof_file']);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    json_out(['ok' => true, 'status' => $status]);
}

function csv_cell($v) {
    $v = (string)$v;
    return ($v !== '' && strpos('=+-@', $v[0]) !== false) ? "'" . $v : $v;
}
function api_export($what) {
    if (!in_array($what, ['demos', 'orders'], true)) throw new ApiError('Unknown export.', 404);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="omnistaq-' . $what . '-' . date('Ymd-His') . '.csv"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    if ($what === 'demos') {
        fputcsv($out, ['Reference', 'Name', 'Phone', 'Business', 'Business type', 'Message', 'Status', 'Notes', 'Created']);
        foreach (db()->query('SELECT * FROM demos ORDER BY id DESC') as $r)
            fputcsv($out, array_map('csv_cell', [$r['ref'], $r['name'], $r['phone'], $r['business'], $r['shop_type'], $r['message'], $r['status'], $r['notes'], $r['created_at']]));
    } else {
        fputcsv($out, ['Reference', 'Name', 'Phone', 'Email', 'Business', 'Business type', 'Categories', 'City', 'Payment', 'Items', 'Amount (LKR)', 'Status', 'Notes', 'Created']);
        foreach (db()->query('SELECT * FROM orders ORDER BY id DESC') as $r) {
            $names = implode(' | ', array_map(function ($i) { return ($i['name'] ?? '') . ' x' . ($i['qty'] ?? 1); }, json_decode($r['items'], true) ?: []));
            $cats = implode(', ', json_decode($r['business_categories'] ?? '[]', true) ?: []);
            fputcsv($out, array_map('csv_cell', [$r['ref'], $r['name'], $r['phone'], $r['email'], $r['business'], $r['business_type'], $cats, $r['city'], $r['payment_method'], $names, $r['amount_cents'] === null ? '' : $r['amount_cents'] / 100, $r['status'], $r['admin_notes'], $r['created_at']]));
        }
    }
    fclose($out);
    exit;
}
