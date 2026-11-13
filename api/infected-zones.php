<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

function validateGeometry($value) {
    $geometry = is_string($value) ? json_decode($value, true) : $value;
    if (!is_array($geometry) || ($geometry['type'] ?? '') !== 'Polygon' || !is_array($geometry['coordinates'] ?? null) || count($geometry['coordinates']) !== 1) {
        sendResponse(422, 'error', 'A valid Polygon boundary is required.');
    }
    $ring = $geometry['coordinates'][0];
    if (count($ring) < 4 || $ring[0] !== $ring[count($ring) - 1]) {
        sendResponse(422, 'error', 'The polygon must be closed and have at least three points.');
    }
    $distinct = [];
    foreach ($ring as $point) {
        if (!is_array($point) || count($point) < 2 || !is_numeric($point[0]) || !is_numeric($point[1])) {
            sendResponse(422, 'error', 'The polygon contains invalid coordinates.');
        }
        $longitude = (float) $point[0];
        $latitude = (float) $point[1];
        if ($longitude < 121.65 || $longitude > 122.25 || $latitude < 13.10 || $latitude > 13.65) {
            sendResponse(422, 'error', 'The zone must be within the Marinduque reporting area.');
        }
        $distinct[$longitude . ':' . $latitude] = true;
    }
    if (count($distinct) < 3) sendResponse(422, 'error', 'The polygon needs three distinct points.');
    return json_encode($geometry, JSON_UNESCAPED_SLASHES);
}

try {
    if ($method === 'GET') {
        $scope = $_GET['scope'] ?? 'public';
        $sql = "SELECT z.*, r.report_status FROM infected_zones z LEFT JOIN disease_reports r ON r.report_id = z.report_id";
        $params = [];
        if ($scope === 'public') {
            $sql .= " WHERE z.is_published = 1 AND z.zone_status IN ('confirmed', 'monitoring', 'resolved') AND z.report_id IS NOT NULL AND EXISTS (SELECT 1 FROM disease_reports dr JOIN disease_confirmations dc ON dc.report_id=dr.report_id WHERE dr.report_id=z.report_id AND dr.report_status='confirmed')";
        } else {
            requireAdmin($pdo);
        }
        $sql .= " ORDER BY z.created_at DESC, z.zone_id DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['zone_id'] = (int) $row['zone_id'];
            $row['report_id'] = $row['report_id'] ? (int) $row['report_id'] : null;
            $row['created_by'] = (int) $row['created_by'];
            $row['is_published'] = (bool) $row['is_published'];
            $row['geometry'] = json_decode($row['geometry'], true);
        }
        unset($row);
        sendResponse(200, 'success', 'Disease zones retrieved.', $rows);
    }

    $user = requireAdmin($pdo);
    requireCsrf();
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) sendResponse(400, 'error', 'Invalid JSON request.');
    $geometry = validateGeometry($data['geometry'] ?? null);
    foreach (['zone_name', 'disease_type', 'municipality', 'severity', 'zone_status'] as $field) {
        if (!is_string($data[$field] ?? null) || trim($data[$field]) === '') sendResponse(422, 'error', 'Complete all required zone fields.');
    }
    if (!in_array($data['severity'], ['low', 'moderate', 'high'], true) || !in_array($data['zone_status'], ['suspected', 'confirmed', 'monitoring', 'resolved'], true)) {
        sendResponse(422, 'error', 'Invalid zone classification.');
    }
    $zoneId = filter_var($data['zone_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $published = !empty($data['is_published']);
    if ($data['zone_status'] === 'confirmed') {
        $reportId = filter_var($data['report_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $stmt = $pdo->prepare(
            "SELECT r.report_id
             FROM disease_reports r
             INNER JOIN disease_confirmations c ON c.report_id = r.report_id
             WHERE r.report_id = ? AND r.report_status = 'confirmed'"
        );
        $stmt->execute([$reportId]);
        if (!$stmt->fetch()) {
            sendResponse(422, 'error', 'Confirmed zones require a report with authorized confirmation.');
        }
    }
    if ($published) {
        $reportId = filter_var($data['report_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
        if (!$reportId || !in_array($data['zone_status'], ['confirmed','monitoring','resolved'], true)) sendResponse(422,'error','Publication requires an eligible zone and a verified report.');
        $check = $pdo->prepare("SELECT r.report_id FROM disease_reports r JOIN disease_confirmations c ON c.report_id=r.report_id WHERE r.report_id=? AND r.report_status='confirmed'");
        $check->execute([$reportId]);
        if (!$check->fetch()) sendResponse(422,'error','Publication requires an officially confirmed associated incident.');
    }
    if ($zoneId) {
        $stmt = $pdo->prepare(
            "UPDATE infected_zones SET report_id = ?, zone_name = ?, disease_type = ?, municipality = ?, barangay = ?,
             severity = ?, zone_status = ?, geometry = ?, description = ?, is_published = ?, published_at = IF(?, COALESCE(published_at, NOW()), NULL)
             WHERE zone_id = ?"
        );
        $stmt->execute([
            $data['report_id'] ?: null, trim($data['zone_name']), trim($data['disease_type']), trim($data['municipality']),
            trim((string) ($data['barangay'] ?? '')) ?: null, $data['severity'], $data['zone_status'], $geometry,
            trim((string) ($data['description'] ?? '')) ?: null, (int) $published, (int) $published, $zoneId
        ]);
    } else {
        $stmt = $pdo->prepare(
            "INSERT INTO infected_zones
             (report_id, created_by, zone_name, disease_type, municipality, barangay, severity, zone_status, geometry, description, is_published, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(?, NOW(), NULL))"
        );
        $stmt->execute([
            $data['report_id'] ?: null, (int) $user['user_id'], trim($data['zone_name']), trim($data['disease_type']),
            trim($data['municipality']), trim((string) ($data['barangay'] ?? '')) ?: null, $data['severity'],
            $data['zone_status'], $geometry, trim((string) ($data['description'] ?? '')) ?: null, (int) $published, (int) $published
        ]);
        $zoneId = (int) $pdo->lastInsertId();
    }
    sendResponse(200, 'success', 'Zone saved.', ['zone_id' => $zoneId]);
} catch (Throwable $error) {
    error_log($error->getMessage());
    sendResponse(500, 'error', 'Unable to process disease zone request.');
}
