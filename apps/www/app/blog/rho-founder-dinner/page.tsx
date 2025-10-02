import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Rho Founder Dinner x Builders and Bytes in the Barrel Room",
  description:
    "An evening of connection, collaboration, and conversation at an exclusive underground dinner with founders building the future.",
};

export default function RhoFounderDinnerPost() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mb-6 bg-neutral-950/80 backdrop-blur top-0 z-40 border-b border-neutral-900">
        <div className="container max-w-5xl mx-auto px-2 sm:px-3 py-2.5">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>
        </div>
      </header>

      <article className="container max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <header className="mb-12">
          <time
            className="text-sm text-neutral-500 mb-4 block"
            dateTime="2025-10-02"
          >
            October 2, 2025
          </time>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            Rho Founder Dinner x Builders and Bytes in the Barrel Room
          </h1>
          <p className="text-xl text-neutral-400 leading-relaxed">
            An evening of connection, collaboration, and conversation at an
            exclusive underground dinner with founders building the future.
          </p>
        </header>

        <div className="prose prose-invert prose-neutral max-w-none">
          <div className="space-y-6 text-neutral-300 leading-relaxed">
            <p>
              Last night, I had the privilege of attending the{" "}
              <strong className="text-white">
                Rho Founder Dinner x Builders and Bytes
              </strong>{" "}
              in the Barrel Room—a private underground dinner that brought
              together some of the most ambitious founders working on
              infrastructure, fintech, and AI.
            </p>

            <p>
              The setting itself was unforgettable: an intimate underground
              space with exposed brick, candlelight, and the kind of atmosphere
              that makes authentic conversation inevitable. No stages, no
              pitches—just founders sharing what they&apos;re building and why
              it matters.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-10 mb-4">
              The Conversations
            </h2>

            <p>
              What struck me most was the caliber of builders in the room.
              Everyone was working on hard problems—payments infrastructure,
              developer tools, AI agents—and the discussions reflected that.
            </p>

            <p>
              One particularly fascinating conversation centered on how{" "}
              <strong className="text-white">
                two founders at the dinner are working directly with the
                Guernsey government
              </strong>{" "}
              to build financial infrastructure. They&apos;re navigating the
              complex intersection of regulatory compliance, modern fintech, and
              government partnership—turning what&apos;s traditionally a slow,
              bureaucratic process into something agile and forward-thinking.
            </p>

            <p>
              Hearing about their experience working with Guernsey was eye-opening.
              It&apos;s not often you meet founders who are simultaneously
              building cutting-edge tech and collaborating with government
              entities to shape policy and infrastructure. The work they&apos;re
              doing has implications far beyond their own products—they&apos;re
              helping define how modern financial systems can integrate with
              regulatory frameworks that were designed for a different era.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-10 mb-4">
              Why These Dinners Matter
            </h2>

            <p>
              In a world of endless Zoom calls and asynchronous Slack threads,
              there&apos;s something irreplaceable about sitting across the
              table from someone who&apos;s solving a problem adjacent to yours.
            </p>

            <p>
              The Rho Founder Dinner reminded me why in-person gatherings
              still matter. The spontaneous connections, the serendipitous
              introductions, the late-night debates about product strategy—these
              things don&apos;t happen on Twitter or LinkedIn.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-10 mb-4">
              Gratitude
            </h2>

            <p>
              Thank you to{" "}
              <strong className="text-white">
                Rho and Builders and Bytes
              </strong>{" "}
              for organizing this. Thank you to the founders who showed up,
              shared openly, and made the evening what it was.
            </p>

            <p>
              If you&apos;re building something hard and you get the chance to
              attend one of these dinners, go. The people you meet and the
              conversations you have might just change the trajectory of what
              you&apos;re building.
            </p>
          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-neutral-800">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>
        </footer>
      </article>
    </div>
  );
}
