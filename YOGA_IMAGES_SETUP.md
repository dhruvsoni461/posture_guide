# Yoga Challenge Images Setup Guide

## Image Requirements

The Quick Yoga Challenge now uses real images instead of emojis. You need to add images for each pose.

## Image Paths

Place your images in the `public/assets/yoga/` directory with these exact filenames:

1. **Cobra Pose**: `public/assets/yoga/cobra.jpg`
2. **Cat-Cow Pose**: `public/assets/yoga/catcow.jpg`
3. **Seated Twist**: `public/assets/yoga/seated_twist.jpg`

## Directory Structure

```
posture/
├── public/
│   └── assets/
│       └── yoga/
│           ├── cobra.jpg
│           ├── catcow.jpg
│           └── seated_twist.jpg
└── src/
    └── components/
        └── QuickYogaChallenge.jsx
```

## Image Specifications

- **Format**: JPG, PNG, or WebP
- **Recommended size**: 800x600px or larger
- **Aspect ratio**: 4:3 or 16:9
- **File size**: Keep under 500KB for fast loading

## Where to Get Images

You can:
1. Use free stock photos from Unsplash, Pexels, or Pixabay
2. Create your own illustrations
3. Use screenshots from yoga tutorial videos (with permission)
4. Use AI-generated images

## Fallback Behavior

If images are not found, the component will:
- Show a placeholder with instructions
- Display the image path that should be used
- Still function normally with the tutorial text

## Testing

After adding images:
1. Restart your dev server
2. Open Quick Yoga Challenge
3. Verify images load for each pose
4. Check browser console for any 404 errors

## Updating Image Paths

If you want to use different paths or filenames, edit `src/components/QuickYogaChallenge.jsx`:

```javascript
const POSE_ASSETS = {
  cobra: {
    image: '/your/custom/path/cobra.jpg',
    // ...
  },
  // ...
};
```

