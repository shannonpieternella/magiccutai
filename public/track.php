<?php
// track.php - UTM Tracking Proxy for MagicCutAI
// Upload this file to the root directory of magiccutai.com

// Allow GET requests (for pixel tracking)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Forward to ngrok
    $ngrokUrl = 'https://41fa332f6a86.ngrok-free.app/t.gif?' . $_SERVER['QUERY_STRING'];
    
    // Get the image from ngrok
    $image = @file_get_contents($ngrokUrl);
    
    // Send the image to browser
    header('Content-Type: image/gif');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    if ($image) {
        echo $image;
    } else {
        // Send 1x1 transparent gif if ngrok fails
        echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    }
    exit;
}

// Allow POST requests (for events)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = file_get_contents('php://input');
    
    // Forward to ngrok
    $ch = curl_init('https://41fa332f6a86.ngrok-free.app/api/tracking/event');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: utm_Q9Oi2TSYzFb0mLhVx8Qsy6EPGkyGQtZe'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo $response;
    exit;
}

// Method not allowed
http_response_code(405);
echo 'Method not allowed';
?>