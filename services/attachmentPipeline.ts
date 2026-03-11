import { Attachment } from '../types';
import { encryptDataUrl } from './crypto';
import { fileToDataUrl } from './attachmentProcessing';
import { generateId } from './id';

export const buildAttachmentPayload = async (file: File, attachmentKeyId: string) => {
  const dataUrl = await fileToDataUrl(file);
  const encrypted = await encryptDataUrl(dataUrl, attachmentKeyId);

  const attachment: Attachment = {
    id: generateId(),
    name: file.name,
    mimeType: file.type,
    storage: 'idb',
    date: new Date().toISOString()
  };

  return { attachment, encrypted };
};
