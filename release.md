## What's New

### Student Profiles
You can now view detailed student profiles directly from the admin dashboard. Click on any student's name in the enrolled students list or newly registered students list to open their profile modal. This shows their name, email, and profile picture.

### Name Collection
When new students register, they now provide their first name, and optionally a middle name and last name. The system stores these separately but displays the full name normally, so nothing changes for existing users — all old names have been automatically split into parts during setup.

### Profile Pictures
Instructors and admins can now upload and change profile pictures. If no image is set, the system shows initials based on the student's first and last name. You can also remove a picture to go back to initials.

### Instructor Codes
Instructors can now view and manage their personal instructor code directly from their profile. There are buttons to copy the code to the clipboard or regenerate it if needed. This code is what students use to enroll in their classes.

### Admin Navigation
- The navbar now has a **Profile** button above **Change password** in the dropdown
- The profile modal shows different headers depending on your role: **Student Profile**, **Instructor Profile**, or **Admin Profile**
- Age is now displayed from date of birth where available

### Mobile Friendly
- The profile modal adjusts nicely on phones and tablets
- Student profile modal is narrower on mobile devices
- Avatars in the navbar are sized to match the logo

## Updates

### Admin Students Page
- Clicking a student's name anywhere in the table now opens their profile — no need to click a separate "Profile" button
- This works in both the "Enrolled Students" section and the "Newly Registered" section

### Subject Details
- On subject detail pages, the enrollment token card has been moved to appear above the exams section for better visibility

## Bug Fixes

- Profile modals now center properly on all screen sizes, including mobile phones
- Student name clicks reliably open the profile modal in all list views
- Existing user names have been automatically preserved and split into first/middle/last parts during setup — no action needed

## Version
**v1.1.0**

## Upgrading

If you are updating from an earlier version:

```sh
sudo npm run update      # or: npm run deploy -- -NoStart
```
**Manual**

1. Pull the latest changes from Git
2. Run `npx prisma db push` to update the database
3. Run `npx tsx scripts/backfill-name-parts.ts` to split existing names into parts (this runs automatically on first start, but you can run it manually)
4. Run `npm run build` to rebuild the application
5. Restart the development server with `npm run dev`

All your existing data — students, exams, grades, and settings — will remain intact. The new name fields are populated automatically from the names you already have in the system.