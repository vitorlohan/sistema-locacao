import { type ReactNode } from 'react';

interface Props {
  title: string;
  message: string | ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', danger }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>{title}</h3></div>
        <div className="modal-body">
          <p style={{ fontSize: '.9rem', color: '#4b5563' }}>{message}</p>
          <div className="confirm-actions">
            <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
