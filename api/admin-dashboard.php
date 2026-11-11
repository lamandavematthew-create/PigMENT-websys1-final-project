<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { header('Allow: GET'); sendResponse(405, 'error', 'Method not allowed.'); }
try {
    requireAdmin($pdo);
    $counts = [
        'farmers' => "SELECT COUNT(*) FROM users WHERE role = 'farmer'",
        'active_listings' => "SELECT COUNT(*) FROM marketplace_listings m INNER JOIN users u ON u.user_id=m.seller_id WHERE m.listing_status='active' AND u.account_status='active'" . (adminModerationAvailable($pdo) ? " AND NOT EXISTS (SELECT 1 FROM listing_moderation lm WHERE lm.listing_id=m.listing_id AND lm.is_hidden=1)" : ''),
        'pending_reports' => "SELECT COUNT(*) FROM disease_reports WHERE report_status='pending'",
        'published_zones' => "SELECT COUNT(*) FROM infected_zones WHERE is_published=1"
    ];
    $data = [];
    foreach ($counts as $key => $sql) $data[$key] = (int)$pdo->query($sql)->fetchColumn();
    $stmt = $pdo->query("SELECT report_id, disease_type, municipality, created_at, report_status FROM disease_reports WHERE report_status IN ('pending','under_review') ORDER BY created_at DESC LIMIT 5");
    $data['attention'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $data['moderation_ready'] = adminModerationAvailable($pdo);
    sendResponse(200, 'success', 'Admin overview retrieved.', $data);
} catch (Throwable $e) { error_log($e->getMessage()); sendResponse(500, 'error', 'Unable to load admin overview.'); }
function adminModerationAvailable($pdo) {
    $stmt=$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='listing_moderation'");
    return (bool)$stmt->fetchColumn();
}
