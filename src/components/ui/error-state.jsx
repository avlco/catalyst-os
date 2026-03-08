import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred. Please try again.',
  onRetry,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
      <h3 className="text-body-l font-semibold mb-1">{title}</h3>
      <p className="text-body-m text-muted-foreground mb-4">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
