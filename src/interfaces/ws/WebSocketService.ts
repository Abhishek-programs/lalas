import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { singleton } from 'tsyringe';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';

interface UserConnection {
  ws: WebSocket;
  userId: string;
}

@singleton()
export class WebSocketService {
  private connections: Map<string, WebSocket[]> = new Map();

  /**
   * Initialize the WebSocket server on top of the HTTP server.
   */
  init(server: Server) {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws: WebSocket, req) => {
      // Authenticate via query parameter token
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(4001, 'Authentication required');
        return;
      }

      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
        const userId = decoded.sub;

        // Store connection
        if (!this.connections.has(userId)) {
          this.connections.set(userId, []);
        }
        this.connections.get(userId)!.push(ws);

        console.log(`WebSocket: User ${userId} connected`);

        ws.on('close', () => {
          const userConns = this.connections.get(userId);
          if (userConns) {
            const idx = userConns.indexOf(ws);
            if (idx !== -1) userConns.splice(idx, 1);
            if (userConns.length === 0) {
              this.connections.delete(userId);
            }
          }
          console.log(`WebSocket: User ${userId} disconnected`);
        });

        ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Welcome to MusicGPT WebSocket' }));
      } catch (err) {
        ws.close(4002, 'Invalid token');
      }
    });

    console.log('WebSocket server initialized on /ws');
  }

  /**
   * Send a notification to a specific user.
   */
  notifyUser(userId: string, payload: any) {
    const userConns = this.connections.get(userId);
    if (userConns) {
      const message = JSON.stringify(payload);
      for (const ws of userConns) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  }
}
