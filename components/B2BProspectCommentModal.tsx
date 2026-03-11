import React from 'react';
import { Prospect } from '../types';
import { MessageSquare, X } from 'lucide-react';

interface CommentModalProps {
  isOpen: boolean;
  prospect: Prospect | null;
  value: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  prospect,
  value,
  isSaving,
  onChange,
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-[2.5rem] shadow-2xl overflow-hidden p-6 animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Commentaire Agent</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prospect?.companyName || ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full">
            <X className="w-6 h-6 text-slate-300" />
          </button>
        </div>
        <div className="space-y-4 pb-6">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Note / Commentaire</label>
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full min-h-[140px] p-4 mt-1 rounded-2xl bg-slate-50 border-none font-bold text-sm shadow-inner resize-none"
              placeholder="Ajouter un commentaire pour l'agent..."
            />
          </div>
          <button onClick={onSave} disabled={isSaving} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 transition-transform disabled:opacity-70">
            {isSaving ? 'Enregistrement...' : 'Enregistrer le commentaire'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentModal;
