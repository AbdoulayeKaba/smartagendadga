import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  message: string | null | undefined;
  className?: string;
};

export function InlineFieldError({ id, message, className }: Props) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'workspace-crud-field-hint workspace-crud-field-hint--error mt-1.5',
        className
      )}
    >
      {message}
    </p>
  );
}

export function inlineFieldErrorClass(invalid: boolean, baseClass = ''): string {
  return cn(baseClass, invalid && 'border-destructive ring-destructive/20');
}
