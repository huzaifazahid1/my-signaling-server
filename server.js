const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the receiver files statically
app.use(express.static(path.join(__dirname, './receiver')));

// Map: roomId -> Set<WebSocket>
const rooms = new Map();

console.log('Server running at http://localhost:3000');

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) { return; }

        if (data.type === 'join') {
            const { roomId } = data;
            if (!rooms.has(roomId)) rooms.set(roomId, new Set());
            const room = rooms.get(roomId);
            
            if (room.size >= 2) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room full' }));
                return;
            }
            
            room.add(ws);
            currentRoom = roomId;
            
            if (room.size === 2) {
                room.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'peer-joined' }));
                    }
                });
            }
        } else if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message.toString());
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            const room = rooms.get(currentRoom);
            room.delete(ws);
            if (room.size === 0) {
                rooms.delete(currentRoom);
            } else {
                room.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'peer-left' }));
                    }
                });
            }
        }
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});
