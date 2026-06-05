# HunarHub Local Artisans

## Environment Variables

Required:
- `MONGODB_URI` - MongoDB connection URI.
- `MONGODB_DB` - MongoDB database name.
- `SUPABASE_URL` - Supabase URL for any remaining client-side auth or features.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` - optional for client-side Supabase integration.

### Image Uploads

Product image uploads no longer require Supabase Storage service-role credentials.
Images are now stored locally in `public/uploads` and served from `/uploads/<filename>`.

Example image URL stored in MongoDB:
- `/uploads/<userId>/<timestamp>.jpg`

This means image URLs persist after browser refresh and server restart, as long as the local `public/uploads` folder is preserved.

## Notes

- The upload UI remains unchanged for artisans.
- Image uploads are handled by `POST /api/storage/upload`.
- Uploaded images are saved on disk and returned as a public URL.
- Image URLs are stored in the product document `images` array.
