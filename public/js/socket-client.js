/**
 * Shared Socket.io client for Restaurant OS.
 * Provides a singleton socket connection and helper functions.
 */
const RestaurantSocket = (() => {
  const SERVER_URL = window.location.origin;

  class RestaurantSocketClient {
    constructor() {
      this.socket = null;
      this.connected = false;
      this.listeners = {};
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
    }

    connect() {
      if (this.socket && this.socket.connected) return;

      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('[RestaurantSocket] Connected:', this.socket.id);
        this._emit('_connected', { id: this.socket.id });
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        console.log('[RestaurantSocket] Disconnected:', reason);
        this._emit('_disconnected', { reason });
      });

      this.socket.on('connect_error', (err) => {
        this.reconnectAttempts++;
        console.warn('[RestaurantSocket] Connection error:', err.message);
      });
    }

    // Subscribe to an event
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
        if (this.socket) {
          this.socket.on(event, (data) => {
            (this.listeners[event] || []).forEach((cb) => cb(data));
          });
        }
      }
      this.listeners[event].push(callback);
      return () => this.off(event, callback);
    }

    // Unsubscribe
    off(event, callback) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }

    // Emit an event to the server
    emit(event, data) {
      if (this.socket && this.socket.connected) {
        this.socket.emit(event, data);
      } else {
        console.warn('[RestaurantSocket] Cannot emit — not connected');
      }
    }

    // Internal emit to local listeners
    _emit(event, data) {
      (this.listeners[event] || []).forEach((cb) => cb(data));
    }

    // Disconnect
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.connected = false;
      }
    }

    // Check connection status
    isConnected() {
      return this.connected;
    }
  }

  // Singleton
  let instance;
  return {
    getInstance() {
      if (!instance) {
        instance = new RestaurantSocketClient();
      }
      return instance;
    },
  };
})();
