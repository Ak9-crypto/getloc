from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except Exception:
            data = {}

        client_ip = self.headers.get('X-Forwarded-For', self.client_address[0])

        if data.get("denied"):
            # This is where you'd flag the login attempt as blocked in production.
            print(f"[DENIED] ip={client_ip} error={data.get('error')}")
            response = {"status": "denied_recorded"}
        else:
            lat = data.get("lat")
            lng = data.get("lng")
            accuracy = data.get("accuracy")
            # In production: look up the user's session, compare this location
            # against their known/trusted locations, and decide allow/block/step-up.
            print(f"[LOCATION] ip={client_ip} lat={lat} lng={lng} accuracy={accuracy}m")
            response = {"status": "received", "lat": lat, "lng": lng}

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "note": "POST location data here"}).encode())
