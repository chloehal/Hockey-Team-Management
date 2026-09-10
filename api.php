<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

// POST data
$input = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
}

switch ($action) {
    case 'get_player_evaluations':
    case 'save_player_evaluation':
        require_once __DIR__ . '/player-evaluations.php';
        handle_player_evaluations($pdo, $action, $input);
        break;


    // ===================== PLAYERS =====================
    case 'get_players':
        $stmt = $pdo->query('SELECT id, name, number, position_1, position_2, position_3, level FROM players ORDER BY name');
        echo json_encode($stmt->fetchAll());
        break;

    case 'add_player':
        $name = trim($input['name'] ?? '');
        $number = trim($input['number'] ?? '');
        if ($name === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Nom requis']);
            break;
        }
        $stmt = $pdo->prepare('INSERT INTO players (name, number) VALUES (?, ?)');
        $stmt->execute([$name, $number]);
        echo json_encode(['id' => $pdo->lastInsertId()]);
        break;

    case 'delete_player':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM players WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    case 'update_player_details':
        $id = (int)($input['id'] ?? 0);
        $pos1 = $input['position_1'] ?? null;
        $pos2 = $input['position_2'] ?? null;
        $pos3 = $input['position_3'] ?? null;
        $level = (int)($input['level'] ?? 2);

        $validPositions = ['gardienne', 'defense_centrale', 'defense_laterale', 'milieu_centre', 'milieu_aile', 'attaquante_centre', 'attaquante_aile', null, ''];
        foreach ([$pos1, $pos2, $pos3] as $p) {
            if (!in_array($p, $validPositions)) {
                http_response_code(400);
                echo json_encode(['error' => 'Position invalide']);
                break 2;
            }
        }
        if ($level < 1 || $level > 3) {
            http_response_code(400);
            echo json_encode(['error' => 'Niveau invalide (1-3)']);
            break;
        }

        $pos1 = $pos1 === '' ? null : $pos1;
        $pos2 = $pos2 === '' ? null : $pos2;
        $pos3 = $pos3 === '' ? null : $pos3;

        $stmt = $pdo->prepare('UPDATE players SET position_1 = ?, position_2 = ?, position_3 = ?, level = ? WHERE id = ?');
        $stmt->execute([$pos1, $pos2, $pos3, $level, $id]);
        echo json_encode(['ok' => true]);
        break;

    // ===================== TRAININGS =====================
    case 'get_trainings':
        $trainings = $pdo->query('SELECT id, date FROM trainings ORDER BY date')->fetchAll();
        foreach ($trainings as &$t) {
            $stmt = $pdo->prepare('SELECT player_id FROM training_presences WHERE training_id = ?');
            $stmt->execute([$t['id']]);
            $t['presentIds'] = array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        }
        echo json_encode($trainings);
        break;

    case 'save_training':
        $date = $input['date'] ?? '';
        $presentIds = $input['presentIds'] ?? [];
        if ($date === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Date requise']);
            break;
        }

        // Check if training exists for this date
        $stmt = $pdo->prepare('SELECT id FROM trainings WHERE date = ?');
        $stmt->execute([$date]);
        $existing = $stmt->fetch();

        if ($existing) {
            $trainingId = $existing['id'];
            // Clear old presences
            $pdo->prepare('DELETE FROM training_presences WHERE training_id = ?')->execute([$trainingId]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO trainings (date) VALUES (?)');
            $stmt->execute([$date]);
            $trainingId = $pdo->lastInsertId();
        }

        // Insert presences
        if (!empty($presentIds)) {
            $stmt = $pdo->prepare('INSERT INTO training_presences (training_id, player_id) VALUES (?, ?)');
            foreach ($presentIds as $pid) {
                $stmt->execute([$trainingId, (int)$pid]);
            }
        }

        echo json_encode(['id' => $trainingId]);
        break;

    case 'delete_training':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM trainings WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    // ===================== IMPORTANT MESSAGE =====================
    case 'get_important_msg':
        $stmt = $pdo->query('SELECT id, title, text, icon FROM important_msg ORDER BY id DESC');
        echo json_encode($stmt->fetchAll());
        break;

    case 'save_important_msg':
        $title = trim($input['title'] ?? '');
        $text = trim($input['text'] ?? '');
        $icon = $input['icon'] ?? 'warning';
        $stmt = $pdo->prepare('INSERT INTO important_msg (title, text, icon) VALUES (?, ?, ?)');
        $stmt->execute([$title, $text, $icon]);
        echo json_encode(['ok' => true]);
        break;

    case 'delete_important_msg':
        $id = intval($input['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM important_msg WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    // ===================== NOTES =====================
    case 'get_notes':
        $stmt = $pdo->query('SELECT id, text FROM notes ORDER BY id');
        echo json_encode($stmt->fetchAll());
        break;

    case 'add_note':
        $text = trim($input['text'] ?? '');
        if ($text === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Texte requis']);
            break;
        }
        $stmt = $pdo->prepare('INSERT INTO notes (text) VALUES (?)');
        $stmt->execute([$text]);
        echo json_encode(['id' => $pdo->lastInsertId()]);
        break;

    case 'delete_note':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM notes WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    // ===================== REFEREES =====================
    case 'get_referees':
        $stmt = $pdo->query('SELECT id, date, name, phone FROM referees ORDER BY date, id');
        echo json_encode($stmt->fetchAll());
        break;

    case 'add_referee':
        $date = $input['date'] ?? '';
        $name = trim($input['name'] ?? '');
        $phone = trim($input['phone'] ?? '');
        if ($date === '' || $name === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Date et nom requis']);
            break;
        }
        // Check max 2 per date
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM referees WHERE date = ?');
        $stmt->execute([$date]);
        if ($stmt->fetchColumn() >= 2) {
            http_response_code(400);
            echo json_encode(['error' => 'Deja 2 arbitres pour cette date']);
            break;
        }
        $stmt = $pdo->prepare('INSERT INTO referees (date, name, phone) VALUES (?, ?, ?)');
        $stmt->execute([$date, $name, $phone]);
        echo json_encode(['id' => $pdo->lastInsertId()]);
        break;

    case 'delete_referee':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM referees WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    // ===================== COACH PASSWORD =====================
    case 'verify_coach_password':
        $password = $input['password'] ?? '';
        $stored = '111';
        try {
            $stmt = $pdo->prepare('SELECT value FROM settings WHERE `key` = ?');
            $stmt->execute(['coach_password']);
            $row = $stmt->fetchColumn();
            if ($row !== false) $stored = $row;
        } catch (Exception $e) {
            // Table settings n'existe pas encore, utiliser le defaut
        }
        echo json_encode(['ok' => $password === $stored]);
        break;

    case 'change_coach_password':
        $oldPassword = $input['old_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        if ($newPassword === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Nouveau mot de passe requis']);
            break;
        }
        $stored = '111';
        try {
            $stmt = $pdo->prepare('SELECT value FROM settings WHERE `key` = ?');
            $stmt->execute(['coach_password']);
            $row = $stmt->fetchColumn();
            if ($row !== false) $stored = $row;
        } catch (Exception $e) {}
        if ($oldPassword !== $stored) {
            http_response_code(403);
            echo json_encode(['error' => 'Ancien mot de passe incorrect']);
            break;
        }
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS settings (`key` VARCHAR(50) PRIMARY KEY, value TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $stmt = $pdo->prepare('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?');
            $stmt->execute(['coach_password', $newPassword, $newPassword]);
            echo json_encode(['ok' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Erreur serveur']);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Action inconnue']);
}
