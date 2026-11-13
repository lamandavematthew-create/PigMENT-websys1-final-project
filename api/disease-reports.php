<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

function reportRow($row) {
    return [
        'report_id' => (int) $row['report_id'],
        'disease_type' => $row['disease_type'],
        'municipality' => $row['municipality'],
        'barangay' => $row['barangay'],
        'latitude' => isset($row['latitude']) ? (float) $row['latitude'] : null,
        'longitude' => isset($row['longitude']) ? (float) $row['longitude'] : null,
        'incident_date' => $row['incident_date'],
        'report_status' => $row['report_status'],
        'is_published' => (bool) $row['is_published'],
        'description' => $row['description'],
        'admin_remarks' => $row['admin_remarks'],
        'created_at' => $row['created_at'],
        'reviewed_at' => $row['reviewed_at'],
        'reporter_name' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))
    ];
}

function validateCoordinates($latitude, $longitude) {
    if (!is_numeric($latitude) || !is_numeric($longitude)) {
        sendResponse(422, 'error', 'Select a valid incident location.');
    }
    $latitude = (float) $latitude;
    $longitude = (float) $longitude;
    if ($latitude < 13.10 || $latitude > 13.65 || $longitude < 121.65 || $longitude > 122.25) {
        sendResponse(422, 'error', 'The selected location must be within the Marinduque reporting area.');
    }
    return [$latitude, $longitude];
}

