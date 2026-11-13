<?php

require_once __DIR__ . '/config.php';

header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    require_once __DIR__ . '/../database/db.php';
    requireAdmin($pdo);

    $unavailable = [];
    $read = static function ($key, callable $query) use (&$unavailable) {
        try {
            return $query();
        } catch (PDOException $e) {
            error_log('Admin overview ' . $key . ': ' . $e->getMessage());
            $unavailable[] = $key;
            return null;
        }
    };

    $count = static function ($sql) use ($pdo) {
        return (int) $pdo->query($sql)->fetchColumn();
    };

    $moderationReady = $read('moderation_ready', static function () use ($count) {
        return (bool) $count(
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = 'listing_moderation'"
        );
    });

    $data = [
        'farmers' => $read('farmers', static function () use ($count) {
            return $count("SELECT COUNT(*) FROM users WHERE role = 'farmer'");
        }),
        'active_listings' => null,
        'pending_reports' => $read('pending_reports', static function () use ($count) {
            return $count("SELECT COUNT(*) FROM disease_reports WHERE report_status = 'pending'");
        }),
        'published_zones' => $read('published_zones', static function () use ($count) {
            // Match the zones eligible to appear on the public disease map.
            return $count(
                "SELECT COUNT(*) FROM infected_zones z
                 WHERE z.is_published = 1
                   AND z.zone_status IN ('confirmed', 'monitoring', 'resolved')
                   AND z.report_id IS NOT NULL
                   AND EXISTS (
                       SELECT 1 FROM disease_reports dr
                       JOIN disease_confirmations dc ON dc.report_id = dr.report_id
                       WHERE dr.report_id = z.report_id AND dr.report_status = 'confirmed'
                   )"
            );
        }),
        'attention' => $read('attention', static function () use ($pdo) {
            return $pdo->query(
                "SELECT report_id, disease_type, municipality, created_at, report_status
                 FROM disease_reports
                 WHERE report_status IN ('pending', 'under_review')
                 ORDER BY CASE WHEN report_status = 'pending' THEN 0 ELSE 1 END,
                          created_at DESC, report_id DESC
                 LIMIT 5"
            )->fetchAll(PDO::FETCH_ASSOC);
        }),
        'moderation_ready' => $moderationReady
    ];

    if ($moderationReady === null) {
        $unavailable[] = 'active_listings';
    } else {
        $data['active_listings'] = $read('active_listings', static function () use ($count, $moderationReady) {
            return $count(
                "SELECT COUNT(*) FROM marketplace_listings m
                 JOIN users u ON u.user_id = m.seller_id
                 WHERE m.listing_status = 'active' AND u.account_status = 'active'"
                . ($moderationReady ? " AND NOT EXISTS (
                     SELECT 1 FROM listing_moderation lm
                     WHERE lm.listing_id = m.listing_id AND lm.is_hidden = 1
                   )" : '')
            );
        });
    }

    $data['unavailable'] = $unavailable;
    sendResponse(200, 'success', 'Admin overview retrieved.', $data);
} catch (Throwable $e) {
    error_log('Admin overview: ' . $e->getMessage());
    sendResponse(500, 'error', 'Unable to load admin overview.');
}
