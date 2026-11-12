<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    $user = requireLogin($pdo);

    if ($user['role'] !== 'farmer') {
        sendResponse(403, 'error', 'Farmer access only.');
    }

    $ownerId = (int) $user['user_id'];

    // All statistics are scoped to the currently authenticated farmer.
    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*) AS total_pigs,
            COALESCE(SUM(CASE WHEN pig_status = 'active' THEN 1 ELSE 0 END), 0) AS active_pigs
         FROM pigs
         WHERE owner_id = ?"
    );
    $stmt->execute([$ownerId]);
    $pigCounts = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM marketplace_listings
         WHERE seller_id = ? AND listing_status = 'active'"
    );
    $stmt->execute([$ownerId]);
    $activeListings = (int) $stmt->fetchColumn();

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM disease_reports
         WHERE reporter_id = ? AND created_at >= (NOW() - INTERVAL 30 DAY)"
    );
    $stmt->execute([$ownerId]);
    $recentReports = (int) $stmt->fetchColumn();

    sendResponse(200, 'success', 'Farm snapshot retrieved.', [
        'total_pigs' => (int) $pigCounts['total_pigs'],
        'active_pigs' => (int) $pigCounts['active_pigs'],
        'active_listings' => $activeListings,
        'recent_reports' => $recentReports
    ]);
} catch (PDOException $error) {
    error_log('Farm snapshot database error: ' . $error->getMessage());
    sendResponse(500, 'error', 'Unable to load farm snapshot.');
}
