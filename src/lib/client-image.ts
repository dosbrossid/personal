const STATIC_COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
}

interface UploadPublicImageOptions extends CompressImageOptions {
  context?: 'blog' | 'cover' | 'note';
  registerBlogMedia?: boolean;
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.${nextExtension}`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca gambar untuk kompresi.'));
    };

    image.src = objectUrl;
  });
}

export async function compressImageFile(
  file: File,
  options?: CompressImageOptions
): Promise<File> {
  if (!STATIC_COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  const image = await loadImage(file);
  const maxDimension = options?.maxDimension ?? 1920;
  const quality = options?.quality ?? 0.82;

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas tidak tersedia untuk kompresi gambar.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/webp', quality);
  });

  if (!blob) {
    throw new Error('Gagal membuat file WebP terkompresi.');
  }

  return new File([blob], replaceFileExtension(file.name, 'webp'), {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

export async function uploadCompressedPublicImage(
  file: File,
  options?: UploadPublicImageOptions
) {
  const preparedFile = await compressImageFile(file, options);
  const formData = new FormData();
  formData.append('file', preparedFile);
  formData.append('context', options?.context ?? 'blog');
  formData.append('registerBlogMedia', options?.registerBlogMedia === false ? 'false' : 'true');

  const response = await fetch('/api/blog/media', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Gagal upload gambar');
  }

  if (!payload?.data?.publicUrl) {
    throw new Error('URL gambar tidak ditemukan setelah upload');
  }

  return payload.data as {
    id?: string;
    storagePath: string;
    publicUrl: string;
    mimeType: string;
    originalName: string;
  };
}
