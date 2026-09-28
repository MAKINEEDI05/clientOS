import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ClientWorkspace } from './pages/ClientWorkspace';
import { AIWorkspace } from './pages/AIWorkspace';
import { MemoryTimeline } from './pages/MemoryTimeline';
import { EmptyState } from './components/States';

function NotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <EmptyState
        icon="compass"
        title="Page not found"
        description="This address does not match a client or a screen in ClientOS."
        action={<Link to="/" className="btn-secondary">Back to clients</Link>}
      />
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
