import { type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
  large?: boolean;
  footer?: ReactNode;
}

export default function Modal({ title, children, onClose, large, footer }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal${large ? ' modal-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-icon" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
