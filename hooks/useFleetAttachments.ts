import React from 'react';
import { Attachment, Vehicle, Driver } from '../types';
import { decryptDataUrl } from '../services/crypto';
import { putAttachmentData, getAttachmentData, deleteAttachmentData } from '../services/attachmentStore';
import { buildAttachmentPayload } from '../services/attachmentPipeline';

type Target = 'vehicle' | 'driver';

interface FleetAttachmentsParams {
  attachmentKeyId: string;
  vehicleForm: Partial<Vehicle>;
  setVehicleForm: React.Dispatch<React.SetStateAction<Partial<Vehicle>>>;
  driverForm: Partial<Driver>;
  setDriverForm: React.Dispatch<React.SetStateAction<Partial<Driver>>>;
}

export const useFleetAttachments = ({
  attachmentKeyId,
  vehicleForm,
  setVehicleForm,
  driverForm,
  setDriverForm
}: FleetAttachmentsParams) => {
  const openAttachment = async (attachment: Attachment) => {
    let dataUrl = attachment.data || '';

    try {
      if (!dataUrl && attachment.dataEnc && attachment.iv) {
        dataUrl = await decryptDataUrl({ dataUrl: attachment.dataEnc, enc: true, iv: attachment.iv }, attachmentKeyId);
      } else if (!dataUrl && attachment.storage === 'idb') {
        const stored = await getAttachmentData(attachment.id);
        if (stored) dataUrl = await decryptDataUrl(stored, attachmentKeyId);
      }
    } catch (e) {
      console.error("Erreur de déchiffrement:", e);
    }

    if (!dataUrl) {
      alert("Impossible d'ouvrir le document. Données manquantes.");
      return;
    }

    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: Target) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sécurité taille fichier pour PDF
    if (file.type === 'application/pdf' && file.size > 2 * 1024 * 1024) {
      alert("Le fichier PDF est trop volumineux (Max 2MB). La synchronisation échouera.");
      return;
    }

    try {
      const { attachment: newAtt, encrypted } = await buildAttachmentPayload(file, attachmentKeyId);

      try {
        await putAttachmentData(newAtt.id, encrypted);
      } catch (e) {
        console.warn("Stockage IndexedDB indisponible, sauvegarde inline.");
        newAtt.storage = 'inline';
        if (encrypted.enc) {
          newAtt.dataEnc = encrypted.dataUrl;
          newAtt.iv = encrypted.iv;
        } else {
          newAtt.data = encrypted.dataUrl;
        }
      }
      
      if (target === 'vehicle') {
        setVehicleForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAtt] }));
      } else {
        setDriverForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAtt] }));
      }
    } catch (error) {
      console.error("Erreur traitement fichier:", error);
      alert("Impossible de traiter ce fichier.");
    }
  };

  const handleDeleteAttachment = async (index: number, target: Target) => {
    const current = target === 'vehicle' ? (vehicleForm.attachments || []) : (driverForm.attachments || []);
    const att = current[index];
    if (att?.storage === 'idb') {
      try { await deleteAttachmentData(att.id); } catch (e) {}
    }

    if (target === 'vehicle') {
      setVehicleForm(prev => ({
        ...prev,
        attachments: prev.attachments?.filter((_, i) => i !== index)
      }));
    } else {
      setDriverForm(prev => ({
        ...prev,
        attachments: prev.attachments?.filter((_, i) => i !== index)
      }));
    }
  };

  return { openAttachment, handleAttachmentUpload, handleDeleteAttachment };
};
