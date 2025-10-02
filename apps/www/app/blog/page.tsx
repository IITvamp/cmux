import Link from "next/link";
import CmuxLogo from "@/components/logo/cmux-logo";

type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
};

const posts: BlogPost[] = [
  {
    slug: "rho-founder-dinner",
    title: "Rho Founder Dinner x Builders and Bytes in the Barrel Room",
    description:
      "An evening of connection, collaboration, and conversation at an exclusive underground dinner with founders building the future.",
    date: "October 2, 2025",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mb-6 bg-neutral-950/80 backdrop-blur top-0 z-40 border-b border-neutral-900">
        <div className="container max-w-5xl mx-auto px-2 sm:px-3 py-2.5">
          <div className="grid w-full grid-cols-[auto_1fr] grid-rows-1 items-center gap-2">
            <Link
              aria-label="Go to homepage"
              className="col-start-1 col-end-2 inline-flex items-center"
              href="/"
            >
              <CmuxLogo height={40} label="cmux" showWordmark />
            </Link>
            <div className="col-start-2 col-end-3 flex items-center justify-end gap-2 sm:gap-3">
              <nav aria-label="Main" className="hidden md:flex items-center">
                <ul className="flex flex-wrap items-center gap-x-2">
                  <li>
                    <a
                      className="font-semibold text-white hover:text-blue-400 transition"
                      href="/"
                    >
                      Home
                    </a>
                  </li>
                  <li className="text-neutral-700 px-1" role="presentation">
                    |
                  </li>
                  <li>
                    <a
                      className="font-semibold text-blue-400"
                      href="/blog"
                    >
                      Blog
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-neutral-400">
            Thoughts on building tools for the future of software development.
          </p>
        </div>

        <div className="space-y-8">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
            >
              <Link href={`/blog/${post.slug}`}>
                <time className="text-sm text-neutral-500 block mb-2">
                  {post.date}
                </time>
                <h2 className="text-2xl font-semibold mb-3 text-white hover:text-blue-400 transition-colors">
                  {post.title}
                </h2>
                <p className="text-neutral-400 leading-relaxed">
                  {post.description}
                </p>
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
