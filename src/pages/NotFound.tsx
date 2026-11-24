import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1>Page not found</h1>
      <Link to="/" className="btn-secondary">
        Back to Today
      </Link>
    </div>
  );
}
