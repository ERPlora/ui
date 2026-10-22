// Public types of ImageUpload.

/** A stored image: `id` is what the page saves, `url` what the thumbnail shows. */
export interface ImageUploadValue {
  id: string;
  url: string;
}

/** Sends the chosen file and answers the stored image; a rejection's message is shown as is. */
export type ImageUploader = (file: File) => Promise<ImageUploadValue>;
