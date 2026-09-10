<?php
// Evaluations stored in the existing settings(key, value) table; no schema migration.
function normalize_player_evaluation($scores) {
    $criteria = ['technique', 'physique', 'strategie', 'placement', 'esprit_equipe', 'puissance', 'precision'];
    if (!is_array($scores) || count($scores) !== count($criteria) || array_diff(array_keys($scores), $criteria)) {
        throw new InvalidArgumentException('Les sept critères doivent être fournis.');
    }
    $clean = [];
    foreach ($criteria as $criterion) {
        if (!array_key_exists($criterion, $scores)) throw new InvalidArgumentException('Critère manquant.');
        $value = $scores[$criterion];
        if ($value !== null && ((!is_int($value) && !is_float($value)) || !is_finite((float)$value) || $value < 0 || $value > 10)) {
            throw new InvalidArgumentException('Chaque note doit être comprise entre 0 et 10, ou rester vide.');
        }
        $clean[$criterion] = $value;
    }
    return $clean;
}

function handle_player_evaluations($pdo, $action, $input) {
    header('Cache-Control: no-store');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Méthode POST requise.']);
        return;
    }
    try {
        $stmt = $pdo->prepare('SELECT value FROM settings WHERE `key` = ?');
        $stmt->execute(['coach_password']);
        $stored = $stmt->fetchColumn();
        $stored = $stored === false ? '111' : (string)$stored;
        $password = $input['password'] ?? null;
        if (!is_string($password) || !hash_equals($stored, $password)) {
            http_response_code(403);
            echo json_encode(['error' => 'Accès coach requis pour les évaluations.']);
            return;
        }
        if ($action === 'get_player_evaluations') {
            $stmt = $pdo->query("SELECT p.id, s.value FROM players p JOIN settings s ON s.`key` = CONCAT('player_evaluation_', p.id)");
            $result = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $result[(string)$row['id']] = normalize_player_evaluation(json_decode($row['value'], true));
            }
            echo json_encode((object)$result);
            return;
        }
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) throw new InvalidArgumentException('Joueuse invalide.');
        $scores = normalize_player_evaluation($input['scores'] ?? null);
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id FROM players WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        if (!$stmt->fetchColumn()) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Cette joueuse n’existe plus.']);
            return;
        }
        $json = json_encode($scores, JSON_THROW_ON_ERROR);
        $stmt = $pdo->prepare('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?');
        $stmt->execute(['player_evaluation_' . $id, $json, $json]);
        $pdo->commit();
        echo json_encode(['ok' => true, 'scores' => $scores]);
    } catch (InvalidArgumentException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Impossible d’enregistrer ou de charger les évaluations. Vérifie que la table settings existante est disponible.']);
    }
}
