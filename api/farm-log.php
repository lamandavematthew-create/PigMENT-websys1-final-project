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

    // Build the activity feed from existing records, not a separate/duplicate log table.
    // Every SELECT is restricted to the authenticated farmer's ownership.
    $stmt = $pdo->prepare(<<<'SQL'
        SELECT activity_type, item_label, detail, activity_date, sort_id
        FROM (
            SELECT 'pig' AS activity_type,
                   COALESCE(NULLIF(p.pig_code, ''), CONCAT('Pig #', p.pig_id)) AS item_label,
                   COALESCE(NULLIF(p.pig_name, ''), p.breed, '') AS detail,
                   p.created_at AS activity_date, p.pig_id AS sort_id
            FROM pigs p
            WHERE p.owner_id = ?

            UNION ALL

            SELECT 'listing' AS activity_type,
                   m.listing_title AS item_label,
                   m.listing_status AS detail,
                   m.created_at AS activity_date, m.listing_id AS sort_id
            FROM marketplace_listings m
            WHERE m.seller_id = ?

            UNION ALL

            SELECT 'report' AS activity_type,
                   r.disease_type AS item_label,
                   r.municipality AS detail,
                   r.created_at AS activity_date, r.report_id AS sort_id
            FROM disease_reports r
            WHERE r.reporter_id = ?

            UNION ALL

            SELECT 'weight' AS activity_type,
                   COALESCE(NULLIF(p.pig_code, ''), CONCAT('Pig #', p.pig_id)) AS item_label,
                   CONCAT(CAST(w.estimated_weight AS CHAR), ' kg') AS detail,
                   CAST(w.measurement_date AS DATETIME) AS activity_date,
                   w.weight_record_id AS sort_id
            FROM weight_records w
            INNER JOIN pigs p ON p.pig_id = w.pig_id
            WHERE p.owner_id = ?
        ) AS farm_activities
        WHERE activity_date IS NOT NULL
        ORDER BY activity_date DESC, sort_id DESC
        LIMIT 8
    SQL);
    $stmt->execute([$ownerId, $ownerId, $ownerId, $ownerId]);
    sendResponse(200, 'success', 'Farm log retrieved.', $stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (PDOException $error) {
    error_log('Farm log database error: ' . $error->getMessage());
    sendResponse(500, 'error', 'Unable to load farm log.');
}
