# Quick Yoga Challenge - Tutorial Mode

## Overview

The Quick Yoga Challenge has been updated to focus on **tutorials and instruction** rather than pose detection. Users learn how to do each pose with step-by-step instructions, then practice for 5 seconds.

## Key Changes

### ✅ Removed Pose Detection
- No ML-based pose validation
- No scoring based on pose correctness
- Focus is on learning and practice

### ✅ Added Detailed Tutorials
Each pose now includes:
- **Step-by-step instructions** (4-5 steps per pose)
- **Tips** for each step
- **Benefits** of the pose
- **Precautions** to be aware of
- **Visual guide** with image

### ✅ Real Images Instead of Emojis
- Removed emoji icons (🐍, 🐱, 🔄)
- Uses actual images from `/assets/yoga/` directory
- Fallback message if images are missing

### ✅ Camera Visibility Fixed
- Camera frame stays visible during all phases
- Video element is explicitly shown and positioned
- Semi-transparent overlays allow camera to show through
- Camera is ensured to be active before practice starts

## Flow

1. **Intro** → User clicks "Begin Challenge"
2. **Tutorial** → Step-by-step instructions with image
3. **Practice** → 3-second countdown, then 5-second practice with camera visible
4. **Summary** → Shows completion status and XP earned

## Image Setup

See `YOGA_IMAGES_SETUP.md` for details on adding images.

Required images:
- `public/assets/yoga/cobra.jpg`
- `public/assets/yoga/catcow.jpg`
- `public/assets/yoga/seated_twist.jpg`

## Camera Requirements

The camera component (`CameraAccessWithPoseFixed`) must be rendered on the page for the challenge to work. The challenge will:

1. Find the video element from the camera component
2. Ensure it's visible and playing
3. Keep it visible during tutorial and practice phases

## Tutorial Content

### Cobra Pose
- 4 steps with detailed instructions
- Tips for proper form
- Benefits: Strengthens spine, opens chest, improves posture
- Precautions: Avoid with back injuries

### Cat-Cow Pose
- 4 steps with breathing guidance
- Tips for smooth movement
- Benefits: Spinal flexibility, tension relief
- Precautions: Move slowly with neck issues

### Seated Twist
- 5 steps with detailed positioning
- Tips for safe twisting
- Benefits: Spinal rotation, digestion improvement
- Precautions: Avoid with recent back injuries

## Testing Checklist

- [ ] Images load for all 3 poses (or show fallback message)
- [ ] Camera is visible during tutorial phase
- [ ] Camera is visible during practice phase
- [ ] Step navigation works (Prev/Next buttons)
- [ ] Practice timer counts down correctly
- [ ] Summary shows completion status
- [ ] All tutorial content displays correctly

## Troubleshooting

### Camera Not Visible
1. Ensure `CameraAccessWithPoseFixed` is rendered on the page
2. Check browser console for `[YogaChallenge]` logs
3. Verify camera permissions are granted
4. Check that video element exists in DOM

### Images Not Loading
1. Verify images are in `public/assets/yoga/` directory
2. Check filenames match exactly (case-sensitive)
3. Check browser console for 404 errors
4. Fallback message will show if images are missing

### Tutorial Steps Not Showing
1. Check browser console for errors
2. Verify `POSE_ASSETS` object has `tutorial` property
3. Ensure all steps have required fields (title, instruction)

## Future Enhancements

Potential additions:
- Video tutorials instead of static images
- Audio narration of steps
- Progress tracking across sessions
- Custom practice duration
- Pose variations

