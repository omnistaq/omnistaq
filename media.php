<?php
/* Serves admin-uploaded images (offers, hero, campaign) that are stored inside MySQL.
 * Payment slips are NOT served here - they are private and only reachable by the signed-in admin through api.php. */
ini_set('display_errors', '0');
require_once __DIR__ . '/helpers.php';

$id = (string)($_GET['id'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/', $id)) { http_response_code(404); exit; }

try {
    $st = db()->prepare("SELECT mime, size, data FROM media WHERE id=? AND kind='public'");
    $st->execute([$id]);
    $m = $st->fetch();
} catch (Throwable $e) {
    error_log('media.php: ' . $e->getMessage());
    http_response_code(500); exit;
}
if (!$m) { http_response_code(404); exit; }

$etag = '"' . $id . '"';   // ids are random and content never changes for an id
header('ETag: ' . $etag);
header('Cache-Control: public, max-age=31536000, immutable');
header('X-Content-Type-Options: nosniff');
header('Cross-Origin-Resource-Policy: cross-origin');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }

$data = is_resource($m['data']) ? stream_get_contents($m['data']) : $m['data'];
header('Content-Type: ' . $m['mime']);
header('Content-Length: ' . strlen($data));
echo $data;
