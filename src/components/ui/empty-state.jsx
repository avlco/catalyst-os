import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      {title && <h3 className="text-h3 text-foreground mb-2">{title}</h3>}
      {description && <p className="text-body-m text-muted-foreground mb-6 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
