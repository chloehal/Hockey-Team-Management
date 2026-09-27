<?php
// Fail closed: a missing setting or database error never grants coach access.
function require_coach_access($pdo, $input) {
    header('Cache-Control: no-store');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Méthode POST requise.']);
        return false;
    }
    try {
        $stmt = $pdo->prepare('SELECT value FROM settings WHERE `key` = ?');
        $stmt->execute(['coach_password']);
        $stored = $stmt->fetchColumn();
        $password = $input['password'] ?? null;
        if (is_string($stored) && $stored !== '' && is_string($password) && hash_equals($stored, $password)) return true;
    } catch (Exception $e) {
        http_response_code(503);
        echo json_encode(['error' => 'Impossible de vérifier l’accès coach. Réessaie plus tard.']);
        return false;
    }
    http_response_code(403);
    echo json_encode(['error' => 'Seul le coach peut modifier ou supprimer des présences enregistrées.']);
    return false;
}
