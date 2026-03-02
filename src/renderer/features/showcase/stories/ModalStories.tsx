/**
 * Story definitions for Modal and ConfirmationModal components.
 * Each variant renders a trigger button that opens the modal.
 */
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';

import type { ComponentStory } from '../types';

const ModalWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { title, content, size, showFooter } = props as {
    title?: string
    content?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showFooter?: boolean
  };
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Open {title ?? 'Modal'}
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        size={size}
        footer={showFooter ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={() => setIsOpen(false)}>Confirm</Button>
          </div>
        ) : undefined}
      >
        <p className="text-muted-foreground">{content ?? 'Modal content goes here.'}</p>
      </Modal>
    </>
  );
};

const ConfirmWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { variant, title, message } = props as {
    variant?: 'danger' | 'warning' | 'info'
    title?: string
    message?: string
  };
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Open {variant ?? 'danger'} confirm
      </Button>
      <ConfirmationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
        title={title ?? 'Are you sure?'}
        message={message ?? 'This action cannot be undone.'}
        variant={variant}
      />
    </>
  );
};

const FormModalWrapper: React.FC<Record<string, unknown>> = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Open Form Modal
      </Button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Item" size="md" footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={() => setIsOpen(false)}>Create</Button>
        </div>
      }>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name-input">Name</Label>
            <Input id="name-input" placeholder="Enter name..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc-input">Description</Label>
            <Input id="desc-input" placeholder="Enter description..." />
          </div>
        </div>
      </Modal>
    </>
  );
};

export const modalStory: ComponentStory = {
  name: 'Modal',
  category: 'Overlay',
  component: ModalWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Basic', props: { title: 'Basic Modal', content: 'Simple modal content.' } },
    { name: 'With Footer', props: { title: 'Confirm', content: 'Confirm action?', showFooter: true } },
    { name: 'Large', props: { title: 'Large Modal', size: 'lg', content: 'This is a large modal.' } },
    { name: 'Small', props: { title: 'Small Modal', size: 'sm', content: 'Compact modal.' } },
  ],
};

export const confirmationModalStory: ComponentStory = {
  name: 'ConfirmationModal',
  category: 'Overlay',
  component: ConfirmWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Danger', props: { variant: 'danger', title: 'Delete Item?', message: 'This will be permanently deleted.' } },
    { name: 'Warning', props: { variant: 'warning', title: 'Unsaved Changes', message: 'You have unsaved changes.' } },
    { name: 'Info', props: { variant: 'info', title: 'Heads Up', message: 'This will update all records.' } },
  ],
};

export const formModalStory: ComponentStory = {
  name: 'Form Modal',
  category: 'Overlay',
  component: FormModalWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Create Form', props: {}, description: 'Modal with form fields and actions' },
  ],
};
