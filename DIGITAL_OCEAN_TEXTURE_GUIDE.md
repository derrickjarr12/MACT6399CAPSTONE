# Digital Ocean Texture Loading for HolographicGlobe

## Overview

The SAION GUI now supports dynamic texture loading from Digital Ocean Spaces (or any CORS-enabled CDN). The implementation includes:

- **Polling mechanism**: Checks for texture updates every 30 seconds
- **Texture loading**: Uses Three.js TextureLoader for efficient texture management
- **Normal map support**: Optional normal mapping for enhanced surface detail
- **UI controls**: Easy-to-use texture URL input fields in the CONTROLS tab
- **Status feedback**: Real-time feedback on texture loading success/failure

## Features

### 1. **Automatic Polling**
- Polls Digital Ocean every 30 seconds for updated textures
- Uses cache-busting query parameters to bypass browser cache
- Only reloads if the original URL changes

### 2. **Texture Properties**
- Wrapping: RepeatWrapping (seamless tiling)
- Filtering: LinearFilter (smooth appearance)
- Format: Any image format supported by WebGL (JPG, PNG, WebP, etc.)

### 3. **Real-time Status**
- Shows success/error messages in the UI
- Logs detailed messages to browser console
- Callback mechanism for parent component updates

## Usage

### Step 1: Prepare Your Images

Upload your texture images to Digital Ocean Spaces:
1. Go to https://cloud.digitalocean.com/spaces
2. Create a new Space (or use existing)
3. Upload your texture.jpg and normal_map.jpg
4. Make sure they are publicly accessible (CDN enabled)
5. Copy the CDN URL (not the direct URL)

Example CDN URL format:
```
https://your-space-name.nyc3.cdn.digitaloceanspaces.com/texture.jpg
```

### Step 2: Add Texture URLs in CONTROLS Tab

1. Navigate to the **CONTROLS** tab
2. Scroll down to **"Globe Textures (Digital Ocean)"** section
3. Paste your texture URL in the **Texture URL** field
4. (Optional) Paste your normal map URL in the **Normal Map URL** field
5. Hit Enter or click elsewhere to trigger loading

### Step 3: Monitor Loading

- Watch for the status message that appears below the input fields
- ✓ Success message: "Texture loaded" (green)
- ✗ Error message: Shows the error details (red)
- Console messages for debugging (open browser DevTools)

## Implementation Details

### HolographicGlobe Component Props

```jsx
<HolographicGlobe
  // ... existing props ...
  textureUrl={textureUrl}           // URL to load as globe texture
  normalMapUrl={normalMapUrl}       // Optional normal map URL
  onTextureUpdate={callback}        // Callback for status updates
/>
```

### State Management (App-new.jsx)

```jsx
const [textureUrl, setTextureUrl] = useState(null);
const [normalMapUrl, setNormalMapUrl] = useState(null);
const [textureUpdateStatus, setTextureUpdateStatus] = useState(null);
```

### Texture Loading Logic

1. **TextureLoader Initialization**
   - One reusable TextureLoader instance per component
   - Efficient memory management

2. **Load Function**
   - Fetches texture from URL
   - Applies texture wrapping and filtering
   - Updates globe material
   - Triggers callback with status

3. **Polling Mechanism**
   ```jsx
   // Polls every 30 seconds
   const pollInterval = setInterval(() => {
     // Check if URL changed
     if (textureUrl !== currentTextureUrlRef.current) {
       loadTexture(cacheBustUrl);
     }
   }, 30000);
   ```

## CORS Considerations

### Required CORS Headers

For the texture to load, your Digital Ocean Spaces must have CORS configured:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Allow-Headers: Content-Type
```

Digital Ocean Spaces CDN automatically enables these by default.

### Troubleshooting CORS Issues

If you get CORS errors:
1. Verify the URL is publicly accessible
2. Check Digital Ocean Spaces CORS settings
3. Try the Direct URL vs CDN URL
4. Check browser console for detailed error messages

## Cache Busting

The polling mechanism uses cache-busting to prevent stale texture caches:

```jsx
const cacheBustUrl = textureUrl.includes('?') 
  ? `${textureUrl}&t=${Date.now()}`
  : `${textureUrl}?t=${Date.now()}`;
