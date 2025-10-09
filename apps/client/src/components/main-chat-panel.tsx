export function MainChatPanel() {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-neutral-500 dark:text-neutral-400 text-sm text-center py-8">
            Chat panel - coming soon
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-4">
        <div className="max-w-3xl mx-auto">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
          />
        </div>
      </div>
    </div>
  );
}
