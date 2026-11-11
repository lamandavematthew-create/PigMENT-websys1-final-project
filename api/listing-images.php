<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'DELETE'], true)) {
    header('Allow: POST, DELETE');
    sendResponse(405, 'error', 'Method not allowed.');
}

$user = requireLogin($pdo);
if ($user['role'] !== 'farmer') {
    sendResponse(403, 'error', 'Farmer access only.');
}
requireCsrf();

$listingId = filter_var(
    $_REQUEST['listing_id'] ?? $_GET['id'] ?? null,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);
if (!$listingId) {
    sendResponse(422, 'error', 'Valid listing ID required.');
}

$stmt = $pdo->prepare(
    'SELECT listing_id FROM marketplace_listings WHERE listing_id = ? AND seller_id = ?'
);
$stmt->execute([$listingId, (int) $user['user_id']]);
if (!$stmt->fetch()) {
    sendResponse(404, 'error', 'Listing not found.');
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $imageId = filter_var($_GET['image_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$imageId) {
        sendResponse(422, 'error', 'Valid image ID required.');
    }
    $stmt = $pdo->prepare('SELECT image_path FROM listing_images WHERE image_id = ? AND listing_id = ?');
    $stmt->execute([$imageId, $listingId]);
    $image = $stmt->fetch();
    if (!$image) {
        sendResponse(404, 'error', 'Image not found.');
    }
    $stmt = $pdo->prepare('DELETE FROM listing_images WHERE image_id = ? AND listing_id = ?');
    $stmt->execute([$imageId, $listingId]);
    $relativePath = ltrim((string) $image['image_path'], '/');
    $filePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    if (is_file($filePath)) {
        unlink($filePath);
    }
    sendResponse(200, 'success', 'Listing image removed.');
}

if (
    empty($_FILES['image']) ||
    $_FILES['image']['error'] !== UPLOAD_ERR_OK ||
    $_FILES['image']['size'] > 5 * 1024 * 1024
) {
    sendResponse(422, 'error', 'Choose an image no larger than 5 MB.');
}

$file = $_FILES['image'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp'
];
if (!isset($allowed[$mime]) || @getimagesize($file['tmp_name']) === false) {
    sendResponse(422, 'error', 'Only JPG, PNG, and WebP images are supported.');
}

$directory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'listings';
if (!is_dir($directory) && !mkdir($directory, 0750, true)) {
    sendResponse(500, 'error', 'Unable to prepare image storage.');
}

$filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
$target = $directory . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($file['tmp_name'], $target)) {
    sendResponse(500, 'error', 'Unable to save listing image.');
}

$relativePath = 'public/assets/uploads/listings/' . $filename;
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('UPDATE listing_images SET is_primary = 0 WHERE listing_id = ?');
    $stmt->execute([$listingId]);
    $stmt = $pdo->prepare('INSERT INTO listing_images (listing_id, image_path, is_primary) VALUES (?, ?, 1)');
    $stmt->execute([$listingId, $relativePath]);
    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    if (is_file($target)) {
        unlink($target);
    }
    error_log($error->getMessage());
    sendResponse(500, 'error', 'Unable to save listing image.');
}

sendResponse(201, 'success', 'Listing image uploaded.', ['image_path' => $relativePath]);