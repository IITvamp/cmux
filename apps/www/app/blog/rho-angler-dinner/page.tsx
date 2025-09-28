import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'An Evening at Angler: Rho-Sponsored Dinner and New Connections',
  description: 'Reflecting on an incredible evening at Angler, sponsored by Rho, where great food met fascinating conversations.',
}

export default function RhoAnglerDinnerPost() {
  return (
    <article className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12">
        <time className="text-sm text-neutral-500 dark:text-neutral-400">
          September 2024
        </time>
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
          An Evening at Angler: Rho-Sponsored Dinner and New Connections
        </h1>
        <p className="text-xl text-neutral-600 dark:text-neutral-300 mt-4">
          Sometimes the best evenings are the ones where great food meets fascinating conversations.
        </p>
      </header>

      <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none">
        <p>
          Last week, I had the privilege of attending a dinner at Angler, generously sponsored by
          <a href="https://rho.com" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer"> Rho</a>.
          What started as an evening out turned into something much more meaningful—a chance to connect with
          some truly remarkable people who are building the future of technology and finance.
        </p>

        <h2>The Setting</h2>
        <p>
          Angler, with its stunning San Francisco Bay views and innovative cuisine, provided the perfect
          backdrop for an evening of connection and conversation. There's something about sharing a meal
          that breaks down barriers and creates space for authentic dialogue—something that was evident
          from the moment we sat down.
        </p>

        <h2>New Faces, Fresh Perspectives</h2>
        <p>
          One of the highlights of the evening was meeting several new people who brought unique perspectives
          to our conversations. From founders working on cutting-edge fintech solutions to engineers solving
          complex infrastructure challenges, the diversity of backgrounds and experiences around the table
          was both inspiring and energizing.
        </p>

        <p>
          What struck me most was how quickly the conversation moved beyond the usual startup small talk.
          We dove deep into topics ranging from the future of developer tooling to the challenges of
          building in regulated industries. It's rare to find a group where you can seamlessly transition
          from discussing the latest advances in AI tooling to debating the nuances of financial compliance—
          all while enjoying exceptional food.
        </p>

        <h2>The Rho Connection</h2>
        <p>
          Rho's sponsorship of the evening wasn't just about providing a great meal (though the food was
          incredible). It reflected their commitment to fostering genuine connections within the tech and
          finance communities. As a company building modern banking infrastructure for businesses, they
          understand that the best solutions emerge from collaborative thinking and diverse perspectives.
        </p>

        <p>
          What I appreciate about Rho is their approach to community building—it's not performative or
          transactional, but rather focused on bringing together people who are genuinely passionate about
          solving hard problems. This dinner was a perfect example of that philosophy in action.
        </p>

        <h2>Lasting Impressions</h2>
        <p>
          As the evening wound down and we stepped out into the cool San Francisco night, I couldn't help
          but reflect on how these kinds of connections are what make the tech community special. Sure,
          we all get caught up in our day-to-day building, but events like this remind us that we're part
          of something larger—a community of people who believe technology can make the world better.
        </p>

        <p>
          I left the dinner with new contacts in my phone, fresh ideas buzzing in my head, and a renewed
          appreciation for the power of bringing thoughtful people together over good food. Sometimes the
          most valuable insights come not from a Slack channel or a GitHub issue, but from a conversation
          over dinner with someone whose work you'd never encountered before.
        </p>

        <p>
          Thanks to Rho for sponsoring such a wonderful evening, and to all the new friends I made—looking
          forward to continuing our conversations and seeing what we build together.
        </p>
      </div>
    </article>
  )
}