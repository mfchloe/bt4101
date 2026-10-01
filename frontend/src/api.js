// Port 5001 rather than Flask's default 5000: on macOS, port 5000 is taken by
// the AirPlay Receiver, which answers requests with "403 Forbidden".
export const API_URL = "http://127.0.0.1:5001";