```

This adds a timestamp parameter that changes on each poll, forcing the browser to fetch fresh content.

## Performance Notes

- Texture size: Recommended 1024x1024 to 4096x4096 pixels
- File format: JPG for smaller file sizes, PNG for transparency
- Polling frequency: 30 seconds (can be adjusted in HolographicGlobe.jsx)
- Memory: Textures are GPU-cached by Three.js

## Example Textures

### Metallic Texture
- URL: `https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Metal_texture.jpg/320px-Metal_texture.jpg`
- Type: Diffuse map

### Normal Map (Brick Wall)
- URL: `https://learnopengl.com/img/textures/wall_normal.jpg`
- Type: Normal map for surface detail

## Debugging

### Console Messages

The implementation logs helpful messages:

```
✅ Loaded texture from Digital Ocean: https://...
✓ Texture loaded

⚠️ Failed to load texture: Error message
✗ Error: Failed to load image

✅ Loaded normal map from Digital Ocean: https://...
```

### Browser DevTools

1. Open DevTools (F12)
2. Go to Console tab
3. Look for messages with ✅, ⚠️, or ✗ emojis
4. Network tab shows texture fetch requests

## Advanced Usage

### Manual Polling Control

To change polling frequency, edit [HolographicGlobe.jsx](src/HolographicGlobe.jsx) line ~135:

```jsx
}, 30000); // Change 30000ms (30 seconds) to desired interval
```

### Disable Polling

Comment out the polling logic to load texture only once:

```jsx
// const pollInterval = setInterval(() => { ... }, 30000);
// return () => clearInterval(pollInterval);
```

### Custom Callback

Add custom logic when textures load:

```jsx
<HolographicGlobe
  {...props}
  onTextureUpdate={(status) => {
    if (status.success) {
      console.log('Texture ready!', status.url);
      // Update UI, analytics, etc.
    } else {
      console.error('Texture failed:', status.error);
    }
  }}
/>
```

## Files Modified

- [gui/src/HolographicGlobe.jsx](gui/src/HolographicGlobe.jsx)
  - Added texture props
  - Added texture loading effects
  - Added polling logic
  - Added mesh/scene refs for texture updates

- [gui/src/App-new.jsx](gui/src/App-new.jsx)
  - Added texture URL state management
  - Added texture UI controls in CONTROLS tab
  - Passed texture props to HolographicGlobe

- [gui/src/styles.css](gui/src/styles.css)
  - Added `.texture-status` styling (success/error)
  - Added `.settings-hint` styling

## Next Steps

1. ✅ Implement texture loading (COMPLETED)
2. ✅ Add polling mechanism (COMPLETED)
3. ✅ Create UI controls (COMPLETED)
4. ✅ Add status feedback (COMPLETED)
5. 🔄 Test with real Digital Ocean URLs
6. 🔄 Monitor performance impact
7. 🔄 Consider webhook-based updates (future enhancement)

## Future Enhancements

### Option 1: Webhook-Based Updates (Real-time)
- Digital Ocean sends webhook when image changes
- Immediate texture reload
- Better for production use

### Option 2: Scheduled Updates
- Set custom polling intervals
- Update at specific times
- Control timing from UI

### Option 3: Multi-Layer Textures
- Stack multiple textures with blend modes
- Create complex visual effects
- Advanced compositing pipeline

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify Digital Ocean URL is correct and publicly accessible
3. Test CORS with a simple curl request:
   ```bash
   curl -i -H "Origin: http://localhost:5176" https://your-cdn.digitaloceanspaces.com/texture.jpg
   ```
4. Review the three files modified above for implementation details
