import { Navigate, useLocation } from 'react-router-dom';

export default function RootRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/en/${search}`} replace />;
}
