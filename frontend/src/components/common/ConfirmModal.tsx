import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isDangerous?: boolean;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant,
  isDangerous,
  isLoading = false,
}) => {
  const effectiveVariant = isDangerous ? 'danger' : (variant || 'danger');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="p-6 flex flex-col gap-4">
        <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 mt-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={effectiveVariant === 'danger' ? 'adventure' : 'primary'}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
            className={effectiveVariant === 'danger' ? 'bg-light-error hover:bg-red-700 text-white' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
