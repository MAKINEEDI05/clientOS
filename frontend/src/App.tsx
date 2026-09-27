import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ClientWorkspace } from './pages/ClientWorkspace';
import { AIWorkspace } from './pages/AIWorkspace';
import { MemoryTimeline } from './pages/MemoryTimeline';

function NotFound() {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="font-display text-lg text-ink">Page not found</p>
      <Link to="/" className="btn-secondary mt-4">Back to clients</Link>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'clients/:clientId', element: <ClientWorkspace /> },
      { path: 'clients/:clientId/ai', element: <AIWorkspace /> },
      { path: 'clients/:clientId/memory', element: <MemoryTimeline /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
