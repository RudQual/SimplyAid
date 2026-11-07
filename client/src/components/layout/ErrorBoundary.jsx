import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/** Catches render errors in a page so one broken view doesn't blank the whole app. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-content">
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon tone-red"><AlertTriangle size={24} /></div>
            <h3>This page failed to load</h3>
            <p>{this.state.error.message}</p>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}><RefreshCw size={15} /> Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
