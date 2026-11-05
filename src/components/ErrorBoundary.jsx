import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-red-400 text-[32px]">error</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Something went wrong</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center mb-6 max-w-xs">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/home'; }}
            className="px-8 py-3 rounded-full bg-primary text-background font-body-md text-body-md font-semibold press-feedback"
          >
            Go Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
