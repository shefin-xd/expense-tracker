import { Component, type ReactNode } from 'react';
import { Button } from './ui/Button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="grid min-h-dvh place-items-center px-6 text-center">
        <div><h1 className="text-lg font-semibold">Something broke on this page</h1><p className="mx-auto mt-2 max-w-sm text-sm text-muted">Your records are safe. Reload to try again.</p><div className="mt-5 flex justify-center"><Button onClick={() => window.location.reload()}>Reload</Button></div></div>
      </div>
    );
  }
}
