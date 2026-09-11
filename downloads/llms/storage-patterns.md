# Supabase Storage Patterns

> Practical implementation patterns for Supabase Storage: uploads, signed URLs, CDN, image transforms, and access control.
> Sources: supabase.com/docs/guides/storage, supabase.com/docs/guides/storage/uploads/standard-uploads, community guides.

---

## Overview

Supabase Storage provides file management with fine-grained access controls and optimized delivery.

**Key features:**
- **Multi Protocol**: S3 compatible, RESTful API, TUS resumable uploads
- **Global CDN**: 285+ cities worldwide
- **Image Optimization**: Resize, compress, transform on the fly
- **Fine-grained Access Control**: RLS policies for file permissions
- **Multiple Bucket Types**: Files, Analytics (Apache Iceberg), Vector (embeddings)

---

## 1. Bucket Types

### Files Buckets (Default)
```sql
-- Create a public bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true);

-- Create a private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-docs', 'private-docs', false);
```

### Vector Buckets (AI/Embeddings)
```sql
-- Create a vector bucket for similarity search
INSERT INTO storage.buckets (id, name, public)
VALUES ('embeddings', 'embeddings', false);
```

---

## 2. Standard Upload Patterns

### Basic File Upload

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function uploadFile(file: File) {
  const { data, error } = await supabase.storage
    .from('bucket_name')
    .upload('file_path', file)

  if (error) {
    console.error('Upload error:', error.message)
    return null
  }
  return data
}
```

### Upload with Metadata

```typescript
async function uploadWithMetadata(file: File, userId: string) {
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .upload(`${userId}/${file.name}`, file, {
      contentType: file.type,
      upsert: false,
      metadata: {
        userId,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    })

  return { data, error }
}
```

### Upsert (Overwrite) Pattern

```typescript
// Use upsert: true to overwrite existing files
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`user-${userId}.jpg`, file, {
    upsert: true, // Overwrites if exists
    contentType: 'image/jpeg',
  })
```

**Note:** Avoid overwriting when possible. The CDN takes time to propagate changes, leading to stale content. Upload to a new path instead.

---

## 3. Resumable Uploads (TUS)

### Client-Side TUS Upload

```typescript
import Uppy from '@uppy/core'
import Tus from '@uppy/tus'
import Dashboard from '@uppy/dashboard'