try {
    if ($method === 'GET') {
        $scope = $_GET['scope'] ?? 'public';
        $sql = "SELECT r.*, u.first_name, u.last_name
                FROM disease_reports r
                INNER JOIN users u ON u.user_id = r.reporter_id";
        $params = [];

        if ($scope === 'mine') {
            $user = requireLogin($pdo);
            $sql .= " WHERE r.reporter_id = ?";
            $params[] = (int) $user['user_id'];
        } elseif ($scope === 'admin') {
            requireAdmin($pdo);
        } else {
            $sql .= " WHERE r.is_published = 1
                      AND r.report_status = 'confirmed'
                      AND EXISTS (
                          SELECT 1 FROM disease_confirmations c
                          WHERE c.report_id = r.report_id
                      )";
        }

        if (!empty($_GET['municipality'])) {
            $sql .= ($scope === 'admin' && !str_contains($sql, ' WHERE ')) ? " WHERE " : " AND ";
            $sql .= "r.municipality = ?";
            $params[] = trim((string) $_GET['municipality']);
        }
        if (!empty($_GET['status'])) {
            $sql .= ($scope === 'admin' && !str_contains($sql, ' WHERE ') && !$params) ? " WHERE " : " AND ";
            $sql .= "r.report_status = ?";
            $params[] = trim((string) $_GET['status']);
        }
        $sql .= " ORDER BY r.created_at DESC, r.report_id DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        if ($scope === 'public') {
            foreach ($rows as &$row) {
                $row['latitude'] = round((float) $row['latitude'], 3);
                $row['longitude'] = round((float) $row['longitude'], 3);
            }
            unset($row);
        }

        sendResponse(200, 'success', 'Disease reports retrieved.', array_map('reportRow', $rows));
    }

    $user = requireLogin($pdo);
    requireCsrf();
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) sendResponse(400, 'error', 'Invalid JSON request.');

    if ($method === 'POST') {
        if ($user['role'] !== 'farmer') sendResponse(403, 'error', 'Farmer access only.');
        foreach (['disease_type', 'municipality', 'barangay', 'incident_date', 'description'] as $field) {
            if (!is_string($data[$field] ?? null) || trim($data[$field]) === '') {
                sendResponse(422, 'error', 'Complete all report fields.');
            }
        }
        [$latitude, $longitude] = validateCoordinates($data['latitude'] ?? null, $data['longitude'] ?? null);
        $date = DateTime::createFromFormat('Y-m-d', $data['incident_date']);
        if (!$date || $date->format('Y-m-d') !== $data['incident_date'] || $data['incident_date'] > date('Y-m-d')) {
            sendResponse(422, 'error', 'Enter a valid incident date.');
        }
        $stmt = $pdo->prepare(
            "INSERT INTO disease_reports
             (reporter_id, disease_type, description, municipality, barangay, latitude, longitude, incident_date, report_status, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)"
        );
        $stmt->execute([
            (int) $user['user_id'], trim($data['disease_type']), trim($data['description']),
            trim($data['municipality']), trim($data['barangay']), $latitude, $longitude, $data['incident_date']
        ]);
        sendResponse(201, 'success', 'Report submitted for review.', ['report_id' => (int) $pdo->lastInsertId()]);
    }

    if ($method === 'PUT') {
        if ($user['role'] !== 'admin') sendResponse(403, 'error', 'Admin access only.');
        $reportId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$reportId) sendResponse(422, 'error', 'Valid report ID required.');
        $status = $data['report_status'] ?? null;
        if (!in_array($status, ['pending', 'under_review', 'confirmed', 'rejected'], true)) {
            sendResponse(422, 'error', 'Invalid report status.');
        }
        $remarks = trim((string) ($data['admin_remarks'] ?? ''));
        if (strlen($remarks) > 1000) sendResponse(422, 'error', 'Admin remarks are too long.');
        if ($status === 'rejected' && strlen($remarks) < 5) sendResponse(422, 'error', 'Please provide a rejection reason.');
        $pdo->beginTransaction();
        $check = $pdo->prepare('SELECT report_status FROM disease_reports WHERE report_id = ? FOR UPDATE');
        $check->execute([$reportId]);
        $previous = $check->fetchColumn();
        if ($previous === false) { $pdo->rollBack(); sendResponse(404, 'error', 'Report not found.'); }
        if ($status === 'under_review' && !in_array($previous, ['pending', 'under_review'], true)) {
            $pdo->rollBack(); sendResponse(409, 'error', 'Only pending reports can be accepted for review.');
        }
        if ($status === 'confirmed' && $previous === 'rejected') {
            $pdo->rollBack(); sendResponse(409, 'error', 'A rejected report must be reopened for review first.');
        }
        $confirmation = $data['confirmation'] ?? null;
        $stmt = $pdo->prepare('SELECT confirmation_id FROM disease_confirmations WHERE report_id = ?');
        $stmt->execute([$reportId]);
        $hasConfirmation = (bool) $stmt->fetchColumn();
        if ($status === 'confirmed' && is_array($confirmation)) {
            foreach (['confirmed_by_name', 'designation', 'organization', 'confirmation_date'] as $field) {
                if (!is_string($confirmation[$field] ?? null) || trim($confirmation[$field]) === '') {
                    $pdo->rollBack(); sendResponse(422, 'error', 'Complete the authorized veterinary confirmation details.');
                }
            }
            $verifiedDate = DateTime::createFromFormat('!Y-m-d', $confirmation['confirmation_date']);
            if (!$verifiedDate || $verifiedDate->format('Y-m-d') !== $confirmation['confirmation_date'] || $confirmation['confirmation_date'] > date('Y-m-d')) {
                $pdo->rollBack(); sendResponse(422, 'error', 'Enter a valid confirmation date.');
            }
            $stmt = $pdo->prepare(
                "INSERT INTO disease_confirmations
                 (report_id, confirmed_by_name, designation, organization, confirmation_date, reference_number, confirmation_notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE confirmed_by_name = VALUES(confirmed_by_name), designation = VALUES(designation),
                 organization = VALUES(organization), confirmation_date = VALUES(confirmation_date),
                 reference_number = VALUES(reference_number), confirmation_notes = VALUES(confirmation_notes)"
            );
            $stmt->execute([
                $reportId, trim($confirmation['confirmed_by_name']), trim($confirmation['designation']),
                trim($confirmation['organization']), $confirmation['confirmation_date'],
                trim((string) ($confirmation['reference_number'] ?? '')) ?: null,
                trim((string) ($confirmation['confirmation_notes'] ?? '')) ?: null
            ]);
            $hasConfirmation = true;
        }
        if ($status === 'confirmed' && !$hasConfirmation) {
            $pdo->rollBack(); sendResponse(422, 'error', 'Authorized veterinary confirmation is required before marking a report confirmed.');
        }
        $publish = !empty($data['is_published']);
        if ($publish && ($status !== 'confirmed' || !$hasConfirmation)) {
            $pdo->rollBack(); sendResponse(422, 'error', 'Publication requires authorized veterinary confirmation.');
        }
        $stmt = $pdo->prepare(
            "UPDATE disease_reports
             SET report_status = ?, admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), is_published = ?
             WHERE report_id = ?"
        );
        $stmt->execute([$status, $remarks, (int) $user['user_id'], (int) $publish, $reportId]);
        $pdo->commit();
        sendResponse(200, 'success', 'Report updated.');
    }

    sendResponse(405, 'error', 'Method not allowed.');
} catch (PDOException $error) {
    error_log($error->getMessage());
    sendResponse(500, 'error', 'Disease report operation failed.');
} catch (Throwable $error) {
    error_log($error->getMessage());
    sendResponse(500, 'error', 'Unable to process disease report request.');
}
