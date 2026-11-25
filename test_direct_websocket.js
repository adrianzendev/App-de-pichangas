const WebSocket = require('ws');

console.log('🔗 TESTING DIRECT WEBSOCKET CONNECTION');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', function() {
    console.log('✅ WebSocket connected successfully');
    
    // Send user connection message
    const message = {
        type: 'user_connected',
        userId: 'test-user-121905'
    };
    
    console.log('📤 Sending message:', JSON.stringify(message));
    ws.send(JSON.stringify(message));
});

ws.on('message', function(data) {
    console.log('📨 Received:', data.toString());
});

ws.on('close', function() {
    console.log('❌ WebSocket connection closed');
});

ws.on('error', function(error) {
    console.log('🔴 WebSocket error:', error.message);
});

// Keep alive for 10 seconds
setTimeout(() => {
    console.log('⏰ Closing test connection');
    ws.close();
}, 10000);