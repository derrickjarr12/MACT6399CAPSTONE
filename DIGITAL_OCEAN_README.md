# Digital Ocean Spaces – Setup Guide for SAION Globe Textures

## What This Does

You can upload images to Digital Ocean Spaces and they will automatically appear **inside the holographic globe** in the SAION GUI. The globe polls for updates every 30 seconds, so you can swap images in Digital Ocean and the globe updates on its own.

---

## Step 1 – Create a Space

1. Log in at https://cloud.digitalocean.com
2. In the **left sidebar** click **Spaces Object Storage**
3. Click **Create a Space**
4. Fill in the form:
   - **Region**: Choose the closest to you (e.g. NYC3, SFO3, AMS3)
   - **CDN**: Turn it **ON** ← important, gives you fast CDN URL
   - **File Listing**: Set to **Public**
   - **Name**: Something like `saion-textures`
5. Click **Create a Space**

---

## Step 2 – Upload a Texture Image

1. Click into your new Space
2. Click **Upload Files**
3. Select your image (JPG or PNG recommended — 1024×1024 to 4096×4096 px)
4. After upload, click the file name
5. Click **More** → **Manage permissions** → set to **Public**

> **Tip:** Name your files clearly, e.g. `globe-texture.jpg`, `globe-normal.jpg`

---

## Step 3 – Get the CDN URL

After uploading, your CDN URL will follow this format:

```
https://YOUR-SPACE-NAME.REGION.cdn.digitaloceanspaces.com/YOUR-FILE.jpg
```

**Example:**
```
https://saion-textures.nyc3.cdn.digitaloceanspaces.com/globe-texture.jpg
```

You can find the exact URL by clicking the file in your Space → the URL is shown at the top.

---

## Step 4 – Add the URL to the SAION GUI

1. Open the SAION GUI at http://localhost:5176
2. Click the **CONTROLS** tab
3. Scroll down to **"Globe Textures (Digital Ocean)"**
4. Paste your CDN URL into the **Texture URL** field
5. (Optional) Paste a normal map URL into the **Normal Map URL** field
6. A green **"✓ Texture loaded"** message confirms it worked

---

## Step 5 – Update Textures (Auto-Polling)

- The globe **automatically checks** your Digital Ocean URL every **30 seconds**
- To swap the texture: **upload a new image** to your Space with the **same filename**
- The globe will pick it up on the next poll without any manual refresh

---

## CORS Setup (if you get loading errors)

If the texture fails to load with a CORS error in the browser console:

1. Go to your Space in Digital Ocean
2. Click **Settings** tab
3. Scroll to **CORS Configurations**
4. Click **Add**
5. Fill in:
   - **Origin**: `http://localhost:5176`
   - **Allowed Methods**: `GET`, `HEAD`
   - **Access Control Max Age**: `3000`
6. Click **Save**

For production, also add your live domain as an origin.

---

## Normal Maps (Optional)

A normal map adds depth/surface detail on top of your texture.

- Upload a second image (usually looks like a blue/purple bumpy image)
- Paste its CDN URL into the **Normal Map URL** field in CONTROLS
- Works best with a matching diffuse texture in the Texture URL field

---

## Supported Image Formats

| Format | Works | Notes |
|--------|-------|-------|
| JPG    | ✅    | Smaller file size, best for photos |
| PNG    | ✅    | Good for transparency |
| WebP   | ✅    | Smallest file size |
| GIF    | ❌    | Not supported by WebGL |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Red "✗ Error" message in GUI | Check the URL is correct and file is set to Public |
| Texture doesn't update after swap | Wait 30 seconds for the next poll cycle |
| CORS error in browser console | Follow CORS setup above |
| Image looks blurry | Use a higher-res image (2048×2048 or 4096×4096) |
| Black globe | Texture may be loading — wait a moment and check console |

---

## Quick Reference

| Item | Where |
|------|-------|
| Digital Ocean login | https://cloud.digitalocean.com |
| Spaces dashboard | https://cloud.digitalocean.com/spaces |
| GUI Controls tab | http://localhost:5176 → CONTROLS |
| Polling interval | Every 30 seconds (automatic) |
| Status feedback | Green ✓ = loaded, Red ✗ = error |
