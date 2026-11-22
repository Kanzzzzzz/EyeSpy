import { Component, type ReactNode } from 'react';

/**
 * Catches a crash in one screen so the app never goes blank. Shows a way back
 * home and keeps the error in the console for debugging.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('Screen crashed', error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="title-outline font-display text-4xl uppercase text-paper">Something broke</h2>
        <p className="max-w-xs font-semibold text-paper-dim">That screen hit an error. You can carry on from the start.</p>
        <button
          type="button"
          className="min-h-[52px] border-[3px] border-black bg-spot px-6 font-display text-xl uppercase text-ink-950"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
