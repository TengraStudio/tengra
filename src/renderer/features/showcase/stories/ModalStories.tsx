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
import { useTranslation } from '@/i18n';

import type { ComponentStory } from '../types';

const ModalWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { title, content, size, showFooter } = props as {
    title?: string
    content?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showFooter?: boolean
  };
  const [isOpen, setIsOpen] = useState(false);
  const resolvedTitle = title ? t(title) : t('showcase.modal.fallback.title');
  const resolvedContent = content ? t(content) : t('showcase.modal.fallback.content');

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {t('showcase.modal.actions.openWithTitle', { title: resolvedTitle })}
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={resolvedTitle}
        size={size}
        footer={showFooter ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>{t('showcase.modal.actions.cancel')}</Button>
            <Button onClick={() => setIsOpen(false)}>{t('showcase.modal.actions.confirm')}</Button>
          </div>
        ) : undefined}
      >
        <p className="text-muted-foreground">{resolvedContent}</p>
      </Modal>
    </>
  );
};

const ConfirmWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { variant, title, message } = props as {
    variant?: 'danger' | 'warning' | 'info'
    title?: string
    message?: string
  };
  const [isOpen, setIsOpen] = useState(false);
  const resolvedVariant = variant ?? 'danger';
  const variantLabelByType: Record<'danger' | 'warning' | 'info', string> = {
    danger: t('showcase.variants.danger'),
    warning: t('showcase.variants.warning'),
    info: t('showcase.variants.info'),
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {t('showcase.modal.confirm.actions.openVariant', { variant: variantLabelByType[resolvedVariant] })}
      </Button>
      <ConfirmationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
        title={title ? t(title) : t('showcase.modal.confirm.fallback.title')}
        message={message ? t(message) : t('showcase.modal.confirm.fallback.message')}
        variant={variant}
      />
    </>
  );
};

const FormModalWrapper: React.FC<Record<string, RendererDataValue>> = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {t('showcase.modal.form.actions.open')}
      </Button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('showcase.modal.form.title')} size="md" footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>{t('showcase.modal.actions.cancel')}</Button>
          <Button onClick={() => setIsOpen(false)}>{t('showcase.modal.form.actions.create')}</Button>
        </div>
      }>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name-input">{t('showcase.modal.form.labels.name')}</Label>
            <Input id="name-input" placeholder={t('showcase.modal.form.placeholders.name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc-input">{t('showcase.modal.form.labels.description')}</Label>
            <Input id="desc-input" placeholder={t('showcase.modal.form.placeholders.description')} />
          </div>
        </div>
      </Modal>
    </>
  );
};

export const modalStory: ComponentStory = {
  name: 'showcase.story.modal',
  category: 'showcase.categories.overlay',
  component: ModalWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    {
      name: 'showcase.variants.basic',
      props: { title: 'showcase.modal.titles.basic', content: 'showcase.modal.contents.simple' },
    },
    {
      name: 'showcase.variants.withFooter',
      props: { title: 'showcase.modal.titles.confirm', content: 'showcase.modal.contents.confirmAction', showFooter: true },
    },
    {
      name: 'showcase.variants.large',
      props: { title: 'showcase.modal.titles.large', size: 'lg', content: 'showcase.modal.contents.large' },
    },
    {
      name: 'showcase.variants.small',
      props: { title: 'showcase.modal.titles.small', size: 'sm', content: 'showcase.modal.contents.small' },
    },
  ],
};

export const confirmationModalStory: ComponentStory = {
  name: 'showcase.story.confirmationModal',
  category: 'showcase.categories.overlay',
  component: ConfirmWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    {
      name: 'showcase.variants.danger',
      props: { variant: 'danger', title: 'showcase.modal.confirm.titles.deleteItem', message: 'showcase.modal.confirm.messages.deletePermanent' },
    },
    {
      name: 'showcase.variants.warning',
      props: { variant: 'warning', title: 'showcase.modal.confirm.titles.unsavedChanges', message: 'showcase.modal.confirm.messages.unsavedChanges' },
    },
    {
      name: 'showcase.variants.info',
      props: { variant: 'info', title: 'showcase.modal.confirm.titles.headsUp', message: 'showcase.modal.confirm.messages.updateRecords' },
    },
  ],
};

export const formModalStory: ComponentStory = {
  name: 'showcase.story.formModal',
  category: 'showcase.categories.overlay',
  component: FormModalWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.createForm', props: {}, description: 'showcase.modal.form.descriptions.withFields' },
  ],
};
