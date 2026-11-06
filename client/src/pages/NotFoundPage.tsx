import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section>
      <h1 className="h3">Page not found</h1>
      <Link to="/">Go to the start page</Link>
    </section>
  );
}
