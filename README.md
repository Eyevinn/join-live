# Join Live - Participant Broadcast Application

A web application that allows participants to join live broadcasts from their browser using WebRTC and WHIP (WebRTC-HTTP Ingestion Protocol).

## Features

- 📹 Camera preview with automatic permission handling
- 🔴 One-click live broadcasting via WHIP
- ⚙️ Configurable WHIP gateway (defaults to OSC livevibe)
- 📱 Responsive design for desktop and mobile
- 🎛️ Real-time status updates

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

4. **Join the broadcast:**
   - Click "Start Camera" to preview your video
   - Click "Join Live" to start broadcasting
   - Click "Stop Streaming" to end the broadcast

## Configuration

### WHIP Gateway URL

The application defaults to the OSC livevibe service. To use a different WHIP gateway:

**Option 1: Environment Variable**
```bash
WHIP_GATEWAY_URL=https://your-whip-gateway.com/whip npm start
```

**Option 2: .env file**
```bash
cp .env.example .env
# Edit .env and set your WHIP_GATEWAY_URL
```

### WHIP Authentication

If your WHIP gateway requires authentication, set the auth key:

**Option 1: Environment Variable**
```bash
WHIP_AUTH_KEY=your-auth-key npm start
```

**Option 2: .env file**
```bash
cp .env.example .env
# Edit .env and set your WHIP_AUTH_KEY
```

**Combined Example:**
```bash
WHIP_GATEWAY_URL=https://your-gateway.com/whip WHIP_AUTH_KEY=secret123 npm start
```

### Port Configuration

```bash
PORT=8080 npm start  # Run on port 8080 instead of 3000
```

## Technical Details

### Dependencies

- **@eyevinn/whip-web-client**: Open source WHIP client library
- **express**: Web server for serving the application

### WebRTC Configuration

The application requests camera and microphone access with these settings:
- Video: 1280x720 resolution (ideal)
- Audio: Default microphone
- Camera: Front-facing (user) camera preferred

### WHIP Integration

Uses the Symphony Media Bridge WHIP gateway for ingesting WebRTC streams. The default configuration points to the OSC livevibe service at `https://livevibe.osaas.io/api/v2/whip/sfu-broadcaster`.

## Browser Support

- Chrome 88+
- Firefox 84+
- Safari 14+
- Edge 88+

## Troubleshooting

### Camera Access Issues
- Ensure you're accessing the app via HTTPS in production
- Check browser permissions for camera/microphone access
- Some browsers require user interaction before requesting media access

### Connection Issues
- Verify the WHIP gateway URL is correct and accessible
- Check network connectivity and firewall settings
- Ensure the WHIP gateway supports the required WebRTC codecs

### Development
For development with HTTPS (required for camera access on remote devices):
```bash
# Use a tool like ngrok for HTTPS tunneling
npx ngrok http 3000
```

## License

MIT