const uppy = new Uppy({
  restrictions: { maxSize: 10 * 1024 * 1024 * 1024 }, // 10GB limit
})
  .use(Dashboard, { inline: true, target: '#upload-area' })
  .use(Tus, {
    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${accessToken}`,
    },
    onBeforeRequest: (req) => {
      // Set bucket and path metadata
      const metadata = JSON.parse(req.headers['Tus-Resumable'] || '{}')
      req.headers['x-upsert'] = 'true'
    },
    chunkSize: 6 * 1024 * 1024, // 6MB chunks
    retryDelays: [0, 1000, 3000, 5000],
  })

uppy.on('upload-success', (file, response) => {
  console.log('Upload complete:', file.name)
})
```

### When to Use TUS vs Standard

| Size | Method | Why |
|------|--------|-----|
| < 6MB | Standard upload | Simpler, faster for small files |
| 6MB - 5GB | TUS resumable | Reliable, supports pause/resume |
| > 5GB | TUS resumable | Only option for large files |

---

## 4. Signed URLs

### Generate Signed Upload URL

```typescript
// Server-side: Generate a signed upload URL (bypasses your server)
const { data, error } = await supabase.storage
  .from('bucket_name')
  .createSignedUploadUrl('file_path')

// Client-side: Upload directly using the signed URL
const { error } = await supabase.storage
  .from('bucket_name')
  .uploadToSignedUrl('file_path', file, {
    token: data.token,
  })
```

### Generate Signed Download URL

```typescript
// Create a signed URL for downloading (expires in 1 hour)
const { data, error } = await supabase.storage
  .from('private-docs')
  .createSignedUrl('report.pdf', 3600) // 3600 seconds = 1 hour

// Use the signed URL
window.open(data.signedUrl)
```

### Signed URL with Transformation

```typescript
// Signed URL with image transformation
const { data } = await supabase.storage
  .from('images')
  .createSignedUrl('photo.jpg', 3600, {
    transform: {
      width: 400,
      height: 300,
      resize: 'cover',
      format: 'webp',
    },
  })
```

---

## 5. File Access Patterns

### Public URLs (Public Buckets)

```typescript
// Get public URL for files in public buckets
const { data } = supabase.storage
  .from('public-images')
  .getPublicUrl('photos/sunset.jpg')

// Use in img tag
<img src={data.publicUrl} alt="Sunset" />
```

### List Files

```typescript
// List files in a directory
const { data: files, error } = await supabase.storage
  .from('user-uploads')
  .list('user-123/', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
    search: '.jpg', // Filter by name
  })
```

### Delete Files

```typescript
// Delete a single file
const { error } = await supabase.storage
  .from('bucket_name')
  .remove(['path/to/file.jpg'])

// Delete multiple files
const { error } = await supabase.storage
  .from('bucket_name')
  .remove([
    'path/file1.jpg',
    'path/file2.jpg',
    'path/file3.jpg',
  ])
```

---

## 6. Image Transformations

### On-the-Fly Transformations

```typescript
// Resize image via URL transformation
const { data } = supabase.storage
  .from('images')
  .getPublicUrl('photo.jpg', {
    transform: {
      width: 800,
      height: 600,
      resize: 'cover', // cover, contain, fill
      format: 'webp',
      quality: 80,
    },
  })

// Use in img tag
<img src={data.publicUrl} alt="Transformed" />
```

### Thumbnail Generation

```typescript
function getImageUrl(path: string, size: 'sm' | 'md' | 'lg') {
  const sizes = {
    sm: { width: 150, height: 150 },
    md: { width: 400, height: 400 },
    lg: { width: 800, height: 800 },
  }

  const { data } = supabase.storage
    .from('images')
    .getPublicUrl(path, {
      transform: {
        ...sizes[size],
        resize: 'cover',
        format: 'webp',
        quality: 80,
      },
    })

  return data.publicUrl
}
```

---

## 7. Access Control with RLS

### Storage RLS Policies

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Users can only upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access for public buckets
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
TO anon
USING ( bucket_id = 'public-images' );
```

### Folder-Based Access Control

```typescript
// Upload to user-specific folder
async function uploadUserFile(file: File, userId: string) {
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .upload(`${userId}/${Date.now()}-${file.name}`, file)

  return { data, error }
}

// List only current user's files
async function listUserFiles(userId: string) {
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .list(userId, {
      limit: 50,
      sortBy: { column: 'created_at', order: 'desc' },
    })

  return { data, error }
}
```

---

## 8. CDN and Caching

### Smart CDN

Supabase Storage uses Smart CDN by default. Files are cached at edge nodes worldwide.

**Best practices:**
- Upload to new paths instead of overwriting (avoids stale content)
- Use versioned filenames: `photo-v2.jpg` instead of overwriting `photo.jpg`
- Set appropriate cache headers for custom deployments

### Cache Invalidation

```typescript
// Force CDN refresh by uploading to new path
const newPath = `photos/${Date.now()}-photo.jpg`
await supabase.storage.from('images').upload(newPath, file)

// Delete old path
await supabase.storage.from('images').remove(['photos/old-photo.jpg'])
```

---

## 9. Complete Upload Component

```typescript
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

function FileUploader({ userId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const handleUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    // Upload file
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
        onUploadProgress: (progress) => {
          setProgress(Math.round((progress.loaded / progress.total) * 100))
        },
      })

    if (error) {
      console.error('Upload error:', error.message)
    } else {
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(fileName)

      onUploadComplete(urlData.publicUrl)
    }

    setUploading(false)
  }

  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <progress value={progress} max="100" />}
    </div>
  )
}
```

---

## 10. Performance Best Practices

| Practice | Why |
|----------|-----|
| Use TUS for files > 6MB | Reliable resumable uploads |
| Upload to new paths, don't overwrite | Avoid CDN stale content |
| Use image transformations | Serve optimized sizes on demand |
| Set up RLS policies | Security at the database level |
| Use signed URLs for private files | Time-limited access |
| Compress before upload | Reduce storage costs and transfer time |
| Use folder-based organization | Clean access control via RLS |

---

*References:*
- https://supabase.com/docs/guides/storage
- https://supabase.com/docs/guides/storage/uploads/standard-uploads
- https://eastondev.com/blog/en/posts/dev/supabase-storage-guide/
- https://tomodahinata.com/en/blog/supabase-storage-production-implementation-guide-uploads-signed-urls-cdn-image-transformations
