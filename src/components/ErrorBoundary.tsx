import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Shown in the fallback so the user knows which panel failed. */
  label?: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Contains a render error to one panel instead of blanking the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("panel crashed", this.props.label, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel panel-error">
          <h3>⚠ {this.props.label ?? "Panel"} — error</h3>
          <pre>{String(this.state.error?.stack || this.state.error)}</pre>
          <button onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
