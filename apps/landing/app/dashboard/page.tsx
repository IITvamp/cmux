import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ClientIcon } from '@/components/client-icon'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
        <p className="text-neutral-400 mb-8">
          This would redirect to the main cmux app dashboard.
        </p>
        <Button asChild variant="outline" className="border-neutral-800 text-white hover:bg-neutral-900">
          <Link href="/">
            <ClientIcon icon={ArrowLeft} className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Landing Page
          </Link>
        </Button>
      </div>
    </div>
  )
}