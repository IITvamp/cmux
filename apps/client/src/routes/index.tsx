import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => {
    const teamSlugOrId =
      typeof window !== 'undefined'
        ? window.location.pathname.split('/')[1] || 'default'
        : 'default';
    return <Navigate to="/$teamSlugOrId/dashboard" params={{ teamSlugOrId }} />
  },
})
