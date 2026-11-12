import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">The page you are looking for does not exist or has moved.</p>
      <div className="mt-6 flex justify-center"><Link to="/"><Button>Back to dashboard</Button></Link></div>
    </div>
  );
}
