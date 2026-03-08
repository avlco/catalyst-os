import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { I18nProvider, useTranslation } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from '@/Layout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import Business from '@/pages/Business';
import BusinessDetail from '@/pages/BusinessDetail';
import Content from '@/pages/Content';
import Analytics from '@/pages/Analytics';
import SettingsPage from '@/pages/SettingsPage';
import Login from '@/pages/Login';

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-8">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <p className="text-xl text-foreground mb-2">{t('notFound.title')}</p>
      <p className="text-muted-foreground mb-6">{t('notFound.description')}</p>
      <Link
        to="/"
        className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        {t('notFound.backToDashboard')}
      </Link>
    </div>
  );
}

function ErrorFallback({ error, onReset }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-8">
      <h1 className="text-4xl font-bold text-destructive mb-4">{t('errorFallback.title')}</h1>
      <p className="text-muted-foreground mb-2">{t('errorFallback.description')}</p>
      {error?.message && (
        <pre className="text-sm text-muted-foreground bg-muted p-3 rounded-md mb-4 max-w-lg overflow-auto">
          {error.message}
        </pre>
      )}
      <button
        onClick={onReset}
        className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        {t('errorFallback.tryAgain')}
      </button>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} onReset={() => this.setState({ hasError: false, error: null })} />;
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="business" element={<Business />} />
        <Route path="business/:id" element={<BusinessDetail />} />
        <Route path="content" element={<Content />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ErrorBoundary>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toaster
                position="bottom-right"
                richColors
                closeButton
                toastOptions={{
                  className: 'bg-card text-foreground border border-border',
                }}
              />
            </BrowserRouter>
          </AuthProvider>
        </ErrorBoundary>
      </I18nProvider>
    </QueryClientProvider>
  );
}
